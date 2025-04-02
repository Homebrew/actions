# Git try push GitHub Action

An action that tries to make a `git push`. If it does not succeed, then wait some time and try again. The number of maximum tries is controllable via `tries` input.

## Usage

```yaml
- name: Try pushing
  uses: Homebrew/actions/git-try-push@master
  with:
    token: ${{github.token}}
    directory: path/to/repo
    remote: origin
    branch: master
    tries: 20
```

[GitHub recommends](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions?learn=getting_started#using-third-party-actions) pinning GitHub actions to a commit SHA.
[Dependabot automates](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/keeping-your-actions-up-to-date-with-dependabot) updating these commit SHAs.
