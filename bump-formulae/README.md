# Bump formulae GitHub Action

An action that wraps `brew bump-formula-pr` to ease the process of updating formulae. It uses `brew livecheck` under the hood to get a list of outdated formulae.

Runs on `ubuntu` and `macos`.

## Usage

One should use the [Personal Access Token](https://github.com/settings/tokens/new?scopes=public_repo,workflow) for `token` input to this Action, not the default `GITHUB_TOKEN`, because `brew bump-formula-pr` creates a fork of the formula's tap repository (if needed) and then creates a pull request.

If there are no outdated formulae, the Action will just exit.

```yaml
- name: Bump formulae
  uses: Homebrew/actions/bump-formulae@master
  with:
    # Custom GitHub access token with only the 'public_repo' scope enabled
    token: ${{secrets.TOKEN}}
    # Bump only these formulae if outdated
    formulae: |
      FORMULA-1
      FORMULA-2
      FORMULA-3
      ...
```