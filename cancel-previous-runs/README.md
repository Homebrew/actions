# Cancel previous runs Github Action

An action that cancels all previous uncompleted duplicated workflow runs for a branch.

## Usage

```yaml
- name: Cancel previous runs
  uses: Homebrew/actions/cancel-previous-runs@master
  with:
    token: ${{secrets.HOMEBREW_GITHUB_API_TOKEN}}
```
