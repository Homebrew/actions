#!/bin/bash
set -eo pipefail

cd /home/actions/actions-runner || exit

echo 'GITHUB_ACTIONS_HOMEBREW_SELF_HOSTED=1' >> .env

# shellcheck disable=SC2154
# SC2154: REPOSITORY_NAME/VM_TOKEN/RUNNER_NAME is referenced but not assigned:
# These variables are set from the script environment.
./config.sh \
  --url "https://github.com/${REPOSITORY_NAME}" \
  --token "${VM_TOKEN}" \
  --name "${RUNNER_NAME}" \
  --labels "${RUNNER_NAME}" \
  --replace \
  --unattended \
  --work _work
