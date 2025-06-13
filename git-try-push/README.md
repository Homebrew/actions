# Git try push GitHub Action

An action that tries to make a `git push`. If it does not succeed, then wait some time and try again. The number of maximum tries is controllable via `tries` input.

## Usage

```yaml
- name: Try pushing
  uses: Homebrew/actions/git-try-push@main
  with:
    token: ${{github.token}}
    directory: path/to/repo
    remote: origin
    branch: master
    tries: 20
```
