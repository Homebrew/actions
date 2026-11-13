'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.mapAsyncIterator = mapAsyncIterator;

/**
 * Given an AsyncIterable and a callback function, return an AsyncIterator
 * which produces values mapped via calling the callback function.
 *
 * @internal
 */
function mapAsyncIterator(iterable, callback) {
  const iterator = iterable[Symbol.asyncIterator]();

  async function mapResult(result) {
    if (result.done) {
      return result;
    }

    try {
      return {
        value: await callback(result.value),
        done: false,
      };
    } catch (error) {
      await returnIgnoringErrors();
      throw error;
    }
  }

  async function returnIgnoringErrors() {
    if (typeof iterator.return === 'function') {
      try {
        await iterator.return();
      } catch (_error) {
        // Keep the original error when closing the source also fails.
      }
    }
  }

  return {
    async next() {
      return mapResult(await iterator.next());
    },

    async return() {
      // If iterator.return() does not exist, then type R must be undefined.
      return typeof iterator.return === 'function'
        ? mapResult(await iterator.return())
        : {
            value: undefined,
            done: true,
          };
    },

    async throw(error) {
      if (typeof iterator.throw === 'function') {
        return mapResult(await iterator.throw(error));
      }

      await returnIgnoringErrors();
      throw error;
    },

    [Symbol.asyncIterator]() {
      return this;
    },
  };
}
