'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.SetMap = void 0;

/**
 * Maps an order-independent set of member identities to a value.
 * Each member receives a map-local ID; sorted IDs form the exact key.
 * @internal
 */
class SetMap {
  constructor() {
    this._entries = new Map();
    this._memberIds = new Map();
    this._nextMemberId = 0;
  }

  get(members) {
    return this._entries.get(this._key(members));
  }

  set(members, value) {
    this._entries.set(this._key(members), value);
  }

  _key(members) {
    const ids = [];

    for (const member of members) {
      let id = this._memberIds.get(member);

      if (id === undefined) {
        id = this._nextMemberId++;

        this._memberIds.set(member, id);
      }

      ids.push(id);
    }

    ids.sort((id1, id2) => id1 - id2);
    return ids.join(',');
  }
}

exports.SetMap = SetMap;
