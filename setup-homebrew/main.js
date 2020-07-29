const exec = require('@actions/exec')
const core = require('@actions/core')
const path = require('path')

async function main() {
    try {
        await exec.exec("bash", [path.join(__dirname, "main.sh")])
    } catch (error) {
        core.setFailed(error.message)
    }
}

main()
