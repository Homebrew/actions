import core from "@actions/core"
import exec from "@actions/exec"
import github from "@actions/github"
import fs from "node:fs/promises"
import path from "node:path"

async function main() {
  const commitMessage = core.getInput("message")
  const branch = core.getInput("branch")
  const client = github.getOctokit(core.getInput("token"))
  const directory = core.getInput("directory")
  const [owner, repo] = core.getInput("repository").split("/")

  const files = (
    await exec.getExecOutput("git", ["-C", directory, "diff", "--no-ext-diff", "--cached", "--name-only", "-z"], { silent: true })
  ).stdout.split("\0").filter(file => file.length !== 0)
  if (files.length === 0) {
    core.setFailed("No files to commit")
    return
  }

  const headCommitSha = (await exec.getExecOutput("git", ["-C", directory, "rev-parse", "HEAD"], { silent: true })).stdout.trim()
  const headTreeSha = (await exec.getExecOutput("git", ["-C", directory, "rev-parse", "HEAD:"], { silent: true })).stdout.trim()

  const tree = {}
  for (const file of files) {
    const absoluteFile = path.resolve(directory, file)

    let content;
    try {
      content = await fs.readFile(absoluteFile, {encoding: "base64"})
    } catch (error) {
      if (error.code !== "ENOENT") throw error;

      content = null;
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
        content: await fs.readFile(absoluteFile, {encoding: "base64"}),
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
