const core = require('@actions/core')
const github = require('@actions/github')

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

        // Fetch latest XX open PRs
        const pulls = await client.pulls.list({
            ...github.context.repo,
            state: "open",
            per_page: 50
        })

        // Map pull request object to its files
        const pullToFiles = new Map()

        // Fetch data and store it in the map
        for (const pull of pulls.data) {
            // Fetch PR files
            const files = await client.pulls.listFiles({
                ...github.context.repo,
                pull_number: pull.number
            })

            // Map pull to files
            pullToFiles.set(pull, files.data)

            // Enhance every file object with its content
            for (const file of files.data) {
                // Fetch file content
                const blob = await client.git.getBlob({
                    ...github.context.repo,
                    file_sha: file.sha
                })

                // Decode received base64-encoded file content
                const buffer = Buffer.from(blob.data.content, blob.data.encoding)
                const content = buffer.toString('ascii')

                file.content = content
            }
        }

        // Sweep map
        for (const pullAndFiles of pullToFiles) {
            const pull = pullAndFiles[0]
            const pullFiles = pullAndFiles[1]
            const pullLabels = pull.labels.map(label => label.name)

            // Map constraint to an array of matching files objects
            const constraintToMatchingFiles = new Map()

            // Match files with given constraints
            for (const file of pullFiles) {
                for (const constraint of constraints) {
                    // Do nothing if PR already has the label
                    if (pullLabels.includes(constraint.label)) {
                        continue
                    }

                    if (constraint.status && (file.status != constraint.status)) {
                        continue
                    }
                    if (constraint.path && (!file.filename.match(constraint.path))) {
                        continue
                    }
                    if (constraint.content && (!file.content.match(constraint.content))) {
                        continue
                    }

                    // Init map key if not found
                    if (!constraintToMatchingFiles.has(constraint)) {
                        constraintToMatchingFiles.set(constraint, [])
                    }

                    // Append file to array
                    constraintToMatchingFiles.get(constraint).push(file)
                }
            }

            // Only consider labelling when all PR files match a constraint
            for (const constraintAndMatchingFiles of constraintToMatchingFiles) {
                const constraint = constraintAndMatchingFiles[0]
                const matchingFiles = constraintAndMatchingFiles[1]

                if (matchingFiles.length == pullFiles.length) {
                    continue
                }

                constraintToMatchingFiles.delete(constraint)
            }

            // Get a list of distinct labels
            const labels = Array.from(
                new Set(
                    Array.from(constraintToMatchingFiles.keys())
                        .map(constraint => constraint.label)
                )
            )

            // No constraints matched, continue ...
            if (labels.length == 0) {
                continue
            }

            core.info(`==> Labelling PR #${pull.number} with [${labels}]`)

            // Add wanted labels to PR
            await client.issues.addLabels({
                ...github.context.repo,
                issue_number: pull.number,
                labels: labels
            })
        }
    } catch (error) {
        core.setFailed(error.message)
    }
}

main()
