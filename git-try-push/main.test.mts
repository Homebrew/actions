import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";

const ACTION = fileURLToPath(new URL("./main.mts", import.meta.url));

function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "git-try-push-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const remote = join(directory, "remote.git");
  const local = join(directory, "local");
  const peer = join(directory, "peer");
  const bin = join(directory, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "sleep"), "#!/bin/sh\nexit 0\n");
  chmodSync(join(bin, "sleep"), 0o755);
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
  };

  function git(repository: string, ...args: string[]) {
    return execFileSync("/usr/bin/git", ["-C", repository, ...args], {
      env,
      encoding: "utf8",
      stdio: "pipe",
    }).trim();
  }

  function configure(repository: string) {
    git(repository, "config", "user.name", "Git try push test");
    git(repository, "config", "user.email", "test@example.com");
    git(repository, "config", "commit.gpgsign", "false");
  }

  function commit(repository: string, file: string, content: string) {
    writeFileSync(join(repository, file), content);
    git(repository, "add", file);
    git(repository, "commit", "-m", `Update ${file}`);
    return git(repository, "rev-parse", "HEAD");
  }

  git(directory, "init", "--bare", "--initial-branch=main", remote);
  git(directory, "clone", remote, local);
  configure(local);
  commit(local, "file", "base\n");
  commit(local, "worktree", "clean\n");
  git(local, "push", "origin", "main");
  git(directory, "clone", remote, peer);
  configure(peer);

  function run(inputs: Record<string, string> = {}) {
    const result = spawnSync(process.execPath, [ACTION], {
      cwd: directory,
      encoding: "utf8",
      timeout: 10_000,
      env: {
        ...env,
        INPUT_DIRECTORY: local,
        INPUT_REMOTE: "origin",
        INPUT_BRANCH: "main",
        INPUT_REMOTE_BRANCH: "",
        INPUT_ORIGIN_BRANCH: "",
        INPUT_TOKEN: "",
        INPUT_TRIES: "2",
        INPUT_FORCE: "true",
        INPUT_NO_LEASE: "false",
        ...inputs,
      },
    });
    assert.ifError(result.error);
    return { status: result.status, output: result.stdout + result.stderr };
  }

  function disconnectUntilAfterPullRound() {
    const offline = join(directory, "offline.git");
    const counter = join(directory, "sleeps");
    renameSync(remote, offline);
    // With tries=3, the fourth sleep follows three failed fetches. Restore
    // the remote only after the action has exhausted that inner pull budget.
    writeFileSync(join(bin, "sleep"), `#!${process.execPath}
const fs = require("node:fs");
const counter = ${JSON.stringify(counter)};
const count = fs.existsSync(counter) ? Number(fs.readFileSync(counter, "utf8")) + 1 : 1;
fs.writeFileSync(counter, String(count));
if (count === 4) fs.renameSync(${JSON.stringify(offline)}, ${JSON.stringify(remote)});
`);
  }

  return { local, peer, remote, git, commit, run, disconnectUntilAfterPullRound };
}

for (const backend of ["merge", "apply"]) {
  test(`a conflicting ${backend} rebase preserves the remote commit and restores local changes`, (t) => {
    const { local, peer, remote, git, commit, run } = fixture(t);
    git(local, "config", "rebase.backend", backend);
    const localTip = commit(local, "file", "local\n");
    writeFileSync(join(local, "worktree"), "uncommitted\n");
    const remoteTip = commit(peer, "file", "peer\n");
    git(peer, "push", "origin", "main");

    const result = run();

    assert.equal(git(remote, "rev-parse", "main"), remoteTip, result.output);
    assert.equal(result.status, 1, result.output);
    assert.equal(git(local, "rev-parse", "HEAD"), localTip);
    assert.equal(git(local, "status", "--porcelain"), "M worktree");
    assert.equal(readFileSync(join(local, "worktree"), "utf8"), "uncommitted\n");
    assert.equal(existsSync(join(local, ".git", "rebase-merge")), false);
    assert.equal(existsSync(join(local, ".git", "rebase-apply")), false);
    assert.equal(git(local, "stash", "list"), "");
  });
}

