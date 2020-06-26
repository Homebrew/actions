const core = require('@actions/core')
const exec = require('@actions/exec')

async function main() {
    try {
        const token = core.getInput("token")
        const remote = core.getInput("remote")
        const branch = core.getInput("branch")
        const tries = core.getInput("tries")
        const directory = core.getInput("directory")

        if (directory) {
            process.chdir(directory)
        }

        if (token) {
            try {
                await exec.exec("git", ["config", "--local", "--unset-all", "http.https://github.com/.extraheader"])
            } catch (error) {
                // Do nothing
            }
            await exec.exec("git", ["config", "--local", "http.https://github.com/.extraheader", `AUTHORIZATION: basic ${token}`])
        }

        if (branch) {
            await exec.exec("git", ["checkout", branch])
        }

        for (let i = 0; i < tries; i++) {
            try {
                await exec.exec("git", ["push", remote, branch])
                return
            } catch (error) {
                const delay = Math.floor(Math.random() * (10 + i)) + 3
                await exec.exec("sleep", [delay])
                await exec.exec("git", ["pull", "--rebase", remote, branch])
            }
        }

        throw new Error("Max tries reached")
    } catch (error) {
        core.setFailed(error.message)
    }
}

main()
