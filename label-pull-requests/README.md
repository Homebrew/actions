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
              "path": "Formula/.+",
              "allow_any_match": true
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
        allow_any_match: true

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
```

[GitHub recommends](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions?learn=getting_started#using-third-party-actions) pinning GitHub actions to a commit SHA.
[Dependabot automates](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/keeping-your-actions-up-to-date-with-dependabot) updating these commit SHAs.
