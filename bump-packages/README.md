# Bump packages GitHub Action

An action that wraps `brew bump` to ease the process of updating packages. It uses `brew livecheck` under the hood to get a list of outdated packages.

Runs on `ubuntu` (formulae only) and `macos`.

## Usage

One should use the [Personal Access Token](https://github.com/settings/tokens/new?scopes=public_repo,workflow) for `token` input to this Action,
not the default `GITHUB_TOKEN`, because `brew bump` creates a fork of the formula's tap repository (if needed) and then creates a pull request.

If there are no outdated packages, the Action will just exit.

```yaml
- name: Bump packages
  uses: Homebrew/actions/bump-packages@main
  with:
    # Custom GitHub access token with only the 'public_repo' scope enabled
    token: ${{secrets.TOKEN}}
    # Bump only these formulae if outdated
    formulae: >
      FORMULA-1
      FORMULA-2
      FORMULA-3
      ...
    # Bump only these casks if outdated
    casks: >
      CASK-1
      CASK-2
      CASKS-3
      ...
    # Do not use a fork for opening PR's
    fork: false
```
