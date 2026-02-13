# Setup Ruby (Homebrew) GitHub Action

An action that sets up Ruby using Homebrew.

Runs on `ubuntu` and `macos` (requires Homebrew).

## Usage

Set up Ruby with an existing Homebrew installation:

```yaml
- name: Set up Homebrew
  uses: Homebrew/actions/setup-homebrew@main

- name: Set up Ruby
  uses: Homebrew/actions/setup-ruby@main
```

Set up Homebrew from this action when requested:

```yaml
- name: Set up Ruby and Homebrew
  uses: Homebrew/actions/setup-ruby@main
  with:
    setup-homebrew: true
```

To use Homebrew's portable Ruby instead of the `ruby` formula:

```yaml
- name: Set up Homebrew portable Ruby
  uses: Homebrew/actions/setup-ruby@main
  with:
    portable-ruby: true
```

Enable Bundler cache:

```yaml
- name: Set up Ruby with Bundler cache
  uses: Homebrew/actions/setup-ruby@main
  with:
    setup-homebrew: true
    bundler-cache: true
```

Run from a specific subdirectory:

```yaml
- name: Set up Ruby from subdirectory
  uses: Homebrew/actions/setup-ruby@main
  with:
    setup-homebrew: true
    working-directory: path/to/project
```

## Outputs

- `ruby-path`: Path to the Ruby executable.
- `ruby-prefix`: Ruby installation prefix.
- `ruby-version`: Ruby version string.

## Notes

- When `portable-ruby` is `false`, this action installs Homebrew's `ruby` formula (if needed) and adds it to `PATH`.
- When `portable-ruby` is `true`, this action uses the same Ruby Homebrew runs (`brew ruby`) and adds it to `PATH`.
- `setup-homebrew` defaults to `false` and only runs `Homebrew/actions/setup-homebrew` when explicitly enabled.
- `bundler-cache` defaults to `false`. When enabled, this action:
  - Caches `vendor/bundle` using `actions/cache`.
  - Runs `bundle install` only when `bundle check` fails.
  - Requires `Gemfile` in the current working directory.
  - Uses `Gemfile.lock` for cache hashing when present, otherwise falls back to `Gemfile`.
  - Includes Ruby version and Ruby prefix in cache key derivation.
- `working-directory` defaults to `.` and is used for Ruby setup, Gemfile discovery, and Bundler commands.
