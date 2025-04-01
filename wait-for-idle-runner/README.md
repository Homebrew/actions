# Wait for idle runner GitHub Action

An action that waits for an idle runner.
The `runner-found` output is set to `true` or `false` based on whether or not the runner was found.

If the runner was found, the `runner-idle` output is set to `true` or `false` based on whether the runner is idle.

## Usage

```yaml
- name: Wait for idle runner
  uses: Homebrew/actions/wait-for-idle-runner@master
  with:
    github_token: ${{ secrets.HOMEBREW_GITHUB_API_TOKEN }}
    runner_name: linux-self-hosted-1
    repository_name: ${{ github.repository }}
```

[GitHub recommends](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions?learn=getting_started#using-third-party-actions) pinning GitHub actions to a commit SHA.
[Dependabot automates](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/keeping-your-actions-up-to-date-with-dependabot) updating these commit SHAs.
