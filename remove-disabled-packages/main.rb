# typed: strict
# frozen_string_literal: true

require "date"
require "English"
require "fileutils"
require "json"
require "open3"
require "pathname"

# The RemoveDisabledPackages class finds packages that have been disabled over the limit set in Homebrew/brew
# and creates commits in the local repository to remove them.
class RemoveDisabledPackages
  Package = Struct.new(:name, :type, :path, keyword_init: true)

  # Keep in sync with DeprecateDisable::REMOVE_DISABLED_TIME_WINDOW in
  # Homebrew/brew/Library/Homebrew/deprecate_disable.rb.
  REMOVE_DISABLED_MONTHS = 12

  def initialize(repository)
    @repository = repository
    @target_tap = tap_name(repository)
    @tap_dir = Pathname(capture("brew", "--repository", repository).strip)
  end

  def run
    packages_to_remove = find_disabled

    puts "Removing old packages..."

    packages_to_remove.each { |package| FileUtils.rm package.path }

    out = capture("git", "-C", @tap_dir.to_s, "status", "--porcelain", "--ignore-submodules=dirty")

    if out.chomp.empty?
      puts "No packages removed."
      write_output(false)
      return
    end

    git "-C", @tap_dir.to_s, "add", "--all"

    packages_to_remove.each do |package|
      puts "Removed `#{package.name}`."
      relative_path = package.path.relative_path_from(@tap_dir).to_s
      git "-C", @tap_dir.to_s, "commit", relative_path, "--message",
          "#{package.name}: remove #{package.type}", "--quiet"
    end

    write_output(true)
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

    package_data.filter_map do |type, package|
      next if package["tap"]&.downcase != @target_tap
      next unless package["disabled"]
      next unless (disable_date = package["disable_date"])
      next if Date.iso8601(disable_date) >= (Date.today << REMOVE_DISABLED_MONTHS)

      name_key = (type == "formula") ? "name" : "token"
      Package.new(name: package.fetch(name_key), type:, path: sourcefile_path(package))
    end
  end

  def package_data
    packages = []
    if (@tap_dir/"Formula").directory?
      formulae = JSON.parse(capture("brew", "info", "--json=v2", "--formula")).fetch("formulae")
      packages.concat(formulae.map { |formula| ["formula", formula] })
    end
    if (@tap_dir/"Casks").directory?
      casks = JSON.parse(capture("brew", "info", "--json=v2", "--cask")).fetch("casks")
      packages.concat(casks.map { |cask| ["cask", cask] })
    end
    packages
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

  def write_output(packages_removed)
    File.open(ENV.fetch("GITHUB_OUTPUT"), "a") do |file|
      file.puts "packages-removed=#{packages_removed}"
    end
  end
end

RemoveDisabledPackages.new(ENV.fetch("GITHUB_REPOSITORY")).run
