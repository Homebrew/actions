#!/bin/bash
set -eo pipefail

mkdir -p /home/actions/actions-runner
curl https://api.github.com/repos/actions/runner/releases/latest |
  grep -E -o 'https://github.com/actions/runner/releases/download/v[0-9.]+/actions-runner-linux-x64-[0-9.]+\.tar\.gz' |
  uniq |
  xargs curl -L |
  tar xzv -C /home/actions/actions-runner
