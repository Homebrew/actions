# Post comment GitHub Action

An action that simply posts a new comment on given issue with specified content.

## Usage

> `bot_body` input will be used as comment body if `GITHUB_ACTOR` environment variable equals `bot` input. Otherwise `body` input is used.

```yaml
- name: Post comment
  uses: Homebrew/actions/post-comment@master
  with:
    token: ${{secrets.HOMEBREW_GITHUB_API_TOKEN}}
    issue: 123
    body: ${{github.actor}} has triggered this workflow.
    bot_body: BrewTestBot has triggered this workflow.
    bot: BrewTestBot
```

[GitHub recommends](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions?learn=getting_started#using-third-party-actions) pinning GitHub actions to a commit SHA.
[Dependabot automates](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/keeping-your-actions-up-to-date-with-dependabot) updating these commit SHAs.
