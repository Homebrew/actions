# Upload and Cleanup Bottle Result

An action that upload and cleanup bottle result.

## Usage

```yaml
- name: Upload and Cleanup Bottle Result
  if: always()
  uses: Homebrew/actions/upload-and-cleanup-bottle-result@master
  with:
    workdir: ${{ github.workspace }}
```
