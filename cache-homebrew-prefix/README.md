# Cache Homebrew Prefix

A composite action that caches the Homebrew prefix, installs formulae via
`brew install --formula`, and keys the cache from the formula list.

## Usage

```yaml
- name: Cache Homebrew prefix
  uses: Homebrew/actions/cache-homebrew-prefix@main
  with:
    install: wget jq
    uninstall: true
```

```yaml
- name: Cache Homebrew prefix from Brewfile
  uses: Homebrew/actions/cache-homebrew-prefix@main
  with:
    brewfile: true
    uninstall: true
```

## Inputs

- `install` (optional): Formula names passed to `brew install --formula`.
  Tokens are split on whitespace and must match `^[A-Za-z0-9._/@-]+$`.
- `brewfile` (optional): Install formulae from `./Brewfile` instead of
  `install` using `brew bundle --file Brewfile --no-upgrade`. Default: `false`.
- `uninstall` (optional): When `true`, existing formulae are automatically
  removed before install. Default: `false`.
- Validation: Either `install` or `brewfile` must be provided (but not both).

## Outputs

- `prefix`: Homebrew prefix path used for caching.
- `cache-key`: The computed cache key hash.

## Notes

- The action only checks existing formulae (not casks).
- If formulae are already installed and `uninstall` is `false`, the action
  fails early.
- If `uninstall` is `true`, existing formulae are cleaned up with
  `brew test-bot --only-cleanup-before` before install.
- `brewfile` and `install` are mutually exclusive.
- Cache keys are based on `brew list --formula --versions` and are scoped by
  OS version and architecture.
