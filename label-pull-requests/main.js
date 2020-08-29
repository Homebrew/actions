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

        // Map pull request object to its files objects
        const pullToFiles = new Map()

        // Fetch data and store it in the map
        for (const pull of pulls.data) {
            // Fetch PR files
            const files = await client.pulls.listFiles({
                ...github.context.repo,
                pull_number: pull.number
            })

            // Map pull object to files object
            pullToFiles.set(pull, files.data)

            // Extend every file object with its content
            for (const file of files.data) {
                // File object could have this field set as 'null'
                if (!file.sha) {
                    file.content = ""
                    continue
                }

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
                    let constraintApplies = false
                    let labelExists = false

                    // Possible unwanted label
                    if (pullLabels.includes(constraint.label)) {
                        labelExists = true
                    }

                    // Check constraints
                    if (
                        (!constraint.status || file.status == constraint.status) &&
                        (!constraint.path || file.filename.match(constraint.path)) &&
                        (!constraint.content || file.content.match(constraint.content)) &&
                        (!constraint.missing_content || !file.content.match(constraint.missing_content))
                    ) {
                        constraintApplies = true
                    }

                    if (labelExists && constraintApplies) {
                        continue
                    }
                    if (!labelExists && !constraintApplies) {
                        continue
                    }

                    // Unwanted label
                    if (labelExists && !constraintApplies) {
                        constraint.wanted = false
                    }

                    // Wanted label
                    if (!labelExists && constraintApplies) {
                        constraint.wanted = true
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

            const pullLabelsNew = pullLabels.slice()

            // Determine which labels should be added or deleted
            for (const constraint of constraintToMatchingFiles.keys()) {
                if (constraint.wanted && !pullLabelsNew.includes(constraint.label)) {
                    pullLabelsNew.push(constraint.label)
                }
                if (!constraint.wanted) {
                    const index = pullLabelsNew.indexOf(constraint.label);
                    if (index > -1) {
                        pullLabelsNew.splice(index, 1);
                    }
                }
            }

            // No constraints matched, continue ...
            if (pullLabels.length == pullLabelsNew.length && pullLabels.every((label, i) => label == pullLabelsNew[i])) {
                continue
            }

            core.info(`==> #${pull.number}: [${pullLabels}] => [${pullLabelsNew}]`)

            // Update PR labels
            await client.issues.update({
                ...github.context.repo,
                issue_number: pull.number,
                labels: pullLabelsNew
            })
        }
    } catch (error) {
        core.setFailed(error.message)
    }
}

main()
