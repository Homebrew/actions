import core from "@actions/core"
import github from "@actions/github"

async function main() {
  try {
    const token = core.getInput("token", { required: true })
    const [owner, repo] = core.getInput("repository", { required: true }).split("/")
    const head = core.getInput("head", { required: true })
    const base = core.getInput("base", { required: true })

    const title = core.getInput("title")
    const body = core.getInput("body")

    const labels = core.getInput("labels").split(",")
    const reviewers = core.getInput("reviewers").split(",")

    const client = github.getOctokit(token)

    let prRequest = { owner, repo, head, base }
    if (title) {
      prRequest.title = title
    }
    if (body) {
      prRequest.body = body
    }

    const response = await client.rest.pulls.create(prRequest)
    const prNumber = response.data.number

    if (labels) {
      await client.rest.issues.addLabels({
        owner,
        repo,
        issue_number: prNumber,
        labels
      })
    }

    if (reviewers) {
      await client.rest.pulls.requestReviewers({
        owner,
        repo,
        pull_number: prNumber,
        reviewers
      })
    }

    core.setOutput("number", prNumber)
  } catch (error) {
    core.setFailed(error)
  }
}

await main()
