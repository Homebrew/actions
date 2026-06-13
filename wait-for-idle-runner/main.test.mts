import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("wait-for-idle-runner", () => {
  const token = "fake-token";
  const runnerName = "linux-self-hosted-1";

  let directory: string;
  let githubOutput: string;

  beforeEach(async () => {
    directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "wait-for-idle-runner-"));
    githubOutput = path.join(directory, "github-output");
    await fs.promises.writeFile(githubOutput, "");
    process.env.GITHUB_OUTPUT = githubOutput;

    mockInput("github_token", token);
    mockInput("runner_name", runnerName);
    mockInput("repository_name", GITHUB_REPOSITORY);
  });

  afterEach(async () => {
    await fs.promises.rm(directory, { recursive: true });
  });

  function outputs() {
    const lines = fs.readFileSync(githubOutput, "utf8").split("\n");
    const result: Record<string, string> = {};
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(.+)<<(\S+)$/);
      if (!match) continue;
      const [, key, delimiter] = match;
      const value = [];
      while (++i < lines.length && lines[i] !== delimiter) value.push(lines[i]);
      assert.ok(i < lines.length, `Unterminated heredoc for ${key} in GITHUB_OUTPUT`);
      result[key] = value.join("\n");
    }
    return result;
  }

  function interceptRunners(runners: { name: string; busy: boolean }[]) {
    githubMockPool().intercept({
      method: "GET",
      path: `/repos/${GITHUB_REPOSITORY}/actions/runners`,
      headers: {
        Authorization: `token ${token}`,
      },
    }).defaultReplyHeaders({
      "Content-Type": "application/json",
    }).reply(200, { total_count: runners.length, runners });
  }

  it("reports an idle runner as found and idle", async () => {
    interceptRunners([{ name: runnerName, busy: false }]);

    await loadMain();

    assert.deepEqual(outputs(), { "runner-found": "true", "runner-idle": "true" });
  });

  it("reports a missing runner as not found", async () => {
    interceptRunners([{ name: "some-other-runner", busy: false }]);

    await loadMain();

    assert.deepEqual(outputs(), { "runner-found": "false" });
  });
});
