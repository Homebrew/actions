'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.reduce = reduce;

var _inspect = require('../jsutils/inspect.js');

var _ast = require('./ast.js');

/** @category Visiting */

/** @internal */
function reduce(root, reducer) {
  const stack = [];
  let frame = {
    parent: [root],
    keys: undefined,
    results: [],
    index: -1,
  };
  let node;

  do {
    let kind;
    frame.index++;
    const length =
      frame.keys === undefined ? frame.parent.length : frame.keys.length;

    if (frame.index === length) {
      node = frame.results;
      kind = frame.keys === undefined ? undefined : frame.results.kind;
      frame = stack.pop();
    } else {
      node =
        frame.keys === undefined
          ? frame.parent[frame.index]
          : frame.parent[frame.keys[frame.index]];

      if (node == null && stack.length !== 0) {
        continue;
      }

      if (Array.isArray(node)) {
        if (node.length !== 0) {
          stack.push(frame);
          frame = {
            parent: node,
            keys: undefined,
            results: [],
            index: -1,
          };
          continue;
        }
      } else {
        const parent = node;
        kind = parent === null || parent === void 0 ? void 0 : parent.kind;
        const keys =
          typeof kind === 'string' ? _ast.QueryDocumentKeys[kind] : undefined;

        if (!Array.isArray(keys)) {
          throw new Error(`Invalid AST Node: ${(0, _inspect.inspect)(node)}.`);
        }

        if (keys.length !== 0) {
          stack.push(frame);
          frame = {
            parent,
            keys,
            results: { ...parent },
            index: -1,
          };
          continue;
        }
      }
    }

    if (kind !== undefined) {
      const reduceNode = reducer[kind];
      node =
        reduceNode === null || reduceNode === void 0
          ? void 0
          : reduceNode(node);
    }

    if (frame.keys === undefined) {
      frame.results.push(node);
    } else {
      frame.results[frame.keys[frame.index]] = node;
    }
  } while (stack.length !== 0);

  return node;
}
