const core = require('@actions/core')
const github = require('@actions/github')
const fs = require("fs")

async function main() {
    try {
        const token = core.getInput("token", { required: true })
        const def = core.getInput("def", { required: true })

        // Parse definition
        const constraints = JSON.parse(def)

        // Lint constraints
        for (const constraint of constraints) {
            if (!constraint.label) {
                console.log(constraint)
                core.setFailed("Missing label in above constraint")
                return
            }
        }

        const client = github.getOctokit(token)

        // Fetch latest 30 open PRs
        const pulls = await client.pulls.list({
            ...github.context.repo,
            state: "open",
            per_page: 50
        })

        for (const pull of pulls.data) {
            console.log(`==> #${pull.number}: ${pull.title}`)

            let existingLabels = pull.labels.map(label => label.name)
            let wantedLabels = []

            // Fetch PR files
            const files = await client.pulls.listFiles({
                ...github.context.repo,
                pull_number: pull.number
            });

            for (const file of files.data) {
                // Fetch file content
                const blob = await client.git.getBlob({
                    ...github.context.repo,
                    file_sha: file.sha
                })

                // Decode received base64-encoded file content
                const buffer = Buffer.from(blob.data.content, blob.data.encoding)
                const content = buffer.toString('ascii')

                // Match constraints
                for (const constraint of constraints) {
                    if (constraint.status && (file.status != constraint.status)) {
                        continue
                    }
                    if (constraint.path && (!file.filename.match(constraint.path))) {
                        continue
                    }
                    if (constraint.content && (!content.match(constraint.content))) {
                        continue
                    }
                    if (existingLabels.includes(constraint.label)) {
                        continue
                    }
                    if (wantedLabels.includes(constraint.label)) {
                        continue
                    }

                    console.log(constraint)

                    wantedLabels.push(constraint.label)
                }
            }

            // No constraints matched, continue ...
            if (wantedLabels.length == 0) {
                continue
            }

            console.log(`Labelling PR #${pull.number} with: [${wantedLabels}]`)

            // Add wanted labels to PR
            await client.issues.addLabels({
                ...github.context.repo,
                issue_number: pull.number,
                labels: wantedLabels
            })
        }
    } catch (error) {
        core.setFailed(error.message)
    }
}

main()
