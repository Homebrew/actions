const core = require('@actions/core')
const github = require('@actions/github')
const ab2b = require('arraybuffer-to-buffer')
const stream = require('stream')
const unzip = require('unzipper');

async function main() {
    try {
        const token = core.getInput("github_token", { required: true })
        const workflow = core.getInput("workflow", { required: true })
        const name = core.getInput("name", { required: true })
        const path = core.getInput("path") || "./"
        const pr = core.getInput("pr")
        let commit = core.getInput("commit")

        const client = new github.GitHub(token)

        client.registerEndpoints({
            actions: {
                listWorkflowRunsFixed: {
                    method: "GET",
                    url: "/repos/:owner/:repo/actions/workflows/:workflow_id/runs",
                    headers: {
                        accept: "application/vnd.github.groot-preview+json"
                    },
                    params: {
                        owner: {
                            required: true,
                            type: "string"
                        },
                        repo: {
                            required: true,
                            type: "string"
                        },
                        workflow_id: {
                            required: true,
                            type: "string",
                        }
                    }
                }
            }
        })

        if (pr) {
            console.log("==> PR:", pr)

            const pull = await client.pulls.get({
                ...github.context.repo,
                pull_number: pr,
            })
            commit = pull.data.head.sha
        }

        console.log("==> Commit:", commit)

        // https://github.com/octokit/routes/issues/665
        const options = client.actions.listWorkflowRunsFixed.endpoint.merge({
            ...github.context.repo,
            workflow_id: workflow
        })

        let run
        for await (const response of client.paginate.iterator(options)) {
            const matching_run = response.data.workflow_runs.find((workflow_run) => {
                return workflow_run.head_sha == commit
            })
            if (matching_run) {
                run = matching_run
                break
            }
        }

        console.log("==> Run:", run.id)

        const artifacts = await client.actions.listWorkflowRunArtifacts({
            ...github.context.repo,
            run_id: run.id,
        })

        const artifact = artifacts.data.artifacts.find((artifact) => {
            return artifact.name == name
        })

        console.log("==> Artifact:", artifact.id)

        const format = "zip"

        const zip = await client.actions.downloadArtifact({
            ...github.context.repo,
            artifact_id: artifact.id,
            archive_format: format,
        })

        new stream.PassThrough()
            .end(ab2b(zip.data))
            .pipe(unzip.Extract({path: path}))
    } catch (error) {
        core.setFailed(error.message)
    }
}

main()
