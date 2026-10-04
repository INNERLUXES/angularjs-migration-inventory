// The module graph: the cycles between modules and the suggested migration order. Both work on the modules declared in
// the files read; a dependency on a module that is not declared there (a library such as ngRoute) is outside the graph.

// Compares two strings by their UTF-16 code units, so the order does not depend on the locale.
export const byCode = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// The strongly connected components of a graph with more than one node, or with a node that depends on itself:
// [[name, ...]], each sorted, in the order of their first name. deps maps a name to the names it depends on, all of
// which are nodes. Iterative, so a long chain cannot overflow the stack.
export function cyclesOf(deps) {
  const index = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  const out = [];
  let next = 0;
  for (const root of [...deps.keys()].sort(byCode)) {
    if (index.has(root)) continue;
    const work = [{ node: root, i: 0 }];
    index.set(root, next);
    low.set(root, next);
    next += 1;
    stack.push(root);
    onStack.add(root);
    while (work.length) {
      const top = work.at(-1);
      const edges = deps.get(top.node);
      if (top.i < edges.length) {
        const to = edges[top.i];
        top.i += 1;
        if (!index.has(to)) {
          index.set(to, next);
          low.set(to, next);
          next += 1;
          stack.push(to);
          onStack.add(to);
          work.push({ node: to, i: 0 });
        } else if (onStack.has(to)) low.set(top.node, Math.min(low.get(top.node), index.get(to)));
        continue;
      }
      work.pop();
      if (work.length) {
        const parent = work.at(-1).node;
        low.set(parent, Math.min(low.get(parent), low.get(top.node)));
      }
      if (low.get(top.node) === index.get(top.node)) {
        const component = [];
        for (;;) {
          const n = stack.pop();
          onStack.delete(n);
          component.push(n);
          if (n === top.node) break;
        }
        if (component.length > 1 || edges.includes(top.node)) out.push(component.sort(byCode));
      }
    }
  }
  return out.sort((a, b) => byCode(a[0], b[0]));
}

// A small binary heap of names, ordered by a compare function.
class Heap {
  constructor(compare) {
    this.items = [];
    this.compare = compare;
  }

  get size() {
    return this.items.length;
  }

  push(item) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.compare(a[i], a[p]) >= 0) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }

  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.compare(a[l], a[m]) < 0) m = l;
        if (r < a.length && this.compare(a[r], a[m]) < 0) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

// The suggested migration order: a module comes after every module it depends on, and of the modules that are ready,
// the one with the fewest dependents goes first, then the smaller size score, then the name. When every module left
// waits on another, a cycle is broken at the module of a cycle with the fewest dependencies not yet placed, then by the
// same order. nodes is a Map of name to { deps, dependents, score }, where deps and dependents hold names of nodes.
// Returns [{ name, position, brokeCycle }].
export function migrationOrder(nodes) {
  const rank = (a, b) => nodes.get(a).dependents.length - nodes.get(b).dependents.length || nodes.get(a).score - nodes.get(b).score || byCode(a, b);
  const unmet = new Map();
  const heap = new Heap(rank);
  for (const [name, n] of nodes) {
    unmet.set(name, new Set(n.deps).size);
    if (unmet.get(name) === 0) heap.push(name);
  }
  const cyclic = new Set(cyclesOf(new Map([...nodes].map(([name, n]) => [name, [...new Set(n.deps)]]))).flat());
  const placed = new Set();
  const out = [];
  const place = (name, brokeCycle) => {
    placed.add(name);
    out.push({ name, position: out.length + 1, brokeCycle });
    for (const d of new Set(nodes.get(name).dependents)) {
      if (placed.has(d)) continue;
      unmet.set(d, unmet.get(d) - 1);
      if (unmet.get(d) === 0) heap.push(d);
    }
  };
  while (out.length < nodes.size) {
    if (heap.size) {
      const name = heap.pop();
      if (!placed.has(name)) place(name, false);
      continue;
    }
    let best = null;
    for (const name of nodes.keys()) {
      if (placed.has(name) || !cyclic.has(name)) continue;
      if (best === null || unmet.get(name) < unmet.get(best) || (unmet.get(name) === unmet.get(best) && rank(name, best) < 0)) best = name;
    }
    place(best, true);
  }
  return out;
}
