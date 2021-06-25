#!/bin/bash

set -euo pipefail

TEST_BOT="${1}"
DEBUG="${2}"

if [[ "${DEBUG}" == 'true' ]]; then
  set -x
fi

MAX_GIT_RETRIES=5

function git_retry {
  local try=0

  until git "$@"; do
    exit_code="$?"
    try=$(($try + 1))

    if [ $try -lt $MAX_GIT_RETRIES ]; then
      sleep $((2 ** $try))
    else
      return $exit_code
    fi
  done

  return 0
}

# Check brew's existence
if ! which brew &>/dev/null; then
    echo "Could not find 'brew' command in PATH."
    exit 1
fi

# Set basic variables
HOMEBREW_PREFIX="$(brew --prefix)"
HOMEBREW_REPOSITORY="$(brew --repo)"
HOMEBREW_CORE_REPOSITORY="$HOMEBREW_REPOSITORY/Library/Taps/homebrew/homebrew-core"
HOMEBREW_CASK_REPOSITORY="$HOMEBREW_REPOSITORY/Library/Taps/homebrew/homebrew-cask"

# Do in container or on the runner
if grep -q actions_job /proc/1/cgroup; then
    # Fix permissions to give normal user access
    sudo chown -R "$(whoami)" "$HOME" "$PWD/.."
else
    # Add brew to PATH
    echo "$HOMEBREW_PREFIX/bin" >> $GITHUB_PATH
fi

# Setup Homebrew/brew
if [[ "$GITHUB_REPOSITORY" =~ ^.+/brew$ ]]; then
    cd "$HOMEBREW_REPOSITORY"
    rm -rf "$GITHUB_WORKSPACE"
    if [[ -n "${GITHUB_ACTIONS_HOMEBREW_MACOS_SELF_HOSTED-}" ]]; then
        mkdir -vp "$GITHUB_WORKSPACE"
    else
        ln -vs "$HOMEBREW_REPOSITORY" "$GITHUB_WORKSPACE"
    fi
    git remote set-url origin "https://github.com/$GITHUB_REPOSITORY"
    git_retry fetch --tags origin "$GITHUB_SHA" '+refs/heads/*:refs/remotes/origin/*'
    git remote set-head origin --auto
    git checkout --force -B master FETCH_HEAD
    cd -
else
    git_retry -C "$HOMEBREW_REPOSITORY" fetch --force origin
    git -C "$HOMEBREW_REPOSITORY" checkout --force -B master origin/HEAD
fi

# Setup Homebrew Bundler RubyGems cache
GEMS_PATH="$HOMEBREW_REPOSITORY/Library/Homebrew/vendor/bundle/ruby/"
GEMS_HASH="$(shasum -a 256 "$HOMEBREW_REPOSITORY/Library/Homebrew/Gemfile.lock" | cut -f1 -d' ')"

echo "::set-output name=gems-path::$GEMS_PATH"
echo "::set-output name=gems-hash::$GEMS_HASH"

# Setup Homebrew/(home|linux)brew-core tap
if [[ "$GITHUB_REPOSITORY" =~ ^.+/(home|linux)brew-core$ ]]; then
    cd "$HOMEBREW_CORE_REPOSITORY"
    rm -rf "$GITHUB_WORKSPACE"
    if [[ -n "${GITHUB_ACTIONS_HOMEBREW_MACOS_SELF_HOSTED-}" ]]; then
        mkdir -vp "$GITHUB_WORKSPACE"
    else
        ln -vs "$HOMEBREW_CORE_REPOSITORY" "$GITHUB_WORKSPACE"
    fi
    git remote set-url origin "https://github.com/$GITHUB_REPOSITORY"
    git_retry fetch origin "$GITHUB_SHA" '+refs/heads/*:refs/remotes/origin/*'
    git remote set-head origin --auto
    git checkout --force -B master FETCH_HEAD
    cd -
