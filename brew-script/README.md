# Brew script Github Action

An action that takes given Ruby script and executes it in Homebrew environment via `brew ruby` command.

Runs on `ubuntu` and `macos`.

## Usage

```yaml
- name: Run brew script
  uses: Homebrew/actions/brew-script@master
  with:
    # GitHub token, defaults to ${{github.token}}, is set as HOMEBREW_GITHUB_API_TOKEN
    token: ${{github.token}}
    script: |
        revision = Utils.safe_popen_read("git", "rev-parse", "HEAD")
        ohai revision
```
