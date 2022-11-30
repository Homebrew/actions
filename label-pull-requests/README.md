# Label pull requests GitHub Action

An action that labels the pull request with given criteria.

Will remove labels from a pull request that no longer apply.

## Usage

### With JSON def

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
              "label": "legacy",
              "path": "Formula/.+@.+",
              "except": [
                  "Formula/python@3.8",
                  "Formula/python@3.9"
              ]
          },
          {
              "label": "missing license",
              "missing_content": "license \"[^"]+\"",
              "path": "Formula/.+"
          },
          {
              "label": "automerge-skip",
              "path": "Formula/(patchelf|binutils).rb",
              "keep_if_no_match": true
          },
          {
              "label": "bump-formula-pr",
              "pr_body_content": "Created with `brew bump-formula-pr`"
          },
          {
              "label": "documentation",
              "path": ".*\\.md"
          },
          {
              "label": "long build",
              "path": "Formula/(gcc|llvm|qt)(@[0-9]+)?.rb",
              "keep_if_no_match": true,
              "keep_if_any_match": true
          }
      ]
```

### With YAML def

```yaml
- name: Label PR
  uses: Homebrew/actions/label-pull-requests@master
  with:
    token: ${{secrets.HOMEBREW_GITHUB_API_TOKEN}}
    def: |
      - label: new formula
        status: added
        path: Formula/.+

      - label: bottle unneeded
        content: bottle :unneeded
        path: Formula/.+

      - label: legacy
        path: Formula/.+@.+
        except:
          - Formula/python@3.8
          - Formula/python@3.9

      - label: missing license
        missing_content: license "[^"]+"
        path: Formula/.+

      - label: automerge-skip
        path: Formula/(patchelf|binutils).rb
        keep_if_no_match: true

      - label: bump-formula-pr
        pr_body_content: Created with `brew bump-formula-pr`

      - label: documentation
        path: .*\.md

      - label: long build
        path: Formula/(gcc|llvm|qt)(@[0-9]+)?.rb
        keep_if_no_match: true
        keep_if_any_match: true
```
