# Limit Pull Requests GitHub Action

An action that limits the number of open pull requests to the repository created
by a user.

## Prerequisites

- [GitHub CLI (`gh`)](https://github.com/cli/cli) and
  [`jq`](https://jqlang.github.io/jq/) need to be installed.
- These permissions need to be set:

  ```yaml
  permissions:
    contents: read
    pull-requests: write
  ```

## Usage

This action should be used in a `pull_request_target` workflow.

```yaml
- uses: Homebrew/actions/limit-pull-requests@master
  with:
    except-users: |
      BrewTestBot
    # https://docs.github.com/en/graphql/reference/enums#commentauthorassociation
    except-author-associations: |
      MEMBER
    comment-limit: 10
    comment: >
      You already have 10 pull requests open. Please consider working on getting
      the existing ones merged before opening new ones. Thanks!
    close-limit: 50
    close: true
```

[GitHub recommends](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions?learn=getting_started#using-third-party-actions) pinning GitHub actions to a commit SHA.
[Dependabot automates](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/keeping-your-actions-up-to-date-with-dependabot) updating these commit SHAs.
