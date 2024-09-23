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
    close-comment: An optional comment to post when closing an issue
```
