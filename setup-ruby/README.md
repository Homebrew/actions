# Setup Ruby (Homebrew) GitHub Action

An action that sets up Ruby using Homebrew.

Runs on `ubuntu` and `macos` (requires Homebrew).

## Usage

```yaml
- name: Set up Homebrew
  uses: Homebrew/actions/setup-homebrew@main

- name: Set up Ruby
  uses: Homebrew/actions/setup-ruby@main
```

To use Homebrew's portable Ruby instead of the `ruby` formula:

```yaml
- name: Set up Homebrew portable Ruby
  uses: Homebrew/actions/setup-ruby@main
  with:
    portable-ruby: true
```

## Outputs

- `ruby-path`: Path to the Ruby executable.
- `ruby-prefix`: Ruby installation prefix.
- `ruby-version`: Ruby version string.

## Notes

- When `portable-ruby` is `false`, this action installs Homebrew's `ruby` formula (if needed) and adds it to `PATH`.
- When `portable-ruby` is `true`, this action uses the same Ruby Homebrew runs (`brew ruby`) and adds it to `PATH`.
