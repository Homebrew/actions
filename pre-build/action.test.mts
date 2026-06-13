import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import yaml from "js-yaml";

type Step = {
  name?: string;
  run?: string;
};

type Action = {
  runs: {
    steps: Step[];
  };
};

const action = yaml.load(
  fs.readFileSync(new URL("action.yml", import.meta.url), "utf8"),
) as Action;

function actionStep(name: string): Step {
  const step = action.runs.steps.find((candidate) => candidate.name === name);
  assert.ok(step, `Expected ${name} step to exist.`);
  return step;
}

function runStep(name: string, env: Record<string, string>, stubs: Record<string, string> = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pre-build-"));

  try {
    const bin = path.join(directory, "bin");
    fs.mkdirSync(bin);
    for (const [command, output] of Object.entries(stubs)) {
      fs.writeFileSync(path.join(bin, command), `#!/bin/sh\necho "${output}"\n`);
      fs.chmodSync(path.join(bin, command), 0o755);
    }

    const githubOutput = path.join(directory, "github-output");
    fs.writeFileSync(githubOutput, "");

    execFileSync("/bin/bash", ["-e", "-u", "-o", "pipefail", "-c", actionStep(name).run!], {
      cwd: directory,
      env: {
        ...process.env,
        ...env,
        GITHUB_OUTPUT: githubOutput,
        PATH: `${bin}:${process.env.PATH}`,
      },
      stdio: "ignore",
    });

    return Object.fromEntries(
      fs.readFileSync(githubOutput, "utf8").trimEnd().split("\n").filter(Boolean).map((line) => line.split("=", 2)),
    );
  } finally {
    fs.rmSync(directory, { force: true, recursive: true });
  }
}

describe("pre-build action", () => {
  it("keys the RubyGems cache by OS on Linux", () => {
    assert.deepEqual(runStep("Set up RubyGems cache", { RUNNER_OS: "Linux" }), {
      cache_key_prefix: "Linux",
      macos_version: "",
      arch: "",
    });
  });

  it("keys the RubyGems cache by macOS version and architecture", () => {
    assert.deepEqual(
      runStep("Set up RubyGems cache", { RUNNER_OS: "macOS" }, { "sw_vers": "14.5.1", "uname": "arm64" }),
      {
        cache_key_prefix: "14-arm64",
        macos_version: "14",
        arch: "arm64",
      },
    );
  });

  it("computes the Linux bottle specifier", () => {
    assert.deepEqual(
      runStep("Set up bottles directory", { RUNNER_OS: "Linux", BOTTLES_DIR: "bottles", MACOS_VERSION: "", ARCH: "" }),
      { bottle_specifier: "{ubuntu,linux}" },
    );
  });

  it("computes the macOS bottle specifier", () => {
    assert.deepEqual(
      runStep("Set up bottles directory", { RUNNER_OS: "macOS", BOTTLES_DIR: "bottles", MACOS_VERSION: "14", ARCH: "arm64" }),
      { bottle_specifier: "{macos-14,14-arm64}" },
    );
  });
});
