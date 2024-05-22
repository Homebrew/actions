# ES module reload

This module lets you reload an ES module and its dependencies in `Node.js`. It does so by adding a [module resolution hook](https://nodejs.org/api/module.html#resolvespecifier-context-nextresolve).

## Background

Per spec, ES modules are cached the first time they are imported, and subsequent import statements return the same object.

```JS
import {assert} from 'node:assert/strict'

const m1 = await import('./my-module.js')
const m2 = await import('./my-module.js')


assert.equal(m1, m2) // passes
```

This is desirable in most scenarios, but you can sometimes want to instantiate a module several times. For example, you may want to test a module that branches at load time depending on its environment. To some extent, that can be achieved by tacking a query string at the end of the `import` specifier:

```JS
import {assert} from 'node:assert/strict'

const m1 = await import('./my-module.js?dev')
process.env.NODE_ENV='production'
const m2 = await import('./my-module.js?prod')

assert.notEqual(mDev, mProd)  // passes
```

However, this doesn't work transitively. `./my-module.js?prod` will import the dependencies that were cached when `./my-module.js?dev` was loaded.

If you want to load a module multpile times from scratch with its dependencies you can use this module.

## Usage:

The resolver hook gives a special meaning to `?instance=...` and `?reload` query strings.

If you want to retrieve a specific instance, use the former with an identifier of your choice.

```JS
import "esm-reload" // this registers the hook

const mDev = await import("./myModule.js?instance=dev")
process.env.NODE_ENV='production'
const mProd = await import("./myModule.js?instance=prod")
const mDev2 = await import("./myModule.js?instance=dev")

assert.equal(mDev, mDev2)              // passes
assert.notEqual(mDev, mProd)           // passes
```

If you just want a fresh instance you can use `?reload`

```JS
const mReloaded = await import("./myModule.js?reload")
assert.notEqual(mDev, mReloaded)       // passes
assert.notEqual(mProd, mReloaded)      // passes

// ?reload is "magic"
const mReloaded2 = await import("./myModule.js?reload")
assert.notEqual(mReloaded, mReloaded2) // passes
```

In both cases, instances come with a fresh set of dependencies (except for the builtin `node:xxx` modules that don't support query strings at all).

### With dependencies

Suppose these files:

```JS
// foo.js
export {x} from "./bar.js"

// bar.js
export const x = {}
```

We can then do

```JS
import "esm-reload"

const foo1 = await import("./foo.js?instance=1")
const bar1 = await import("./bar.js?instance=1")

const foo2 = await import("./foo.js?instance=2")
const bar2 = await import("./bar.js?instance=2")

assert.equal(foo1.x, bar1.x)
assert.equal(foo2.x, bar1.x)

assert.notEqual(bar1.x, bar2.x)
```

## Credit:

The hook was originally written by Marcel Laverdet([@laverdet](https://github.com/laverdet)) then tweaked, tested and documented by yours truly.

## License

ISC
