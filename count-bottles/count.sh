#!/usr/bin/env bash

WORKING_DIRECTORY="$1"
DEBUG="$2"

if [[ "${DEBUG}" = "true" ]]
then
  set -x
fi

cd "${WORKING_DIRECTORY}" || exit 1

shopt -s nullglob

json_files=(*.json)
count="${#json_files[@]}"
echo "::notice ::${count} bottles"
echo "count=${count}" >> "${GITHUB_OUTPUT:?}"

failed_json_files=(failed/*.json)
failures="${#failed_json_files[@]}"
echo "::notice ::${failures} failed bottles"
echo "failures=${failures}" >> "${GITHUB_OUTPUT:?}"

skipped_lists=(skipped_or_failed_formulae-*.txt)
skipped="${#skipped_lists[@]}"
echo "::notice ::${skipped} lists of skipped formulae"
echo "skipped=${skipped}" >> "${GITHUB_OUTPUT:?}"
