/* node:coverage disable */
import assert from "node:assert/strict"
import { executionAsyncId } from "node:async_hooks"
import { createRequire } from "node:module"
import path from "node:path"
import { test, before, after, beforeEach, afterEach, describe, it, type TestContext } from "node:test"
import { MockAgent, setGlobalDispatcher, type Interceptable } from "undici"
import * as core from "@actions/core"
import "esm-reload"

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
  await import(`${mainFile}?instance=${executionAsyncId()}`)
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
const require = createRequire(import.meta.url)
beforeEach((t) => {
  process.env = structuredClone(originalEnv)

  delete require.cache[require.resolve("@actions/github")]

  const agent = new MockAgent()
  agent.disableNetConnect()
  setGlobalDispatcher(agent)
  globalThis.mockAgent = agent;

  // Make core.setFailed raise an error rather than print to stdout
  (t as TestContext).mock.method(core, "setFailed", (error: string | Error) => {
    if (typeof error === "string") {
      throw new Error(error)
    } else {
      throw error
    }
  })
})

afterEach(() => {
  mockAgent.assertNoPendingInterceptors()
})
