# Cache Homebrew Prefix

A composite action that caches the Homebrew prefix, installs formulae via
`brew install --formula`, and keys the cache from the formula list.

## Usage

```yaml
- name: Cache Homebrew prefix
  uses: Homebrew/actions/cache-homebrew-prefix@main
  with:
    install: wget jq
```

## Inputs

- `install` (required): Formula names passed to `brew install --formula`.
  Tokens are split on whitespace and must match `^[A-Za-z0-9._/@-]+$`.

## Outputs

- `prefix`: Homebrew prefix path used for caching.
- `cache-key`: The computed cache key hash.

## Notes

- The action fails early if any formulae or casks are already installed.
  Ensure the runner has an empty Homebrew before running this action.
- Cache keys are based on `brew list --formula --versions` and are scoped by
  OS version and architecture.
