# Setup Gems Cache

An action that sets up and installs Homebrew gems

## Usage

```yaml
- name: Setup Gems Cache
  if: always()
  uses: Homebrew/actions/setup-gems-cache@master
  with: 
    gems-path: ${{ steps.set-up-homebrew.outputs.gems-path }}
    gems-hash: ${{ steps.set-up-homebrew.outputs.gems-hash }}
```
