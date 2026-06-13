import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const script = new URL("count-bottles.sh", import.meta.url).pathname;

function countBottles(files: string[]) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "count-bottles-"));

  try {
    const githubOutput = path.join(directory, "github-output");
    fs.writeFileSync(githubOutput, "");
    for (const file of files) {
      fs.mkdirSync(path.join(directory, path.dirname(file)), { recursive: true });
      fs.writeFileSync(path.join(directory, file), "");
    }

    execFileSync(script, ["false"], {
      cwd: directory,
      env: { ...process.env, GITHUB_OUTPUT: githubOutput },
      stdio: "ignore",
    });

    return Object.fromEntries(
      fs.readFileSync(githubOutput, "utf8").trimEnd().split("\n").map((line) => line.split("=", 2)),
    );
  } finally {
    fs.rmSync(directory, { force: true, recursive: true });
  }
}

describe("count-bottles.sh", () => {
  it("reports zero for an empty directory", () => {
    assert.deepEqual(countBottles([]), {
      count: "0",
      failures: "0",
      skipped: "0",
      dependents: "0",
    });
  });

  it("counts bottles, failures, skipped lists and tested dependents", () => {
    assert.deepEqual(countBottles([
      "foo.json",
      "bar.json",
      "failed/baz.json",
      "skipped_or_failed_formulae-macOS.txt",
      "tested-dependents-macOS.txt",
      "tested-dependents-Linux.txt",
    ]), {
      count: "2",
      failures: "1",
      skipped: "1",
      dependents: "2",
    });
  });
});
