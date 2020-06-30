const core = require('@actions/core')
const exec = require('child_process');
const fs = require('fs')

async function main() {
    try {
        process.env.HOMEBREW_NO_ENV_FILTERING = "1"
        process.env.HOMEBREW_NO_AUTO_UPDATE = "1"
        process.env.HOMEBREW_NO_ANALYTICS = "1"
        process.env.HOMEBREW_COLOR = "1"

        const token = core.getInput("token")
        const script = core.getInput("script", { required: true })

        if (token)
            process.env.HOMEBREW_GITHUB_API_TOKEN = token

        const res = exec.spawnSync("brew", ["ruby", "-e", script], { stdio: "inherit" })

        if (res.status != 0)
            throw new Error("Execution error")
    } catch (error) {
        core.setFailed(error.message)
    }
}

main()