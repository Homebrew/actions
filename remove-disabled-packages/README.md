# Remove Disabled Packages Github Action

An action that deletes packages that have a disable date of more than one year ago.

## Usage

```yaml
- name: Run brew script
  uses: Homebrew/actions/remove-disabled-packages@master
```

[GitHub recommends](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions?learn=getting_started#using-third-party-actions) pinning GitHub actions to a commit SHA.
[Dependabot automates](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/keeping-your-actions-up-to-date-with-dependabot) updating these commit SHAs.
