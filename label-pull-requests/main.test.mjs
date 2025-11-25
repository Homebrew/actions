import fs from "fs"
import os from "os"
import path from "path"
import util from "util"

describe("label-pull-requests", async () => {
  const token = "fake-token"
  const pr = 12345
  const fileSha = "abcdef1234567890abcdef1234567890abcdef12"
  const label = "wontfix"
  const existingLabel = "existing-label"

  beforeEach(() => {
    mockInput("token", token)

    const tempdir = fs.mkdtempSync(path.join(os.tmpdir(), "check-commit-format-"))
    const tempfile = `${tempdir}/event.json`
    fs.writeFileSync(tempfile, JSON.stringify({
      pull_request: {
        number: pr,
      },
    }))
    process.env.GITHUB_EVENT_PATH = tempfile
  })

  afterEach(() => {
    fs.rmSync(path.dirname(process.env.GITHUB_EVENT_PATH), { recursive: true })
  })

  describe("correctly labels", async () => {
    beforeEach(() => {
      const mockPool = githubMockPool()

      mockPool.intercept({
        method: "GET",
        path: `/repos/${GITHUB_REPOSITORY}/pulls/${pr}/files`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, [
        {
          sha:      fileSha,
          filename: "some/file.txt",
        },
      ])

      mockPool.intercept({
        method: "GET",
        path: `/repos/${GITHUB_REPOSITORY}/pulls/${pr}`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, {
        body: "Created with `brew bump-formula-pr`.",
      })

      mockPool.intercept({
        method: "GET",
        path: `/repos/${GITHUB_REPOSITORY}/git/blobs/${fileSha}`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, {
        content:  "This is the file contents.",
        encoding: "ascii",
      })

      mockPool.intercept({
        method: "GET",
        path: `/repos/${GITHUB_REPOSITORY}/issues/${pr}/labels`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, [
        {
          name: existingLabel,
        },
      ])

      mockPool.intercept({
        method: "PATCH",
        path: `/repos/${GITHUB_REPOSITORY}/issues/${pr}`,
        headers: {
          Authorization: `token ${token}`,
        },
        body: (body) => util.isDeepStrictEqual(JSON.parse(body), {
          labels: [existingLabel, label],
        }),
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, {})
    })

    it("with JSON input", async () => {
      mockInput("def", `
[
  {
    "label": "${label}",
    "path": ".+"
  }
]
      `)

      await loadMain()
    })

    it("with YAML input", async () => {
      mockInput("def", `
- label: ${label}
  path: .+
      `)

      await loadMain()
    })
  })

  describe("patch content constraints", async () => {
    it("labels when patch content matches", async () => {
      const mockPool = githubMockPool()

      mockPool.intercept({
        method: "GET",
        path: `/repos/${GITHUB_REPOSITORY}/pulls/${pr}/files`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, [
        {
          sha:      fileSha,
          filename: "some/file.txt",
          patch:    "@@ -1,3 +1,3 @@\n-foo\n+generate_completions_from_executable\n bar",
        },
      ])

      mockPool.intercept({
        method: "GET",
        path: `/repos/${GITHUB_REPOSITORY}/pulls/${pr}`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, {
        body: "Created with `brew bump-formula-pr`.",
      })

      mockPool.intercept({
        method: "GET",
        path: `/repos/${GITHUB_REPOSITORY}/git/blobs/${fileSha}`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, {
        content:  "This is the file contents.",
        encoding: "ascii",
      })

      mockPool.intercept({
        method: "GET",
        path: `/repos/${GITHUB_REPOSITORY}/issues/${pr}/labels`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, [])

      mockPool.intercept({
        method: "PATCH",
        path: `/repos/${GITHUB_REPOSITORY}/issues/${pr}`,
        headers: {
          Authorization: `token ${token}`,
        },
        body: (body) => util.isDeepStrictEqual(JSON.parse(body), {
          labels: [label],
        }),
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, {})

      mockInput("def", `
- label: ${label}
  path: .+
  patch_content: 'generate_completions_from_executable'
      `)

      await loadMain()
    })

    it("does not label when patch is null", async () => {
      const mockPool = githubMockPool()

      mockPool.intercept({
        method: "GET",
        path: `/repos/${GITHUB_REPOSITORY}/pulls/${pr}/files`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, [
        {
          sha:      fileSha,
          filename: "some/file.txt",
          patch:    null,
        },
      ])

      mockPool.intercept({
        method: "GET",
        path: `/repos/${GITHUB_REPOSITORY}/pulls/${pr}`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, {
        body: "Created with `brew bump-formula-pr`.",
      })

      mockPool.intercept({
        method: "GET",
        path: `/repos/${GITHUB_REPOSITORY}/git/blobs/${fileSha}`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, {
        content:  "This is the file contents.",
        encoding: "ascii",
      })

      mockPool.intercept({
        method: "GET",
        path: `/repos/${GITHUB_REPOSITORY}/issues/${pr}/labels`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, [])

      mockInput("def", `
- label: ${label}
  path: .+
  patch_content: ['generate_completions_from_executable']
      `)

      await loadMain()
    })
  })
})
