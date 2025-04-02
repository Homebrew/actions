# API Commit and Push

An action that commits and pushes changes via the GitHub API rather than the git CLI.

Useful for GitHub Apps which need to use the API in order to sign commits.

## Usage

```yaml
- uses: actions/create-github-app-token@v1
  id: app-token
  with:
    app-id: ${{ vars.APP_ID }}
    private-key: ${{ secrets.PRIVATE_KEY }}

- run: git add some/file.txt

- uses: Homebrew/actions/api-commit-and-push@master
  with:
    message: Update generated files
    branch: some-branch
    token: ${{ steps.app-token.outputs.token }}
```

[GitHub recommends](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions?learn=getting_started#using-third-party-actions) pinning GitHub actions to a commit SHA.
[Dependabot automates](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/keeping-your-actions-up-to-date-with-dependabot) updating these commit SHAs.
