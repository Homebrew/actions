# Get or create a pull request

After pushing a branch, use this action to return its open PR number or create
a PR if one is missing. Both branches must belong to the target repository.
Existing PRs retain their title, body and labels.

```yaml
- id: pr
  uses: Homebrew/actions/get-or-create-pull-request@main
  with:
    head: update-generated-files
    base: main
    token: ${{ secrets.BOT_TOKEN }}
```

By default the action uses the job token for lookup and creation. Pass a
separate `token` when PR creation needs to trigger CI or a `read-token` when
the job token cannot read the target repository.

With no title or body, `gh pr create --fill` reads the commits from the local
checkout. Set `working-directory` when that checkout is outside the workspace
root. An explicit `title` and `body` or `body-file` supply the PR text directly.
Use `repository` to target another repository and `labels` to label a new PR.

Set `create-if-missing: false` for a lookup. The `number` output is empty
when no open PR matches. The `created` output is true only for the run that
opened the PR.
