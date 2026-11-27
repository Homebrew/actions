#!/bin/bash
set -euo pipefail

git check-ref-format "refs/heads/$PR_HEAD" || { echo "Expected a same-repository head branch" >&2; exit 1; }

find_open_pr() {
  local filters=(-f state=open -f "head=${GH_REPO%/*}:$PR_HEAD")
  if [[ -n "$PR_BASE" ]]; then filters+=(-f "base=$PR_BASE"); fi
  GH_TOKEN="$READ_TOKEN" gh api --method GET "repos/$GH_REPO/pulls" "${filters[@]}" --paginate --slurp |
    jq -r 'first(.[][] | select(.head.repo.id == .base.repo.id) | .number) // empty'
}

number=$(find_open_pr)
created=false
if [[ -z "$number" && "$CREATE_IF_MISSING" == true ]]; then
  args=(--head "$PR_HEAD")
  if [[ -n "$PR_BASE" ]]; then args+=(--base "$PR_BASE"); fi
  if [[ -n "$PR_TITLE" ]]; then args+=(--title "$PR_TITLE"); else args+=(--fill); fi
  if [[ -n "$PR_BODY_FILE" ]]; then
    args+=(--body-file "$PR_BODY_FILE")
  elif [[ -n "$PR_TITLE" || -n "$PR_BODY" ]]; then
    args+=(--body "$PR_BODY")
  fi
  if [[ -n "$PR_LABELS" ]]; then args+=(--label "$PR_LABELS"); fi

  if url=$(gh pr create "${args[@]}"); then
    number=${url##*/}
    [[ "$number" =~ ^[0-9]+$ ]] || { echo "Unexpected PR URL: $url" >&2; exit 1; }
    created=true
  else
    create_status=$?
    # gh prints the new PR URL even when applying labels fails.
    if [[ -n "$url" ]]; then
      echo "$url" >&2
      exit "$create_status"
    fi

    # Another run may have opened the PR since the lookup.
    number=$(find_open_pr)
    [[ -n "$number" ]] || exit 1
  fi
fi

printf 'number=%s\ncreated=%s\n' "$number" "$created" >> "$GITHUB_OUTPUT"
