import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

describe("setup-homebrew shallow taps", () => {
  for (const existing of [false, true]) {
    it(`sets up ${existing ? "existing" : "missing"} taps and blocks subsequent fetches`, () => {
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), "setup-homebrew-shallow-"));
      const repository = path.join(directory, "brew");
      const bin = path.join(directory, "bin");
      const env = {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        TEST_BREW_REPOSITORY: repository,
        GIT_CONFIG_GLOBAL: path.join(directory, "gitconfig"),
        GIT_CONFIG_SYSTEM: path.join(directory, "systemconfig"),
        GIT_CONFIG_COUNT: "1",
        GIT_CONFIG_KEY_0: `url.${pathToFileURL(`${directory}/remotes/`).href}.insteadOf`,
        GIT_CONFIG_VALUE_0: "https://github.com/Homebrew/",
        GITHUB_REPOSITORY: "Homebrew/formulae.brew.sh",
        GITHUB_SERVER_URL: "https://github.com",
        GITHUB_ACTIONS_HOMEBREW_SELF_HOSTED: "1",
        GITHUB_ENV: path.join(directory, "env"),
        GITHUB_OUTPUT: path.join(directory, "output"),
        GITHUB_PATH: path.join(directory, "path"),
        GITHUB_STATE: path.join(directory, "state"),
        RUNNER_OS: "macOS",
        RUNNER_WORKSPACE: directory,
        RUNNER_TEMP: directory,
      };
      const git = (cwd: string, ...args: string[]) =>
        execFileSync("git", ["-C", cwd, ...args], { env, encoding: "utf8", stdio: "pipe" }).trim();

      try {
        fs.mkdirSync(bin);
        fs.writeFileSync(path.join(bin, "brew"),
          '#!/bin/sh\nprintf "%s\\n" "$TEST_BREW_REPOSITORY"\n', { mode: 0o755 });
        for (const name of ["brew", "homebrew-core", "homebrew-cask"]) {
          const remote = path.join(directory, "remotes", name);
          fs.mkdirSync(remote, { recursive: true });
          git(remote, "init", "--quiet", "--initial-branch=main");
          git(remote, "config", "user.name", "Workflow Test");
          git(remote, "config", "user.email", "workflow@example.test");
          git(remote, "config", "commit.gpgsign", "false");
          if (name === "brew") {
            fs.mkdirSync(path.join(remote, "Library/Homebrew"), { recursive: true });
            fs.writeFileSync(path.join(remote, "Library/Homebrew/Gemfile.lock"), "");
          }
          fs.writeFileSync(path.join(remote, "package.rb"), "old\n");
          git(remote, "add", ".");
          git(remote, "commit", "--quiet", "-m", "Initial package");
          if (name === "brew" || existing) {
            git(directory, "clone", "--quiet", "--depth=1", `https://github.com/Homebrew/${name}`,
              name === "brew" ? repository : path.join(repository, "Library/Taps/homebrew", name));
          }
        }

        for (const version of ["current", "latest"]) {
          for (const tap of ["core", "cask"]) {
            const remote = path.join(directory, "remotes", `homebrew-${tap}`);
            fs.writeFileSync(path.join(remote, "package.rb"), `${version}\n`);
            git(remote, "commit", "--quiet", "-am", "Update package");
          }
          execFileSync("/bin/bash", [
            new URL("main.sh", import.meta.url).pathname, "shallow", "shallow", "false", "", "false", "",
          ], { cwd: directory, env, stdio: "pipe", timeout: 10_000 });

          for (const tap of ["core", "cask"]) {
            const checkout = path.join(repository, "Library/Taps/homebrew", `homebrew-${tap}`);
            assert.equal(fs.readFileSync(path.join(checkout, "package.rb"), "utf8"), `${version}\n`);
            assert.equal(git(checkout, "rev-parse", "HEAD"),
              git(path.join(directory, "remotes", `homebrew-${tap}`), "rev-parse", "HEAD"));
            assert.equal(git(checkout, "rev-parse", "--is-shallow-repository"), "true");
            assert.equal(git(checkout, "rev-list", "--count", "HEAD"), "1");
            assert.equal(git(checkout, "config", "remote.origin.url"), `https://github.com/Homebrew/homebrew-${tap}`);
            assert.equal(git(checkout, "symbolic-ref", "refs/remotes/origin/HEAD"), "refs/remotes/origin/main");
            for (const args of [["origin"], ["--unshallow", "origin"], ["--all"],
              [`https://github.com/Homebrew/homebrew-${tap}`]]) {
              const result = spawnSync("git", ["-C", checkout, "fetch", ...args], { env, encoding: "utf8" });
              assert.notEqual(result.status, 0);
              assert.match(result.stderr, /transport 'file' not allowed/);
            }
          }
        }
      } finally {
        fs.rmSync(directory, { force: true, recursive: true });
      }
    });
  }
});
