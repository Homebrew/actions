# Post review GitHub Action

An action that simply posts a new review on given pull request with specified content.

## Usage

```yaml
- name: Post comment
  uses: Homebrew/actions/post-review@master
  with:
    token: ${{ secrets.HOMEBREW_GITHUB_API_TOKEN }}
    pull_request: 123
    event: APPROVE
    body: I approve this pull request.
```
