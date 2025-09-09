# Git user config GitHub Action

An action that globally configures git for specified GitHub user.

## Usage

```yaml
- name: Configure git
  uses: Homebrew/actions/git-user-config@main
  with:
    # Defaults to $GITHUB_ACTOR if not specified
    username: BrewTestBot
```
