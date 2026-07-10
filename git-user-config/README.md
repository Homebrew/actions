# Git user config GitHub Action

An action that globally configures git for specified GitHub user.

## Usage

```yaml
- name: Configure git
  uses: Homebrew/actions/git-user-config@1f8e202ffddf94def7f42f6fa3a482e821489f9c # 2026.07.10.1
  with:
    # Defaults to $GITHUB_ACTOR if not specified
    username: BrewTestBot
```
