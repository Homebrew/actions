# Create Pull Request

A very simple action to create a pull request from an already pushed branch.

Intended for internal use only.

## Usage

```yaml
- run: git commit ... && git push ...

- uses: Homebrew/actions/create-pull-request@main
  with:
    token: ${{ github.token }} # defaults to this
    repository: ${{ github.repository }} # defaults to this
    head: some-branch
    base: main
    title: Some optional title
    body: Some optional body
```
