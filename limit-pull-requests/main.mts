import * as core from "@actions/core";
import * as github from "@actions/github";

async function main() {
  try {
    const eventName = github.context.eventName;
    if (!["pull_request", "pull_request_target"].includes(eventName)) {
      core.setFailed(`${eventName} is not a supported event. Only pull_request `
        + `and pull_request_target are supported.`);
      return;
    }

    const token = core.getInput("token", { required: true });

    const exceptUsersInput = core.getInput("except-users");
    const exceptUsers = exceptUsersInput ? exceptUsersInput.split(",") : [];
    const exceptAuthorAssocsInput =
      core.getInput("except-author-associations");
    const exceptAuthorAssocs =
      exceptAuthorAssocsInput ? exceptAuthorAssocsInput.split(",") : [];

    const commentLimit = parseInt(core.getInput("comment-limit"), 10);
    const comment = core.getInput("comment");
    const closeLimit = parseInt(core.getInput("close-limit"), 10);
    const close = core.getBooleanInput("close");

    if (!comment && !close) {
      core.info("No action specified; exiting.");
      return;
    }
    if (exceptUsers.includes(github.context.actor)) {
      core.info(`@${github.context.actor} is exempted from the limit.`);
      return;
    }
    if (exceptAuthorAssocs.includes(
      github.context.payload.pull_request!.author_association)) {
      core.info(`@${github.context.actor} is exempted from the limit.`);
      return;
    }

    const client = github.getOctokit(token);
    const openPrs = await client.paginate(client.rest.pulls.list, {
      ...github.context.repo,
      state: "open",
      per_page: 100,
    });
    const prCount = openPrs
      .filter(pr => pr.user?.login === github.context.actor)
      .length;
    core.info(`@${github.context.actor} has ${prCount} open PR(s).`);

    if (comment && prCount >= commentLimit) {
      await client.rest.issues.createComment({
        ...github.context.repo,
        issue_number: github.context.payload.pull_request!.number,
        body: comment,
      });
      core.notice(`Soft limit reached; commented on PR.`);
    }

    if (close && prCount >= closeLimit) {
      await client.rest.pulls.update({
        ...github.context.repo,
        pull_number: github.context.payload.pull_request!.number,
        state: "closed",
      });
      core.notice(`Hard limit reached; closed PR.`);
    }
  } catch (error) {
    if (!Error.isError(error)) throw error;

    core.setFailed(error);
  }
}

await main();
