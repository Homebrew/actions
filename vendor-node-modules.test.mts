import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const CHECK = fileURLToPath(new URL("./.github/scripts/check-node-modules.sh", import.meta.url));

for (const [name, install, expected] of [
  ["unchanged production dependencies", "true", 0],
  ["changed dependency", "echo updated > node_modules/example/index.js", 1],
  ["new dependency", "mkdir -p node_modules/new; echo new > node_modules/new/index.js", 1],
  ["removed dependency", "rm node_modules/example/index.js", 1],
  ["ignored files", "mkdir -p node_modules/.bin; touch node_modules/.bin/example", 0],
  ["failed installation", "exit 42", 42],
] as const) {
  test(`vendor check handles ${name}`, (t) => {
    const directory = mkdtempSync(join(tmpdir(), "actions-vendor-check-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const git = (...args: string[]) => execFileSync("git", args, { cwd: directory, stdio: "pipe" });
    git("init", "--quiet");
    git("config", "user.name", "Vendor Test");
    git("config", "user.email", "test@example.com");
    git("config", "commit.gpgsign", "false");
    mkdirSync(join(directory, "node_modules/example"), { recursive: true });
    writeFileSync(join(directory, "node_modules/example/index.js"), "original\n");
    writeFileSync(join(directory, ".gitignore"), "/node_modules/.bin/\n");
    git("add", ".");
    git("commit", "--quiet", "-m", "fixture");
    mkdirSync(join(directory, "bin"));
    const npm = join(directory, "bin/npm");
    writeFileSync(npm, `#!/bin/sh\n[ "$*" = "ci --ignore-scripts --omit=dev" ] || exit 99\n${install}\n`);
    chmodSync(npm, 0o755);
    const result = spawnSync("bash", [CHECK], {
      cwd: directory,
      env: { ...process.env, PATH: `${join(directory, "bin")}:${process.env.PATH}` },
      encoding: "utf8",
    });
    assert.equal(result.status, expected, result.stdout + result.stderr);
  });
}
