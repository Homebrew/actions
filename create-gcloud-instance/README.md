# Create a new linux self-hosted runner GitHub Action

An action that creates a new self-hosted runner using gcloud.

The GITHUB_TOKEN has to have "public repo" access.

## Usage

```yaml
- name: Create a new linux self-hosted runner
  uses: Homebrew/actions/create-gcloud-instance@main
  with:
    runner_name: linux-self-hosted-1
    gcp_project_id: ${{ secrets.GCP_PROJECT_ID }}
    gcp_service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}
    gcp_sa_key: ${{ secrets.GCP_SA_KEY }}
    github_token: ${{ secrets.HOMEBREW_GITHUB_PUBLIC_REPO_TOKEN }}
    repository_name: Homebrew/homebrew-core
```
