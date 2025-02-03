#!/bin/bash

set -euo pipefail

SSH_SIGNING_KEY="${1}"

# re-derive the public key from the private key
pubkey=$(ssh-keygen -y -f /dev/stdin <<< "${SSH_SIGNING_KEY}")

# load the private key into the SSH agent
ssh-add -q - <<< "${SSH_SIGNING_KEY}"

# add our public key as an allowed signer
# we treat the public key as trusted for the currently configured git email
allowed_signer="$(git config get user.email) ${pubkey}"
mkdir -p ~/.ssh
echo "${allowed_signer}" >> ~/.ssh/allowed_signers

git config --global gpg.format ssh
git config --global commit.gpgsign true
git config --global user.signingkey "${pubkey}"
