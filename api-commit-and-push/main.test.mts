import exec from "@actions/exec"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import util from "node:util"

import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods"

describe("api-commit-and-push", async () => {
  const token = "fake-token"
  const branch = "a-branch"
  const message = "Some message"
  let directory: string
  let baseCommitSha: string
  let baseTreeSha: string

  const blobSha = "abcdef1234567890abcdef1234567890abcdef12"
  const treeSha = "abcdef1234567890abcdef1234567890abcdef13"
  const commitSha = "abcdef1234567890abcdef1234567890abcdef14"
  const addedFile = ".github/workflows/example.yml"
  const removedFile = "someotherfile.rb"

  before(async () => {
    directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "api-commit-and-push-"))
    console.log(directory)

    // Setup test repository
    await exec.exec("git", ["-C", directory, "init"])
    await exec.exec("git", ["-C", directory, "config", "user.name", "github-actions[bot]"])
    await exec.exec("git", ["-C", directory, "config", "user.email", "github-actions[bot]@users.noreply.github.com"])
    await fs.promises.mkdir(path.join(directory, "somedir"))
    await fs.promises.writeFile(path.join(directory, "somedir", "somefile.rb"), "test file 1")
    await fs.promises.writeFile(path.join(directory, removedFile), "test file 2")
    await exec.exec("git", ["-C", directory, "add", "-A"])
    await exec.exec("git", ["-C", directory, "commit", "--no-gpg-sign", "-m", "Initial commit"])
    await fs.promises.unlink(path.join(directory, removedFile))
    await fs.promises.mkdir(path.join(directory, path.dirname(addedFile)), { recursive: true })
    await fs.promises.writeFile(path.join(directory, addedFile), "test file 3")
    await exec.exec("git", ["-C", directory, "add", "-A"])
    baseCommitSha = (await exec.getExecOutput("git", ["-C", directory, "rev-parse", "HEAD"])).stdout.trim()
    baseTreeSha = (await exec.getExecOutput("git", ["-C", directory, "rev-parse", "HEAD:"])).stdout.trim()
  })

  after(async () => {
    await fs.promises.rm(directory, { recursive: true })
  })

  beforeEach(async () => {
    mockInput("token", token)
    mockInput("branch", branch)
    mockInput("message", message)
    mockInput("repository", GITHUB_REPOSITORY)
    mockInput("directory", directory)
  })

  it("commits and pushes changes", async () => {
    const mockPool = githubMockPool()

    mockPool.intercept({
      method: "POST",
      path: `/repos/${GITHUB_REPOSITORY}/git/blobs`,
      headers: {
        Authorization: `token ${token}`,
      },
      body: (body) => util.isDeepStrictEqual(JSON.parse(body), {
        content: fs.readFileSync(path.join(directory, addedFile), { encoding: "base64" }),
        encoding: "base64",
      }),
    }).defaultReplyHeaders({
      "Content-Type": "application/json",
    }).reply(200, {
      sha: blobSha,
    })

    const tree: Array<RestEndpointMethodTypes["git"]["createTree"]["parameters"]["tree"][number]> = []
    addedFile.split("/").slice(0, -1).reduce((parentPath, component) => {
      const treePath = path.posix.join(parentPath, component);

      tree.push({
        path: treePath,
        mode: "040000",
        type: "tree",
      })

      return treePath;
    }, "")
    tree.push(
      {
        path: addedFile,
        mode: "100644",
        type: "blob",
        sha: blobSha,
      },
      {
        path: removedFile,
        mode: "100644",
        type: "blob",
        sha: null,
      }
    )

    mockPool.intercept({
      method: "POST",
      path: `/repos/${GITHUB_REPOSITORY}/git/trees`,
      headers: {
        Authorization: `token ${token}`,
      },
      body: (body) => util.isDeepStrictEqual(JSON.parse(body), {
        tree: tree,
        base_tree: baseTreeSha,
      }),
    }).defaultReplyHeaders({
      "Content-Type": "application/json",
    }).reply(200, {
      sha: treeSha,
    })

    mockPool.intercept({
      method: "POST",
      path: `/repos/${GITHUB_REPOSITORY}/git/commits`,
      headers: {
        Authorization: `token ${token}`,
      },
      body: (body) => util.isDeepStrictEqual(JSON.parse(body), {
        message: message,
        tree: treeSha,
        parents: [baseCommitSha],
      }),
    }).defaultReplyHeaders({
      "Content-Type": "application/json",
    }).reply(200, {
      sha: commitSha,
    })

    mockPool.intercept({
      method: "PATCH",
      path: `/repos/${GITHUB_REPOSITORY}/git/refs/heads%2F${branch}`,
      headers: {
        Authorization: `token ${token}`,
      },
      body: (body) => util.isDeepStrictEqual(JSON.parse(body), {
        sha: commitSha
      }),
    }).defaultReplyHeaders({
      "Content-Type": "application/json",
    }).reply(200, {})

    await loadMain()
  })

  it("aborts if no changes are found", async () => {
    await exec.exec("git", ["-C", directory, "reset"])

    await assert.rejects(loadMain, { message: "No files to commit" })
  })
})
