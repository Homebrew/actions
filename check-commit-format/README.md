# Check commit format GitHub Action

An action that rejects conventional commit prefixes and commits that are
attributed only to AI tools. AI attribution is allowed alongside a human author
or `Co-authored-by:` co-author. By default, it also checks that package commits
follow [Homebrew's commit style guidelines](https://docs.brew.sh/Formula-Cookbook#commit).

## Usage

```yaml
on:
  pull_request:

permissions:
  contents: read
  issues: write
  pull-requests: read

jobs:
  check-commit-style:
    runs-on: ubuntu-latest
    steps:
      - name: Check commit style
        uses: Homebrew/actions/check-commit-format@1f8e202ffddf94def7f42f6fa3a482e821489f9c # 2026.07.10.1
```

When the `token` input is omitted, the action uses `${{ github.token }}` and the
workflow `permissions:` block shown above grants it `contents: read`,
`pull-requests: read` and `issues: write` for package-repository label
management. GitHub downgrades write access for fork pull requests.

The workflow `permissions:` block does not grant permissions to a custom token
passed with `token`. Grant that token equivalent repository permissions or
scopes directly.

Set `check_package_commit_format: false` when using the action in a repository
that does not contain formulae or casks.

When migrating from the legacy `Commit style` status, update branch protection
rules or rulesets to require the workflow job instead.
