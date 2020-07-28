const exec = require('@actions/exec')
const core = require('@actions/core')

async function main() {
    try {
        const token = core.getInput("token")
        const script = core.getInput("script", { required: true })

        if (token)
            process.env.HOMEBREW_GITHUB_API_TOKEN = token

        process.env.HOMEBREW_NO_ENV_FILTERING = "1"
        process.env.HOMEBREW_NO_AUTO_UPDATE = "1"
        process.env.HOMEBREW_NO_ANALYTICS = "1"
        process.env.HOMEBREW_COLOR = "1"

        await exec.exec("brew", ["ruby", "-e", script])
    } catch (error) {
        core.setFailed(error.message)
    }
}

main()
