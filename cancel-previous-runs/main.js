const core = require('@actions/core')
const github = require('@actions/github')

async function main() {
    try {
        const token = core.getInput("token", { required: true })
        const workflow = core.getInput("workflow", { required: true })
        const event = core.getInput("event")

        const client = github.getOctokit(token)

        const allRuns = await client.actions.listWorkflowRuns({
            ...github.context.repo,
            workflow_id: workflow,
            event: event,
            status: "in_progress OR queued"
        })

        const branchToRuns = new Map()

        // Map branch to workflow runs
        for (const run of allRuns.data.workflow_runs) {
            // Make branch be in format "user:branch"
            const branch = run.head_repository.owner.login + ":" + run.head_branch

            // Initialize array
            if (!branchToRuns.has(branch))
                branchToRuns.set(branch, [])

            branchToRuns.get(branch).push(run)
        }

        // Iterate over map
        for (const branchAndRuns of branchToRuns) {
            const branch = branchAndRuns[0]
            const runs = branchAndRuns[1]

            // Only one workflow run is good
            if (runs.length == 1)
                continue

            // First run in array is the freshest one, keep it running
            const run = runs.shift()

            core.info(`==> For branch: "${branch}", these workflow runs: [${runs.map(run => run.id)}] are duplicates of: ${run.id}`)

            for (const run of runs) {
                core.info(`==> Cancelling workflow run: ${run.id}`)

                await client.actions.cancelWorkflowRun({
                    ...github.context.repo,
                    run_id: run.id
                })
            }
        }
    } catch (error) {
        core.setFailed(error)
    }
}

main()
