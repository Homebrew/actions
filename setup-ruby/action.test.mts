import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import yaml from "js-yaml";

type Step = {
  name: string;
  if?: string;
  run?: string;
  env?: Record<string, string>;
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

function bundleCalls(bundlerCache: string, bundleCheckStatus = "1"): { calls: string[]; bundlePath: string } {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "setup-ruby-"));

  try {
    const bin = path.join(directory, "bin");
    const log = path.join(directory, "bundle.log");
    const bundlePath = path.join(directory, "vendor/bundle");

    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(directory, "Gemfile"), "source 'https://rubygems.org'\n");
    fs.writeFileSync(path.join(bin, "bundle"), [
      "#!/bin/sh",
      "printf '%s\\n' \"$*\" >> \"$BUNDLE_LOG\"",
      "if [ \"$1\" = \"check\" ]; then",
      "  exit \"$BUNDLE_CHECK_STATUS\"",
      "fi",
    ].join("\n"));
    fs.chmodSync(path.join(bin, "bundle"), 0o755);

    execFileSync("/bin/bash", ["-e", "-u", "-o", "pipefail", "-c", actionStep("Install Bundler gems").run!], {
      cwd: directory,
      env: {
        ...process.env,
        BUNDLE_CHECK_STATUS: bundleCheckStatus,
        BUNDLE_LOG: log,
        BUNDLE_PATH: bundlePath,
        BUNDLER_CACHE: bundlerCache,
        PATH: `${bin}:${process.env.PATH}`,
      },
    });

    return { calls: fs.readFileSync(log, "utf8").trimEnd().split("\n"), bundlePath };
  } finally {
    fs.rmSync(directory, { force: true, recursive: true });
  }
}

describe("setup-ruby action", () => {
  it("runs bundle install without requiring Bundler cache", () => {
    const installStep = actionStep("Install Bundler gems");

    assert.equal(installStep.if, undefined);
    assert.deepEqual(bundleCalls("false").calls, [
      "check",
      "install --jobs 4 --retry 3",
    ]);
  });

  it("skips bundle install when bundle check succeeds", () => {
    assert.deepEqual(bundleCalls("false", "0").calls, ["check"]);
  });

  it("configures the Bundler path before installing with Bundler cache", () => {
    const result = bundleCalls("true");

    assert.deepEqual(result.calls, [
      `config set --local path ${result.bundlePath}`,
      "check",
      "install --jobs 4 --retry 3",
    ]);
  });

  it("keys the Bundler cache by Ruby version", () => {
    const configureStep = actionStep("Configure Bundler cache");

    assert.equal(configureStep.env?.RUBY_VERSION, "${{ steps.setup.outputs.ruby-version }}");
    assert.match(configureStep.run!, /cache_prefix=.*\$\{RUBY_VERSION\}/);
  });

  it("keys the Bundler cache by portable Ruby mode", () => {
    const configureStep = actionStep("Configure Bundler cache");

    assert.match(actionStep("Set up Ruby").run!, /portable-ruby=\$\{portable_ruby\}/);
    assert.equal(configureStep.env?.PORTABLE_RUBY, "${{ steps.setup.outputs.portable-ruby }}");
    assert.match(configureStep.run!, /cache_prefix=.*\$\{PORTABLE_RUBY\}/);
  });

  it("keys the Bundler cache by Gemfile.lock when present", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "setup-ruby-"));

    try {
      const gemfile = "source 'https://rubygems.org'\ngem 'rake'\n";
      const gemfileLock = "lockfile contents\n";
      const githubOutput = path.join(directory, "github-output");

      fs.writeFileSync(path.join(directory, "Gemfile"), gemfile);
      fs.writeFileSync(path.join(directory, "Gemfile.lock"), gemfileLock);

      execFileSync("/bin/bash", ["-e", "-u", "-o", "pipefail", "-c", actionStep("Configure Bundler cache").run!], {
        cwd: directory,
        env: {
          ...process.env,
          GITHUB_OUTPUT: githubOutput,
          PORTABLE_RUBY: "false",
          RUBY_PREFIX: "/opt/homebrew/opt/ruby",
          RUBY_VERSION: "3.4.1",
          RUNNER_ARCH: "ARM64",
          RUNNER_OS: "macOS",
        },
      });

      assert.ok(
        Object.fromEntries(
          fs.readFileSync(githubOutput, "utf8").trimEnd().split("\n").map((line) => line.split("=", 2)),
        )["cache-key"].endsWith(crypto.createHash("sha256").update(gemfileLock).digest("hex")),
      );
    } finally {
      fs.rmSync(directory, { force: true, recursive: true });
    }
  });
});
