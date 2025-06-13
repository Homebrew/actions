# Check commit format GitHub Action

An action that checks that a pull request's commits follow [Homebrew's commit style guidelines](https://docs.brew.sh/Formula-Cookbook#commit).

## Usage

```yaml
- name: Check commit style
  uses: Homebrew/actions/check-commit-format@main
  with:
    token: ${{secrets.HOMEBREW_GITHUB_API_TOKEN}}
```
