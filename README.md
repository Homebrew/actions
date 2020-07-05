# Homebrew's GitHub Actions

Navigate to subdirectories for more information about particular Actions.

Every directory (except `node_modules`) is a separate Action.

## Development

In Actions' subdirectories, there are no separate `node_modules` directories or `package-lock.json` files.
That's because we try to maintain one top-level dependency stack for all Actions together.
If one wants to add a new dependency (because some Action requires it), please do so by running `npm install` in root directory of this repository.
To update dependencies for all Actions at once, one needs to simply run `npm upgrade`, while being in root directory of this repository too.

Workflow names match Actions' directory names, for consistency.
Particular workflow to test an Action is run only when this Action's directory contents or workflow file are changed.
In addition to that, all test workflows will run if `package.json` or `package-lock.json` files or `node_modules` directory are changed.

> Please be careful not to run same multiple workflow jobs at once, as it may cause a failure, because of the way some Actions are tested.