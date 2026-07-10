import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  appendFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import * as yaml from "js-yaml";

type ActionStep = {
  uses?: string;
};

type ActionMetadata = {
  runs?: {
    steps?: ActionStep[];
  };
};

const REPOSITORY_ROOT = fileURLToPath(new URL(".", import.meta.url));
const PREPARE_RELEASE = fileURLToPath(
  new URL("./.github/scripts/prepare-release.sh", import.meta.url),
);

function git(repository: string, ...arguments_: string[]): string {
  return execFileSync("git", ["-C", repository, ...arguments_], {
    encoding: "utf8",
  }).trim();
}

function repository(): string {
  const path = mkdtempSync(join(tmpdir(), "homebrew-actions-release-"));
  git(path, "init", "--initial-branch=main");
  git(path, "config", "user.email", "test@example.com");
  git(path, "config", "user.name", "Release Test");
  git(path, "config", "commit.gpgsign", "false");
  git(path, "config", "tag.gpgsign", "false");
  return path;
}

function commit(repository: string, message: string, date: string): string {
  appendFileSync(join(repository, "state.txt"), `${message}\n`);
  git(repository, "add", "state.txt");
  execFileSync("git", ["-C", repository, "commit", "-m", message], {
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_DATE: date,
    },
  });
  return git(repository, "rev-parse", "HEAD");
}

function tag(repository: string, name: string): void {
  git(repository, "tag", "--annotate", name, "--message", name);
}

