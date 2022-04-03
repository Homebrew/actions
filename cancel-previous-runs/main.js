const core = require('@actions/core')
const github = require('@actions/github')
const fs = require('fs')

async function main() {
    try {
        const token = core.getInput("token", { required: true })

        const client = github.getOctokit(token)

        // Parse event
        const json = fs.readFileSync(process.env.GITHUB_EVENT_PATH, { encoding: "utf-8" })
        const event = JSON.parse(json)
        const pull = event.pull_request

        const repoWorkflowRuns = await client.rest.actions.listWorkflowRunsForRepo({
            ...github.context.repo,
            branch: pull.head.ref,
            event: "pull_request",
            status: "in_progress OR queued"
        })

        // Map branch to workflow ID to workflow runs
        const branchToIDToRuns = new Map()

        for (const workflowRun of repoWorkflowRuns.data.workflow_runs) {
            // GitHub can still return completed workflow runs, check it
            if (workflowRun.status == "completed")
                continue

            // Check if conclusion is not null
            if (workflowRun.conclusion)
                continue

            // Make branch be in format "user:branch"
            const branch = workflowRun.head_repository.owner.login + ":" + workflowRun.head_branch

            // Initialize nested map
            if (!branchToIDToRuns.has(branch))
                branchToIDToRuns.set(branch, new Map())

            // Initialize array of workflow runs
            if (!branchToIDToRuns.get(branch).has(workflowRun.workflow_id))
                branchToIDToRuns.get(branch).set(workflowRun.workflow_id, [])

            branchToIDToRuns.get(branch).get(workflowRun.workflow_id).push(workflowRun)
        }

        // Iterate over map
        for (const branchAndIDToRuns of branchToIDToRuns) {
            const branch = branchAndIDToRuns[0]
            const workflowIDToRuns = branchAndIDToRuns[1]

            for (const workflowIDAndRuns of workflowIDToRuns) {
                const workflowID = workflowIDAndRuns[0]
                const workflowRuns = workflowIDAndRuns[1]

                // Only one workflow run is good
                if (workflowRuns.length == 1)
                    continue

                // First run in array is the freshest one, keep it running
                workflowRuns.shift()

                for (const workflowRun of workflowRuns) {
                    core.info(`Cancelling workflow run #${workflowRun.id} for "${branch}" branch`)

                    await client.rest.actions.cancelWorkflowRun({
                        ...github.context.repo,
                        run_id: workflowRun.id
                    })
                }
            }
        }
    } catch (error) {
        core.setFailed(error)
    }
}

main()
