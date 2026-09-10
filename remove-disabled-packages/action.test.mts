import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";

type Step = {
  id?: string;
  run?: string;
};

type Action = {
  runs: {
    steps: Step[];
  };
};

type PackageData = Record<string, unknown>;

type RunOptions = {
  casks?: PackageData[];
  directories?: string[];
  env?: Record<string, string>;
  files?: string[];
  formulae?: PackageData[];
};

type RunResult = {
  brewCalls: string[][];
  fileExists: Record<string, boolean>;
  output: Record<string, string>;
  subjects: string[];
};

const repository = "Homebrew/homebrew-actions-test-tap";
const tap = "homebrew/actions-test-tap";

const action = yaml.load(
  fs.readFileSync(new URL("action.yml", import.meta.url), "utf8"),
) as Action;

function actionStep(id: string): Step {
  const step = action.runs.steps.find((candidate) => candidate.id === id);
  assert.ok(step, `Expected ${id} step to exist.`);
  return step;
}

function formatDate(target: Date): string {
  return [
    target.getFullYear(),
    String(target.getMonth() + 1).padStart(2, "0"),
    String(target.getDate()).padStart(2, "0"),
  ].join("-");
}

function monthsAgo(months: number): string {
  const today = new Date();
  const targetYear = today.getFullYear();
  const targetMonth = today.getMonth() - months;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const target = new Date(targetYear, targetMonth, Math.min(today.getDate(), lastDay));

  return formatDate(target);
}

function daysAfter(date: string, days: number): string {
  const target = new Date(`${date}T12:00:00`);
  target.setDate(target.getDate() + days);
  return formatDate(target);
}

