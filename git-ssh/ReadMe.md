# Usage

```yml
- uses: Homebrew/actions/git-ssh@master
  with:
    git_user: username
    git_email: username@example.org
    key_name: key_rsa
    key: ${{ secrets.SSH_KEY }}
```

# Building

```
npm install
npm build
npm purne --production
```
