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
