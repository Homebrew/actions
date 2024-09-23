import util from "node:util";

describe("create-issue", async () => {
  const token = "fake-token";
  const title = "Issue title";
  const body = "Issue body.\nLorem ipsum dolor sit amet.";
  const labels = "label1,label2";
  const assignees = "assignee1,assignee2";

  const issueNumber = 12345;

  beforeEach(async () => {
    mockInput("token", token);
    mockInput("repository", GITHUB_REPOSITORY);
    mockInput("title", title);
    mockInput("body", body);
    mockInput("labels", labels);
    mockInput("assignees", assignees);
  });

  it("creates an issue", async () => {
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

    const closeComment = "Deployment succeeded.\nClosing issue.";
    mockInput("close-comment", closeComment);

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
});
