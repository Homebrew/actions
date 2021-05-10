#!/bin/bash
set -eo pipefail

cd /home/actions/actions-runner || exit

# shellcheck disable=SC2154
# SC2154: REPO_NAME/VM_TOKEN/RUNNER_NAME is referenced but not assigned: 
# These variables are set from the script environment.
./config.sh \
  --url "https://github.com/${REPO_NAME}" \
  --token "${VM_TOKEN}" \
  --name "${RUNNER_NAME}" \
  --labels "${RUNNER_NAME}" \
  --replace \
  --unattended \
  --work _work
