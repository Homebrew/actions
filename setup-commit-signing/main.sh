#!/bin/bash

set -euo pipefail

GPG_SIGNING_KEY="${1}"

export GNUPGHOME="$HOME/.gnupg/"
mkdir -p "$GNUPGHOME"
chmod 0700 "$GNUPGHOME"

GPG_EXEC=$(command -v gpg)

# Wrapper script to use passphrase non-interactively with git
GPG_WITH_PASSPHRASE=$(mktemp)
echo "$GPG_EXEC"' --pinentry-mode loopback --passphrase "$GPG_PASSPHRASE" --batch --no-tty "$@"' > $GPG_WITH_PASSPHRASE
chmod +x $GPG_WITH_PASSPHRASE
git config --global gpg.program $GPG_WITH_PASSPHRASE

echo "$GPG_SIGNING_KEY" | base64 --decode | gpg --batch --no-tty --quiet --yes --import
GPG_KEY_ID=$(gpg --list-keys --with-colons | sed -ne "/^sub:/ p;" | cut -d: -f5)

git config --global user.signingkey $GPG_KEY_ID
git config --global commit.gpgsign true
