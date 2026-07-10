// Warn users referencing Homebrew/actions via @master to pin an immutable release.
// Called from TypeScript actions with the action name as the sole argument.
import * as core from "@actions/core"

export function deprecateMaster(action: string) {
  if (process.env.GITHUB_ACTION_REF === "master") {
    core.warning(
      `Homebrew/actions/${action}@master is deprecated. ` +
      `Please update your workflow references to pin ` +
      `Homebrew/actions/${action}@1f8e202ffddf94def7f42f6fa3a482e821489f9c (2026.07.10.1). ` +
      `The "master" branch sync will stop and this warning will become ` +
      `an error when Homebrew 5.2.0 is released (no earlier than 2026-06-10).`
    )
  }
}
