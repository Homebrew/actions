#!/bin/bash
# Warn users referencing Homebrew/actions via @master to migrate to @main.
# Called from composite actions with the action name as the sole argument.

set -euo pipefail

if [ -z "${GITHUB_ACTION_REF+x}" ]; then
  echo "::error::GITHUB_ACTION_REF is not set. This script must be run inside a GitHub Actions workflow."
  exit 1
fi

if [ "$GITHUB_ACTION_REF" = "master" ]; then
  echo "::warning::Homebrew/actions/${1}@master is deprecated. Please update your workflow references to use Homebrew/actions/${1}@main. The 'master' branch sync will stop and this warning will become an error when Homebrew 5.2.0 is released (no earlier than 2026-06-10)."
fi
