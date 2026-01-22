import core from "@actions/core"
import exec from "@actions/exec"

async function main() {
    try {
        const token = core.getInput("token")
        const directory = core.getInput("directory")
        const remote = core.getInput("remote", { required: true })
        const branch = core.getInput("branch", { required: true })
        const tries = parseInt(core.getInput("tries", { required: true }), 10)
        const remote_branch = core.getInput("remote_branch") || branch
        const origin_branch = core.getInput("origin_branch") || remote_branch
        const force = String(core.getInput("force")) == "true"
        const no_lease = String(core.getInput("no_lease")) == "true"

        const git = "/usr/bin/git"

        var force_flag
        if (no_lease) {
            force_flag = "--force"
        } else {
            force_flag = "--force-with-lease"
        }

        var refspec =`${branch}:${remote_branch}`

        // We can use `${branch}:${remote_branch}` as a catch-all. But we want
        // to simplify the log output a bit because `branch` and `remote_branch`
        // are often the same.
        if (branch == remote_branch) {
            refspec = branch
        }

        // Change directory.
        if (directory) {
            process.chdir(directory)
        }

        // Set up token authentication for pushing.
        // Command taken from actions/checkout.
        if (token) {
            const credentials = Buffer.from(`x-access-token:${token}`, 'utf8').toString('base64')
            core.setSecret(credentials)
            await exec.exec(git, ["config", "--local", "http.https://github.com/.extraheader", `AUTHORIZATION: basic ${credentials}`])
        }

        // Exit if number of tries is zero
        if (tries == 0) {
            return
        }

        // Checkout the branch which should be pushed.
        await exec.exec(git, ["checkout", branch])

        // Loop specified number of tries.
        for (let i = 0; i < tries; i++) {
            try {
                // Try to push, if successful, then checkout previous branch and just exit.
                // If force pushing with lease, don't try to force push the first time
                // in case it's not necessary.
                // If force pushing without lease, force push the first time since we've
                // already decided we don't care about having outdated refs.
                if (force && ((i > 0) || no_lease))
                    await exec.exec(git, ["push", force_flag, remote, refspec])
                else
                    await exec.exec(git, ["push", remote, refspec])
                await exec.exec(git, ["checkout", "-"])
                return
            } catch (error) {
                // Push failed. Wait some time (with an exponential backoff), pull changes with rebasing
                // and try again.
                const delay = 2 ** i
                await exec.exec("sleep", [delay.toString()])
                // `git pull` can also fail, so do the same retry procedure here.
                for (let j = 0; j < tries; j++) {
                    try {
                        await exec.exec(git, ["pull", "--rebase", "--autostash", remote, origin_branch])
                        break
                    } catch (error) {
                        await exec.exec("sleep", [delay.toString()])
                    }
                }
            }
        }

        // This should never be reached.
        throw new Error("Max tries reached")
    } catch (error) {
        if (!Error.isError(error)) throw error

        core.setFailed(error.message)
    }
}

await main()
