import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as yaml from "js-yaml";

function setupHomebrew(core: string, cask: string, existingTaps: string[], repository = "Homebrew/actions") {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "setup-homebrew-"));

  try {
    const bin = path.join(directory, "bin");
    const gitLog = path.join(directory, "git.log");
    fs.mkdirSync(bin);
    fs.mkdirSync(path.join(directory, "Library/Homebrew"), { recursive: true });
    fs.writeFileSync(path.join(directory, "Library/Homebrew/Gemfile.lock"), "");
    for (const tap of existingTaps) {
      fs.mkdirSync(path.join(directory, "Library/Taps/homebrew", `homebrew-${tap}`), { recursive: true });
    }
    for (const [command, script] of Object.entries({
      brew: 'case "$1" in --prefix|--repo) echo "$TEST_BREW_REPOSITORY";; esac',
      git: 'echo "$*" >> "$GIT_LOG"\nif [ "$1" = symbolic-ref ]; then echo refs/remotes/origin/main; fi',
      sudo: "exit 0",
      setfacl: "exit 0",
    })) {
      fs.writeFileSync(path.join(bin, command), `#!/bin/sh\n${script}\n`, { mode: 0o755 });
    }

    execFileSync("/bin/bash", [new URL("main.sh", import.meta.url).pathname, core, cask, "false", "", "false", ""], {
      cwd: directory,
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        TEST_BREW_REPOSITORY: directory,
        GIT_LOG: gitLog,
        GITHUB_REPOSITORY: repository,
        GITHUB_SERVER_URL: "https://github.com",
        GITHUB_SHA: "test-sha",
        GITHUB_ACTIONS_HOMEBREW_SELF_HOSTED: "1",
        GITHUB_ENV: path.join(directory, "env"),
        GITHUB_OUTPUT: path.join(directory, "output"),
        GITHUB_PATH: path.join(directory, "path"),
        GITHUB_STATE: path.join(directory, "state"),
        RUNNER_OS: "macOS",
        RUNNER_WORKSPACE: directory,
        RUNNER_TEMP: directory,
      },
      stdio: "pipe",
    });

    return fs.readFileSync(gitLog, "utf8").replaceAll(directory, "");
  } finally {
    fs.rmSync(directory, { force: true, recursive: true });
  }
}

for (const actionName of ["pre-build", "setup-homebrew"]) {
  const action = yaml.load(
    fs.readFileSync(new URL(`../${actionName}/action.yml`, import.meta.url), "utf8"),
  ) as {
    inputs: Record<string, { default: string | boolean }>;
    runs: { steps?: { name?: string; with: Record<string, string> }[] };
  };
  const inputs = actionName === "pre-build"
    ? action.runs.steps!.find((step) => step.name === "Set up Homebrew")!.with
    : { core: action.inputs.core.default, cask: action.inputs.cask.default };

  describe(`${actionName} tap defaults`, () => {
    for (const existingTaps of [[], ["core"], ["cask"], ["core", "cask"]]) {
      it(`handles existing taps: ${existingTaps.join(", ") || "none"}`, () => {
        const calls = setupHomebrew(String(inputs.core), String(inputs.cask), existingTaps);
        assert.doesNotMatch(calls, /clone /);
        for (const tap of ["core", "cask"]) {
          assert.equal(
            calls.includes(`-C /Library/Taps/homebrew/homebrew-${tap} fetch --force origin`),
            actionName === "pre-build" && existingTaps.includes(tap),
          );
        }
      });
    }

    for (const repository of [
      "Homebrew/homebrew-core", "Homebrew/homebrew-cask",
      "fork/homebrew-core", "fork/homebrew-cask", "Linuxbrew/linuxbrew-core", "fork/homebrew-tools",
    ]) {
      it(`checks out ${repository} when its tap is absent`, () => {
        const calls = setupHomebrew(String(inputs.core), String(inputs.cask), [], repository);
        assert.ok(calls.includes(`remote add origin https://github.com/${repository}`));
        assert.ok(calls.includes("fetch origin test-sha +refs/heads/*:refs/remotes/origin/*"));
        assert.ok(calls.includes("checkout --force -B main FETCH_HEAD"));
        assert.doesNotMatch(calls, /clone /);
      });
    }
  });
}

describe("setup-homebrew tap overrides", () => {
  for (const tap of ["core", "cask"]) {
    for (const existingTaps of [[], ["core", "cask"]]) {
      it(`honours explicit ${tap}: true with ${existingTaps.length ? "existing" : "absent"} taps`, () => {
        const calls = setupHomebrew(tap === "core" ? "true" : "false", tap === "cask" ? "true" : "false", existingTaps);
        assert.ok(calls.includes(existingTaps.length
          ? `-C /Library/Taps/homebrew/homebrew-${tap} fetch --force origin`
          : `clone https://github.com/Homebrew/homebrew-${tap} /Library/Taps/homebrew/homebrew-${tap}`));
        const otherTap = tap === "core" ? "cask" : "core";
        assert.ok(!calls.includes(`homebrew-${otherTap} fetch --force origin`));
        assert.ok(!calls.includes(`clone https://github.com/Homebrew/homebrew-${otherTap}`));
      });
    }

    for (const mode of ["false", "shallow"]) {
      it(`checks out the tested ${tap} tap even with explicit ${mode}`, () => {
        const calls = setupHomebrew(mode, mode, [], `Homebrew/homebrew-${tap}`);
        assert.ok(calls.includes(`remote add origin https://github.com/Homebrew/homebrew-${tap}`));
        assert.ok(calls.includes("fetch origin test-sha +refs/heads/*:refs/remotes/origin/*"));
        assert.ok(calls.includes("checkout --force -B main FETCH_HEAD"));
        assert.ok(!calls.includes(`-C /Library/Taps/homebrew/homebrew-${tap} config protocol.allow never`));
      });
    }
  }
});
