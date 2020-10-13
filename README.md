# Homebrew's GitHub Actions

Navigate to subdirectories for more information about particular Actions.

Every directory (except `node_modules`) is a separate Action.

## Development

In Actions' subdirectories, there are no separate `node_modules` directories or `package-lock.json` files.
That's because we try to maintain one top-level dependency stack for all Actions together.
To add a new dependency (because some Action requires it), run `npm install` in root directory of this repository.
To update dependencies for all Actions at once, one needs to simply run `npm upgrade`, while being in root directory of this repository too.

Workflow names match Actions' directory names, for consistency.
Particular workflow to test an Action is run only when this Action's directory contents or workflow file are changed.
In addition to that, all test workflows will run if `package.json` or `package-lock.json` files or `node_modules` directory are changed.

> Please be careful not to start multiple workflow jobs testing the same Action at once, as it may cause a failure, because of the way some Actions are tested.

To test an action locally, first run `npm install` in the root of this repository, then in the directory of your action, run `node main.js`. Input variables are specified through the environment. For example, if an Action needed a `pull_request` input, running `export INPUT_PULL_REQUEST=1234` would pass that input to the Node.js script. For Actions that need variables from the [GitHub Events API](https://docs.github.com/en/free-pro-team@latest/developers/webhooks-and-events/github-event-types), you'll need to save (or construct) the appropriate JSON file, then set `GITHUB_EVENT_PATH` to the file's location.
