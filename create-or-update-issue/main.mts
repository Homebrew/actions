import { deprecateMaster } from "../deprecate-master.mts"
deprecateMaster("create-or-update-issue")
import * as core from "@actions/core";
import * as github from "@actions/github";

import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";

type Client = ReturnType<typeof github.getOctokit>;
type Issue = RestEndpointMethodTypes["issues"]["listForRepo"]["response"]["data"][number];

const normalize = (text: string) => text.replaceAll("\r\n", "\n").trim();

// The latest text posted by the issue's author: their last comment, or the issue body.
async function latestPost(client: Client, owner: string, repo: string, issue: Issue) {
  const author = issue.user?.login;
  const comments = await client.paginate(client.rest.issues.listComments, {
    owner,
    repo,
    issue_number: issue.number,
    per_page: 100,
  });
  const comment = author ? comments.findLast((comment) => comment.user?.login === author) : undefined;
  return (comment ? comment.body : issue.body) ?? "";
}

async function main() {
  try {
    const token = core.getInput("token", { required: true });
    const [owner, repo] =
      core.getInput("repository", { required: true }).split("/");

    const title = core.getInput("title", { required: true });
    const body = core.getInput("body", { required: true });

    const labelsInput = core.getInput("labels");
    const labels = labelsInput ? labelsInput.split(",") : [];
    const assigneesInput = core.getInput("assignees");
    const assignees = assigneesInput ? assigneesInput.split(",") : [];
    const type = core.getInput("type") || null;

    const updateExisting = core.getBooleanInput("update-existing");
    const skipIfUnchanged = core.getBooleanInput("skip-if-unchanged");
    const closeExisting = core.getBooleanInput("close-existing");
    const closeFromAuthor = core.getInput("close-from-author");
    const closeComment = core.getInput("close-comment");

    const client = github.getOctokit(token);

    let existingIssue = undefined;
    if (updateExisting || closeExisting) {
      const params: RestEndpointMethodTypes["issues"]["listForRepo"]["parameters"] = {
        owner,
        repo,
        state: "open",
        sort: "created",
        direction: "desc",
        per_page: 100,
      };
      if (closeFromAuthor) {
        params.creator = closeFromAuthor;
      }
      for await (const response of client.paginate.iterator(
        client.rest.issues.listForRepo,
        params
      )) {
        existingIssue = response.data.find((issue) => issue.title === title);
        if (existingIssue) {
          break;
        }
      }
    }
    if (existingIssue) {
      if (updateExisting) {
        if (skipIfUnchanged &&
            normalize(await latestPost(client, owner, repo, existingIssue)) === normalize(body)) {
          core.info(`Existing issue already matches body: ${existingIssue.html_url}`);

          core.setOutput("outcome", "unchanged");
          core.setOutput("number", existingIssue.number);
          core.setOutput("node_id", existingIssue.node_id);
          return;
        }

        const response = await client.rest.issues.createComment({
          owner,
          repo,
          issue_number: existingIssue.number,
          body,
        });
        const commentUrl = response.data.html_url;

        core.info(`Posted comment under existing issue: ${commentUrl}`);

        core.setOutput("outcome", "commented");
        core.setOutput("number", existingIssue.number);
        core.setOutput("node_id", existingIssue.node_id);
        return;
      }
      if (closeExisting) {
        if (closeComment) {
          const response = await client.rest.issues.createComment({
            owner,
            repo,
            issue_number: existingIssue.number,
            body: closeComment,
          });
          const commentUrl = response.data.html_url;
          core.info(`Posted comment under existing issue: ${commentUrl}`);
        }

        const response = await client.rest.issues.update({
          owner,
          repo,
          issue_number: existingIssue.number,
          state: "closed",
          state_reason: "completed",
        });
        const issueUrl = response.data.html_url;

        core.info(`Closed existing issue as completed: ${issueUrl}`);

        core.setOutput("outcome", "closed");
        core.setOutput("number", existingIssue.number);
        core.setOutput("node_id", existingIssue.node_id);
        return;
      }
    }

    if (closeExisting) {
      core.info("No existing issue found.");
      core.setOutput("outcome", "none");
      return;
    }

    const response = await client.rest.issues.create({
      owner,
      repo,
      title,
      body,
      labels,
      assignees,
      type,
    });
    const issueNumber = response.data.number;
    const issueNodeId = response.data.node_id;
    const issueUrl = response.data.html_url;

    core.info(`Issue created: ${issueUrl}`);

    core.setOutput("outcome", "created");
    core.setOutput("number", issueNumber);
    core.setOutput("node_id", issueNodeId);
  } catch (error) {
    if (!Error.isError(error)) throw error;

    core.setFailed(error);
  }
}

await main();
