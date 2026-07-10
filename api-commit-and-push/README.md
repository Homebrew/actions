# API commit and push GitHub Action

An action that commits and pushes changes via the GitHub API rather than the git CLI.

Useful for GitHub Apps which need to use the API in order to sign commits.

## Usage

```yaml
- uses: actions/create-github-app-token@v3
  id: app-token
  with:
    app-id: ${{ vars.APP_ID }}
    private-key: ${{ secrets.PRIVATE_KEY }}

- run: git add some/file.txt

- uses: Homebrew/actions/api-commit-and-push@1f8e202ffddf94def7f42f6fa3a482e821489f9c # 2026.07.10.1
  with:
    message: Update generated files
    branch: some-branch
    token: ${{ steps.app-token.outputs.token }}
```
