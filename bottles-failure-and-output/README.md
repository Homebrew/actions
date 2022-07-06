# Output Failures Summary and Brew Bottle Result

An action that groups `cat bottles/steps_output.txt` and `cat bottles/bottle_output.txt` together to ease the process of reading logs.

## Usage

```yaml
- name: Failures summary and output brew bottle result
  if: always()
  uses: Homebrew/actions/bottles-failure-and-output@master
```