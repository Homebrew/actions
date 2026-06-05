# frozen_string_literal: true

require "json"
require "digest"

pkgs = ARGV.uniq
dupes = ARGV.size - pkgs.size
warn "::warning::#{dupes} duplicate package name(s) ignored." if dupes.positive?

pkgs.each do |p|
  abort "::error::Tapped formulae (#{p}) are not supported by version hash lookup. PRs welcome." if p.include?("/")
end

brew_cache = `brew --cache`.chomp
api_cache = "#{brew_cache}/api"

api_candidates = Dir["#{api_cache}/internal/packages.*.jws.json"].sort.map { |path| [path, :internal] }
# TODO: Remove support for the public API cache after Homebrew 6.0.1 has been released.
formula_jws_file = "#{api_cache}/formula.jws.json"
api_candidates << [formula_jws_file, :formula]

lookup = pkgs.to_h { |p| [p, true] }
api_errors = []
formulae = nil
api_candidates.each do |jws_file, api_type|
  jws = JSON.parse(File.read(jws_file, encoding: "UTF-8"))
  payload = JSON.parse(jws.fetch("payload"))
  formulae = if api_type == :internal
    formula_hashes = payload.fetch("formulae")
    raise TypeError, "expected internal API formulae to be an object" unless formula_hashes.is_a?(Hash)

    formula_hashes.each_with_object([]) do |(name, formula), array|
      next unless lookup[name]

      array << {
        "name"           => name,
        "stable_version" => formula["stable_version"],
        "revision"       => formula["revision"],
      }
    end
  else
    raise TypeError, "expected formula API payload to be an array" unless payload.is_a?(Array)

    payload.select { |formula| lookup[formula["name"]] }
  end

  break
rescue Errno::ENOENT, Errno::EACCES, JSON::ParserError, KeyError, TypeError => e
  api_errors << "#{jws_file}: #{e.class}: #{e.message}"
end

unless formulae
  abort <<~EOS
    ::error::Homebrew API cache not found or invalid. Run the setup-homebrew action before this one.
    #{api_errors.join("\n")}
  EOS
end

lines = formulae
        .sort_by { |formula| formula["name"] }
        .map do |formula|
          stable_version = formula["stable_version"] || formula.dig("versions", "stable")
          "#{formula["name"]} #{stable_version} #{formula["revision"]}"
        end

if lines.size != pkgs.size
  abort <<~EOS
    ::error::Version hash covers #{lines.size} of #{pkgs.size} requested packages. Missing entries would cause incorrect cache hits.
    Requested: #{pkgs.join(" ")}
    Found:
    #{lines.join("\n")}
  EOS
end

puts Digest::SHA256.hexdigest("#{lines.join("\n")}\n")
