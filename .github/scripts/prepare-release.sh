#!/usr/bin/env bash

set -euo pipefail

readonly CALVER_PATTERN='^[0-9]{4}\.[0-9]{2}\.[0-9]{2}\.[1-9][0-9]*$'

event_name="${GITHUB_EVENT_NAME:-workflow_dispatch}"
minimum_age_seconds="${RELEASE_MINIMUM_AGE_SECONDS:-86400}"
now="${RELEASE_NOW:-$(date -u +%s)}"
release_date="${RELEASE_DATE:-$(date -u +%Y.%m.%d)}"

if [[ -z "${GITHUB_OUTPUT:-}" ]]; then
  echo "GITHUB_OUTPUT must be set." >&2
  exit 1
fi

if [[ ! "${minimum_age_seconds}" =~ ^[0-9]+$ ]]; then
  echo "RELEASE_MINIMUM_AGE_SECONDS must be a non-negative integer." >&2
  exit 1
fi

if [[ ! "${now}" =~ ^[0-9]+$ ]]; then
  echo "RELEASE_NOW must be a non-negative integer." >&2
  exit 1
fi

if [[ ! "${release_date}" =~ ^[0-9]{4}\.[0-9]{2}\.[0-9]{2}$ ]]; then
  echo "RELEASE_DATE must use YYYY.MM.DD." >&2
  exit 1
fi

case "${event_name}" in
  schedule | workflow_dispatch) ;;
  *)
    echo "Unsupported release event: ${event_name}" >&2
    exit 1
    ;;
esac

write_output() {
  printf '%s=%s\n' "$1" "$2" >> "${GITHUB_OUTPUT}"
}

candidate_sha="$(git rev-parse HEAD)"
candidate_timestamp="$(git show -s --format=%ct "${candidate_sha}")"
# Clamp to zero so a future-dated commit (clock skew) reads as freshest rather
# than reporting a negative age and slipping past the bake gate.
candidate_age_seconds="$(( now > candidate_timestamp ? now - candidate_timestamp : 0 ))"
latest_tag=""

while IFS= read -r tag; do
  if [[ "${tag}" =~ ${CALVER_PATTERN} ]]; then
    latest_tag="${tag}"
    break
  fi
done < <(git tag --merged "${candidate_sha}" --sort=-version:refname)

write_output candidate_sha "${candidate_sha}"
write_output candidate_age_seconds "${candidate_age_seconds}"
write_output latest_tag "${latest_tag}"

if [[ -n "${latest_tag}" ]] &&
   [[ "$(git rev-list --count "${latest_tag}..${candidate_sha}")" -eq 0 ]]; then
  reason="No commits since ${latest_tag}."
  write_output release false
  write_output reason "${reason}"
  echo "${reason} Skipping release."
  exit 0
fi

if [[ "${event_name}" == "schedule" ]] &&
   (( candidate_age_seconds < minimum_age_seconds )); then
  reason="Candidate commit is ${candidate_age_seconds} seconds old; scheduled releases require ${minimum_age_seconds} seconds."
  write_output release false
  write_output reason "${reason}"
  echo "${reason} Skipping release."
  exit 0
fi

escaped_release_date="${release_date//./\.}"
release_tag_pattern="^${escaped_release_date}\.([1-9][0-9]*)$"
highest_sequence=0

while IFS= read -r tag; do
  if [[ "${tag}" =~ ${release_tag_pattern} ]]; then
    sequence="$((10#${BASH_REMATCH[1]}))"
    if (( sequence > highest_sequence )); then
      highest_sequence="${sequence}"
    fi
  fi
done < <(git tag --list "${release_date}.*")

version="${release_date}.$((highest_sequence + 1))"
reason="Release ${candidate_sha} as ${version}."

write_output release true
write_output version "${version}"
write_output reason "${reason}"
echo "${reason}"
