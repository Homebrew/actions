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

function brewBumpArgs(stepName: string, env: Record<string, string>): string[] {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bump-packages-"));

  try {
    const bin = path.join(directory, "bin");
    const log = path.join(directory, "brew.log");
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, "brew"), [
      "#!/bin/sh",
      'printf "%s\\n" "$@" >> "$BREW_LOG"',
    ].join("\n"));
    fs.chmodSync(path.join(bin, "brew"), 0o755);

    execFileSync("/bin/bash", ["-e", "-o", "pipefail", "-c", actionStep(stepName).run!], {
      env: {
        ...process.env,
        ...env,
        BREW_LOG: log,
        PATH: `${bin}:${process.env.PATH}`,
      },
      stdio: "ignore",
    });

    return fs.readFileSync(log, "utf8").trimEnd().split("\n");
  } finally {
    fs.rmSync(directory, { force: true, recursive: true });
  }
}

describe("bump-packages action", () => {
  it("bumps formulae with --no-fork when not using a fork", () => {
    assert.deepEqual(brewBumpArgs("Bump formulae", { INPUT_FORMULAE: "foo bar", INPUT_FORK: "false" }), [
      "bump",
      "--no-fork",
      "--open-pr",
      "--formulae",
      "foo",
      "bar",
    ]);
  });

  it("bumps formulae without --no-fork when using a fork", () => {
    assert.deepEqual(brewBumpArgs("Bump formulae", { INPUT_FORMULAE: "foo", INPUT_FORK: "true" }), [
      "bump",
      "--open-pr",
      "--formulae",
      "foo",
    ]);
  });

  it("bumps fully-qualified formulae with --full-name automatically", () => {
    assert.deepEqual(brewBumpArgs("Bump formulae", {
      INPUT_FORMULAE: "user/tap/foo",
      INPUT_FORK: "false",
    }), [
      "bump",
      "--no-fork",
      "--full-name",
      "--open-pr",
      "--formulae",
      "user/tap/foo",
    ]);
  });

  it("forces --full-name for short formula names", () => {
    assert.deepEqual(brewBumpArgs("Bump formulae", {
      INPUT_FORMULAE: "foo",
      INPUT_FORK: "false",
      INPUT_FULL_NAME: "true",
    }), [
      "bump",
      "--no-fork",
      "--full-name",
      "--open-pr",
      "--formulae",
      "foo",
    ]);
  });

  it("bumps casks with --no-fork when not using a fork", () => {
    assert.deepEqual(brewBumpArgs("Bump casks", { INPUT_CASKS: "baz qux", INPUT_FORK: "false" }), [
      "bump",
      "--no-fork",
      "--open-pr",
      "--casks",
      "baz",
      "qux",
    ]);
  });

  it("bumps fully-qualified casks with --full-name automatically", () => {
    assert.deepEqual(brewBumpArgs("Bump casks", {
      INPUT_CASKS: "user/tap/baz",
      INPUT_FORK: "false",
    }), [
      "bump",
      "--no-fork",
      "--full-name",
      "--open-pr",
      "--casks",
      "user/tap/baz",
    ]);
  });

  it("forces --full-name for short cask names", () => {
    assert.deepEqual(brewBumpArgs("Bump casks", {
      INPUT_CASKS: "baz",
      INPUT_FORK: "false",
      INPUT_FULL_NAME: "true",
    }), [
      "bump",
      "--no-fork",
      "--full-name",
      "--open-pr",
      "--casks",
      "baz",
    ]);
  });
});
