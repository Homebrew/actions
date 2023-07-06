#!/bin/bash

set -euo pipefail

UPDATE_CORE="${1}"
UPDATE_CASK="${2}"
TEST_BOT="${3}"
DEBUG="${4}"
TOKEN="${5}"

if [[ "${DEBUG}" == "true" ]]; then
    set -x
fi

ohai() {
    echo -e "\\033[34m==>\\033[0m \\033[1m$*\\033[0m"
}

MAX_GIT_RETRIES=5

function git_retry {
    local try=0

    until git "$@"; do
        exit_code="$?"
        try=$((try + 1))

        if [ $try -lt $MAX_GIT_RETRIES ]; then
            sleep $((2 ** try))
        else
            return $exit_code
        fi
    done

    return 0
}

# Check brew's existence
if ! which brew &>/dev/null; then
    PATH="/home/linuxbrew/.linuxbrew/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

    if ! which brew &>/dev/null; then
        echo "Could not find 'brew' command in PATH or standard locations."
        exit 1
    fi
fi

# Set basic variables
HOMEBREW_PREFIX="$(brew --prefix)"
HOMEBREW_REPOSITORY="$(brew --repo)"
HOMEBREW_CORE_REPOSITORY="$HOMEBREW_REPOSITORY/Library/Taps/homebrew/homebrew-core"
HOMEBREW_CASK_REPOSITORY="$HOMEBREW_REPOSITORY/Library/Taps/homebrew/homebrew-cask"
HOMEBREW_OTHER_CASK_REPOSITORIES=(
    "${HOMEBREW_REPOSITORY}/Library/Taps/homebrew/homebrew-cask-fonts"
    "${HOMEBREW_REPOSITORY}/Library/Taps/homebrew/homebrew-cask-versions"
)
if [[ "$GITHUB_REPOSITORY" =~ ^.+/homebrew-.+$ ]]; then
    HOMEBREW_TAP_REPOSITORY="$HOMEBREW_REPOSITORY/Library/Taps/$(echo "$GITHUB_REPOSITORY" | tr "[:upper:]" "[:lower:]")"
fi

# Do in container or on the runner
if [[ -f "/.dockerenv" ]] || ([[ -f /proc/1/cgroup ]] && grep -qE "actions_job|docker" /proc/1/cgroup); then
    # Fix permissions to give container user write access.
    # Directories mounted by the runner are owned by the host user, and can't be written by the container user.
    if [[ -n "$(command -v setfacl)" ]]; then
        setfacl_dirs=()
        user=$(whoami)
        for dir in "$HOME" "$RUNNER_WORKSPACE" "$RUNNER_TEMP"; do # These are mounted by the runner
            if [[ ! -w "$dir" ]]; then
                # Give the container user RW permissions, plus execute for directories.
                sudo setfacl -Rm "d:u:$user:rwX,u:$user:rwX" "$dir"
                setfacl_dirs+=("$dir")
            fi
        done
        # Store what we've changed so we can revert what we did later.
        echo "SETFACL_DIRECTORIES=$(
            IFS=:
            echo "${setfacl_dirs[*]}"
        )" >>"$GITHUB_STATE"
        echo "Set up ACL."
    elif [[ ! -w "$GITHUB_OUTPUT" ]]; then
        # setfacl isn't installed on Ubuntu by default.
        # Silence error about backtick usage inside single quotes.
        # shellcheck disable=SC2016
        echo '::warning::Missing write permissions to GitHub directories. Install `acl` (`setfacl`).'
    fi

    # Add safe directories. This is necessary to allow containers to run as root.
    # See similar code in `actions/checkout`.
    # Could do this for non-containers too, but we want to take care to not write into a shared $HOME.
    # For self-hosted without containers, consider pre-setting this instead.
    for repo in "$HOMEBREW_REPOSITORY" "$HOMEBREW_CORE_REPOSITORY" \
        "$HOMEBREW_CASK_REPOSITORY" "${HOMEBREW_OTHER_CASK_REPOSITORIES[@]}" \
        "${HOMEBREW_TAP_REPOSITORY-}"; do
        if [[ -n "$repo" ]]; then
            git config --global --add safe.directory "$repo"
        fi
    done

    HOMEBREW_IN_CONTAINER=1
else
    # Add brew to PATH
    echo "$HOMEBREW_PREFIX/sbin" >>"$GITHUB_PATH"
    echo "$HOMEBREW_PREFIX/bin" >>"$GITHUB_PATH"
fi

# This needs to be done after permission fixes above.
if [[ "${DEBUG}" == "true" ]]; then
    echo HOMEBREW_DEBUG=1 >>"$GITHUB_ENV"
    echo HOMEBREW_VERBOSE=1 >>"$GITHUB_ENV"
fi

# This is set by GitHub Actions by default but we don't want that.
echo HOMEBREW_NO_INSTALL_FROM_API= >>"$GITHUB_ENV"
unset HOMEBREW_NO_INSTALL_FROM_API