function runAction({
  casks = [],
  directories = ["Formula"],
  env = {},
  files = [],
  formulae = [],
}: RunOptions = {}): RunResult {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "remove-disabled-packages-"));

  try {
    const actionPath = fileURLToPath(new URL(".", import.meta.url));
    const bin = path.join(directory, "bin");
    const brewLog = path.join(directory, "brew.log");
    const caskJson = path.join(directory, "casks.json");
    const formulaJson = path.join(directory, "formulae.json");
    const githubOutput = path.join(directory, "github-output");
    const tapDirectory = path.join(directory, "tap");
    const gitEnv = {
      ...process.env,
      GIT_AUTHOR_EMAIL: "brew-test-bot@brew.sh",
      GIT_AUTHOR_NAME: "BrewTestBot",
      GIT_COMMITTER_EMAIL: "brew-test-bot@brew.sh",
      GIT_COMMITTER_NAME: "BrewTestBot",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_SYSTEM: "/dev/null",
    };

    fs.mkdirSync(bin);
    fs.mkdirSync(tapDirectory);
    for (const subdirectory of directories) {
      fs.mkdirSync(path.join(tapDirectory, subdirectory), { recursive: true });
    }
    for (const file of files) {
      const absolutePath = path.join(tapDirectory, file);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, `${file}\n`);
    }

    fs.writeFileSync(formulaJson, JSON.stringify({ formulae }));
    fs.writeFileSync(caskJson, JSON.stringify({ casks }));
    fs.writeFileSync(githubOutput, "");
    fs.writeFileSync(brewLog, "");
    fs.writeFileSync(path.join(bin, "brew"), [
      "#!/bin/sh",
      "(",
      "  printf '%s' \"$1\"",
      "  shift",
      "  printf '\\t%s' \"$@\"",
      "  printf '\\n'",
      ") >> \"$BREW_LOG\"",
      "case \"$1\" in",
      "  --repository)",
      "    printf '%s\\n' \"$TAP_DIRECTORY\"",
      "    ;;",
      "  info)",
      "    case \" $* \" in",
      "      *' --formula '*) cat \"$FORMULA_JSON\" ;;",
      "      *' --cask '*) cat \"$CASK_JSON\" ;;",
      "    esac",
      "    ;;",
      "esac",
    ].join("\n"));
    fs.chmodSync(path.join(bin, "brew"), 0o755);

    execFileSync("git", ["-C", tapDirectory, "init", "--quiet"], { env: gitEnv });
    execFileSync("git", ["-C", tapDirectory, "add", "--all"], { env: gitEnv });
    execFileSync("git", ["-C", tapDirectory, "commit", "--allow-empty", "--message", "Add fixtures", "--quiet"], {
      env: gitEnv,
    });

    execFileSync("/bin/bash", ["-e", "-u", "-o", "pipefail", "-c", actionStep("remove-packages").run!], {
      cwd: directory,
      env: {
        ...gitEnv,
        ...env,
        BREW_LOG: brewLog,
        CASK_JSON: caskJson,
        FORMULA_JSON: formulaJson,
        GITHUB_ACTION_PATH: actionPath,
        GITHUB_OUTPUT: githubOutput,
        GITHUB_REPOSITORY: repository,
        PATH: `${bin}:${process.env.PATH}`,
        TAP_DIRECTORY: tapDirectory,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const brewCalls = fs.readFileSync(brewLog, "utf8").trimEnd().split("\n")
      .filter(Boolean)
      .map((line) => line.split("\t"));
    const output = Object.fromEntries(
      fs.readFileSync(githubOutput, "utf8").trimEnd().split("\n")
        .filter(Boolean)
        .map((line) => line.split("=", 2)),
    );
    const subjects = execFileSync("git", ["-C", tapDirectory, "log", "--format=%s"], {
      encoding: "utf8",
      env: gitEnv,
    }).trimEnd().split("\n");
    const fileExists = Object.fromEntries(
      files.map((file) => [file, fs.existsSync(path.join(tapDirectory, file))]),
    );

    return { brewCalls, fileExists, output, subjects };
  } finally {
    fs.rmSync(directory, { force: true, recursive: true });
  }
}

describe("remove-disabled-packages action", () => {
  it("removes packages disabled for more than twelve months and keeps recent ones", () => {
    const activePath = "Formula/active.rb";
    const cutoffPath = "Formula/cutoff.rb";
    const oldPath = "Formula/old.rb";
    const old2Path = "Formula/old2.rb";
    const recentPath = "Formula/recent.rb";
    const result = runAction({
      files: [activePath, cutoffPath, oldPath, old2Path, recentPath],
      formulae: [
        {
          name: "old",
          tap: "Homebrew/actions-test-tap",
          disabled: true,
          disable_date: monthsAgo(13),
          ruby_source_path: oldPath,
        },
        {
          name: "old2",
          tap,
          disabled: true,
          disable_date: monthsAgo(13),
          ruby_source_path: old2Path,
        },
        {
          name: "cutoff",
          tap,
          disabled: true,
          disable_date: monthsAgo(12),
          ruby_source_path: cutoffPath,
        },
        {
          name: "recent",
          tap,
          disabled: true,
          disable_date: daysAfter(monthsAgo(12), 1),
          ruby_source_path: recentPath,
        },
        {
          name: "active",
          tap,
          disabled: false,
          disable_date: monthsAgo(13),
          ruby_source_path: activePath,
        },
      ],
    });

    assert.equal(result.fileExists[activePath], true);
    assert.equal(result.fileExists[cutoffPath], true);
    assert.equal(result.fileExists[oldPath], false);
    assert.equal(result.fileExists[old2Path], false);
    assert.equal(result.fileExists[recentPath], true);
    assert.equal(result.output["packages-removed"], "true");
    assert.deepEqual(result.subjects, ["old2: remove formula", "old: remove formula", "Add fixtures"]);
    assert.deepEqual(result.brewCalls, [
      ["--repository", repository],
      ["info", "--json=v2", "--formula"],
    ]);
  });

  it("removes disabled casks and commits with the cask type", () => {
    const caskPath = "Casks/old-cask.rb";
    const result = runAction({
      casks: [{
        token: "old-cask",
        tap,
        disabled: true,
        disable_date: monthsAgo(13),
        ruby_source_path: caskPath,
      }],
      directories: ["Casks"],
      files: [caskPath],
    });

    assert.equal(result.fileExists[caskPath], false);
    assert.equal(result.output["packages-removed"], "true");
    assert.deepEqual(result.subjects, ["old-cask: remove cask", "Add fixtures"]);
    assert.deepEqual(result.brewCalls, [
      ["--repository", repository],
      ["info", "--json=v2", "--cask"],
    ]);
  });

  it("does not query casks when the Casks directory is absent", () => {
    const result = runAction({ directories: [] });

    assert.equal(result.output["packages-removed"], "false");
    assert.deepEqual(result.brewCalls, [["--repository", repository]]);
  });

  it("keeps disabled packages from other taps", () => {
    const foreignPath = "Formula/foreign.rb";
    const result = runAction({
      files: [foreignPath],
      formulae: [{
        name: "foreign",
        tap: "someone/else",
        disabled: true,
        disable_date: monthsAgo(13),
        ruby_source_path: foreignPath,
      }],
    });

    assert.equal(result.fileExists[foreignPath], true);
    assert.equal(result.output["packages-removed"], "false");
  });

  for (const [description, rubySourcePath, message] of [
    ["an escaping", "../outside.rb", /Package source path is outside .*\/tap: \.\.\/outside\.rb \(RuntimeError\)/],
    ["a null", null, /unsafe has no ruby_source_path \(RuntimeError\)/],
    ["an empty", "", /unsafe has no ruby_source_path \(RuntimeError\)/],
  ] as const) {
    it(`rejects ${description} ruby_source_path`, () => {
      assert.throws(() => runAction({
        formulae: [{
          name: "unsafe",
          tap,
          disabled: true,
          disable_date: monthsAgo(13),
          ruby_source_path: rubySourcePath,
        }],
      }), message);
    });
  }

  it("parses non-ASCII brew info under the C locale", () => {
    const result = runAction({
      env: { LC_ALL: "C" },
      formulae: [{
        name: "café",
        tap,
        disabled: false,
        ruby_source_path: "Formula/café.rb",
      }],
    });

    assert.equal(result.output["packages-removed"], "false");
  });
});