test("exhausted pull retries cannot force push even when no rebase is in progress", (t) => {
  const { local, peer, remote, git, commit, run } = fixture(t);
  commit(local, "file", "local\n");
  const remoteTip = commit(peer, "other", "peer\n");
  git(peer, "push", "origin", "main");
  const hook = join(local, ".git", "hooks", "pre-rebase");
  writeFileSync(hook, "#!/bin/sh\nexit 1\n");
  chmodSync(hook, 0o755);

  const result = run();

  assert.equal(git(remote, "rev-parse", "main"), remoteTip, result.output);
  assert.equal(result.status, 1, result.output);
});

for (const force of ["false", "true"]) {
  test(`a successful rebase preserves both writers' commits with force=${force}`, (t) => {
    const { local, peer, remote, git, commit, run } = fixture(t);
    commit(local, "file", "local\n");
    const remoteTip = commit(peer, "other", "peer\n");
    git(peer, "push", "origin", "main");

    const result = run({ INPUT_FORCE: force });

    assert.equal(result.status, 0, result.output);
    git(remote, "merge-base", "--is-ancestor", remoteTip, "main");
    assert.equal(git(remote, "show", "main:file"), "local");
    assert.equal(git(remote, "show", "main:other"), "peer");
  });
}

test("a transient pull failure is retried before pushing", (t) => {
  const { local, peer, remote, git, commit, run } = fixture(t);
  commit(local, "file", "local\n");
  const remoteTip = commit(peer, "other", "peer\n");
  git(peer, "push", "origin", "main");
  const hook = join(local, ".git", "hooks", "pre-rebase");
  writeFileSync(hook, '#!/bin/sh\nrm "$0"\nexit 1\n');
  chmodSync(hook, 0o755);

  const result = run();

  assert.equal(result.status, 0, result.output);
  assert.equal(existsSync(hook), false);
  git(remote, "merge-base", "--is-ancestor", remoteTip, "main");
  assert.equal(git(remote, "show", "main:file"), "local");
});

test("no_lease preserves the explicit overwrite behavior", (t) => {
  const { local, peer, remote, git, commit, run } = fixture(t);
  const localTip = commit(local, "file", "local\n");
  commit(peer, "file", "peer\n");
  git(peer, "push", "origin", "main");

  const result = run({ INPUT_NO_LEASE: "true" });

  assert.equal(result.status, 0, result.output);
  assert.equal(git(remote, "rev-parse", "main"), localTip);
});

for (const force of ["false", "true"]) {
  for (const concurrent of [false, true]) {
    test(`recovers after a full round of fetch failures with force=${force}, concurrent=${concurrent}`, (t) => {
      const { local, peer, remote, git, commit, run, disconnectUntilAfterPullRound } = fixture(t);
      commit(local, "file", "local\n");
      const remoteTip = concurrent ? commit(peer, "other", "peer\n") : git(peer, "rev-parse", "HEAD");
      git(peer, "push", "origin", "main");
      disconnectUntilAfterPullRound();

      const result = run({ INPUT_FORCE: force, INPUT_TRIES: "3" });

      assert.equal(result.status, 0, result.output);
      git(remote, "merge-base", "--is-ancestor", remoteTip, "main");
      assert.equal(git(remote, "show", "main:file"), "local");
      if (concurrent) assert.equal(git(remote, "show", "main:other"), "peer");
    });
  }
}

test("an untracked file collision cannot authorize a force push", (t) => {
  const { local, peer, remote, git, commit, run } = fixture(t);
  const localTip = commit(local, "file", "local\n");
  const remoteTip = commit(peer, "collision", "peer\n");
  git(peer, "push", "origin", "main");
  writeFileSync(join(local, "collision"), "untracked\n");

  const result = run();

  assert.equal(result.status, 1, result.output);
  assert.equal(git(remote, "rev-parse", "main"), remoteTip, result.output);
  assert.equal(git(local, "rev-parse", "HEAD"), localTip);
  assert.equal(readFileSync(join(local, "collision"), "utf8"), "untracked\n");
  assert.equal(existsSync(join(local, ".git", "rebase-merge")), false);
  assert.equal(git(local, "stash", "list"), "");
});
