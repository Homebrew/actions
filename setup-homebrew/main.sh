#/bin/bash

set -euo pipefail

if which brew &>/dev/null; then
    HOMEBREW_PREFIX="$(brew --prefix)"
    HOMEBREW_REPOSITORY="$HOMEBREW_PREFIX/Homebrew"
    HOMEBREW_CORE_REPOSITORY="$HOMEBREW_REPOSITORY/Library/Taps/homebrew/homebrew-core"
    brew update-reset "$HOMEBREW_REPOSITORY" "$HOMEBREW_CORE_REPOSITORY"
else
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
fi

export PATH="$HOMEBREW_PREFIX/bin:$PATH"
echo "::add-path::$HOMEBREW_PREFIX/bin"

GEMS_PATH="$HOMEBREW_REPOSITORY/Library/Homebrew/vendor/bundle/ruby/"
echo "::set-output name=gems-path::$GEMS_PATH"
GEMS_HASH=$(shasum -a 256 "$HOMEBREW_REPOSITORY/Library/Homebrew/Gemfile.lock" | cut -f1 -d' ')
echo "::set-output name=gems-hash::$GEMS_HASH"

case "$GITHUB_REPOSITORY" in
    */brew|*/*brew-core)
        cd "$HOMEBREW_CORE_REPOSITORY"
        rm -rf "$GITHUB_WORKSPACE"
        ln -s "$HOMEBREW_CORE_REPOSITORY" "$GITHUB_WORKSPACE"
        git fetch origin "$GITHUB_SHA"
        git checkout --force -B master FETCH_HEAD
        cd -
    ;;
esac

if [ "$RUNNER_OS" = "Linux" ]; then
    sudo chown -R "$USER" "$HOMEBREW_PREFIX"
    sudo chmod -R g-w,o-w "$HOMEBREW_CORE_REPOSITORY"
fi
