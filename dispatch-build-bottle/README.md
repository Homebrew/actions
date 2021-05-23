# Build Bottle GitHub Action

Composite Action for Dispatch Build Bottle - Build Job  

## Usage

```yaml
- name: Build bottle
  uses: Homebrew/actions/dispatch-build-bottle@master
  with:
    formula: $${{ formula }}
    issue: 123
    ignore_error: ${{ ignore_errors }}
    macos: ${{ macos }}
    sender: $${{ sender }}
```
