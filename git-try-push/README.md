# Git try push GitHub Action

An action that tries to make a `git push`. If it does not succeed, then wait some time and try again. The number of maximum tries is controllable via `tries` input.

## Usage

```yaml
- name: Try pushing
  uses: Homebrew/actions/git-try-push@1f8e202ffddf94def7f42f6fa3a482e821489f9c # 2026.07.10.1
  with:
    token: ${{github.token}}
    directory: path/to/repo
    remote: origin
    branch: main
    tries: 20
```
