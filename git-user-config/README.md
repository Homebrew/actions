# Git user config Github Action

An action that globally configures git for specified GitHub user.

## Usage

```yaml
- name: Configure git
  uses: Homebrew/actions/git-user-config@master
  with:
    # Defaults to $GITHUB_ACTOR if not specified
    username: BrewTestBot
```

[GitHub recommends](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions?learn=getting_started#using-third-party-actions) pinning GitHub actions to a commit SHA.
[Dependabot automates](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/keeping-your-actions-up-to-date-with-dependabot) updating these commit SHAs.
