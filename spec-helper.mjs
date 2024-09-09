/* node:coverage disable */
import assert from "node:assert/strict"
import { executionAsyncId } from "node:async_hooks"
import { createRequire } from "node:module"
import { test, before, after, beforeEach, afterEach, describe, it } from "node:test"
import { MockAgent, setGlobalDispatcher } from "undici"
import core from "@actions/core"
import "esm-reload"

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
  if (!testFile.endsWith(".test.mjs")) {
    throw new Error("Could not detect test file.")
  }
  const mainFile = testFile.substring(0, testFile.length - 8) + "mjs"
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
  globalThis.mockAgent = agent

  // Make core.setFailed raise an error rather than print to stdout
  t.mock.method(core, "setFailed", (error) => {
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
