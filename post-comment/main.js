const core = require('@actions/core')
const github = require('@actions/github')

async function main() {
    try {
        const token = core.getInput("token", { required: true })
        const issue = core.getInput("issue", { required: true })
        const body = core.getInput("body")
        const bot_body = core.getInput("bot_body")
        const bot = core.getInput("bot")

        const client = github.getOctokit(token)

        core.info(`==> Posting comment on issue #${issue}`)

        await client.rest.issues.createComment({
            ...github.context.repo,
            issue_number: issue,
            body: github.context.actor == bot ? bot_body : body
        })
    } catch (error) {
        core.setFailed(error.message)
    }
}

main()
