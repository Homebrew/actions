/* node:coverage disable */
import { spec } from "node:test/reporters"
import { Transform } from "node:stream"

class Reporter extends Transform {
  constructor() {
    super({ __proto__: null, writableObjectMode: true })
    this.specReporter = new spec()
  }

  _transform(event, encoding, callback) {
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

  _flush(callback) {
    this.specReporter._flush(callback)
  }
}

export default new Reporter()
