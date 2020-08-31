# Label pull requests GitHub Action

An action that labels the pull request with given criteria.

Will remove labels from a pull request that no longer apply.

## Usage

```yaml
- name: Label PR
  uses: Homebrew/actions/label-pull-requests@master
  with:
    token: ${{secrets.HOMEBREW_GITHUB_API_TOKEN}}
    def: |
      [
          {
              "label": "new formula",
              "status": "added",
              "path": "Formula/.+"
          },
          {
              "label": "bottle unneeded",
              "content": "bottle :unneeded",
              "path": "Formula/.+"
          },
          {
              "label": "missing license",
              "missing_content": "license \"[^"]+\"",
              "path": "Formula/.+"
          }
      ]
```
