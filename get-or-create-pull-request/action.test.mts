import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

function run(env: Record<string, string> = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "get-or-create-pr-"))
  try {
    fs.writeFileSync(path.join(cwd, "gh"), `#!/bin/bash
set -eu
echo "$GH_TOKEN $*" >> calls
if [[ "$1" == api ]]; then
  [[ "$GH_TOKEN" == read ]] || exit 1
  [[ "$*" != *"--slurp --jq"* ]] || exit 2
  [[ "$LOOKUP_ERROR" == false ]] || exit 2
  number=$EXISTING_PR
  if [[ -f opened ]]; then number=42; fi
  jq -nr --arg number "$number" '
    [[{number: 10, head: {repo: {id: 2}}, base: {repo: {id: 1}}}],
     [select($number != "") | {number: ($number | tonumber), head: {repo: {id: 1}}, base: {repo: {id: 1}}}]]
  '
else
  [[ "$GH_TOKEN" == write && "$1 $2" == "pr create" ]] || exit 1
  if [[ "$CREATE_RESULT" == race || "$CREATE_RESULT" == partial ]]; then
    touch opened
    if [[ "$CREATE_RESULT" == race ]]; then exit 1; fi
    echo https://github.com/owner/repo/pull/42
    echo "pull request update failed: could not apply labels" >&2
    exit 3
  fi
  [[ "$CREATE_RESULT" == ok ]] || exit 3
  echo https://github.com/owner/repo/pull/17
fi
`, { mode: 0o755 })
    fs.writeFileSync(path.join(cwd, "calls"), "")
    const result = spawnSync("bash", [fileURLToPath(new URL("main.sh", import.meta.url))], {
      cwd, encoding: "utf8",
      env: {
        PATH: cwd + ":" + process.env.PATH, GITHUB_OUTPUT: path.join(cwd, "output"),
        GH_REPO: "owner/repo", PR_HEAD: "topic", PR_BASE: "", CREATE_IF_MISSING: "true",
        READ_TOKEN: "read", GH_TOKEN: "write", PR_TITLE: "", PR_BODY: "", PR_BODY_FILE: "", PR_LABELS: "",
        EXISTING_PR: "", LOOKUP_ERROR: "false", CREATE_RESULT: "ok", ...env,
      },
    })
    const output = path.join(cwd, "output")
    return {
      status: result.status,
      calls: fs.readFileSync(path.join(cwd, "calls"), "utf8").trimEnd().split("\n").filter(Boolean),
      output: fs.existsSync(output) ? fs.readFileSync(output, "utf8") : "",
    }
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
}

describe("get-or-create-pull-request", () => {
  it("returns an existing same-repository PR using the read token", () => {
    const result = run({ EXISTING_PR: "23", PR_BASE: "release" })
    assert.equal(result.status, 0)
    assert.equal(result.output, "number=23\ncreated=false\n")
    assert.equal(result.calls.length, 1)
    assert.match(result.calls[0], /repos\/owner\/repo\/pulls .*head=owner:topic .*base=release/)
  })

  it("requires a branch in the target repository", () => {
    const result = run({ PR_HEAD: "fork:topic" })
    assert.notEqual(result.status, 0)
    assert.equal(result.calls.length, 0)
  })

  it("supports lookup without creation and propagates lookup errors", () => {
    const missing = run({ CREATE_IF_MISSING: "false" })
    assert.equal(missing.output, "number=\ncreated=false\n")
    assert.equal(missing.calls.length, 1)
    const failure = run({ LOOKUP_ERROR: "true" })
    assert.notEqual(failure.status, 0)
    assert.equal(failure.calls.length, 1)
  })

  it("uses commit messages by default and returns the new PR number", () => {
    const result = run()
    assert.equal(result.status, 0)
    assert.equal(result.calls[1], "write pr create --head topic --fill")
    assert.equal(result.output, "number=17\ncreated=true\n")
  })

  it("accepts explicit PR metadata and a body file", () => {
    const env = { PR_BASE: "main", PR_TITLE: "Bump Ruby", PR_BODY: "Release notes", PR_LABELS: "CI-no-bottles" }
    assert.equal(run(env).calls[1], "write pr create --head topic --base main --title Bump Ruby --body Release notes --label CI-no-bottles")
    assert.match(run({ PR_TITLE: "Report", PR_BODY_FILE: "report.md" }).calls[1], /--title Report --body-file report.md$/)
  })

  it("returns the competing PR after a race and fails on other create errors", () => {
    const race = run({ CREATE_RESULT: "race" })
    assert.equal(race.status, 0)
    assert.equal(race.output, "number=42\ncreated=false\n")
    assert.notEqual(run({ CREATE_RESULT: "error" }).status, 0)
  })

  it("propagates a label failure after opening the PR", () => {
    const result = run({ CREATE_RESULT: "partial", PR_LABELS: "CI-no-bottles" })
    assert.equal(result.status, 3)
    assert.equal(result.calls.length, 2)
    assert.equal(result.output, "")
  })
})
