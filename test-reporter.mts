/* node:coverage disable */
import { spec, type TestEvent } from "node:test/reporters"
import { Transform, type TransformCallback } from "node:stream"

class Reporter extends Transform {
  readonly specReporter: Transform

  constructor() {
    super({ __proto__: null, writableObjectMode: true } as any) // https://github.com/microsoft/TypeScript/issues/38385
    this.specReporter = new spec()
  }

  _transform(event: TestEvent, encoding: BufferEncoding, callback: TransformCallback) {
    switch (event.type) {
      case "test:stdout":
      case "test:stderr":
        callback(null)
        break
      default:
        this.specReporter._transform(event, encoding, callback)
        break
    }
  }

  _flush(callback: TransformCallback) {
    this.specReporter._flush(callback)
  }
}

export default new Reporter()
