# typed: strict
# frozen_string_literal: true

require "date"
require "English"
require "fileutils"
require "json"
require "open3"
require "pathname"
require "securerandom"

# The RemoveDisabledPackages class finds packages that have been disabled over the limit set in Homebrew/brew
# and creates commits in the local repository to remove them. Packages disabled over the limit on only some
# platforms are kept and reported instead, as removing just those platforms needs a manual edit.
class RemoveDisabledPackages
  Package = Struct.new(:name, :type, :path, :disable_dates, keyword_init: true)

  # Keep in sync with DeprecateDisable::REMOVE_DISABLED_TIME_WINDOW in
  # Homebrew/brew/Library/Homebrew/deprecate_disable.rb.
  REMOVE_DISABLED_MONTHS = 12

  def initialize(repository)
    @repository = repository
    @target_tap = tap_name(repository)
    @tap_dir = Pathname(capture("brew", "--repository", repository).strip)
    @cutoff = Date.today << REMOVE_DISABLED_MONTHS
  end

  def run
    packages_to_remove, partially_disabled = find_disabled

    report_partially_disabled(partially_disabled)

    puts "Removing old packages..."

    packages_to_remove.each { |package| FileUtils.rm package.path }

    out = capture("git", "-C", @tap_dir.to_s, "status", "--porcelain", "--ignore-submodules=dirty")

    if out.chomp.empty?
      puts "No packages removed."
      write_output("packages-removed", "false")
      return
    end

    git "-C", @tap_dir.to_s, "add", "--all"

    packages_to_remove.each do |package|
      puts "Removed `#{package.name}`."
      git "-C", @tap_dir.to_s, "commit", relative_path(package), "--message",
          "#{package.name}: remove #{package.type}", "--quiet"
    end

    write_output("packages-removed", "true")
  end

  private

  def capture(*command)
    stdout, stderr, status = Open3.capture3(*command)
    # Open3 tags output with the default external encoding, which is US-ASCII under
    # the C locale used in CI. Both brew and git emit UTF-8.
    stdout.force_encoding(Encoding::UTF_8)
    stderr.force_encoding(Encoding::UTF_8)
    raise "#{command.join(" ")} failed: #{stderr}" unless status.success?

    stdout
  end

  def git(*args)
    system "git", *args
    exit $CHILD_STATUS.exitstatus unless $CHILD_STATUS.success?
  end

  def find_disabled
    puts "Finding disabled packages..."

    removable = []
    partially_disabled = []

    package_data.each do |type, package|
      next if package["tap"]&.downcase != @target_tap

      expired, unexpired = platform_states(package).partition { |state| expired?(state) }
      next if expired.empty?

      name_key = (type == "formula") ? "name" : "token"
      disable_dates = expired.map { |state| state["disable_date"] }.uniq.sort
      (unexpired.empty? ? removable : partially_disabled) <<
        Package.new(name: package.fetch(name_key), type:, path: sourcefile_path(package), disable_dates:)
    end

    [removable, partially_disabled]
  end

  # `variations` only lists the platforms whose values differ from the platform brew ran on.
  # Casks also list the platforms they support; formulae are treated as supporting all of them.
  def platform_states(package)
    current = package.slice("disabled", "disable_date")
    variations = (package["variations"] || {}).transform_values do |variation|
      current.merge(variation.slice("disabled", "disable_date"))
    end

    supported_platforms = package["supported_platforms"] || []
    return [current, *variations.values] if supported_platforms.empty?

    supported_platforms.map { |platform| variations.fetch(platform, current) }
  end

  def expired?(state)
    return false unless state["disabled"]
    return false unless (disable_date = state["disable_date"])

    Date.iso8601(disable_date) < @cutoff
  end

  def package_data
    { "formula" => ["Formula", "formulae"], "cask" => ["Casks", "casks"] }.flat_map do |type, (directory, key)|
      names = names_calling_disable(@tap_dir/directory)
      next [] if names.empty?

      JSON.parse(capture("brew", "info", "--json=v2", "--variations", "--#{type}", *names))
          .fetch(key)
          .map { |package| [type, package] }
    end
  end

  # Evaluating variations is slow, so only ask brew about packages that could be disabled.
  def names_calling_disable(directory)
    return [] unless directory.directory?

    directory.glob("**/*.rb")
             .select { |path| path.binread.include?("disable!") }
             .map { |path| "#{@target_tap}/#{path.basename(".rb")}" }
             .sort
  end

  def report_partially_disabled(packages)
    report = packages.map do |package|
      path = relative_path(package)
      url = "#{ENV.fetch("GITHUB_SERVER_URL", "https://github.com")}/#{@repository}/blob/HEAD/#{path}"
      "- `#{package.name}` (#{package.type}, disabled #{package.disable_dates.join(", ")}): [#{path}](#{url})"
    end.join("\n")

    write_output("partially-disabled-packages", report)
    return if report.empty?

    puts "Disabled on only some platforms, so not removed:", report
    return unless (summary = ENV.fetch("GITHUB_STEP_SUMMARY", nil))

    File.write(summary, "### Partially disabled packages\n\n#{report}\n", mode: "a")
  end

  def relative_path(package)
    package.path.relative_path_from(@tap_dir).to_s
  end

  def sourcefile_path(package)
    package_name = package["name"] || package["token"] || "Package"
    relative_path = package["ruby_source_path"]
    raise "#{package_name} has no ruby_source_path" unless relative_path.is_a?(String)
    raise "#{package_name} has no ruby_source_path" if relative_path.empty?

    relative_path = Pathname(relative_path)
    path = @tap_dir.join(relative_path).cleanpath
    unless path.to_s.start_with?("#{@tap_dir}/")
      raise "Package source path is outside #{@tap_dir}: #{relative_path}"
    end

    path
  end

  def tap_name(repository)
    owner, name = repository.split("/", 2)
    raise "Invalid GitHub repository: #{repository}" if name.nil?

    "#{owner.downcase}/#{name.downcase.delete_prefix("homebrew-")}"
  end

  def write_output(name, value)
    delimiter = "ghadelimiter_#{SecureRandom.uuid}"
    File.open(ENV.fetch("GITHUB_OUTPUT"), "a") do |file|
      file.puts "#{name}<<#{delimiter}", value, delimiter
    end
  end
end

RemoveDisabledPackages.new(ENV.fetch("GITHUB_REPOSITORY")).run
