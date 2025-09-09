# Setup Homebrew GitHub Action

An action that sets up a Homebrew environment.

Runs on `ubuntu` and `macos`.

## Usage

```yaml
- name: Set up Homebrew
  id: set-up-homebrew
  uses: Homebrew/actions/setup-homebrew@main
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
