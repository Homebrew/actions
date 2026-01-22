test("dismiss-approvals", async () => {
  const mockPool = githubMockPool()

  const token = "fake-token"
  const pr = "12345"
  const message = "Some message"

  mockInput("token", token)
  mockInput("pr", pr)
  mockInput("message", message)

  mockPool.intercept({
    method: "GET",
    path: `/repos/${GITHUB_REPOSITORY}/pulls/${pr}/reviews`,
    headers: {
      Authorization: `token ${token}`,
    },
  }).defaultReplyHeaders({
    "Content-Type": "application/json",
  }).reply(200, [
    { id: 1, state: "APPROVED" },
    { id: 2, state: "CHANGES_REQUESTED" },
    { id: 3, state: "APPROVED" },
  ])

  for (const review of [1, 3]) {
    mockPool.intercept({
      method: "PUT",
      path: `/repos/${GITHUB_REPOSITORY}/pulls/${pr}/reviews/${review}/dismissals`,
      headers: {
        Authorization: `token ${token}`,
      },
      body: (body) => JSON.parse(body).message === message,
    }).defaultReplyHeaders({
      "Content-Type": "application/json",
    }).reply(200, {})
  }

  await loadMain()
})
