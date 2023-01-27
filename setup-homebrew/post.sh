#!/bin/bash
# Cleanup script to restore the state of the system to as it was when the job started.

set -euo pipefail

DEBUG="${1}"

if [[ "${DEBUG}" == 'true' ]]; then
  set -x
fi

# Remove symlink and move files back.
if [[ -n "${STATE_TAP_SYMLINK-}" ]]; then
  rm "${STATE_TAP_SYMLINK}"
  mkdir "${STATE_TAP_SYMLINK}"
  (shopt -s dotglob; mv "${GITHUB_WORKSPACE}"/* "${STATE_TAP_SYMLINK}" )
  echo "Reset tap symlink."
fi

# Remove (potentially sensitive) token.
if [[ -n "${STATE_TOKEN_SET-}" ]]; then
  git config --global --unset-all "http.${GITHUB_SERVER_URL}/.extraheader"
  echo "Removed token."
fi

# Restore permissions to as they were before.
if [[ -n "${STATE_SETFACL_DIRECTORIES-}" ]]; then
  (IFS=:; sudo setfacl -Rb ${STATE_SETFACL_DIRECTORIES})
  echo "Reset permissions."
fi
