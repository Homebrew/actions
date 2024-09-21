import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import util from "node:util";

describe("limit-pull-requests", async () => {
  const token = "fake-token";
  const commentLimit = 3;
  const comment = "Please don't open too many PRs!";
  const closeLimit = 5;
  const close = true;
  const exemptedUser = "exempted-user";

  const prNumber = 12345;

  const GITHUB_ACTOR = "fake-actor";
  const GITHUB_EVENT_NAME = "pull_request_target";

  let directory;
  let eventPath;

  before(async () => {
    process.env.GITHUB_ACTOR = GITHUB_ACTOR;
    process.env.GITHUB_EVENT_NAME = GITHUB_EVENT_NAME;

    directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "limit-pull-requests-"));
    eventPath = path.join(directory, "event.json");
    await fs.promises.writeFile(eventPath, JSON.stringify({
      pull_request: {
        number: prNumber,
        author_association: "CONTRIBUTOR",
      },
    }));

    process.env.GITHUB_EVENT_PATH = eventPath;
  });

  after(async () => {
    await fs.promises.rm(directory, { recursive: true });
  });

  beforeEach(async () => {
    mockInput("token", token);
    mockInput("comment-limit", commentLimit.toString());
    mockInput("comment", comment);
    mockInput("close-limit", closeLimit.toString());
    mockInput("close", close.toString());
    mockInput("except-users", exemptedUser);
  });

  it("does nothing if no limit is reached", async () => {
    const actor = GITHUB_ACTOR;
    const mockPool = githubMockPool();

    mockPool.intercept({
      method: "GET",
      path: `/repos/${GITHUB_REPOSITORY}/pulls?per_page=100&state=open`,
      headers: {
        Authorization: `token ${token}`,
      },
    }).defaultReplyHeaders({
      "Content-Type": "application/json",
    }).reply(200, [
      { user: { login: actor } },
      { user: { login: "some-other-actor-1" } },
      { user: { login: "some-other-actor-2" } },
      { user: { login: "some-other-actor-3" } },
    ]);

    await loadMain();
  });

  it("posts a comment and closes the PR if limits are reached", async () => {
    const actor = GITHUB_ACTOR;
    const mockPool = githubMockPool();

    mockPool.intercept({
      method: "GET",
      path: `/repos/${GITHUB_REPOSITORY}/pulls?per_page=100&state=open`,
      headers: {
        Authorization: `token ${token}`,
      },
    }).defaultReplyHeaders({
      "Content-Type": "application/json",
    }).reply(200, [
      { user: { login: actor } },
      { user: { login: actor } },
      { user: { login: actor } },
      { user: { login: actor } },
      { user: { login: actor } },
      { user: { login: actor } },
      { user: { login: "some-other-actor-1" } },
      { user: { login: "some-other-actor-2" } },
      { user: { login: "some-other-actor-3" } },
    ]);

    mockPool.intercept({
      method: "POST",
      path: `/repos/${GITHUB_REPOSITORY}/issues/${prNumber}/comments`,
      headers: {
        Authorization: `token ${token}`,
      },
      body: (body) => util.isDeepStrictEqual(JSON.parse(body), {
        body: comment,
      }),
    }).defaultReplyHeaders({
      "Content-Type": "application/json",
    }).reply(200, {});

    mockPool.intercept({
      method: "PATCH",
      path: `/repos/${GITHUB_REPOSITORY}/pulls/${prNumber}`,
      headers: {
        Authorization: `token ${token}`,
      },
      body: (body) => util.isDeepStrictEqual(JSON.parse(body), {
        state: "closed",
      }),
    }).defaultReplyHeaders({
      "Content-Type": "application/json",
    }).reply(200, {});

    await loadMain();
  });

  it("does nothing if limits are reached but user is exempted", async () => {
    process.env.GITHUB_ACTOR = exemptedUser;
    await loadMain();
  });
});
