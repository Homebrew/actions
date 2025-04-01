# Create Pull Request

A very simple action to create a pull request from an already pushed branch.

Intended for internal use only.

## Usage

```yaml
- run: git commit ... && git push ...

- uses: Homebrew/actions/create-pull-request@master
  with:
    token: ${{ github.token }} # defaults to this
    repository: ${{ github.repository }} # defaults to this
    head: some-branch
    base: main
    title: Some optional title
    body: Some optional body
```

[GitHub recommends](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions?learn=getting_started#using-third-party-actions) pinning GitHub actions to a commit SHA.
[Dependabot automates](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/keeping-your-actions-up-to-date-with-dependabot) updating these commit SHAs.
