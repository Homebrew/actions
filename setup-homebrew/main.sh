#!/bin/bash

set -euo pipefail

TEST_BOT="${1}"

# Clone Homebrew/brew and Homebrew/linuxbrew-core if necessary.
if ! which brew &>/dev/null; then
    HOMEBREW_PREFIX=/home/linuxbrew/.linuxbrew
    HOMEBREW_REPOSITORY="$HOMEBREW_PREFIX/Homebrew"
    sudo mkdir -p "$HOMEBREW_PREFIX"
    sudo git clone --depth=1 https://github.com/Homebrew/brew "$HOMEBREW_REPOSITORY"

    HOMEBREW_CORE_REPOSITORY="$HOMEBREW_REPOSITORY/Library/Taps/homebrew/homebrew-core"
    sudo mkdir -p "$HOMEBREW_CORE_REPOSITORY"
    sudo rm -rf "$HOMEBREW_CORE_REPOSITORY"
    sudo git clone --depth=1 https://github.com/Homebrew/linuxbrew-core "$HOMEBREW_CORE_REPOSITORY"

    cd "$HOMEBREW_PREFIX"
    sudo mkdir -p bin etc include lib opt sbin share var/homebrew/linked Cellar
    sudo ln -vs ../Homebrew/bin/brew "$HOMEBREW_PREFIX/bin/"
    cd -

    export PATH="$HOMEBREW_PREFIX/bin:$PATH"
else
    HOMEBREW_PREFIX="$(brew --prefix)"
    HOMEBREW_REPOSITORY="$(brew --repo)"
    HOMEBREW_CORE_REPOSITORY="$HOMEBREW_REPOSITORY/Library/Taps/homebrew/homebrew-core"
fi

HOMEBREW_CASK_REPOSITORY="$HOMEBREW_REPOSITORY/Library/Taps/homebrew/homebrew-cask"

echo "::add-path::$HOMEBREW_PREFIX/bin"

# Setup Homebrew/brew
if [[ "$GITHUB_REPOSITORY" =~ ^.+/brew$ ]]; then
    cd "$HOMEBREW_REPOSITORY"
    rm -rf "$GITHUB_WORKSPACE"
    if [[ -n "${GITHUB_ACTIONS_HOMEBREW_SELF_HOSTED-}" ]]; then
        mkdir -vp "$GITHUB_WORKSPACE"
    else
        ln -vs "$HOMEBREW_REPOSITORY" "$GITHUB_WORKSPACE"
    fi
    git remote set-url origin "https://github.com/$GITHUB_REPOSITORY"
    git fetch --tags origin "$GITHUB_SHA"
    git checkout --force -B master FETCH_HEAD
    cd -
else
    brew update-reset "$HOMEBREW_REPOSITORY"
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
    if [[ -n "${GITHUB_ACTIONS_HOMEBREW_SELF_HOSTED-}" ]]; then
        mkdir -vp "$GITHUB_WORKSPACE"
    else
        ln -vs "$HOMEBREW_CORE_REPOSITORY" "$GITHUB_WORKSPACE"
    fi
    git remote set-url origin "https://github.com/$GITHUB_REPOSITORY"
    git fetch origin "$GITHUB_SHA"
    git checkout --force -B master FETCH_HEAD
    cd -
else
    if [[ "$GITHUB_REPOSITORY" =~ ^.+/homebrew-.+$ ]]; then
        if [[ -n "${GITHUB_ACTIONS_HOMEBREW_SELF_HOSTED-}" ]]; then
            echo "Self-hosted runners not supported for this tap!"
            exit 1
        fi

        if [[ "$GITHUB_REPOSITORY" =~ ^.+/homebrew-cask-.+$ ]]; then
            if [[ -d "${HOMEBREW_CASK_REPOSITORY}" ]]; then
                brew update-reset "${HOMEBREW_CASK_REPOSITORY}"
            else
                brew tap homebrew/cask
            fi
        fi

        HOMEBREW_TAP_REPOSITORY="$(brew --repo "$GITHUB_REPOSITORY")"
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
        git fetch origin "$GITHUB_SHA"
        git checkout --force -B master FETCH_HEAD
        cd -
    fi

    brew update-reset "$HOMEBREW_CORE_REPOSITORY"
fi

if [[ "${TEST_BOT}" == 'true' ]]; then
    # Setup Homebrew/homebrew-test-bot
    HOMEBREW_TEST_BOT_REPOSITORY="$HOMEBREW_REPOSITORY/Library/Taps/homebrew/homebrew-test-bot"
    if ! [[ -d "$HOMEBREW_TEST_BOT_REPOSITORY" ]]; then
        git clone --depth=1 https://github.com/Homebrew/homebrew-test-bot "$HOMEBREW_TEST_BOT_REPOSITORY"
    elif [[ "$GITHUB_REPOSITORY" != "Homebrew/homebrew-test-bot" ]]; then
        brew update-reset "$HOMEBREW_TEST_BOT_REPOSITORY"
    fi
fi

# Setup Linux permissions
if [[ "$RUNNER_OS" = "Linux" ]]; then
    sudo chown -R "$(whoami)" "$HOMEBREW_PREFIX"
    sudo chmod -R g-w,o-w /home/linuxbrew $HOME /opt
fi
