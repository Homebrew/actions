const { Octokit } = require("@octokit/action");

const octokit = new Octokit();

const NUMBER_OF_ATTEMPTS = 3000;
const TIME_BETWEEN_ATTEMPTS_SECONDS = 5000;

async function main() {
  for (var i=0; i < NUMBER_OF_ATTEMPTS; i++) {
    const result = await octokit.request(`GET /repos/${process.env.REPOSITORY_NAME}/actions/runners`)

    // Select the runner based on its name
    runner = result.data["runners"].filter(function(runner) {
      return runner.name == process.env.RUNNER_NAME;
    })[0]

    if (typeof runner == "undefined") {
      console.log("::set-output name=runner-found::false");
      return;
    }

    if (runner.busy == false) {
      console.log("::set-output name=runner-found::true");
      console.log("::set-output name=runner-idle::true");
      return;
    }

    await new Promise(resolve => setTimeout(resolve, TIME_BETWEEN_ATTEMPTS_SECONDS));
  }

  console.log("::set-output name=runner-found::true");
  console.log("::set-output name=runner-idle::false");
}

main()
