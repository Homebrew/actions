describe("post-comment", async () => {
  const token = "fake-token"
  const issue = "12345"
  const body = "Some comment"
  const botBody = "Some bot comment"
  const bot = "IAmBot"

  beforeEach(() => {
    mockInput("token", token)
    mockInput("issue", issue)
    mockInput("body", body)
    mockInput("bot_body", botBody)
    mockInput("bot", bot)
  })

  it("posts a regular comment for non-bots", async () => {
    process.env.GITHUB_ACTOR = "NotABot"

    githubMockPool().intercept({
      method: "POST",
      path: `/repos/${GITHUB_REPOSITORY}/issues/${issue}/comments`,
      headers: {
        Authorization: `token ${token}`,
      },
      body: (requestBody) => JSON.parse(requestBody).body === body,
    }).defaultReplyHeaders({
      "Content-Type": "application/json",
    }).reply(200, {})

    await loadMain()
  })

  it("posts a bot comment for bots", async () => {
    process.env.GITHUB_ACTOR = bot

    githubMockPool().intercept({
      method: "POST",
      path: `/repos/${GITHUB_REPOSITORY}/issues/${issue}/comments`,
      headers: {
        Authorization: `token ${token}`,
      },
      body: (requestBody) => JSON.parse(requestBody).body === botBody,
    }).defaultReplyHeaders({
      "Content-Type": "application/json",
    }).reply(200, {})

    await loadMain()
  })
})
