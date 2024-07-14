# typed: true
# frozen_string_literal: true

require "formula"
require "cask"
require "deprecate_disable"

# The RemoveDisabledPackages class finds packages that have been disabled over the limit set in Homebrew/brew
# and creates commits in the local repository to remove them.
class RemoveDisabledPackages
  def initialize(target_tap)
    @target_tap = target_tap
  end

  def run
    packages_to_remove = find_disabled(packages: Formula.all + Cask::Cask.all)

    puts "Removing old packages..."

    packages_to_remove.each { |package| FileUtils.rm sourcefile_path(package) }

    tap_dir = @target_tap.path

    out, err, status = Open3.capture3 "git", "-C", tap_dir.to_s, "status", "--porcelain", "--ignore-submodules=dirty"
    raise err unless status.success?

    if out.chomp.empty?
      puts "No packages removed."
      File.open(ENV.fetch("GITHUB_OUTPUT", nil), "a") { |f| f.puts("packages-removed=false") }
      exit
    end

    git "-C", tap_dir.to_s, "add", "--all"

    packages_to_remove.each do |package|
      name = package.is_a?(Formula) ? package.name : package.token
      puts "Removed `#{name}`."
      git "-C", tap_dir.to_s, "commit", sourcefile_path(package), "--message",
          "#{name}: remove #{package.is_a?(Formula) ? "formula" : "cask"}", "--quiet"
    end

    File.open(ENV.fetch("GITHUB_OUTPUT", nil), "a") { |f| f.puts("packages-removed=true") }
  end

  private

  def git(*args)
    system "git", *args
    exit $CHILD_STATUS.exitstatus unless $CHILD_STATUS.success?
  end

  def find_disabled(packages: [])
    puts "Finding disabled packages..."
    packages.select do |package|
      next false if package.tap != @target_tap
      next false unless package.disabled?
      next false if package.disable_date.nil?

      package.disable_date < DeprecateDisable::REMOVE_DISABLED_BEFORE
    end
  end

  def sourcefile_path(package)
    package.is_a?(Formula) ? package.path : package.sourcefile_path
  end
end

target_tap = Tap.fetch(ENV.fetch("GITHUB_REPOSITORY"))
RemoveDisabledPackages.new(target_tap).run
