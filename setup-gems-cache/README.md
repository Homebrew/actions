# Setup Gems Cache

An action that prepare and setup gems cache.

## Usage

```yaml
- name: Setup Gems Cache
  if: always()
  uses: Homebrew/actions/setup-gems-cache@master
  with: 
    ci_test_mode: 0
    relink: 0
    gems-path: ${{ steps.set-up-homebrew.outputs.gems-path }}
    gems-hash: ${{ steps.set-up-homebrew.outputs.gems-hash }}
```
