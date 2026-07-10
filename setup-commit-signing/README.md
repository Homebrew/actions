# Setup SSH commit signing GitHub Action

An action that sets up SSH commit signing.

## Usage

```yaml
- name: Set up SSH commit signing
  id: set-up-commit-signing
  uses: Homebrew/actions/setup-commit-signing@1f8e202ffddf94def7f42f6fa3a482e821489f9c # 2026.07.10.1
  with:
    signing_key: ${{ secrets.SSH_SIGNING_KEY }}
```
