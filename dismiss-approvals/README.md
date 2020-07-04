# Dismiss approvals GitHub Action

An action that dismisses all approved reviews on given pull request.

## Usage

```yaml
- name: Dismiss approvals
  uses: Homebrew/actions/dismiss-approvals@master
  with:
    token: ${{secrets.HOMEBREW_GITHUB_API_TOKEN}}
    pr: ${{github.event.pull_request.number}}
    message: workflow run failed
```
