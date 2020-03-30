const core = require('@actions/core')
const github = require('@actions/github')

async function main() {
    try {
        const token = core.getInput("token", { required: true })

        const client = new github.GitHub(token)

        let githubActor = process.env.GITHUB_ACTOR
        if (!githubActor)
            throw "GITHUB_ACTOR is not defined"

        let githubEventName = process.env.GITHUB_EVENT_NAME
        if (!githubEventName)
            throw "GITHUB_EVENT_NAME is not defined"

        let githubRunId = process.env.GITHUB_RUN_ID
        if (!githubRunId)
            throw "GITHUB_RUN_ID is not defined"

        let githubWorkflow = process.env.GITHUB_WORKFLOW
        if (!githubWorkflow)
            throw "GITHUB_WORKFLOW is not defined"

        // If GITHUB_HEAD_REF is set, then it is a PR branch from forked repo
        // and we should use it, instead of standard GITHUB_REF.
        //
        // GITHUB_HEAD_REF format = <BRANCH>
        // GITHUB_REF format = refs/heads/<BRANCH>
        let githubHeadRef = process.env.GITHUB_HEAD_REF
        let githubRef = process.env.GITHUB_REF
        if (!githubRef)
            throw "GITHUB_REF is not defined"
        else
            githubRef = githubRef.replace(/^refs\/heads\//, "")

        console.log(
            "-----------------------------",
            `\n==> Actor: ${githubActor}`,
            `\n==> Event: ${githubEventName}`,
            `\n==> RunId: ${githubRunId}`,
            `\n==> Workflow: ${githubWorkflow}`,
            `\n==> HeadRef: ${githubHeadRef}`,
            `\n==> Ref: ${githubRef}`,
            "\n-----------------------------"
        )

        const allWorkflows = await client.actions.listRepoWorkflows({
            ...github.context.repo,
            per_page: 100
        })

        const matchingWorkflow = allWorkflows.data.workflows.find(workflow => workflow.name == githubWorkflow)

        const allRuns = await client.actions.listWorkflowRuns({
            ...github.context.repo,
            actor: githubActor,
            branch: githubHeadRef ? githubHeadRef : githubRef,
            event: githubEventName,
            workflow_id: matchingWorkflow.id,
            per_page: 100
        })

        const matchingRuns = allRuns.data.workflow_runs.filter(run => {
            if (run.id.toString() == githubRunId)
                return false
            if (run.status == "completed")
                return false
            return true
        })

        console.log("==> Total matching workflow runs:", matchingRuns.length)

        for (const run of matchingRuns) {
            console.log("==> Cancelling run:", run.id)
            await client.actions.cancelWorkflowRun({
                ...github.context.repo,
                run_id: run.id
            })
        }
    } catch (error) {
        core.setFailed(error)
    }
}

main()