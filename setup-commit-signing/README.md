# Setup SSH Commit Signing GitHub Action

An action that sets up SSH commit signing.

## Usage

```yaml
- name: Set up SSH commit signing
  id: set-up-commit-signing
  uses: Homebrew/actions/setup-commit-signing@master
  with:
    signing_key: ${{ secrets.SSH_SIGNING_KEY }}
```

[GitHub recommends](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions?learn=getting_started#using-third-party-actions) pinning GitHub actions to a commit SHA.
[Dependabot automates](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/keeping-your-actions-up-to-date-with-dependabot) updating these commit SHAs.
