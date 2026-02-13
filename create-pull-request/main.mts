import * as core from "@actions/core"
import * as github from "@actions/github"

import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods"

async function main() {
  try {
    const token = core.getInput("token", { required: true })
    const [owner, repo] = core.getInput("repository", { required: true }).split("/")
    const head = core.getInput("head", { required: true })
    const base = core.getInput("base", { required: true })

    const title = core.getInput("title")
    const body = core.getInput("body")

    const labelsInput = core.getInput("labels")
    const labels = labelsInput ? labelsInput.split(",") : []
    const reviewersInput = core.getInput("reviewers")
    const reviewers = reviewersInput ? reviewersInput.split(",") : []

    const client = github.getOctokit(token)

    let prRequest: RestEndpointMethodTypes["pulls"]["create"]["parameters"] = { owner, repo, head, base }
    if (title) {
      prRequest.title = title
    }
    if (body) {
      prRequest.body = body
    }

    const response = await client.rest.pulls.create(prRequest)
    const prNumber = response.data.number
    const prNodeId = response.data.node_id
    const prUrl = response.data.html_url

    core.info(`Created pull request ${prUrl}`)

    if (labels.length > 0) {
      await client.rest.issues.addLabels({
        owner,
        repo,
        issue_number: prNumber,
        labels
      })

      core.info(`Added labels ${labels.join(", ")} to pull request`)
    }

    if (reviewers.length > 0) {
      await client.rest.pulls.requestReviewers({
        owner,
        repo,
        pull_number: prNumber,
        reviewers
      })

      core.info(`Requested review from ${reviewers.join(", ")} for pull request`)
    }

    core.setOutput("number", prNumber)
    core.setOutput("node_id", prNodeId)
  } catch (error) {
    if (!Error.isError(error)) throw error

    core.setFailed(error)
  }
}

await main()
