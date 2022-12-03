import {exec} from "@actions/exec"
import core from "@actions/core"

// GitHub Actions does not support shell `post` actions and thus requires a JS wrapper.
try {
  await exec("bash", [
    new URL("./post.sh", import.meta.url).pathname,
    core.getInput("debug")
  ])
} catch (error) {
  core.setFailed(error.message)
}
