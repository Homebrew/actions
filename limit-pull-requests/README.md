# Limit Pull Requests GitHub Action

An action that limits the number of pull requests opened by a user.

## Prerequisites

- [GitHub CLI (`gh`)](https://github.com/cli/cli) needs to be installed.
- These permissions need to be set:
  ```yaml
  permissions:
    contents: read
    pull-requests: write
  ```

## Usage

```yaml
- uses: Homebrew/actions/limit-pull-requests@master
  with:
    except-users: |
      BrewTestBot
    comment-limit: 10
    comment: >
      You already have 10 pull requests open. Please consider working on getting
      the existing ones merged before opening new ones. Thanks!
    close-limit: 50
    close: true
```
