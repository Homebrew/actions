# Output Failures Summary and Brew Bottle Result

An action that groups `cat bottles/steps_output.txt` and `cat bottles/bottle_output.txt` together to ease the process of reading logs.

## Usage

```yaml
- name: Output failures summary and brew bottle result
  if: always()
  uses: Homebrew/actions/output-failures-and-bottle-result@master
```
