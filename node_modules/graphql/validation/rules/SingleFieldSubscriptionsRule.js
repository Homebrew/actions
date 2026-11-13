'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.SingleFieldSubscriptionsRule = SingleFieldSubscriptionsRule;

var _GraphQLError = require('../../error/GraphQLError.js');

var _kinds = require('../../language/kinds.js');

var _collectFields = require('../../execution/collectFields.js');

/** @category Validation Rules */

/**
 * Subscriptions must only include a non-introspection field.
 *
 * A GraphQL subscription is valid only if it contains a single root field and
 * that root field is not an introspection field.
 *
 * See https://spec.graphql.org/draft/#sec-Single-root-field
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { SingleFieldSubscriptionsRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     name: String
 *   }
 *
 *   type Subscription {
 *     a: String
 *     b: String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   subscription { a b }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [
 *   SingleFieldSubscriptionsRule,
 * ]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   subscription { a }
 * `);
 * const validErrors = validate(schema, validDocument, [
 *   SingleFieldSubscriptionsRule,
 * ]); // => []
 * ```
 */
function SingleFieldSubscriptionsRule(context) {
  let fragments;

  function reserveSelectionSetWork(selectionSet) {
    context.spendFragmentWork(selectionSet.selections.length);

    for (const selection of selectionSet.selections) {
      const directives = selection.directives;

      if (directives !== undefined) {
        context.spendFragmentWork(directives.length);

        for (const directive of directives) {
          if (
            directive.name.value === 'skip' ||
            directive.name.value === 'include'
          ) {
            var _directive$arguments$, _directive$arguments;

            context.spendFragmentWork(
              (_directive$arguments$ =
                (_directive$arguments = directive.arguments) === null ||
                _directive$arguments === void 0
                  ? void 0
                  : _directive$arguments.length) !== null &&
                _directive$arguments$ !== void 0
                ? _directive$arguments$
                : 0,
            );
          }
        }
      }
    }
  }

  return {
    OperationDefinition(node) {
      if (node.operation === 'subscription') {
        const schema = context.getSchema();
        const subscriptionType = schema.getSubscriptionType();

        if (subscriptionType) {
          const operationName = node.name ? node.name.value : null;
          const variableValues = Object.create(null);

          if (fragments === undefined) {
            fragments = Object.create(null);
            const definitions = context.getDocument().definitions;
            context.spendFragmentWork(definitions.length);

            for (const definition of definitions) {
              if (definition.kind === _kinds.Kind.FRAGMENT_DEFINITION) {
                fragments[definition.name.value] = definition;
              }
            }
          }

          const fields = (0, _collectFields.collectFields)(
            schema,
            fragments,
            variableValues,
            subscriptionType,
            node.selectionSet,
            reserveSelectionSetWork,
          );

          if (fields.size > 1) {
            const fieldSelectionLists = [...fields.values()];
            const extraFieldSelectionLists = fieldSelectionLists.slice(1);
            const extraFieldSelections = extraFieldSelectionLists.flat();
            context.reportError(
              new _GraphQLError.GraphQLError(
                operationName != null
                  ? `Subscription "${operationName}" must select only one top level field.`
                  : 'Anonymous Subscription must select only one top level field.',
                {
                  nodes: extraFieldSelections,
                },
              ),
            );
          }

          for (const fieldNodes of fields.values()) {
            const field = fieldNodes[0];
            const fieldName = field.name.value;

            if (fieldName.startsWith('__')) {
              context.reportError(
                new _GraphQLError.GraphQLError(
                  operationName != null
                    ? `Subscription "${operationName}" must not select an introspection top level field.`
                    : 'Anonymous Subscription must not select an introspection top level field.',
                  {
                    nodes: fieldNodes,
                  },
                ),
              );
            }
          }
        }
      }
    },
  };
}
