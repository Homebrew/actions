#!/usr/bin/env bash

set -euo pipefail

npm ci --ignore-scripts --omit=dev

changes="$(git status --porcelain --untracked-files=all -- node_modules)"
if [[ -n "${changes}" ]]; then
  echo "${changes}"
  echo "::error::Vendored dependencies differ from package-lock.json. Run npm ci --ignore-scripts --omit=dev and commit the node_modules changes."
  exit 1
fi
