# Review Cask PR GitHub Action

An action that reviews a cask pull request for “auto-mergability”.

## Usage

```yaml
- name: Review Pull Request
  id: review
  uses: Homebrew/actions/review-cask-pr@master
- name: Post Pull Request Review
  if: steps.review.outputs.event
  run: |
    echo 'REVIEW_EVENT: ${{ steps.review.outputs.event }}'
    echo 'REVIEW_MESSAGE: ${{ steps.review.outputs.message }}'
```


## Debugging

To run the action locally, you can pass a URL like this:

```
brew ruby review.rb <url>
```
