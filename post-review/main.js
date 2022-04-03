const core = require('@actions/core')
const github = require('@actions/github')

async function main() {
  try {
    const token = core.getInput("token", { required: true })
    const pullRequest = core.getInput("pull_request", { required: true })
    const event = core.getInput("event", { required: true })
    const body = core.getInput("body")

    if ((event === 'COMMENT' || event === 'REQUEST_CHANGES') && !body) {
      core.setFailed('Event type COMMENT and REQUEST_CHANGES require a body.');
    }

    const client = github.getOctokit(token)

    core.info(`==> Creating review for pull request #${pullRequest}`)

    await client.rest.pulls.createReview({
      ...github.context.repo,
      pull_number: pullRequest,
      event: event,
      body: body
    })
  } catch (error) {
    core.setFailed(error.message)
  }
}

main()
