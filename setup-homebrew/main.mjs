import { exec } from "@actions/exec"
import core from "@actions/core"

// GitHub Actions does not support shell `post` actions and thus requires a JS wrapper.
try {
  await exec("/bin/bash", [
    new URL("./main.sh", import.meta.url).pathname,
    core.getInput("core"),
    core.getInput("cask"),
    core.getInput("test-bot"),
    core.getInput("debug"),
    core.getInput("token"),
    core.getInput("stable"),
    core.getInput("brew-gh-api-token"),
  ])
} catch (error) {
  core.setFailed(error.message)
}
