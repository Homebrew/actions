# Create Or Update Issue

An action to create or update an issue in a repository.
It supports posting a comment under an existing issue with the same title or
closing it based on the outcome of a previous step.

## Usage

```yaml
- uses: Homebrew/actions/create-or-update-issue@master
  with:
    token: ${{ github.token }} # defaults to this
    repository: ${{ github.repository }} # defaults to this
    title: Issue title
    body: Issue body
    labels: label1,label2 # optional
    assignees: user1,user2 # optional
    # If true: post `body` as a comment under the issue with the same title, if
    # such an issue is found; otherwise, create a new issue.
    update-existing: ${{ steps.<step-id>.conclusion == 'failure' }}
    # If true: close an existing issue with the same title as completed, if such
    # an issue is found; otherwise, do nothing.
    close-existing: ${{ steps.<step-id>.conclusion == 'success' }}
    # If specified and `close-existing` is true: only close an existing issue
    # created by the specified author.
    close-from-author: original-issue-author
    close-comment: An optional comment to post when closing an issue
```

[GitHub recommends](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions?learn=getting_started#using-third-party-actions) pinning GitHub actions to a commit SHA.
[Dependabot automates](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/keeping-your-actions-up-to-date-with-dependabot) updating these commit SHAs.
