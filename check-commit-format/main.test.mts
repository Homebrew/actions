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
        }
      })

      mockPool.intercept({
        method: "POST",
        path: `/repos/${GITHUB_REPOSITORY}/statuses/${sha}`,
        headers: {
          Authorization: `token ${token}`,
        },
        body: (body) => util.isDeepStrictEqual(JSON.parse(body), {
          state:       "success",
          description: "Commit format is correct.",
          context:     "Commit style",
          target_url:  "https://docs.brew.sh/Formula-Cookbook#commit"
        }),
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, {})
    })

    it("succeeds without updating labels", async () => {
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
        }
      })

      mockPool.intercept({
        method: "POST",
        path: `/repos/${GITHUB_REPOSITORY}/statuses/${sha}`,
        headers: {
          Authorization: `token ${token}`,
        },
        body: (body) => util.isDeepStrictEqual(JSON.parse(body), {
          state:       "failure",
          description: `${sha.substring(0, 10)} has 2 parents. Please rebase against origin/HEAD.`,
          context:     "Commit style",
          target_url:  "https://docs.brew.sh/Formula-Cookbook#commit"
        }),
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, {})
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

      await loadMain()
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
        }
      })

      mockPool.intercept({
        method: "POST",
        path: `/repos/${GITHUB_REPOSITORY}/statuses/${sha}`,
        headers: {
          Authorization: `token ${token}`,
        },
        body: (body) => util.isDeepStrictEqual(JSON.parse(body), {
          state:       "failure",
          description: `${sha.substring(0, 10)} is an empty commit.`,
          context:     "Commit style",
          target_url:  "https://docs.brew.sh/Formula-Cookbook#commit"
        }),
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, {})
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

      await loadMain()
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
        }
      })

      mockPool.intercept({
        method: "POST",
        path: `/repos/${GITHUB_REPOSITORY}/statuses/${sha}`,
        headers: {
          Authorization: `token ${token}`,
        },
        body: (body) => util.isDeepStrictEqual(JSON.parse(body), {
          state:       "failure",
          description: "Please follow the commit style guidelines, or this pull request will be replaced.",
          context:     "Commit style",
          target_url:  "https://docs.brew.sh/Formula-Cookbook#commit"
        }),
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, {})
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

      await loadMain()
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

      await loadMain()
    })
  })

  describe("in Homebrew/brew", () => {
    type Identity = { name: string, email: string }

    async function checkCommit(
      message: string,
      author: Identity,
      committer: Identity,
      files: Array<{ filename: string }>,
      state: "success" | "failure",
      description: string,
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

      mockPool.intercept({
        method: "POST",
        path: `/repos/${repository}/statuses/${sha}`,
        headers: {
          Authorization: `token ${token}`,
        },
        body: (body) => util.isDeepStrictEqual(JSON.parse(body), {
          state:       state,
          description: description,
          context:     "Commit style",
          target_url:  "https://github.com/Homebrew/brew/blob/HEAD/CONTRIBUTING.md",
        }),
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, {})

      await loadMain()
    }

    const contributor = { name: "Homebrew Contributor", email: "contributor@example.com" }
    const disallowedCommits = [
      {
        name: "an AI author email",
        message: "Improve checks",
        author: { name: "Coding Assistant", email: "175728472+Copilot@users.noreply.github.com" },
        committer: contributor,
        description: "AI author or committer attribution is not allowed.",
      },
      {
        name: "an AI committer",
        message: "Improve checks",
        author: contributor,
        committer: { name: "Codex", email: "noreply@openai.com" },
        description: "AI author or committer attribution is not allowed.",
      },
      {
        name: "an AI commit trailer",
        message: "Improve checks\n\nCo-authored-by: Coding Assistant <copilot@github.com>",
        author: contributor,
        committer: contributor,
        description: "AI commit trailer attribution is not allowed.",
      },
      {
        name: "a generic AI assistant trailer",
        message: "Improve checks\n\nCo-authored-by: AI Assistant <assistant@example.com>",
        author: contributor,
        committer: contributor,
        description: "AI commit trailer attribution is not allowed.",
      },
      {
        name: "an AI signatory",
        message: "Improve checks\n\nSigned-off-by: Codex <noreply@openai.com>",
        author: contributor,
        committer: contributor,
        description: "AI commit trailer attribution is not allowed.",
      },
      {
        name: "an assisted-by AI trailer",
        message: "Improve checks\n\nAssisted-by: Claude Code <noreply@anthropic.com>",
        author: contributor,
        committer: contributor,
        description: "AI commit trailer attribution is not allowed.",
      },
      {
        name: "a co-developed-by AI trailer",
        message: "Improve checks\n\nCo-developed-by: Gemini CLI <gemini-cli@google.com>",
        author: contributor,
        committer: contributor,
        description: "AI commit trailer attribution is not allowed.",
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
          "failure",
          commit.description,
        )
      })
    }

    it("does not enforce package repository commit rules", async () => {
      await checkCommit(
        "Document ChatGPT support\n\nCo-authored-by: Another Contributor <another@example.com>",
        { name: "Claude Dupont", email: "claude@example.com" },
        contributor,
        [{ filename: "README.md" }, { filename: "docs/FAQ.md" }],
        "success",
        "Commit format is correct.",
      )
    })
  })
})
