import assert from "node:assert/strict"
import * as core from "@actions/core"
import * as github from "@actions/github"
import fs from "fs"
import yaml from "js-yaml"

import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods"

type Constraint = {
    label: string,
    status?: "added" | "modified" | "removed",
    path?: string | Array<string>,
    except?: string | Array<string>,
    content?: string | Array<string>,
    patch_content?: string | Array<string>,
    missing_content?: string | Array<string>,
    pr_body_content?: string,
    keep_if_no_match?: boolean,
    allow_any_match?: boolean,
    wanted?: boolean
}

type FileWithContent = RestEndpointMethodTypes["pulls"]["listFiles"]["response"]["data"][number] & { content?: string }

async function main() {
    try {
        const token = core.getInput("token", { required: true })
        const def = core.getInput("def", { required: true })

        // Parse definition
        let constraints: Array<Constraint>
        try {
            constraints = yaml.load(def) as Array<Constraint>
        } catch {
            constraints = JSON.parse(def)
        }

        // Lint constraints
        for (const constraint of constraints) {
            if (!constraint.label) {
                console.log(constraint)
                core.setFailed("Missing label in above constraint")
                return
            }
        }

        const client = github.getOctokit(token)

        // Parse event
        assert(process.env.GITHUB_EVENT_PATH)
        const json = fs.readFileSync(process.env.GITHUB_EVENT_PATH, { encoding: "utf-8" })
        const event = JSON.parse(json)
        const pull = event.pull_request

        // Fetch PR files
        const { data: files }: { data: FileWithContent[] } = await client.rest.pulls.listFiles({
            ...github.context.repo,
            pull_number: pull.number
        })

        // Fetch PR body
        const { data: { body: body } } = await client.rest.pulls.get({
            ...github.context.repo,
            pull_number: pull.number
        })

        // Extend every file object with its content
        for (const file of files) {
            // Only match added/removed lines
            file.patch = (file.patch || "")
                .split("\n")
                .filter(line => /^[-+]/.test(line))
                .join("\n")

            // File object could have this field set as 'null'
            if (!file.sha) {
                continue
            }

            // Fetch file content
            const blob = await client.rest.git.getBlob({
                ...github.context.repo,
                file_sha: file.sha
            })

            // Decode received base64-encoded file content
            const buffer = Buffer.from(blob.data.content, blob.data.encoding as BufferEncoding)
            const content = buffer.toString('ascii')

            file.content = content
        }

        // Get existing labels on PR
        let issueLabels = await client.rest.issues.listLabelsOnIssue({
            ...github.context.repo,
            issue_number: pull.number
        })
        let existingLabels = issueLabels.data.map(label => label.name)

        // Map constraint to an array of matching files objects
        const constraintToMatchingFiles = new Map()

        // Match files with given constraints
        for (const file of files) {
            for (const constraint of constraints) {
                // Constraints that check the PR body are checked separately
                if (constraint.pr_body_content) {
                    continue
                }

                let constraintApplies = false
                let labelExists = false

                // Possible unwanted label
                if (existingLabels.includes(constraint.label)) {
                    labelExists = true
                }

                // Continue if the label exists and we aren't going to remove
                // it regardless of whether it applies or not
                if (labelExists && constraint.keep_if_no_match) {
                    continue
                }

                // Check constraints
                constraintApplies = doesConstraintApply(constraint, file)

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

            // Continue if constraint allows any PR file to match
            if (constraint.allow_any_match && constraint.wanted) {
                continue
            }

            if (matchingFiles.length == files.length) {
                continue
            }

            constraintToMatchingFiles.delete(constraint)
        }

        for (const constraint of constraints) {
            // Only check constraints that check the PR body here
            if (!constraint.pr_body_content) {
                continue
            }

            let constraintApplies = false
            let labelExists = false

            // Possible unwanted label
            if (existingLabels.includes(constraint.label)) {
                labelExists = true
            }

            if (body) {
                constraintApplies = RegExp(constraint.pr_body_content).test(body)
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
        }

        // Copy labels into new Array
        const updatedLabels = existingLabels.slice()

        // Determine which labels should be added or deleted
        for (const constraint of constraintToMatchingFiles.keys()) {
            if (constraint.wanted && !updatedLabels.includes(constraint.label)) {
                updatedLabels.push(constraint.label)
            }
            if (!constraint.wanted) {
                const index = updatedLabels.indexOf(constraint.label);
                if (index > -1) {
                    updatedLabels.splice(index, 1);
                }
            }
        }

        // No constraints matched, just return
        if (existingLabels.length == updatedLabels.length && existingLabels.every((label, i) => label == updatedLabels[i])) {
            return
        }

        console.log(`#${pull.number}: [${existingLabels}] => [${updatedLabels}]`)

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

function doesConstraintApply(constraint: Constraint, file: FileWithContent): boolean {
    if (constraint.status && file.status != constraint.status) {
        return false
    }

    if (constraint.path) {
        if (Array.isArray(constraint.path)) {
            let matchingPath = false
            for (const path of constraint.path) {
                if (file.filename.match(path)) {
                    matchingPath = true
                    break
                }
            }
            if (!matchingPath) {
                return false
            }
        } else if (!file.filename.match(constraint.path)) {
            return false
        }
    }

    if (constraint.except) {
        if (Array.isArray(constraint.except)) {
            if (constraint.except.includes(file.filename)) {
                return false
            }
        } else if (file.filename == constraint.except) {
            return false
        }
    }

    if (constraint.content) {
        if (Array.isArray(constraint.content)) {
            for (const content of constraint.content) {
                if (!RegExp(content).test(file.content || "")) {
                    return false
                }
            }
        } else if (!RegExp(constraint.content).test(file.content || "")) {
            return false
        }
    }

    if (constraint.patch_content) {
        if (Array.isArray(constraint.patch_content)) {
            for (const patchContent of constraint.patch_content) {
                if (!RegExp(patchContent).test(file.patch || "")) {
                    return false
                }
            }
        } else if (!RegExp(constraint.patch_content).test(file.patch || "")) {
            return false
        }
    }

    if (constraint.missing_content) {
        // Deleted files cannot be missing content.
        if (file.status == 'removed') {
            return false
        }

        if (Array.isArray(constraint.missing_content)) {
            for (const content of constraint.missing_content) {
                if (RegExp(content).test(file.content || "")) {
                    return false
                }
            }
        } else if (RegExp(constraint.missing_content).test(file.content || "")) {
            return false
        }
    }

    return true
}

await main()
