const core = require('@actions/core')
const exec = require('@actions/exec')

async function main() {
    try {
        const token = core.getInput("token")
        const directory = core.getInput("directory")
        const remote = core.getInput("remote", { required: true })
        const branch = core.getInput("branch", { required: true })
        const tries = core.getInput("tries", { required: true })
        const force = String(core.getInput("force")) == "true"
        const origin_branch = core.getInput("origin_branch") || branch
        const no_lease = String(core.getInput("no_lease")) == "true"

        const git = "/usr/bin/git"

        var force_flag
        if (no_lease) {
            force_flag = "--force"
        } else {
            force_flag = "--force-with-lease"
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
                // We can use `${branch}:${origin_branch}` as a catch-all. But
                // we want to simplify the log output a bit because `branch` and
                // `origin_branch` are often the same.
                const refspec = (branch == origin_branch) ? branch : `${branch}:${origin_branch}`
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
                const delay = (i+1)**2
                await exec.exec("sleep", [delay])
                // `git pull` can also fail, so do the same retry procedure here.
                for (let j = 0; j < tries; j++) {
                    try {
                        await exec.exec(git, ["pull", "--rebase", "--autostash", remote, origin_branch])
                        break
                    } catch (error) {
                        await exec.exec("sleep", [delay])
                    }
                }
            }
        }

        // This should never be reached.
        throw new Error("Max tries reached")
    } catch (error) {
        core.setFailed(error.message)
    }
}

main()
