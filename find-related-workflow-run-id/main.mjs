import core from "@actions/core";
import github from "@actions/github";

async function main() {
  try {
    const runId = core.getInput("run-id", { required: true });
    const workflowName = core.getInput("workflow-name", { required: true });
    const repository = core.getInput("repository", { required: true });
    const token = core.getInput("token", { required: true });

    const client = github.getOctokit(token);

    const serverUrl = github.context.serverUrl;
    const runUrl = `${serverUrl}/${repository}/actions/runs/${runId}`;
    const response = await client.graphql(
      `
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
      { runUrl }
    );

    const relatedRunId =
      response.resource.checkSuite.commit.checkSuites.nodes
        .reverse()
        .find(node => node.workflowRun?.workflow.name === workflowName)
        ?.workflowRun.databaseId;

    if (relatedRunId === undefined) {
      core.setFailed(`No related run found for workflow ${workflowName}`);
      return;
    }

    core.setOutput("workflow-run-id", relatedRunId);
    core.exportVariable("workflow_run_id", relatedRunId);
  } catch (error) {
    core.setFailed(error.message);
  }
}

await main();
