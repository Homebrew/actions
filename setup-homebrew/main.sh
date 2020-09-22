#!/bin/bash

set -euo pipefail

TEST_BOT="${1}"
DEBUG="${2}"

if [[ "${DEBUG}" == 'true' ]]; then
  set -x
fi

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
    if [[ -n "${GITHUB_ACTIONS_HOMEBREW_SELF_HOSTED-}" ]]; then
        mkdir -vp "${GITHUB_WORKSPACE}"
    else
        rm -rf "${GITHUB_WORKSPACE}"
        ln -vs "${HOMEBREW_REPOSITORY}" "${GITHUB_WORKSPACE}"
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

set_up_repo() {
  local name="${1}"
  local path="${2}"
  local commit="${3}"

  if [[ -d "${path}" ]]; then
    pushd "${path}"
    git remote set-url origin "https://github.com/${name}"
  else
    mkdir -vp "${path}"
    pushd "${path}"
    git init
    git remote add origin "https://github.com/${name}"
  fi

  git fetch origin "${commit}"
  git checkout --force -B master FETCH_HEAD

  popd
}

replace_workspace() {
  local path="${1}"

  pushd ~

  rm -rf "${GITHUB_WORKSPACE}"
  mv "${path}" "${GITHUB_WORKSPACE}"
  ln -vs "${GITHUB_WORKSPACE}" "${path}"

  popd
}

# Setup Homebrew/(home|linux)brew-core tap
if [[ "$GITHUB_REPOSITORY" =~ ^.+/(home|linux)brew-core$ ]]; then
  set_up_repo "${GITHUB_REPOSITORY}" "${HOMEBREW_CORE_REPOSITORY}" "${GITHUB_SHA}"

  if [[ -n "${GITHUB_ACTIONS_HOMEBREW_SELF_HOSTED-}" ]]; then
    mkdir -vp "${GITHUB_WORKSPACE}"
  else
    replace_workspace "${HOMEBREW_CORE_REPOSITORY}"
  fi
else
  if [[ "$GITHUB_REPOSITORY" =~ ^.+/homebrew-.+$ ]]; then
    HOMEBREW_TAP_REPOSITORY="$(brew --repo "$GITHUB_REPOSITORY")"

    set_up_repo "${GITHUB_REPOSITORY}" "${HOMEBREW_TAP_REPOSITORY}" "${GITHUB_SHA}"

    if [[ -n "${GITHUB_ACTIONS_HOMEBREW_SELF_HOSTED-}" ]]; then
      echo "Self-hosted runners not supported for this tap!"
      exit 1
    else
      replace_workspace "${HOMEBREW_TAP_REPOSITORY}"
    fi

    if [[ "$GITHUB_REPOSITORY" =~ ^.+/homebrew-cask(-.+)*$ ]]; then
      # Set up homebrew/cask for other cask repos.
      if [[ "${HOMEBREW_TAP_REPOSITORY}" != "${HOMEBREW_CASK_REPOSITORY}" ]]; then
        set_up_repo Homebrew/homebrew-cask "${HOMEBREW_CASK_REPOSITORY}" HEAD
      fi

      for cask_repo in \
        "${HOMEBREW_REPOSITORY}/Library/Taps/homebrew/homebrew-cask-drivers" \
        "${HOMEBREW_REPOSITORY}/Library/Taps/homebrew/homebrew-cask-fonts" \
        "${HOMEBREW_REPOSITORY}/Library/Taps/homebrew/homebrew-cask-versions"
      do
        if [[ "${HOMEBREW_TAP_REPOSITORY}" != "${cask_repo}" ]] && [[ -d "${cask_repo}" ]]; then
          brew update-reset "${cask_repo}"
        fi
      done
    fi
  fi

  brew update-reset "${HOMEBREW_CORE_REPOSITORY}"
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
    sudo chmod -R g-w,o-w /home/linuxbrew "${HOME}" /opt
fi
