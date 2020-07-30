#!/bin/bash

set -euo pipefail

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
    sudo ln -sf ../Homebrew/bin/brew "$HOMEBREW_PREFIX/bin/"
    cd -

    export PATH="$HOMEBREW_PREFIX/bin:$PATH"
fi

HOMEBREW_PREFIX="$(brew --prefix)"
HOMEBREW_REPOSITORY="$(brew --repo)"
HOMEBREW_CORE_REPOSITORY="$(brew --repo homebrew/core)"
HOMEBREW_TAP_REPOSITORY="$(brew --repo "$GITHUB_REPOSITORY")"

echo "::add-path::$HOMEBREW_PREFIX/bin"

brew update-reset "$HOMEBREW_REPOSITORY" "$HOMEBREW_CORE_REPOSITORY"

GEMS_PATH="$HOMEBREW_REPOSITORY/Library/Homebrew/vendor/bundle/ruby/"
GEMS_HASH="$(shasum -a 256 "$HOMEBREW_REPOSITORY/Library/Homebrew/Gemfile.lock" | cut -f1 -d' ')"

echo "::set-output name=gems-path::$GEMS_PATH"
echo "::set-output name=gems-hash::$GEMS_HASH"

# brew
if [[ "$GITHUB_REPOSITORY" =~ ^.+/brew$ ]]; then
    rm -rf "$GITHUB_WORKSPACE"
    ln -s "$HOMEBREW_REPOSITORY" "$GITHUB_WORKSPACE"
    git fetch --tags origin "$GITHUB_SHA"
    git checkout --force -B master FETCH_HEAD
# core taps
elif [[ "$GITHUB_REPOSITORY" =~ ^.+/(home|linux)brew-core$ ]]; then
    rm -rf "$GITHUB_WORKSPACE"
    ln -s "$HOMEBREW_CORE_REPOSITORY" "$GITHUB_WORKSPACE"
    git fetch origin "$GITHUB_SHA"
    git checkout --force -B master FETCH_HEAD
# third-party taps
elif [[ "$GITHUB_REPOSITORY" =~ ^.+/homebrew-.+$ ]]; then
    mkdir -p "$(dirname "$HOMEBREW_TAP_REPOSITORY")"
    ln -s "$GITHUB_WORKSPACE" "$HOMEBREW_TAP_REPOSITORY"
fi

if [[ "$RUNNER_OS" = "Linux" ]]; then
    sudo chown -R "$USER" "$HOMEBREW_PREFIX"
    sudo chmod -R g-w,o-w "$HOMEBREW_CORE_REPOSITORY"
fi
