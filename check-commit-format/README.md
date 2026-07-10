# Check commit format GitHub Action

An action that checks that a pull request's commits follow [Homebrew's commit style guidelines](https://docs.brew.sh/Formula-Cookbook#commit).

## Usage

```yaml
- name: Check commit style
  uses: Homebrew/actions/check-commit-format@1f8e202ffddf94def7f42f6fa3a482e821489f9c # 2026.07.10.1
  with:
    token: ${{secrets.HOMEBREW_GITHUB_API_TOKEN}}
```
