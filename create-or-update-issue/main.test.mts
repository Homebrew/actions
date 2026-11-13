import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import util from "node:util";

describe("create-issue", async () => {
  const token = "fake-token";
  const title = "Issue title";
  const body = "Issue body.\nLorem ipsum dolor sit amet.";
  const labels = "label1,label2";
  const assignees = "assignee1,assignee2";
  const type = "Bug";

  const issueNumber = 12345;

  beforeEach(async () => {
    mockInput("token", token);
    mockInput("repository", GITHUB_REPOSITORY);
    mockInput("title", title);
    mockInput("body", body);
    mockInput("skip-if-unchanged", "false");
  });

  function captureOutputs() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "create-or-update-issue-"));
    process.env.GITHUB_OUTPUT = path.join(directory, "output");
    fs.writeFileSync(process.env.GITHUB_OUTPUT, "");

    return () => {
      const contents = fs.readFileSync(process.env.GITHUB_OUTPUT!, "utf8");
      fs.rmSync(directory, { force: true, recursive: true });
      return Object.fromEntries(
        [...contents.matchAll(/^(.+?)<<(.+)\n([\s\S]*?)\n\2$/gm)].map((match) => [match[1], match[3]]),
      );
    };
  }

  function mockExistingIssue(mockPool: ReturnType<typeof githubMockPool>, issueBody: string, comments: object[]) {
    mockPool.intercept({
      method: "GET",
      path: `/repos/${GITHUB_REPOSITORY}/issues?` +
        `direction=desc&per_page=100&sort=created&state=open`,
      headers: {
        Authorization: `token ${token}`,
      },
    }).defaultReplyHeaders({
      "Content-Type": "application/json",
    }).reply(200, [
      {
        title,
        number: issueNumber,
        node_id: "I_issue",
        body: issueBody,
        user: { login: "github-actions[bot]" },
      },
    ]);

    mockPool.intercept({
      method: "GET",
      path: `/repos/${GITHUB_REPOSITORY}/issues/${issueNumber}/comments?per_page=100`,
      headers: {
        Authorization: `token ${token}`,
      },
    }).defaultReplyHeaders({
      "Content-Type": "application/json",
    }).reply(200, comments);
  }

  it("creates an issue with optional inputs", async () => {
    mockInput("labels", labels);
    mockInput("assignees", assignees);
    mockInput("type", type);
    mockInput("update-existing", "false");
    mockInput("close-existing", "false");

    const mockPool = githubMockPool();

    mockPool.intercept({
      method: "POST",
      path: `/repos/${GITHUB_REPOSITORY}/issues`,
      headers: {
        Authorization: `token ${token}`,
      },
      body: (htmlBody) => util.isDeepStrictEqual(JSON.parse(htmlBody), {
        title,
        body,
        labels: labels.split(","),
        assignees: assignees.split(","),
        type,
      }),
    }).defaultReplyHeaders({
      "Content-Type": "application/json",
    }).reply(200, {
      number: issueNumber,
    });

    await loadMain();
  });

  it("creates an issue without optional inputs", async () => {
    mockInput("update-existing", "false");
    mockInput("close-existing", "false");

    const mockPool = githubMockPool();

    mockPool.intercept({
      method: "POST",
      path: `/repos/${GITHUB_REPOSITORY}/issues`,
      headers: {
        Authorization: `token ${token}`,
      },
      body: (htmlBody) => util.isDeepStrictEqual(JSON.parse(htmlBody), {
        title,
        body,
        labels: [],
        assignees: [],
        type: null,
      }),
    }).defaultReplyHeaders({
      "Content-Type": "application/json",
    }).reply(200, {
      number: issueNumber,
    });

    await loadMain();
  });

  it("updates an issue when `update-existing: true`", async () => {
    mockInput("update-existing", "true");
    mockInput("close-existing", "false");

    const mockPool = githubMockPool();

    mockPool.intercept({
      method: "GET",
      path: `/repos/${GITHUB_REPOSITORY}/issues?` +
        `direction=desc&per_page=100&sort=created&state=open`,
      headers: {
        Authorization: `token ${token}`,
      },
    }).defaultReplyHeaders({
      "Content-Type": "application/json",
    }).reply(200, [
      {
        title: "Not the same issue",
        number: 54321,
      },
      {
        title,
        number: issueNumber,
      },
    ]);

    mockPool.intercept({
      method: "POST",
      path: `/repos/${GITHUB_REPOSITORY}/issues/${issueNumber}/comments`,
      headers: {
        Authorization: `token ${token}`,
      },
      body: (htmlBody) => util.isDeepStrictEqual(JSON.parse(htmlBody), {
        body,
      }),
    }).defaultReplyHeaders({
      "Content-Type": "application/json",
    }).reply(200, {
      html_url: "https://github.com/owner/repo/issues/12345#issuecomment-67890",
    });

    await loadMain();
  });

  it("closes an existing issue when `close-existing: true`", async () => {
    mockInput("update-existing", "false");
    mockInput("close-existing", "true");

    const closeFromAuthor = "some-user";
    mockInput("close-from-author", closeFromAuthor);

    const closeComment = "Deployment succeeded.\nClosing issue.";
    mockInput("close-comment", closeComment);

    const mockPool = githubMockPool();

    mockPool.intercept({
      method: "GET",
      path: `/repos/${GITHUB_REPOSITORY}/issues?` +
        [
          `creator=${closeFromAuthor}`,
          "direction=desc",
          "per_page=100",
          "sort=created",
          "state=open",
        ].join("&"),
      headers: {
        Authorization: `token ${token}`,
      },
    }).defaultReplyHeaders({
      "Content-Type": "application/json",
    }).reply(200, [
      {
        title: "Not the same issue",
        number: 54321,
      },
      {
        title,
        number: issueNumber,
      },
    ]);

    mockPool.intercept({
      method: "POST",
      path: `/repos/${GITHUB_REPOSITORY}/issues/${issueNumber}/comments`,
      headers: {
        Authorization: `token ${token}`,
      },
      body: (htmlBody) => util.isDeepStrictEqual(JSON.parse(htmlBody), {
        body: closeComment,
      }),
    }).defaultReplyHeaders({
      "Content-Type": "application/json",
    }).reply(200, {
      html_url: "https://github.com/owner/repo/issues/12345#issuecomment-67890",
    });

    mockPool.intercept({
      method: "PATCH",
      path: `/repos/${GITHUB_REPOSITORY}/issues/${issueNumber}`,
      headers: {
        Authorization: `token ${token}`,
      },
      body: (htmlBody) => util.isDeepStrictEqual(JSON.parse(htmlBody), {
        state: "closed",
        state_reason: "completed",
      }),
    }).defaultReplyHeaders({
      "Content-Type": "application/json",
    }).reply(200, {
      html_url: "https://github.com/owner/repo/issues/12345#issuecomment-67890",
    });

    await loadMain();
  });

  describe("with `update-existing: true` and `skip-if-unchanged: true`", () => {
    beforeEach(() => {
      mockInput("update-existing", "true");
      mockInput("close-existing", "false");
      mockInput("skip-if-unchanged", "true");
    });

    it("doesn't comment when the author's latest comment matches", async () => {
      const outputs = captureOutputs();
      const mockPool = githubMockPool();
      mockExistingIssue(mockPool, "Original body.", [
        { user: { login: "github-actions[bot]" }, body: "Older body." },
        { user: { login: "github-actions[bot]" }, body: `${body.replaceAll("\n", "\r\n")}\r\n` },
        { user: { login: "a-maintainer" }, body: "Taking a look." },
      ]);

      await loadMain();

      assert.deepEqual(outputs(), { outcome: "unchanged", number: `${issueNumber}`, node_id: "I_issue" });
    });

    it("doesn't comment when the author hasn't commented and the issue body matches", async () => {
      const outputs = captureOutputs();
      const mockPool = githubMockPool();
      mockExistingIssue(mockPool, body, [
        { user: { login: "a-maintainer" }, body: "Taking a look." },
      ]);

      await loadMain();

      assert.equal(outputs().outcome, "unchanged");
    });

    it("comments when the body differs from the author's latest comment", async () => {
      const outputs = captureOutputs();
      const mockPool = githubMockPool();
      mockExistingIssue(mockPool, body, [
        { user: { login: "github-actions[bot]" }, body: "Older body." },
        { user: { login: "a-maintainer" }, body },
      ]);

      mockPool.intercept({
        method: "POST",
        path: `/repos/${GITHUB_REPOSITORY}/issues/${issueNumber}/comments`,
        headers: {
          Authorization: `token ${token}`,
        },
        body: (htmlBody) => util.isDeepStrictEqual(JSON.parse(htmlBody), {
          body,
        }),
      }).defaultReplyHeaders({
        "Content-Type": "application/json",
      }).reply(200, {
        html_url: "https://github.com/owner/repo/issues/12345#issuecomment-67890",
      });

      await loadMain();

      assert.equal(outputs().outcome, "commented");
    });
  });
});
