# Failures Summary and Bottle Result

An action that groups `cat bottles/steps_output.txt` and `cat bottles/bottle_output.txt` together to ease the process of reading logs.

## Usage

```yaml
- name: Failures Summary and Bottle Result
  if: always()
  uses: Homebrew/actions/failures-summary-and-bottle-result@master
  with:
    workdir: ${{ github.workspace }}
```
