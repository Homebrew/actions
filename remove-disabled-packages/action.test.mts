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
  plainFiles?: string[];
};

type RunResult = {
  brewCalls: string[][];
  fileExists: Record<string, boolean>;
  output: Record<string, string>;
  subjects: string[];
  summary: string | undefined;
};

const repository = "Homebrew/homebrew-actions-test-tap";
const tap = "homebrew/actions-test-tap";
const serverUrl = "https://github.com";

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

function parseOutput(contents: string): Record<string, string> {
  const output: Record<string, string> = {};
  const lines = contents.split("\n");
  for (let index = 0; index < lines.length; index++) {
    const heredoc = lines[index].match(/^([^=]+?)<<(.+)$/);
    if (heredoc) {
      const end = lines.indexOf(heredoc[2], index + 1);
      output[heredoc[1]] = lines.slice(index + 1, end).join("\n");
      index = end;
    } else if (lines[index]) {
      const [name, value] = lines[index].split("=", 2);
      output[name] = value;
    }
  }
  return output;
}

function runAction({
  casks = [],
  directories = ["Formula"],
  env = {},
  files = [],
  formulae = [],
  plainFiles = [],
}: RunOptions = {}): RunResult {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "remove-disabled-packages-"));

  try {
    const actionPath = fileURLToPath(new URL(".", import.meta.url));
    const bin = path.join(directory, "bin");
    const brewLog = path.join(directory, "brew.log");
    const caskJson = path.join(directory, "casks.json");
    const formulaJson = path.join(directory, "formulae.json");
    const githubOutput = path.join(directory, "github-output");
    const stepSummary = path.join(directory, "step-summary");
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
    for (const file of [...files, ...plainFiles]) {
      const absolutePath = path.join(tapDirectory, file);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      const disable = files.includes(file) ? '  disable! date: "2000-01-01", because: :unmaintained\n' : "";
      fs.writeFileSync(absolutePath, `# ${file}\n${disable}`);
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
        GITHUB_STEP_SUMMARY: stepSummary,
        PATH: `${bin}:${process.env.PATH}`,
        TAP_DIRECTORY: tapDirectory,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const brewCalls = fs.readFileSync(brewLog, "utf8").trimEnd().split("\n")
      .filter(Boolean)
      .map((line) => line.split("\t"));
    const output = parseOutput(fs.readFileSync(githubOutput, "utf8"));
    const summary = fs.existsSync(stepSummary) ? fs.readFileSync(stepSummary, "utf8") : undefined;
    const subjects = execFileSync("git", ["-C", tapDirectory, "log", "--format=%s"], {
      encoding: "utf8",
      env: gitEnv,
    }).trimEnd().split("\n");
    const fileExists = Object.fromEntries(
      files.map((file) => [file, fs.existsSync(path.join(tapDirectory, file))]),
    );

    return { brewCalls, fileExists, output, subjects, summary };
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
    assert.equal(result.output["partially-disabled-packages"], "");
    assert.equal(result.summary, undefined);
    assert.deepEqual(result.brewCalls, [
      ["--repository", repository],
      ["info", "--json=v2", "--variations", "--formula", ...["active", "cutoff", "old", "old2", "recent"].map((name) => `${tap}/${name}`)],
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
      ["info", "--json=v2", "--variations", "--cask", `${tap}/old-cask`],
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
        files: ["Formula/unsafe.rb"],
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
      files: ["Formula/café.rb"],
      formulae: [{
        name: "café",
        tap,
        disabled: false,
        ruby_source_path: "Formula/café.rb",
      }],
    });

    assert.equal(result.output["packages-removed"], "false");
    assert.deepEqual(result.brewCalls[1], ["info", "--json=v2", "--variations", "--formula", `${tap}/café`]);
  });

  it("only asks brew about packages that call disable!", () => {
    const result = runAction({
      directories: ["Formula", "Casks"],
      files: ["Formula/b/disabled.rb"],
      plainFiles: ["Formula/a/plain.rb", "Casks/p/plain-cask.rb"],
    });

    assert.equal(result.output["packages-removed"], "false");
    assert.deepEqual(result.brewCalls, [
      ["--repository", repository],
      ["info", "--json=v2", "--variations", "--formula", `${tap}/disabled`],
    ]);
  });

  it("reports casks disabled on only some supported platforms instead of removing them", () => {
    const intelPath = "Casks/intel-disabled.rb";
    const macosPath = "Casks/macos-disabled.rb";
    const result = runAction({
      directories: ["Casks"],
      files: [intelPath, macosPath],
      casks: [
        {
          token: "intel-disabled",
          tap,
          disabled: false,
          disable_date: null,
          ruby_source_path: intelPath,
          supported_platforms: ["arm64_tahoe", "tahoe", "x86_64_linux"],
          variations: {
            tahoe: { disabled: true, disable_date: monthsAgo(14) },
            x86_64_linux: { disabled: true, disable_date: monthsAgo(14) },
          },
        },
        {
          token: "macos-disabled",
          tap,
          disabled: true,
          disable_date: monthsAgo(13),
          ruby_source_path: macosPath,
          supported_platforms: ["arm64_tahoe", "tahoe", "arm64_linux", "x86_64_linux"],
          variations: {
            arm64_linux: { disabled: false, disable_date: null },
            x86_64_linux: { disabled: false, disable_date: null },
          },
        },
      ],
    });
    const report = [
      `- \`intel-disabled\` (cask, disabled ${monthsAgo(14)}): [${intelPath}](${serverUrl}/${repository}/blob/HEAD/${intelPath})`,
      `- \`macos-disabled\` (cask, disabled ${monthsAgo(13)}): [${macosPath}](${serverUrl}/${repository}/blob/HEAD/${macosPath})`,
    ].join("\n");

    assert.equal(result.fileExists[intelPath], true);
    assert.equal(result.fileExists[macosPath], true);
    assert.equal(result.output["packages-removed"], "false");
    assert.equal(result.output["partially-disabled-packages"], report);
    assert.equal(result.summary, `### Partially disabled packages\n\n${report}\n`);
  });

  it("ignores variations for platforms a cask does not support", () => {
    const caskPath = "Casks/macos-only.rb";
    const result = runAction({
      directories: ["Casks"],
      files: [caskPath],
      casks: [{
        token: "macos-only",
        tap,
        disabled: true,
        disable_date: monthsAgo(13),
        ruby_source_path: caskPath,
        supported_platforms: ["arm64_tahoe", "tahoe"],
        variations: {
          x86_64_linux: { disabled: false, disable_date: null },
        },
      }],
    });

    assert.equal(result.fileExists[caskPath], false);
    assert.equal(result.output["partially-disabled-packages"], "");
    assert.deepEqual(result.subjects, ["macos-only: remove cask", "Add fixtures"]);
  });

  it("keeps packages until every platform has been disabled for long enough", () => {
    const formulaPath = "Formula/staggered.rb";
    const result = runAction({
      files: [formulaPath],
      formulae: [{
        name: "staggered",
        tap,
        disabled: true,
        disable_date: monthsAgo(13),
        ruby_source_path: formulaPath,
        variations: {
          sequoia: { disabled: true, disable_date: monthsAgo(15) },
          x86_64_linux: { disabled: true, disable_date: monthsAgo(2) },
        },
      }],
    });

    assert.equal(result.fileExists[formulaPath], true);
    assert.equal(
      result.output["partially-disabled-packages"],
      `- \`staggered\` (formula, disabled ${monthsAgo(15)}, ${monthsAgo(13)}): ` +
        `[${formulaPath}](${serverUrl}/${repository}/blob/HEAD/${formulaPath})`,
    );
  });

  it("reports formulae disabled only on platforms brew did not run on", () => {
    const formulaPath = "Formula/macos-disabled.rb";
    const result = runAction({
      files: [formulaPath],
      formulae: [{
        name: "macos-disabled",
        tap,
        disabled: false,
        disable_date: null,
        ruby_source_path: formulaPath,
        variations: {
          sequoia: { disabled: true, disable_date: monthsAgo(13) },
          arm64_sequoia: { disabled: true, disable_date: monthsAgo(13) },
        },
      }],
    });

    assert.equal(result.fileExists[formulaPath], true);
    assert.equal(result.output["packages-removed"], "false");
    assert.match(result.output["partially-disabled-packages"], /^- `macos-disabled` \(formula, /);
  });
});
