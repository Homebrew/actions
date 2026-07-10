# Wait for idle runner GitHub Action

An action that waits for an idle runner.
The `runner-found` output is set to `true` or `false` based on whether or not the runner was found.

If the runner was found, the `runner-idle` output is set to `true` or `false` based on whether the runner is idle.

## Usage

```yaml
- name: Wait for idle runner
  uses: Homebrew/actions/wait-for-idle-runner@1f8e202ffddf94def7f42f6fa3a482e821489f9c # 2026.07.10.1
  with:
    github_token: ${{ secrets.HOMEBREW_GITHUB_API_TOKEN }}
    runner_name: linux-self-hosted-1
    repository_name: ${{ github.repository }}
```