# Use an access token to checkout (private repositories)
if [[ -n "${TOKEN}" ]]; then
    base64_token=$(echo -n "x-access-token:${TOKEN}" | base64)
    echo "::add-mask::${base64_token}"
    git config --global "http.${GITHUB_SERVER_URL}/.extraheader" "Authorization: basic ${base64_token}"
    echo "TOKEN_SET=1" >>"$GITHUB_STATE"
fi

# Setup Homebrew/brew
ohai "Fetching Homebrew/brew..."
if [[ "$GITHUB_REPOSITORY" =~ ^.+/brew$ ]]; then
    cd "$HOMEBREW_REPOSITORY"
    git remote set-url origin "https://github.com/$GITHUB_REPOSITORY"
    git_retry fetch --tags origin "$GITHUB_SHA" '+refs/heads/*:refs/remotes/origin/*'
    git remote set-head origin --auto
    git checkout --force -B master FETCH_HEAD
    cd -

    echo "repository-path=$HOMEBREW_REPOSITORY" >>"$GITHUB_OUTPUT"
else
    git_retry -C "$HOMEBREW_REPOSITORY" fetch --force origin
    git -C "$HOMEBREW_REPOSITORY" checkout --force -B master origin/HEAD

    if [[ -n "${HOMEBREW_TAP_REPOSITORY-}" ]]; then
        echo "repository-path=$HOMEBREW_TAP_REPOSITORY" >>"$GITHUB_OUTPUT"
    fi
fi

# Setup Homebrew Bundler RubyGems cache
GEMS_PATH="$HOMEBREW_REPOSITORY/Library/Homebrew/vendor/bundle/ruby/"
GEMS_HASH="$(shasum -a 256 "$HOMEBREW_REPOSITORY/Library/Homebrew/Gemfile.lock" | cut -f1 -d' ')"

echo "gems-path=$GEMS_PATH" >>"$GITHUB_OUTPUT"
echo "gems-hash=$GEMS_HASH" >>"$GITHUB_OUTPUT"

# Setup Homebrew/(home|linux)brew-core tap
if [[ "$GITHUB_REPOSITORY" =~ ^.+/(home|linux)brew-core$ ]]; then
    ohai "Fetching Homebrew/core..."
    if [[ -d "$HOMEBREW_CORE_REPOSITORY" ]]; then
        cd "$HOMEBREW_CORE_REPOSITORY"
        git remote set-url origin "https://github.com/$GITHUB_REPOSITORY"
    else
        mkdir -vp "$HOMEBREW_CORE_REPOSITORY"
        cd "$HOMEBREW_CORE_REPOSITORY"
        git init
        git remote add origin "https://github.com/$GITHUB_REPOSITORY"
    fi
    git_retry fetch origin "$GITHUB_SHA" '+refs/heads/*:refs/remotes/origin/*'
    git remote set-head origin --auto
    git checkout --force -B master FETCH_HEAD
    cd -
