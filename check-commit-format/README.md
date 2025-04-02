# Check commit format GitHub Action

An action that checks that a pull request's commits follow [Homebrew's commit style guidelines](https://docs.brew.sh/Formula-Cookbook#commit).

## Usage

```yaml
- name: Check commit style
  uses: Homebrew/actions/check-commit-format@master
  with:
    token: ${{secrets.HOMEBREW_GITHUB_API_TOKEN}}
```

[GitHub recommends](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions?learn=getting_started#using-third-party-actions) pinning GitHub actions to a commit SHA.
[Dependabot automates](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/keeping-your-actions-up-to-date-with-dependabot) updating these commit SHAs.
