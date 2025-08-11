import util from "node:util"

test("create-pull-request", async () => {
  const mockPool = githubMockPool()

  const token = "fake-token"
  const base = "base-branch"
  const head = "head-branch"
  const prTitle = "Some PR title"
  const prBody = "Some PR body.\nWith multiple lines."

  const labels = "label1,label2"
  const reviewers = "reviewer1,reviewer2"

  const prNumber = 12345

  mockInput("token", token)
  mockInput("repository", GITHUB_REPOSITORY)
  mockInput("base", base)
  mockInput("head", head)
  mockInput("title", prTitle)
  mockInput("body", prBody)
  mockInput("labels", labels)
  mockInput("reviewers", reviewers)

  mockPool.intercept({
    method: "POST",
    path: `/repos/${GITHUB_REPOSITORY}/pulls`,
    headers: {
      Authorization: `token ${token}`,
    },
    body: (body) => util.isDeepStrictEqual(JSON.parse(body), {
      base,
      head,
      title: prTitle,
      body: prBody
    }),
  }).defaultReplyHeaders({
    "Content-Type": "application/json",
  }).reply(200, {
    number: prNumber
  })

  mockPool.intercept({
    method: "POST",
    path: `/repos/${GITHUB_REPOSITORY}/issues/${prNumber}/labels`,
    headers: {
      Authorization: `token ${token}`,
    },
    body: (body) => util.isDeepStrictEqual(JSON.parse(body), {
      labels: labels.split(",")
    }),
  }).defaultReplyHeaders({
    "Content-Type": "application/json",
  }).reply(200, {})

  mockPool.intercept({
    method: "POST",
    path: `/repos/${GITHUB_REPOSITORY}/pulls/${prNumber}/requested_reviewers`,
    headers: {
      Authorization: `token ${token}`,
    },
    body: (body) => util.isDeepStrictEqual(JSON.parse(body), {
      reviewers: reviewers.split(",")
    }),
  }).defaultReplyHeaders({
    "Content-Type": "application/json",
  }).reply(200, {})

  await loadMain()
})
