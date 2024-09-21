import util from "node:util";

test("find-related-workflow-run-id", async () => {
  const GITHUB_SERVER_URL = "https://github.com";
  process.env.GITHUB_SERVER_URL = GITHUB_SERVER_URL;
  process.env.GITHUB_ENV = "/dev/null";

  const mockPool = githubMockPool();

  const runId = 12345;
  const workflowName = "Some workflow";
  const repository = "fake-owner/fake-repo";
  const token = "fake-token";

  const runUrl = `${GITHUB_SERVER_URL}/${repository}/actions/runs/${runId}`;

  mockInput("run-id", runId.toString());
  mockInput("workflow-name", workflowName);
  mockInput("repository", repository);
  mockInput("token", token);

  mockPool.intercept({
    method: "POST",
    path: "/graphql",
    headers: {
      Authorization: `token ${token}`,
    },
    body: (body) => util.isDeepStrictEqual(JSON.parse(body), {
      query: `
        query($runUrl: URI!) {
          resource(url: $runUrl) {
            ... on WorkflowRun {
              checkSuite {
                commit {
                  checkSuites(last: 100) {
                    nodes {
                      workflowRun {
                        databaseId
                        workflow {
                          name
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `,
      variables: { runUrl },
    }),
  }).defaultReplyHeaders({
    "Content-Type": "application/json",
  }).reply(200, {
    data: {
      resource: {
        checkSuite: {
          commit: {
            checkSuites: {
              nodes: [
                {
                  workflowRun: {
                    databaseId: 123,
                    workflow: {
                      name: "Some workflow"
                    }
                  }
                }
              ]
            }
          }
        }
      }
    }
  });

  await loadMain();
});
