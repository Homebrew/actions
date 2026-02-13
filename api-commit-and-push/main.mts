import * as core from "@actions/core"
import * as github from "@actions/github"
import { getExecOutput } from "@actions/exec"
import fs from "node:fs/promises"
import path from "node:path"

import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods"

async function main() {
  const commitMessage = core.getInput("message")
  const branch = core.getInput("branch")
  const client = github.getOctokit(core.getInput("token"))
  const directory = core.getInput("directory")
  const [owner, repo] = core.getInput("repository").split("/")

  const files = (
    await getExecOutput("git", ["-C", directory, "diff", "--no-ext-diff", "--cached", "--name-only", "-z"], { silent: true })
  ).stdout.split("\0").filter(file => file.length !== 0)
  if (files.length === 0) {
    core.setFailed("No files to commit")
    return
  }

  const headCommitSha = (await getExecOutput("git", ["-C", directory, "rev-parse", "HEAD"], { silent: true })).stdout.trim()
  const headTreeSha = (await getExecOutput("git", ["-C", directory, "rev-parse", "HEAD:"], { silent: true })).stdout.trim()

  const tree: Record<string, RestEndpointMethodTypes["git"]["createTree"]["parameters"]["tree"][number]> = {}
  for (const file of files) {
    const absoluteFile = path.resolve(directory, file)

    let content;
    try {
      content = await fs.readFile(absoluteFile, {encoding: "base64"})
    } catch (error) {
      if (Error.isError(error) && "code" in error && error.code === "ENOENT") {
        content = null
      } else {
        throw error
      }
    }

    if (content !== null) {
      file.split("/").slice(0, -1).reduce((parentPath, component) => {
        const treePath = path.posix.join(parentPath, component);

        tree[treePath] ||= {
          path: treePath,
          mode: "040000",
          type: "tree"
        }

        return treePath;
      }, "")
    }

    tree[file] = {
      path: file,
      mode: "100644",
      type: "blob",
    }

    if (content !== null) {
      const blobResponse = await client.rest.git.createBlob({
        owner: owner,
        repo: repo,
        content: content,
        encoding: "base64"
      })

      tree[file].sha = blobResponse.data.sha
    } else {
      tree[file].sha = null
    }
  }

  const treeResponse = await client.rest.git.createTree({
    owner: owner,
    repo: repo,
    tree: Object.values(tree),
    base_tree: headTreeSha
  })

  const commitResponse = await client.rest.git.createCommit({
    owner: owner,
    repo: repo,
    message: commitMessage,
    tree: treeResponse.data.sha,
    parents: [headCommitSha]
  })

  await client.rest.git.updateRef({
    owner: owner,
    repo: repo,
    ref: `heads/${branch}`,
    sha: commitResponse.data.sha
  })

  core.info(`Pushed ${commitResponse.data.sha} to heads/${branch}`)
}

await main()
