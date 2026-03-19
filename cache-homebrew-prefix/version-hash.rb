# frozen_string_literal: true

require "json"
require "digest"

pkgs = ARGV.uniq

pkgs.each do |p|
  abort "::error::Tapped formulae (#{p}) are not supported by version hash lookup. PRs welcome." if p.include?("/")
end

brew_cache = `brew --cache`.chomp
jws_file = "#{brew_cache}/api/formula.jws.json"

jws = begin
  JSON.parse(File.read(jws_file))
rescue Errno::ENOENT, Errno::EACCES
  abort "::error::Homebrew API cache not found at #{jws_file}. Run the setup-homebrew action before this one."
end

lookup = pkgs.to_h { |p| [p, true] }
lines = JSON.parse(jws["payload"])
            .select { |f| lookup[f["name"]] }
            .sort_by { |f| f["name"] }
            .map { |f| "#{f["name"]} #{f["versions"]["stable"]} #{f["revision"]}" }

if lines.size != pkgs.size
  abort <<~EOS
    ::error::Version hash covers #{lines.size} of #{pkgs.size} requested packages. \
    Missing entries would cause incorrect cache hits.
    Requested: #{pkgs.join(" ")}
    Found:
    #{lines.join("\n")}
  EOS
end

puts Digest::SHA256.hexdigest("#{lines.join("\n")}\n")
