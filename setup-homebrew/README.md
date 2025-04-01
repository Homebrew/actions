# Setup Homebrew Github Action

An action that sets up a Homebrew environment.

Runs on `ubuntu` and `macos`.

## Usage

```yaml
- name: Set up Homebrew
  id: set-up-homebrew
  uses: Homebrew/actions/setup-homebrew@master
```

This also sets up the variables necessary to cache the gems installed by Homebrew developer commands (e.g. `brew style`). To use these add:

```yaml
- name: Cache Homebrew Bundler RubyGems
  id: cache
  uses: actions/cache@v3
  with:
    path: ${{ steps.set-up-homebrew.outputs.gems-path }}
    key: ${{ runner.os }}-rubygems-${{ steps.set-up-homebrew.outputs.gems-hash }}
    restore-keys: ${{ runner.os }}-rubygems-

- name: Install Homebrew Bundler RubyGems
  if: steps.cache.outputs.cache-hit != 'true'
  run: brew install-bundler-gems
```

Note you do not need to use the `actions/setup-ruby` or `actions/checkout` steps because this action will install the necessary Ruby for Homebrew and checkout the repository being tested.

[GitHub recommends](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions?learn=getting_started#using-third-party-actions) pinning GitHub actions to a commit SHA.
[Dependabot automates](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/keeping-your-actions-up-to-date-with-dependabot) updating these commit SHAs.
