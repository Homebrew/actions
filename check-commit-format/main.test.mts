import fs from "fs"
import os from "os"
import path from "path"
import util from "util"

describe("check-commit-format", async () => {
  const token = "fake-token"
  const pr = 12345
  const sha = "abcdef1234567890abcdef1234567890abcdef12"
  const failureLabel = "failure-label"
  const autosquashLabel = "autosquash-label"
  const ignoreLabel = "ignore-label"
  const contributor = { name: "Homebrew Contributor", email: "contributor@example.com" }

  beforeEach(() => {
    mockInput("token", token)
    mockInput("failure_label", failureLabel)
    mockInput("autosquash_label", autosquashLabel)
    mockInput("ignore_label", ignoreLabel)
    mockInput("check_package_commit_format", "true")

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
    if (process.env.GITHUB_EVENT_PATH) {
      fs.rmSync(path.dirname(process.env.GITHUB_EVENT_PATH), { recursive: true })
    }
  })

  describe("on a correct commit", async () => {
    beforeEach(() => {
      const mockPool = githubMockPool()

      mockPool.intercept({
        method: "GET",
        path: `/repos/${GITHUB_REPOSITORY}/pulls/${pr}/commits`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, [
        {
          sha: sha,
        },
      ])

      mockPool.intercept({
        method: "GET",
        path: `/repos/${GITHUB_REPOSITORY}/commits/${sha}`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, {
        sha: sha,
        parents: [{ sha: "abcdef1234567890abcdef1234567890abcdef11" }],
        files: [{ filename: "Formula/foo.rb" }],
        commit: {
          message: "foo: some commit",
          author: contributor,
        }
      })
    })

    it("succeeds without updating labels or creating a commit status", async () => {
      const mockPool = githubMockPool()

      mockPool.intercept({
        method: "GET",
        path: `/repos/${GITHUB_REPOSITORY}/issues/${pr}/labels`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, [])

      await loadMain()
    })

    it("succeeds while removing existing failure labels", async () => {
      const mockPool = githubMockPool()

      mockPool.intercept({
        method: "GET",
        path: `/repos/${GITHUB_REPOSITORY}/issues/${pr}/labels`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, [
        { name: "other-label" },
        { name: failureLabel },
      ])

      mockPool.intercept({
        method: "PATCH",
        path: `/repos/${GITHUB_REPOSITORY}/issues/${pr}`,
        headers: {
          Authorization: `token ${token}`,
        },
        body: (body) => util.isDeepStrictEqual(JSON.parse(body), {
          labels: ["other-label"],
        }),
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, {})

      await loadMain()
    })
  })

  describe("on a merge commit", async () => {
    beforeEach(() => {
      const mockPool = githubMockPool()

      mockPool.intercept({
        method: "GET",
        path: `/repos/${GITHUB_REPOSITORY}/pulls/${pr}/commits`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, [
        {
          sha: sha,
        },
      ])

      mockPool.intercept({
        method: "GET",
        path: `/repos/${GITHUB_REPOSITORY}/commits/${sha}`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, {
        sha: sha,
        parents: [
          { sha: "abcdef1234567890abcdef1234567890abcdef11" },
          { sha: "abcdef1234567890abcdef1234567890abcdef12" }
        ],
        files: [],
        commit: {
          message: "Merge commit",
          author: contributor,
        }
      })
    })

    it("fails and adds a failure label", async () => {
      const mockPool = githubMockPool()

      mockPool.intercept({
        method: "GET",
        path: `/repos/${GITHUB_REPOSITORY}/issues/${pr}/labels`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, [
        { name: "other-label" },
      ])

      mockPool.intercept({
        method: "PATCH",
        path: `/repos/${GITHUB_REPOSITORY}/issues/${pr}`,
        headers: {
          Authorization: `token ${token}`,
        },
        body: (body) => util.isDeepStrictEqual(JSON.parse(body), {
          labels: ["other-label", failureLabel],
        }),
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, {})

      await assert.rejects(
        loadMain(),
        new Error(`${sha.substring(0, 10)} has 2 parents. Please rebase against origin/HEAD.`),
      )
    })

    it("preserves the validation failure when adding its label fails", async () => {
      const mockPool = githubMockPool()

      mockPool.intercept({
        method: "GET",
        path: `/repos/${GITHUB_REPOSITORY}/issues/${pr}/labels`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, [
        { name: "other-label" },
      ])

      mockPool.intercept({
        method: "PATCH",
        path: `/repos/${GITHUB_REPOSITORY}/issues/${pr}`,
        headers: {
          Authorization: `token ${token}`,
        },
        body: (body) => util.isDeepStrictEqual(JSON.parse(body), {
          labels: ["other-label", failureLabel],
        }),
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(403, {
        message: "Resource not accessible by integration",
      })

      await assert.rejects(
        loadMain(),
        new Error(`${sha.substring(0, 10)} has 2 parents. Please rebase against origin/HEAD.`),
      )
    })

  })

  describe("on an empty commit", async () => {
    beforeEach(() => {
      const mockPool = githubMockPool()

      mockPool.intercept({
        method: "GET",
        path: `/repos/${GITHUB_REPOSITORY}/pulls/${pr}/commits`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, [
        {
          sha: sha,
        },
      ])

      mockPool.intercept({
        method: "GET",
        path: `/repos/${GITHUB_REPOSITORY}/commits/${sha}`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, {
        sha: sha,
        parents: [{ sha: "abcdef1234567890abcdef1234567890abcdef11" }],
        files: [],
        commit: {
          message: "Empty commit",
          author: contributor,
        }
      })
    })

    it("fails and adds a failure label", async () => {
      const mockPool = githubMockPool()

      mockPool.intercept({
        method: "GET",
        path: `/repos/${GITHUB_REPOSITORY}/issues/${pr}/labels`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, [
        { name: "other-label" },
      ])

      mockPool.intercept({
        method: "PATCH",
        path: `/repos/${GITHUB_REPOSITORY}/issues/${pr}`,
        headers: {
          Authorization: `token ${token}`,
        },
        body: (body) => util.isDeepStrictEqual(JSON.parse(body), {
          labels: ["other-label", failureLabel],
        }),
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, {})

      await assert.rejects(
        loadMain(),
        new Error(`${sha.substring(0, 10)} is an empty commit.`),
      )
    })
  })

  describe("on an autosquashable incorrect commit", async () => {
    beforeEach(() => {
      const mockPool = githubMockPool()

      mockPool.intercept({
        method: "GET",
        path: `/repos/${GITHUB_REPOSITORY}/pulls/${pr}/commits`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, [
        {
          sha: sha,
        },
      ])

      mockPool.intercept({
        method: "GET",
        path: `/repos/${GITHUB_REPOSITORY}/commits/${sha}`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, {
        sha: sha,
        parents: [{ sha: "abcdef1234567890abcdef1234567890abcdef11" }],
        files: [{ filename: "Formula/foo.rb" }],
        commit: {
          message: "Update foo.rb",
          author: contributor,
        }
      })
    })

    it("fails and adds a autosquash label", async () => {
      const mockPool = githubMockPool()

      mockPool.intercept({
        method: "GET",
        path: `/repos/${GITHUB_REPOSITORY}/issues/${pr}/labels`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, [
        { name: "other-label" },
      ])

      mockPool.intercept({
        method: "PATCH",
        path: `/repos/${GITHUB_REPOSITORY}/issues/${pr}`,
        headers: {
          Authorization: `token ${token}`,
        },
        body: (body) => util.isDeepStrictEqual(JSON.parse(body), {
          labels: ["other-label", autosquashLabel],
        }),
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, {})

      await assert.rejects(
        loadMain(),
        new Error("Please follow the commit style guidelines, or this pull request will be replaced."),
      )
    })

    it("fails while retaining existing autosquash labels", async () => {
      const mockPool = githubMockPool()

      mockPool.intercept({
        method: "GET",
        path: `/repos/${GITHUB_REPOSITORY}/issues/${pr}/labels`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, [
        { name: autosquashLabel },
      ])

      await assert.rejects(
        loadMain(),
        new Error("Please follow the commit style guidelines, or this pull request will be replaced."),
      )
    })
  })

  describe("on multiple package commits", () => {
    function mockCommits(commits: Array<{ sha: string, filename: string, message: string }>) {
      const mockPool = githubMockPool()

      mockPool.intercept({
        method: "GET",
        path: `/repos/${GITHUB_REPOSITORY}/pulls/${pr}/commits`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, commits.map(commit => ({ sha: commit.sha })))

      for (const commit of commits) {
        mockPool.intercept({
          method: "GET",
          path: `/repos/${GITHUB_REPOSITORY}/commits/${commit.sha}`,
          headers: {
            Authorization: `token ${token}`,
          },
        }).defaultReplyHeaders({
          "Content-Type": "application/json",
        }).reply(200, {
          sha: commit.sha,
          parents: [{ sha: "abcdef1234567890abcdef1234567890abcdef11" }],
          files: [{ filename: commit.filename }],
          commit: {
            message: commit.message,
            author: contributor,
          }
        })
      }
    }

    function mockLabelUpdate(labels: Array<string>) {
      const mockPool = githubMockPool()

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
        body: (body) => util.isDeepStrictEqual(JSON.parse(body), { labels }),
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, {})
    }

    it("preserves the first validation failure message", async () => {
      mockCommits([
        { sha: `${sha.slice(0, -1)}1`, filename: "Formula/foo.rb", message: "Update foo.rb" },
        { sha: sha, filename: "docs/foo.md", message: "Update docs" },
      ])
      mockLabelUpdate([failureLabel, autosquashLabel])

      await assert.rejects(
        loadMain(),
        new Error("Please follow the commit style guidelines, or this pull request will be replaced."),
      )
    })
  })

  describe("in Homebrew/brew", () => {
    type Identity = { name: string, email: string }

    async function checkCommit(
      message: string,
      author: Identity,
      committer: Identity,
      files: Array<{ filename: string }>,
      failure?: string,
    ) {
      const repository = "Homebrew/brew"
      process.env.GITHUB_REPOSITORY = repository
      mockInput("check_package_commit_format", "false")

      const mockPool = githubMockPool()
      mockPool.intercept({
        method: "GET",
        path: `/repos/${repository}/pulls/${pr}/commits`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, [{ sha: sha }])

      mockPool.intercept({
        method: "GET",
        path: `/repos/${repository}/commits/${sha}`,
        headers: {
          Authorization: `token ${token}`,
        },
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, {
        sha: sha,
        parents: [{ sha: "abcdef1234567890abcdef1234567890abcdef11" }],
        files: files,
        commit: {
          message: message,
          author: author,
          committer: committer,
        },
      })

      if (failure) {
        await assert.rejects(loadMain(), new Error(failure))
      } else {
        await loadMain()
      }
    }

    const copilot = { name: "Coding Assistant", email: "175728472+Copilot@users.noreply.github.com" }
    const disallowedCommits = [
      {
        name: "an AI author without a co-author",
        message: "Improve checks",
        author: copilot,
        committer: contributor,
        description: "Commits must have a human author or co-author.",
      },
      {
        name: "an AI author with only AI co-authors",
        message: "Improve checks\n\nCo-authored-by: Claude Code <noreply@anthropic.com>",
        author: { name: "Codex", email: "noreply@openai.com" },
        committer: contributor,
        description: "Commits must have a human author or co-author.",
      },
      {
        name: "a missing author without a co-author",
        message: "Improve checks",
        author: { name: "", email: "" },
        committer: contributor,
        description: "Commits must have a human author or co-author.",
      },
      {
        name: "a conventional commit prefix",
        message: "fix: improve checks",
        author: contributor,
        committer: contributor,
        description: "Conventional commit prefixes are not allowed.",
      },
    ]

    for (const commit of disallowedCommits) {
      it(`rejects ${commit.name}`, async () => {
        await checkCommit(
          commit.message,
          commit.author,
          commit.committer,
          [{ filename: "README.md" }],
          commit.description,
        )
      })
    }

    const allowedCommits = [
      {
        name: "an AI co-author of a human author",
        message: "Improve checks\n\nCo-authored-by: Claude Code <noreply@anthropic.com>",
        author: contributor,
        committer: contributor,
      },
      {
        name: "a human co-author of an AI author",
        message: `Improve checks\n\nCo-authored-by: ${contributor.name} <${contributor.email}>`,
        author: copilot,
        committer: contributor,
      },
      {
        name: "an AI committer of a human author",
        message: "Improve checks",
        author: contributor,
        committer: { name: "Codex", email: "noreply@openai.com" },
      },
    ]

    for (const commit of allowedCommits) {
      it(`allows ${commit.name}`, async () => {
        await checkCommit(
          commit.message,
          commit.author,
          commit.committer,
          [{ filename: "README.md" }],
        )
      })
    }

    it("does not enforce package repository commit rules", async () => {
      await checkCommit(
        "Document ChatGPT support\n\nCo-authored-by: Another Contributor <another@example.com>",
        { name: "Claude Dupont", email: "claude@example.com" },
        contributor,
        [{ filename: "README.md" }, { filename: "docs/FAQ.md" }],
      )
    })
  })
})
