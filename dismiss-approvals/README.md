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

[GitHub recommends](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions?learn=getting_started#using-third-party-actions) pinning GitHub actions to a commit SHA.
[Dependabot automates](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/keeping-your-actions-up-to-date-with-dependabot) updating these commit SHAs.
