import assert from "node:assert/strict"
import * as core from "@actions/core"
import * as github from "@actions/github"
import fs from "fs"
import path from "path"

import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods"

type IssueLabel = RestEndpointMethodTypes["issues"]["listLabelsOnIssue"]["response"]["data"][number]

async function main() {
    try {
        const token = core.getInput("token", { required: true })
        const failure_label = core.getInput("failure_label", { required: true })
        const autosquash_label = core.getInput("autosquash_label", { required: true })
        const ignore_label = core.getInput("ignore_label", { required: true })

        const client = github.getOctokit(token)

        // Parse event
        assert(process.env.GITHUB_EVENT_PATH)
        const json = fs.readFileSync(process.env.GITHUB_EVENT_PATH, { encoding: "utf-8" })
        const event = JSON.parse(json)
        const pull = event.pull_request

        // Fetch pull request commits
        const commits = await client.rest.pulls.listCommits({
            ...github.context.repo,
            pull_number: pull.number
        })

        let is_success = true
        let autosquash = false
        let commit_state: RestEndpointMethodTypes["repos"]["createCommitStatus"]["parameters"]["state"] = "success"
        let message = "Commit format is correct."
        let files_touched: Array<string> = []
        let target_url = "https://docs.brew.sh/Formula-Cookbook#commit"

        // For each commit...
        for (const commit of commits.data) {
            const commit_info = await client.rest.repos.getCommit({
                ...github.context.repo,
                ref: commit.sha
            })

            const short_sha = commit.sha.substring(0, 10);

            // Autosquash doesn't support merge commits.
            if (commit_info.data.parents.length != 1) {
                is_success = false
                commit_state = "failure"
                message = `${short_sha} has ${commit_info.data.parents.length} parents. Please rebase against origin/HEAD.`
                break
            }

            // Empty commits that are not merge commits are usually a mistake or a bad rebase.
            if (!commit_info.data.files || commit_info.data.files.length === 0) {
                is_success = false
                commit_state = "failure"
                message = `${short_sha} is an empty commit.`
                break
            }

            // Autosquash doesn't support commits that modify more than one file.
            if (commit_info.data.files.length != 1) {
                is_success = false

                let number_of_formulae_touched = 0
                let non_formula_modified = false
                for (const file of commit_info.data.files) {
                    if (file.filename.startsWith("Formula/")) {
                        number_of_formulae_touched++
                    } else {
                        non_formula_modified = true
                    }
                }

                if (number_of_formulae_touched > 1) {
                    commit_state = "failure"
                    message = `${short_sha} modifies ${number_of_formulae_touched} formulae. Please split your commits according to Homebrew style.`
                } else if (non_formula_modified) {
                    message = `${short_sha} modifies non-formula files (maintainers must merge manually)`
                }

                break
            }

            const file = commit_info.data.files[0]
            const commit_subject = commit_info.data.commit.message.split("\n")[0]

            if (file.filename.startsWith("Formula/")) {
                const formula = path.basename(file.filename, '.rb')
                core.debug(`${short_sha} == ${commit_subject} == ${formula}`)

                // We've already modified this file, or the commit subject doesn't start with the formula name.
                if (files_touched.includes(file.filename) || !commit_subject.startsWith(formula)) {
                    autosquash = true
                    commit_state = "failure"
                    message = "Please follow the commit style guidelines, or this pull request will be replaced."
                }
                files_touched.push(file.filename)
            } else if (file.filename.startsWith("Casks/")) {
                message = "Commit modifies cask."
                target_url = "https://github.com/Homebrew/homebrew-cask/blob/HEAD/CONTRIBUTING.md#style-guide"

                if (!files_touched.includes(file.filename)) {
                    files_touched.push(file.filename)
                }

                if (files_touched.length > 1) {
                    is_success = false
                    message = "A pull request must not modify multiple casks."
                }
            } else {
                // Autosquash isn't great at modifying commits that don't modify formulae or casks.
                is_success = false
                message = `${short_sha} modifies non-formulae or non-cask files (maintainers must merge manually)`
                break
            }
        }

        const head_sha = commits.data[commits.data.length - 1].sha
        core.debug(`Writing to sha ${head_sha}`)

        await client.rest.repos.createCommitStatus({
            ...github.context.repo,
            sha: head_sha,
            state: commit_state,
            description: message,
            context: "Commit style",
            target_url: target_url
        })

        // Get existing labels on PR
        let issueLabels = await client.rest.issues.listLabelsOnIssue({
            ...github.context.repo,
            issue_number: pull.number
        })
        let existingLabels = issueLabels.data.map((label: IssueLabel) => label.name)

        // Copy labels into new Array
        const updatedLabels = existingLabels.slice()

        core.debug(`is_success = ${is_success}`)
        core.debug(`autosquash = ${autosquash}`)
        if (is_success && existingLabels.includes(failure_label)) {
            core.debug(`Removing ${failure_label} label`)
            // If commit style is OK, but we have a automerge-skip label, remove it
            const index = updatedLabels.indexOf(failure_label);
            if (index > -1) {
                updatedLabels.splice(index, 1);
            }
        } else if (!is_success && !existingLabels.includes(failure_label) && !existingLabels.includes(ignore_label)) {
            core.debug(`Adding ${failure_label} label`)
            // If commit style is not OK or not autosquashable but we don't have the automerge-skip label, add it
            updatedLabels.push(failure_label);
        }

        if (!autosquash && existingLabels.includes(autosquash_label)) {
            core.debug(`Removing ${autosquash_label} label`)
            // If commits will not be autosquashed but we have an autosquash label, remove it
            const index = updatedLabels.indexOf(autosquash_label);
            if (index > -1) {
                updatedLabels.splice(index, 1);
            }
        } else if (autosquash && !existingLabels.includes(autosquash_label) && !existingLabels.includes(ignore_label)) {
            core.debug(`Adding ${autosquash_label} label`)
            // If commits need autosquashing but we don't have the autosquash label, add it
            updatedLabels.push(autosquash_label);
        }

        // If everything is the same, we're done
        if (existingLabels.length == updatedLabels.length && existingLabels.every((label: string, i: number) => label == updatedLabels[i])) {
            return
        }

        // Update PR labels
        await client.rest.issues.update({
            ...github.context.repo,
            issue_number: pull.number,
            labels: updatedLabels
        })
    } catch (error) {
        if (!Error.isError(error)) throw error

        core.setFailed(error)
    }
}

await main()