# Setup all other taps
else
    if [[ "$GITHUB_REPOSITORY" =~ ^.+/homebrew-.+$ ]]; then
        if [[ -n "${GITHUB_ACTIONS_HOMEBREW_MACOS_SELF_HOSTED-}" ]]; then
            echo "macOS self-hosted runners not supported for this tap!"
            exit 1
        fi

        HOMEBREW_TAP_REPOSITORY="$(brew --repo "$GITHUB_REPOSITORY")"

        if [[ "$GITHUB_REPOSITORY" =~ ^.+/homebrew-cask(-.+)*$ ]]; then
            # Tap or update homebrew/cask for other cask repos.
            if [[ "${HOMEBREW_TAP_REPOSITORY}" != "${HOMEBREW_CASK_REPOSITORY}" ]] && [[ -d "${HOMEBREW_CASK_REPOSITORY}" ]]; then
                git_retry -C "$HOMEBREW_CASK_REPOSITORY" fetch --force origin
                git -C "$HOMEBREW_CASK_REPOSITORY" remote set-head origin --auto
                git -C "$HOMEBREW_CASK_REPOSITORY" checkout --force -B master origin/HEAD
            elif ! [[ -d "${HOMEBREW_CASK_REPOSITORY}" ]]; then
                git_retry clone https://github.com/Homebrew/homebrew-cask "${HOMEBREW_CASK_REPOSITORY}"
            fi

            for cask_repo in \
                "${HOMEBREW_REPOSITORY}/Library/Taps/homebrew/homebrew-cask-drivers" \
                "${HOMEBREW_REPOSITORY}/Library/Taps/homebrew/homebrew-cask-fonts" \
                "${HOMEBREW_REPOSITORY}/Library/Taps/homebrew/homebrew-cask-versions"
            do
                if [[ "${HOMEBREW_TAP_REPOSITORY}" != "${cask_repo}" ]] && [[ -d "${cask_repo}" ]]; then
                    git_retry -C "${cask_repo}" fetch --force origin
                    git -C "${cask_repo}" remote set-head origin --auto
                    git -C "${cask_repo}" checkout --force -B master origin/HEAD
                fi
            done
        fi

        if [[ -d "$HOMEBREW_TAP_REPOSITORY" ]]; then
            cd "$HOMEBREW_TAP_REPOSITORY"
            git remote set-url origin "https://github.com/$GITHUB_REPOSITORY"
        else
            mkdir -vp "$HOMEBREW_TAP_REPOSITORY"
            cd "$HOMEBREW_TAP_REPOSITORY"
            git init
            git remote add origin "https://github.com/$GITHUB_REPOSITORY"
        fi
        rm -rf "$GITHUB_WORKSPACE"
        ln -vs "$HOMEBREW_TAP_REPOSITORY" "$GITHUB_WORKSPACE"
        git_retry fetch origin "$GITHUB_SHA" '+refs/heads/*:refs/remotes/origin/*'
        git remote set-head origin --auto
        head="$(git symbolic-ref refs/remotes/origin/HEAD)"
        head="${head#refs/remotes/origin/}"
        git checkout --force -B "$head" FETCH_HEAD
        cd -
    fi

    git_retry -C "$HOMEBREW_CORE_REPOSITORY" fetch --force origin
    git -C "$HOMEBREW_CORE_REPOSITORY" remote set-head origin --auto
    git -C "$HOMEBREW_CORE_REPOSITORY" checkout --force -B master origin/HEAD
fi

if [[ "${TEST_BOT}" == 'true' ]]; then
    # Setup Homebrew/homebrew-test-bot
    HOMEBREW_TEST_BOT_REPOSITORY="$HOMEBREW_REPOSITORY/Library/Taps/homebrew/homebrew-test-bot"
    if ! [[ -d "$HOMEBREW_TEST_BOT_REPOSITORY" ]]; then
        git_retry clone https://github.com/Homebrew/homebrew-test-bot "$HOMEBREW_TEST_BOT_REPOSITORY"
    elif [[ "$GITHUB_REPOSITORY" != "Homebrew/homebrew-test-bot" ]]; then
        git_retry -C "$HOMEBREW_TEST_BOT_REPOSITORY" fetch --force origin
        git -C "$HOMEBREW_TEST_BOT_REPOSITORY" remote set-head origin --auto
        git -C "$HOMEBREW_TEST_BOT_REPOSITORY" checkout --force -B master origin/HEAD
    fi
fi

# Setup Linux permissions
if [[ "$RUNNER_OS" = "Linux" ]]; then
    sudo chown -R "$(whoami)" "$HOMEBREW_PREFIX"
    sudo chmod -R g-w,o-w /home/linuxbrew $HOME /opt

    # Workaround: Remove fontconfig incompatible fonts provided by the poppler
    # installation in GitHub Actions image
    sudo rm -rf /usr/share/fonts/cmap
fi
