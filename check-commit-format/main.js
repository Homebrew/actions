const core = require('@actions/core')
const github = require('@actions/github')
const fs = require('fs')

async function main() {
    try {
        const token = core.getInput("token", { required: true })
        const failure_label = core.getInput("failure_label", { required: true })

        const client = github.getOctokit(token)

        // Parse event
        const json = fs.readFileSync(process.env.GITHUB_EVENT_PATH, { encoding: "utf-8" })
        const event = JSON.parse(json)
        const pull = event.pull_request

        // Fetch pull request commits
        const commits = await client.pulls.listCommits({
            ...github.context.repo,
            pull_number: pull.number
        })

        let is_success = true
        let message = "Commit format is correct."
        let files_touched = []

        // For each commit...
        for (const commit of commits.data) {
            const commit_info = await client.repos.getCommit({
                ...github.context.repo,
                ref: commit.sha
            })

            short_sha = commit.sha.substring(0, 10);

            // Autosquash doesn't support merge commits.
            if (commit_info.data.parents.length != 1) {
                is_success = false
                message = `${short_sha} has ${commit_info.data.parents.length} parents (maintainers must rebase manually).`
                break
            }

            // Autosquash doesn't support commits that modify more than one file.
            if (commit_info.data.files.length != 1) {
                is_success = false
                message = `${short_sha} modifies ${commit_info.data.files.length} files (maintainers must merge manually).`
                break
            }

            const file = commit_info.data.files[0]
            const commit_subject = commit_info.data.commit.message.split("\n").shift()

            if (file.filename.startsWith("Formula/")) {
                const formula = file.filename.replace(/^Formula\//, "").replace(/\.rb$/, "")
                core.debug(`${short_sha} == ${commit_subject} == ${formula}`)

                // We've already modified this file, or the commit subject doesn't start with the formula name.
                if (files_touched.includes(file.filename) || !commit_subject.startsWith(formula)) {
                    message = "Pull request will be autosquashed."
                }
                files_touched.push(file.filename)
            } else {
                // Autosquash isn't great at modifying commits that don't modify formulae.
                is_success = false
                message = `${short_sha} modifies non-formulae files (maintainers must merge manually)`
                break
            }
        }

        const head_sha = commits.data[commits.data.length - 1].sha
        core.debug(`Writing to sha ${head_sha}`)

        await client.repos.createCommitStatus({
            ...github.context.repo,
            sha: head_sha,
            state: "success",
            description: message,
            context: "Commit style",
            target_url: "https://docs.brew.sh/Formula-Cookbook#commit"
        })

        // Get existing labels on PR
        let existingLabels = await client.issues.listLabelsOnIssue({
            ...github.context.repo,
            issue_number: pull.number
        })
        existingLabels = existingLabels.data.map(label => label.name)

        // Copy labels into new Array
        const updatedLabels = existingLabels.slice()

        if (is_success && existingLabels.includes(failure_label)) {
            // If commit style is OK or autosquashable, but we have a automerge-skip label, remove it
            const index = updatedLabels.indexOf(failure_label);
            if (index > -1) {
                updatedLabels.splice(index, 1);
            }
        } else if (!is_success && !existingLabels.includes(failure_label)) {
            // If commit style is not OK or not autosquashable but we don't have the automerge-skip label, add it
            updatedLabels.push(failure_label);
        }

        // If everything is the same, we're done
        if (existingLabels.length == updatedLabels.length && existingLabels.every((label, i) => label == updatedLabels[i])) {
            return
        }

        // Update PR labels
        await client.issues.update({
            ...github.context.repo,
            issue_number: pull.number,
            labels: updatedLabels
        })
    } catch (error) {
        core.setFailed(error.message)
    }
}

main()
