import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byCode, cyclesOf, migrationOrder } from '../src/index.js';

// The module graph: cycles and the migration order, with ties, cycles and a long chain.

const nodes = (spec) => {
  const out = new Map(Object.entries(spec).map(([name, x]) => [name, { deps: x.deps, dependents: [], score: x.score ?? 0 }]));
  for (const [name, n] of out) for (const d of n.deps) out.get(d).dependents.push(name);
  return out;
};
const order = (spec) => migrationOrder(nodes(spec)).map((o) => `${o.name}${o.brokeCycle ? '*' : ''}`);

test('graph: a module comes after its dependencies, and leaves with fewer dependents go first', () => {
  assert.deepEqual(order({ app: { deps: ['a', 'b'] }, a: { deps: ['core'] }, b: { deps: [] }, core: { deps: [] } }), ['b', 'core', 'a', 'app']);
  assert.deepEqual(order({ x: { deps: [] }, y: { deps: [] }, top: { deps: ['x', 'y'] } }), ['x', 'y', 'top'], 'a tie is broken by the name');
  assert.deepEqual(order({ big: { deps: [], score: 50 }, small: { deps: [], score: 5 } }), ['small', 'big'], 'then by the smaller score');
  assert.deepEqual(order({}), []);
});

test('graph: a cycle is broken at the module with the fewest dependencies left, and marked', () => {
  assert.deepEqual(order({ a: { deps: ['b'] }, b: { deps: ['a'] }, c: { deps: ['a'] } }), ['b*', 'a', 'c'], 'b has fewer dependents than a, and c is in no cycle');
  assert.deepEqual(order({ s: { deps: ['s'] } }), ['s*']);
  assert.deepEqual(order({ a: { deps: ['b', 'c'] }, b: { deps: ['a'] }, c: { deps: [] } }), ['c', 'a*', 'b']);
});

test('graph: the cycles of a graph, sorted, with a module that depends on itself', () => {
  const deps = new Map([['a', ['b']], ['b', ['c']], ['c', ['a']], ['d', ['d']], ['e', ['a']], ['f', []]]);
  assert.deepEqual(cyclesOf(deps), [['a', 'b', 'c'], ['d']]);
  assert.deepEqual(cyclesOf(new Map([['x', ['y']], ['y', []]])), []);
});

test('graph: a chain of a hundred thousand modules is ordered without running out of stack', () => {
  const n = 100000;
  const deps = new Map(Array.from({ length: n }, (_, i) => [`m${i}`, i ? [`m${i - 1}`] : []]));
  assert.deepEqual(cyclesOf(deps), []);
  const graph = new Map([...deps].map(([name, d]) => [name, { deps: d, dependents: [], score: 0 }]));
  for (const [name, x] of graph) for (const d of x.deps) graph.get(d).dependents.push(name);
  const o = migrationOrder(graph);
  assert.equal(o.length, n);
  assert.equal(o[0].name, 'm0');
  assert.equal(o.at(-1).name, `m${n - 1}`);
  deps.set('m0', [`m${n - 1}`]);
  assert.equal(cyclesOf(deps)[0].length, n);
});

test('graph: names are compared by code unit', () => {
  assert.deepEqual(['b', 'B', 'a', 'A'].sort(byCode), ['A', 'B', 'a', 'b']);
});
