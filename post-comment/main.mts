import core from "@actions/core"
import github from "@actions/github"

async function main() {
    try {
        const token = core.getInput("token", { required: true })
        const issue = parseInt(core.getInput("issue", { required: true }), 10)
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
        if (!Error.isError(error)) throw error

        core.setFailed(error)
    }
}

await main()
