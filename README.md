# Homebrew's GitHub Actions

Navigate to subdirectories for more information about particular Actions.

Every directory (except `node_modules`) is a separate Action.

## Releases

All Actions in this repository are released together using bare CalVer tags in
the form `YYYY.MM.DD.N`, where `N` starts at 1 each UTC day. Release tags point
directly to commits on `main` and are never moved. Each tag has a published
GitHub Release with generated release notes. CalVer identifies when a snapshot
was cut; it does not imply semantic compatibility, a support window, or
multiple maintained release tracks.

Consumers can use an exact CalVer tag for readability. Environments that
require immutable third-party action pins should use the tag's full commit SHA
and retain the CalVer tag in a comment.

A scheduled workflow runs every Monday at 12:00 UTC. It skips the release when
there are no commits since the latest CalVer tag or when the latest commit has
had less than 24 hours to bake. Maintainers can dispatch the workflow manually
to release an urgent fix without waiting for the bake period. A recent commit
defers the entire scheduled release, including older changes that have already
had time to bake.

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
