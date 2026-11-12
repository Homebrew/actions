# Remove disabled packages GitHub Action

An action that deletes packages that have a disable date of more than one year ago.

A package disabled on only some platforms (e.g. inside an `on_intel` or `on_macos` block) is never deleted, even once
the disable date has passed. These packages are listed in the `partially-disabled-packages` output instead, so the
disabled platforms can be removed by hand.

## Usage

```yaml
- name: Remove disabled packages
  id: remove-disabled-packages
  uses: Homebrew/actions/remove-disabled-packages@1f8e202ffddf94def7f42f6fa3a482e821489f9c # 2026.07.10.1
```

## Outputs

- `packages-removed`: `true` if any packages were removed, otherwise `false`.
- `partially-disabled-packages`: a Markdown list of packages disabled for more than one year on some platforms but not
  all, or empty if there are none.
