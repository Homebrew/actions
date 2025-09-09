# Setup SSH commit signing GitHub Action

An action that sets up SSH commit signing.

## Usage

```yaml
- name: Set up SSH commit signing
  id: set-up-commit-signing
  uses: Homebrew/actions/setup-commit-signing@main
  with:
    signing_key: ${{ secrets.SSH_SIGNING_KEY }}
```
