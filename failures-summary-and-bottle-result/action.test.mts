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

const summaryStep = action.runs.steps.find((step) => step.run?.includes("GITHUB_STEP_SUMMARY"))!;

function runSummary(resultContents: string | null, collapse = "false") {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "failures-summary-"));

  try {
    const summary = path.join(directory, "summary.md");
    const resultPath = "bottles/steps_output.txt";
    fs.writeFileSync(summary, "");
    if (resultContents !== null) {
      fs.mkdirSync(path.join(directory, "bottles"));
      fs.writeFileSync(path.join(directory, resultPath), resultContents);
    }

    execFileSync("/bin/bash", ["-e", "-u", "-o", "pipefail", "-c", summaryStep.run!], {
      env: {
        ...process.env,
        GITHUB_STEP_SUMMARY: summary,
        WORKDIR: directory,
        RESULT_PATH: resultPath,
        STEP_NAME: "`brew test-bot` output",
        COLLAPSE: collapse,
      },
      stdio: "ignore",
    });

    return {
      summary: fs.readFileSync(summary, "utf8"),
      resultExists: resultContents !== null && fs.existsSync(path.join(directory, resultPath)),
    };
  } finally {
    fs.rmSync(directory, { force: true, recursive: true });
  }
}

describe("failures-summary-and-bottle-result action", () => {
  it("appends the heading and fenced result, then removes the result file", () => {
    const { summary, resultExists } = runSummary("install succeeded\n");

    assert.match(summary, /### `brew test-bot` output/);
    assert.match(summary, /```\ninstall succeeded\n\n```/);
    assert.equal(resultExists, false);
  });

  it("strips ANSI colour codes from the result", () => {
    const { summary } = runSummary("\x1b[31mError:\x1b[0m broken\n");

    assert.match(summary, /^Error: broken$/m);
    assert.doesNotMatch(summary, /\x1b\[/);
  });

  it("wraps the output in a collapsed details block", () => {
    const { summary } = runSummary("some output\n", "true");

    assert.match(summary, /<details><summary>Details<\/summary>/);
    assert.match(summary, /<\/p>\n<\/details>/);
  });

  it("does nothing when the result file is missing", () => {
    const { summary } = runSummary(null);

    assert.equal(summary, "");
  });

  it("does nothing when the result file is empty", () => {
    const { summary } = runSummary("");

    assert.equal(summary, "");
  });
});
