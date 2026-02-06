import * as core from "@actions/core"
import * as github from "@actions/github"

async function main() {
    try {
        const token = core.getInput("token", { required: true })
        const pr = parseInt(core.getInput("pr", { required: true }), 10)
        const message = core.getInput("message", { required: true })

        const client = github.getOctokit(token)

        const reviews = await client.rest.pulls.listReviews({
            ...github.context.repo,
            pull_number: pr
        })

        for (const review of reviews.data) {
            if (review.state != "APPROVED")
                continue

            core.info(`==> Dismissing approvals in PR #${pr}`)

            await client.rest.pulls.dismissReview({
                ...github.context.repo,
                pull_number: pr,
                review_id: review.id,
                message: message
            });
        }
    } catch (error) {
        if (!Error.isError(error)) throw error

        core.setFailed(error)
    }
}

await main()
