#!/bin/bash

DEBUG="$1"

if [[ "${DEBUG}" = "true" ]]
then
  set -x
fi

shopt -s nullglob

json_files=(*.json)
count="${#json_files[@]}"
echo "::notice ::${count} bottle(s)"
echo "count=${count}" >> "${GITHUB_OUTPUT:?}"

failed_json_files=(failed/*.json)
failures="${#failed_json_files[@]}"
echo "::notice ::${failures} failed bottle(s)"
echo "failures=${failures}" >> "${GITHUB_OUTPUT:?}"

skipped_lists=(skipped_or_failed_formulae-*.txt)
skipped="${#skipped_lists[@]}"
echo "::notice ::${skipped} list(s) of skipped formulae"
echo "skipped=${skipped}" >> "${GITHUB_OUTPUT:?}"

dependents_lists=(tested-dependents-*.txt)
dependents="${#dependents_lists[@]}"
echo "::notice ::${dependents} list(s) of successfully tested dependents"
echo "dependents=${dependents}" >> "${GITHUB_OUTPUT:?}"
