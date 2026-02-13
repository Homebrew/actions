import { exec } from "@actions/exec"
import * as core from "@actions/core"

// GitHub Actions does not support shell `post` actions and thus requires a JS wrapper.
try {
  await exec("/bin/bash", [
    new URL("./post.sh", import.meta.url).pathname,
    core.getInput("debug")
  ])
} catch (error) {
  if (!(error instanceof Error)) throw error

  core.setFailed(error.message)
}
