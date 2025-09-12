import core from "@actions/core"
import github from "@actions/github"
import exec from "@actions/exec"

async function main() {
    try {
        const token = core.getInput("token", { required: true })
        const username = core.getInput("username", { required: true })

        const client = github.getOctokit(token)

        const user = await client.rest.users.getByUsername({
            username: username
        })
        const name = (user.data.name || user.data.login)
        const email = (user.data.email || user.data.id + "+" + user.data.login + "@users.noreply.github.com")

        core.setOutput("name", name)
        core.setOutput("email", email)

        await exec.exec("git", ["config", "--global", "user.name", name])
        await exec.exec("git", ["config", "--global", "user.email", email])
    } catch (error) {
        if (!(error instanceof Error)) throw error

        core.setFailed(error.message)
    }
}

await main()