# Setup all other taps
else
    if [[ -n "${HOMEBREW_TAP_REPOSITORY-}" ]]; then
        ohai "Fetching ${GITHUB_REPOSITORY}..."

        if [[ -d "$HOMEBREW_TAP_REPOSITORY" ]]; then
            cd "$HOMEBREW_TAP_REPOSITORY"
            git remote set-url origin "https://github.com/$GITHUB_REPOSITORY"
        else
            mkdir -vp "$HOMEBREW_TAP_REPOSITORY"
            cd "$HOMEBREW_TAP_REPOSITORY"
            git init
            git remote add origin "https://github.com/$GITHUB_REPOSITORY"
        fi

        # Make repo available under `GITHUB_WORKSPACE` (default working directory), which some third-party taps may need.
        # The symlink needs to be in this direction or `actions/cache` etc. will break as they rely on `GITHUB_WORKSPACE` being `PWD`.
        if [[ -z "${HOMEBREW_IN_CONTAINER-}" ]] && [[ -z "${GITHUB_ACTIONS_HOMEBREW_SELF_HOSTED-}" ]]; then
            (
                shopt -s dotglob
                rm -rf "${GITHUB_WORKSPACE:?}"/*
                mv "${HOMEBREW_TAP_REPOSITORY:?}"/* "$GITHUB_WORKSPACE"
            )
            rmdir "$HOMEBREW_TAP_REPOSITORY"
            ln -vs "$GITHUB_WORKSPACE" "$HOMEBREW_TAP_REPOSITORY"
            cd - && cd "$GITHUB_WORKSPACE"
            echo "TAP_SYMLINK=$HOMEBREW_TAP_REPOSITORY" >>"$GITHUB_STATE"
        fi

        git_retry fetch origin "$GITHUB_SHA" '+refs/heads/*:refs/remotes/origin/*'
        git remote set-head origin --auto
        head="$(git symbolic-ref refs/remotes/origin/HEAD)"
        head="${head#refs/remotes/origin/}"
        git checkout --force -B "$head" FETCH_HEAD
        cd -
    fi

    if [[ "${HOMEBREW_TAP_REPOSITORY-}" != "${HOMEBREW_CORE_REPOSITORY}" && "${UPDATE_CORE}" == "true" ]]; then
        if [[ -d "${HOMEBREW_CORE_REPOSITORY}" ]]; then
            # Migrate linuxbrew-core to homebrew-core
            HOMEBREW_CORE_REPOSITORY_ORIGIN="$(git -C "$HOMEBREW_CORE_REPOSITORY" remote get-url origin 2>/dev/null)"
            if [[ "$HOMEBREW_CORE_REPOSITORY_ORIGIN" == "https://github.com/Homebrew/linuxbrew-core" ]]; then
                git -C "$HOMEBREW_CORE_REPOSITORY" remote set-url origin "https://github.com/Homebrew/homebrew-core"
            fi

            ohai "Fetching Homebrew/core..."
            git_retry -C "$HOMEBREW_CORE_REPOSITORY" fetch --force origin
            git -C "$HOMEBREW_CORE_REPOSITORY" remote set-head origin --auto
            git -C "$HOMEBREW_CORE_REPOSITORY" checkout --force -B master origin/HEAD
        else
            ohai "Cloning Homebrew/core..."
            git_retry clone https://github.com/Homebrew/homebrew-core "${HOMEBREW_CORE_REPOSITORY}"
        fi
    fi

    if [[ "${HOMEBREW_TAP_REPOSITORY-}" != "${HOMEBREW_CASK_REPOSITORY}" && "${UPDATE_CASK}" == "true" ]]; then
        if [[ -d "${HOMEBREW_CASK_REPOSITORY}" ]]; then
            ohai "Fetching Homebrew/cask..."
            git_retry -C "$HOMEBREW_CASK_REPOSITORY" fetch --force origin
            git -C "$HOMEBREW_CASK_REPOSITORY" remote set-head origin --auto
            git -C "$HOMEBREW_CASK_REPOSITORY" checkout --force -B master origin/HEAD
        else
            ohai "Cloning Homebrew/cask..."
            git_retry clone https://github.com/Homebrew/homebrew-cask "${HOMEBREW_CASK_REPOSITORY}"
        fi
    fi

    for cask_repo in "${HOMEBREW_OTHER_CASK_REPOSITORIES[@]}"; do
        if [[ "${HOMEBREW_TAP_REPOSITORY-}" != "${cask_repo}" ]] && [[ -d "${cask_repo}" && "${UPDATE_CASK}" == "true" ]]; then
            ohai "Fetching Homebrew/${cask_repo##*/}..."
            git_retry -C "${cask_repo}" fetch --force origin
            git -C "${cask_repo}" remote set-head origin --auto
            git -C "${cask_repo}" checkout --force -B master origin/HEAD
        fi
    done
fi

if [[ "${TEST_BOT}" == "true" ]] || [[ "${TEST_BOT}" == "auto" && -n "${HOMEBREW_TAP_REPOSITORY-}" ]]; then
    # Setup Homebrew/homebrew-test-bot
    HOMEBREW_TEST_BOT_REPOSITORY="$HOMEBREW_REPOSITORY/Library/Taps/homebrew/homebrew-test-bot"
    if [[ -d "$HOMEBREW_TEST_BOT_REPOSITORY" ]]; then
        ohai "Fetching Homebrew/test-bot..."
        git_retry -C "$HOMEBREW_TEST_BOT_REPOSITORY" fetch --force origin
        git -C "$HOMEBREW_TEST_BOT_REPOSITORY" remote set-head origin --auto
        git -C "$HOMEBREW_TEST_BOT_REPOSITORY" checkout --force -B master origin/HEAD
    else
        ohai "Cloning Homebrew/test-bot..."
        git_retry clone https://github.com/Homebrew/homebrew-test-bot "$HOMEBREW_TEST_BOT_REPOSITORY"
    fi
fi

# Run `brew update` once to e.g. download formula/cask JSON files.
(
    # Unset these to ensure homebrew/core and homebrew/cask are not updated (again)
    unset HOMEBREW_NO_INSTALL_FROM_API HOMEBREW_DEVELOPER HOMEBREW_DEV_CMD_RUN
    unset HOMEBREW_UPDATE_CORE_TAP HOMEBREW_UPDATE_CASK_TAP
    brew update --auto
)

# Setup Linux permissions
if [[ "$RUNNER_OS" = "Linux" ]] && [[ -z "${HOMEBREW_IN_CONTAINER-}" ]] && [[ -z "${GITHUB_ACTIONS_HOMEBREW_SELF_HOSTED-}" ]]; then
    # Workaround: Remove fontconfig incompatible fonts provided by the poppler
    # installation in GitHub Actions image
    sudo rm -rf /usr/share/fonts/cmap
fi
