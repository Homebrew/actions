# frozen_string_literal: true

require 'formula'
require 'utils/pypi'

module Homebrew
  module_function

  def print_command(*cmd)
    puts "[command]#{cmd.join(' ').gsub("\n", ' ')}"
  end

  def brew(*args)
    print_command ENV["HOMEBREW_BREW_FILE"], *args
    safe_system ENV["HOMEBREW_BREW_FILE"], *args
  end

  def read_brew(*args)
    print_command ENV["HOMEBREW_BREW_FILE"], *args
    output = `#{ENV["HOMEBREW_BREW_FILE"]} #{args.join(' ')}`.chomp
    odie output if $CHILD_STATUS.exitstatus != 0
    output
  end

  # Get formulae
  formulae = ENV['HOMEBREW_BUMP_FORMULAE']
  formulae = formulae.split(/[ ,\n]/).reject(&:blank?)

  # Define additional message
  message = 'Automated bump'

  # Get livecheck info
  json = read_brew 'livecheck',
                    '--formula',
                    '--quiet',
                    '--newer-only',
                    '--json',
                    *formulae
  json = JSON.parse json

  # Define error
  err = nil

  # Loop over livecheck info
  json.each do |info|
    # Skip if there is no version field
    next unless info['version']

    # Get info about formula
    formula = info['formula']
    version = info['version']['latest']

    # Get stable software spec of the formula
    stable = Formula[formula].stable

    # Check if formula is originating from PyPi
    if PyPI.update_pypi_url(stable.url, version)
      # Install pipgrip utility so resources from PyPi get updated too
      brew 'install', 'pipgrip' unless Formula["pipgrip"].any_version_installed?
    end

    begin
      # Finally bump the formula
      brew 'bump-formula-pr',
            '--no-browse',
            "--message=#{message}",
            "--version=#{version}",
            formula
    rescue ErrorDuringExecution => e
      # Continue execution on error, but save the exeception
      err = e
    end
  end

  # Die if any error occured
  odie err if err
end
