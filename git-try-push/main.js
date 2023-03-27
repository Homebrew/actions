const core = require('@actions/core')
const exec = require('@actions/exec')

async function main() {
    try {
        const token = core.getInput("token")
        const directory = core.getInput("directory")
        const remote = core.getInput("remote", { required: true })
        const branch = core.getInput("branch", { required: true })
        const tries = core.getInput("tries", { required: true })
        const force = core.getInput("force")
        const origin_branch = core.getInput("origin_branch") || branch
        const no_lease = core.getInput("no_lease")

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
                // Try to push, if successful, then checkout previous branch and just exit.
                // Don't try to force push the first time in case it's not necessary.
                if (force && i>0)
                    await exec.exec(git, ["push", force_flag, remote, branch])
                else
                    await exec.exec(git, ["push", remote, branch])
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
