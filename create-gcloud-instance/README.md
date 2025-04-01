# Create a new linux self-hosted runner GitHub Action

An action that creates a new self-hosted runner using gcloud.

The GITHUB_TOKEN has to have "public repo" access.

## Usage

```yaml
- name: Create a new linux self-hosted runner
  uses: Homebrew/actions/create-gcloud-instance@master
  with:
    runner_name: linux-self-hosted-1
    gcp_project_id: ${{ secrets.GCP_PROJECT_ID }}
    gcp_service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}
    gcp_sa_key: ${{ secrets.GCP_SA_KEY }}
    github_token: ${{ secrets.HOMEBREW_GITHUB_PUBLIC_REPO_TOKEN }}
    repository_name: Homebrew/homebrew-core
```

[GitHub recommends](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions?learn=getting_started#using-third-party-actions) pinning GitHub actions to a commit SHA.
[Dependabot automates](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/keeping-your-actions-up-to-date-with-dependabot) updating these commit SHAs.
