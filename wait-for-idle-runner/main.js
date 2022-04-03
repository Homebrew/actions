const core = require('@actions/core')
const github = require('@actions/github')

const NUMBER_OF_ATTEMPTS = 300
const TIME_BETWEEN_ATTEMPTS_SECONDS = 60

async function main() {
  try {
    const token = core.getInput("github_token", { required: true })
    const runnerName = core.getInput("runner_name", { required: true })
    const [owner, repo] = core.getInput("repository_name", { required: true }).split("/")

    const client = github.getOctokit(token)

    for (var i = 0; i < NUMBER_OF_ATTEMPTS; i++) {
      const result = await client.rest.actions.listSelfHostedRunnersForRepo({
        owner: owner,
        repo: repo,
      })

      // Select the runner based on its name
      const runner = result.data.runners.find(runner => runner.name == runnerName)

      if (!runner) {
        core.setOutput("runner-found", false)
        return
      }

      if (!runner.busy) {
        core.setOutput("runner-found", true)
        core.setOutput("runner-idle", true)
        return
      }

      core.info("Runner is busy, waiting...")
      await new Promise(resolve => setTimeout(resolve, 1000*TIME_BETWEEN_ATTEMPTS_SECONDS))
    }

    core.setOutput("runner-found", true)
    core.setOutput("runner-idle", false)

  } catch (error) {
    core.setFailed(error.message)
  }
}

main()
