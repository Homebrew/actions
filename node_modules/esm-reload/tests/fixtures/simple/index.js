import '../../../loader.js'

await import("./dep.js")
await import("./dep.js?reload")
await import("./dep.js?instance=1")
await import("./dep.js?reload")
await import("./dep.js?instance=2")
await import("./dep.js?instance=1")
