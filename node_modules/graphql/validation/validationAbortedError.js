'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.validationAbortedError = void 0;

var _GraphQLError = require('../error/GraphQLError.js');

/** @internal */
const validationAbortedError = new _GraphQLError.GraphQLError(
  'Validation aborted.',
);
exports.validationAbortedError = validationAbortedError;
