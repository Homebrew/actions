/* node:coverage disable */
import assert from "node:assert/strict"
import { registerHooks } from 'node:module';
import path from "node:path"
import { test, before, after, beforeEach, afterEach, describe, it, type TestContext } from "node:test"
import { MockAgent, setGlobalDispatcher, type Interceptable } from "undici"

// Hook imports to allow cache isolation
registerHooks({
  resolve(specifier, context, nextResolve) {
    const instanceMatch = specifier.match(/^instance(\d+):\/\//)
    const instanceID = instanceMatch ? instanceMatch[1] : null
    const strippedSpecifier = instanceMatch ? specifier.substring(instanceMatch[0].length) : specifier

    const resolved = nextResolve(strippedSpecifier, context)
    if (!resolved.url.startsWith("file://")) {
      return resolved
    }

    const parentKey = context.parentURL ? new URL(context.parentURL).searchParams.get("instance") : null;
    if (!instanceID && !parentKey) {
      return resolved
    }

    const resolvedURL = new URL(resolved.url)
    resolvedURL.searchParams.set("instance", instanceID || parentKey!)
    resolved.url = resolvedURL.toString()
    return resolved
  }
})

type Test = typeof test
type Before = typeof before
type After = typeof after
type BeforeEach = typeof beforeEach
type AfterEach = typeof afterEach
type Describe = typeof describe
type It = typeof it
type Assert = typeof assert
declare global {
  var test: Test
  var before: Before
  var after: After
  var beforeEach: BeforeEach
  var afterEach: AfterEach
  var describe: Describe
  var it: It
  var assert: Assert
  var mockAgent: MockAgent
  var testID: number

  function mockInput(input: string, value: string): void
  function githubMockPool<TInterceptable extends Interceptable>(): TInterceptable
  function loadMain(): Promise<void>

  var GITHUB_REPOSITORY: string
}

globalThis.test = test
globalThis.before = before
globalThis.after = after
globalThis.beforeEach = beforeEach
globalThis.afterEach = afterEach
globalThis.describe = describe
globalThis.it = it
globalThis.assert = assert
globalThis.mockInput = function(input, value) {
  process.env[`INPUT_${input.replaceAll(" ", "_").toUpperCase()}`] = value
}
globalThis.githubMockPool = function() {
  return mockAgent.get("https://api.github.com")
}
globalThis.loadMain = async function() {
  const testFile = process.argv[1]
  if (!/\.test\.m(?:t|j)s$/.test(testFile)) {
    throw new Error("Could not detect test file.")
  }
  const mainFile = testFile.substring(0, testFile.length - 9) + path.extname(testFile)
  await import(`instance${globalThis.testID}://${mainFile}`)
}

// Don't inherit CI environment variables
for (const key of Object.keys(process.env)) {
  if (key.startsWith("GITHUB_") || key.startsWith("INPUT_")) {
    delete process.env[key]
  }
}

// Consistent fake variables
process.env.GITHUB_ACTIONS = "true"
globalThis.GITHUB_REPOSITORY = "fake-owner/fake-repo"
process.env.GITHUB_REPOSITORY = GITHUB_REPOSITORY
process.env.GITHUB_REPOSITORY_OWNER = GITHUB_REPOSITORY.split("/", 1)[0]

const originalEnv = process.env
beforeEach(async (t) => {
  process.env = structuredClone(originalEnv)

  const agent = new MockAgent()
  agent.disableNetConnect()
  setGlobalDispatcher(agent)
  globalThis.mockAgent = agent
  globalThis.testID = (globalThis.testID || 0) + 1;

  // Make core.setFailed raise an error rather than print to stdout
  (t as TestContext).mock.module(`instance${globalThis.testID}://@actions/core`, {
    namedExports: {
      ...await import(`instance${globalThis.testID}://@actions/core`),
      setFailed(error: string | Error) {
        if (typeof error === "string") {
          throw new Error(error)
        } else {
          throw error
        }
      }
    }
  })
})

afterEach(() => {
  mockAgent.assertNoPendingInterceptors()
})