function prepare(
  repository: string,
  eventName: "schedule" | "workflow_dispatch",
  now: string,
  releaseDate = "2026.07.06",
): Record<string, string> {
  const output = join(repository, "github-output");
  writeFileSync(output, "");

  const result = spawnSync("bash", [PREPARE_RELEASE], {
    cwd: repository,
    encoding: "utf8",
    env: {
      ...process.env,
      GITHUB_EVENT_NAME: eventName,
      GITHUB_OUTPUT: output,
      RELEASE_DATE: releaseDate,
      RELEASE_MINIMUM_AGE_SECONDS: "86400",
      RELEASE_NOW: now,
    },
  });

  assert.equal(result.status, 0, result.stderr);

  return Object.fromEntries(
    readFileSync(output, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

test("prepares the first scheduled release from an old commit", (t) => {
  const path = repository();
  t.after(() => rmSync(path, { force: true, recursive: true }));

  const candidate = commit(path, "initial", "2026-07-05T12:00:00Z");
  const output = prepare(path, "schedule", "1783339200");

  assert.equal(output.release, "true");
  assert.equal(output.version, "2026.07.06.1");
  assert.equal(output.candidate_sha, candidate);
});

test("increments the sequence for the UTC release date", (t) => {
  const path = repository();
  t.after(() => rmSync(path, { force: true, recursive: true }));

  commit(path, "released", "2026-07-04T12:00:00Z");
  tag(path, "2026.07.06.1");
  tag(path, "v2026.07.06.9");
  commit(path, "next", "2026-07-05T12:00:00Z");

  const output = prepare(path, "schedule", "1783339200");

  assert.equal(output.release, "true");
  assert.equal(output.version, "2026.07.06.2");
  assert.equal(output.latest_tag, "2026.07.06.1");
});

test("increments past single digits with lightweight tags", (t) => {
  const path = repository();
  t.after(() => rmSync(path, { force: true, recursive: true }));

  commit(path, "released", "2026-07-04T12:00:00Z");
  git(path, "tag", "2026.07.06.9");
  commit(path, "next", "2026-07-05T12:00:00Z");

  const output = prepare(path, "schedule", "1783339200");

  assert.equal(output.release, "true");
  assert.equal(output.version, "2026.07.06.10");
  assert.equal(output.latest_tag, "2026.07.06.9");
});

test("avoids a sequence held by an unreachable same-date tag", (t) => {
  const path = repository();
  t.after(() => rmSync(path, { force: true, recursive: true }));

  commit(path, "base", "2026-07-01T12:00:00Z");
  git(path, "checkout", "-b", "side");
  commit(path, "side", "2026-07-02T12:00:00Z");
  git(path, "tag", "2026.07.06.1");
  git(path, "checkout", "main");
  commit(path, "main", "2026-07-03T12:00:00Z");

  const output = prepare(path, "schedule", "1783339200");

  assert.equal(output.release, "true");
  assert.equal(output.latest_tag, "");
  assert.equal(output.version, "2026.07.06.2");
});

test("skips when the latest release already contains the candidate", (t) => {
  const path = repository();
  t.after(() => rmSync(path, { force: true, recursive: true }));

  commit(path, "released", "2026-07-04T12:00:00Z");
  tag(path, "2026.07.05.1");

  const output = prepare(path, "schedule", "1783339200");

  assert.equal(output.release, "false");
  assert.equal(output.reason, "No commits since 2026.07.05.1.");
});

test("manual releases also skip when there are no new commits", (t) => {
  const path = repository();
  t.after(() => rmSync(path, { force: true, recursive: true }));

  commit(path, "released", "2026-07-04T12:00:00Z");
  tag(path, "2026.07.05.1");

  const output = prepare(path, "workflow_dispatch", "1783339200");

  assert.equal(output.release, "false");
  assert.equal(output.reason, "No commits since 2026.07.05.1.");
});

test("scheduled releases require 24 hours of bake time", (t) => {
  const path = repository();
  t.after(() => rmSync(path, { force: true, recursive: true }));

  commit(path, "recent", "2026-07-06T11:00:00Z");

  const output = prepare(path, "schedule", "1783339200");

  assert.equal(output.release, "false");
  assert.equal(
    output.reason,
    "Candidate commit is 3600 seconds old; scheduled releases require 86400 seconds.",
  );
});

test("manual releases bypass the bake-time requirement", (t) => {
  const path = repository();
  t.after(() => rmSync(path, { force: true, recursive: true }));

  commit(path, "urgent fix", "2026-07-06T11:00:00Z");

  const output = prepare(path, "workflow_dispatch", "1783339200");

  assert.equal(output.release, "true");
  assert.equal(output.version, "2026.07.06.1");
});

test("clamps a future-dated candidate age to zero", (t) => {
  const path = repository();
  t.after(() => rmSync(path, { force: true, recursive: true }));

  // Committer date one hour ahead of RELEASE_NOW (clock skew).
  commit(path, "future", "2026-07-06T13:00:00Z");

  const output = prepare(path, "workflow_dispatch", "1783339200");

  assert.equal(output.candidate_age_seconds, "0");
  assert.equal(output.release, "true");
});

test("internal Homebrew/actions dependencies use full commit SHAs", () => {
  const actionFiles = git(REPOSITORY_ROOT, "ls-files")
    .split("\n")
    .filter((file) => file.endsWith("/action.yml"));
  const invalidReferences: string[] = [];

  for (const actionFile of actionFiles) {
    const action = yaml.load(
      readFileSync(join(REPOSITORY_ROOT, actionFile), "utf8"),
    ) as ActionMetadata;

    for (const step of action.runs?.steps ?? []) {
      if (
        step.uses?.startsWith("Homebrew/actions/") &&
        !/^Homebrew\/actions\/[^@]+@[0-9a-f]{40}$/.test(step.uses)
      ) {
        invalidReferences.push(`${actionFile}: ${step.uses}`);
      }
    }
  }

  assert.deepEqual(invalidReferences, []);
});

test("internal Homebrew/actions pins reference the current sub-action tree", () => {
  const actionFiles = git(REPOSITORY_ROOT, "ls-files")
    .split("\n")
    .filter((file) => file.endsWith("/action.yml"));
  const staleReferences: string[] = [];

  for (const actionFile of actionFiles) {
    const action = yaml.load(
      readFileSync(join(REPOSITORY_ROOT, actionFile), "utf8"),
    ) as ActionMetadata;

    for (const step of action.runs?.steps ?? []) {
      const match = step.uses?.match(
        /^Homebrew\/actions\/([^@]+)@([0-9a-f]{40})$/,
      );
      if (!match) continue;

      const [, subAction, sha] = match;
      const changedFiles = git(
        REPOSITORY_ROOT,
        "diff",
        "--name-only",
        `${sha}..HEAD`,
        "--",
        `${subAction}/`,
      );
      if (changedFiles) {
        staleReferences.push(
          `${actionFile}: ${step.uses} is behind ${subAction}/`,
        );
      }
    }
  }

  assert.deepEqual(staleReferences, []);
});
