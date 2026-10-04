// What a script holds for the inventory, read from its tokens (src/lexer.js): the angular.module calls with their
// names and dependencies, the registrations made on a module (chained on the call, or through a variable that holds a
// module) with the way their dependencies are annotated, the two-way bindings of directive and component definitions,
// the templateUrl values, and the uses of the scope, watch, event, compile and timer services. A name that is not a
// string literal is kept as null, so the inventory can count what it cannot name. Nothing is guessed from the shape of
// a name; docs/method.md says exactly which forms are read.

// The methods of a module that register something, in the order the inventory counts them.
export const REGISTRATION_KINDS = ['controller', 'directive', 'component', 'service', 'factory', 'provider', 'filter', 'constant', 'value', 'config', 'run'];

// The kinds that take no name: their first argument is the function itself.
const UNNAMED = ['config', 'run'];

// The kinds whose value is not injected, so it has no annotation.
const NOT_INJECTED = ['constant', 'value'];

// The keys of a directive or component definition whose object holds bindings.
export const BINDING_KEYS = ['scope', 'bindToController', 'bindings'];

// A binding value that binds two ways: = with an optional * and ?, and an optional attribute name.
export const TWO_WAY = /^\s*=\*?\??\s*[A-Za-z_$][A-Za-z0-9_$-]*\s*$|^\s*=\*?\??\s*$/;

export const WATCH_METHODS = ['$watch', '$watchCollection', '$watchGroup'];
export const EVENT_METHODS = ['$broadcast', '$emit', '$on'];
export const TIMER_SERVICES = ['$timeout', '$interval'];

// Words before a parameter name in TypeScript that are not the name.
const MODIFIERS = ['private', 'public', 'protected', 'readonly', 'override'];

const isPunct = (t, v) => Boolean(t) && t.type === 'punct' && t.value === v;
const isName = (t, v) => Boolean(t) && t.type === 'name' && (v === undefined || t.value === v);
const isKey = (t, v) => Boolean(t) && (t.type === 'name' || t.type === 'string') && t.value === v;

// The index of the closing bracket of every opening one, or -1 when it is not closed.
function closings(tokens) {
  const close = new Array(tokens.length).fill(-1);
  const stack = [];
  const pairs = { ')': '(', ']': '[', '}': '{' };
  for (let k = 0; k < tokens.length; k += 1) {
    const t = tokens[k];
    if (t.type !== 'punct') continue;
    if (t.value === '(' || t.value === '[' || t.value === '{') stack.push(k);
    else if (Object.hasOwn(pairs, t.value) && stack.length && tokens[stack.at(-1)].value === pairs[t.value]) close[stack.pop()] = k;
  }
  return close;
}

// Reads the module calls, registrations, bindings, template addresses and risks of the tokens of one script.
export function readScript(tokens) {
  const close = closings(tokens);
  const modules = [];
  const registrations = [];
  const variables = [];
  const twoWay = [];
  const templateUrls = [];
  const risks = { scope: { count: 0, offset: -1 }, rootScope: { count: 0, offset: -1 }, watch: [], events: [], compile: [], timers: [] };

  // The parts of a list between brackets at k, split at the commas of its own level: [[start, end)].
  const partsOf = (k) => {
    const end = close[k];
    if (end < 0) return null;
    const parts = [];
    let from = k + 1;
    for (let j = k + 1; j < end; j += 1) {
      const t = tokens[j];
      if (t.type === 'punct' && (t.value === '(' || t.value === '[' || t.value === '{') && close[j] > 0) j = close[j];
      else if (isPunct(t, ',')) {
        parts.push([from, j]);
        from = j + 1;
      }
    }
    if (from < end) parts.push([from, end]);
    return parts;
  };
  const stringOf = (part) => (part && part[1] - part[0] === 1 && tokens[part[0]].type === 'string' ? tokens[part[0]].value : null);
  // The entries of an object literal at k: [{ key, keyIndex, value: [start, end) }] for the keys written as a name or
  // a string and followed by a colon.
  const entriesOf = (k) => {
    const out = [];
    for (const [s, e] of partsOf(k) ?? []) {
      const key = tokens[s];
      if ((key.type === 'name' || key.type === 'string') && isPunct(tokens[s + 1], ':')) out.push({ key: key.value, keyIndex: s, value: [s + 2, e] });
    }
    return out;
  };
  // The names of the parameters of a list at k, with TypeScript modifiers, rest dots and types left out.
  const paramsOf = (k) => {
    const out = [];
    for (const [s, e] of partsOf(k) ?? []) {
      for (let j = s; j < e; j += 1) {
        if (isPunct(tokens[j], '...') || (isName(tokens[j]) && MODIFIERS.includes(tokens[j].value) && isName(tokens[j + 1]))) continue;
        if (isName(tokens[j])) out.push(tokens[j].value);
        break;
      }
    }
    return out;
  };
  // The strings of an array literal at k.
  const stringsOf = (k) => (partsOf(k) ?? []).map(stringOf).filter((s) => s !== null);

  // The declarations a registration can name: functions, $inject arrays and classes, by name.
  const functions = new Map();
  const injects = new Map();
  const classes = new Map();
  for (let k = 0; k < tokens.length; k += 1) {
    const t = tokens[k];
    if (isName(t, 'function') && isName(tokens[k + 1]) && isPunct(tokens[k + 2], '(')) functions.set(tokens[k + 1].value, paramsOf(k + 2));
    else if (isName(t) && ['var', 'let', 'const'].includes(t.value) && isName(tokens[k + 1]) && isPunct(tokens[k + 2], '=') && isName(tokens[k + 3], 'function')) {
      const at = isPunct(tokens[k + 4], '(') ? k + 4 : isPunct(tokens[k + 5], '(') ? k + 5 : -1;
      if (at > 0) functions.set(tokens[k + 1].value, paramsOf(at));
    } else if (isName(t) && isPunct(tokens[k + 1], '.') && isName(tokens[k + 2], '$inject') && isPunct(tokens[k + 3], '=') && isPunct(tokens[k + 4], '[')) {
      injects.set(t.value, stringsOf(k + 4));
    } else if (isName(t, 'class') && isName(tokens[k + 1]) && !isPunct(tokens[k - 1], '.')) {
      let b = k + 2;
      while (b < tokens.length && !isPunct(tokens[b], '{')) b += 1;
      const end = close[b] ?? -1;
      if (end < 0) continue;
      const info = { inject: null, params: null };
      for (let j = b + 1; j < end; j += 1) {
        if (isName(tokens[j], '$inject') && !isPunct(tokens[j - 1], '.')) {
          let v = j + 1;
          while (v < end && v < j + 8 && !isPunct(tokens[v], '=')) v += 1;
          if (isPunct(tokens[v], '=') && isPunct(tokens[v + 1], '[')) info.inject = stringsOf(v + 1);
        } else if (isName(tokens[j], 'constructor') && isPunct(tokens[j + 1], '(') && info.params === null) info.params = paramsOf(j + 1);
      }
      classes.set(tokens[k + 1].value, info);
    }
  }

  const annotated = (annotation, deps = []) => ({ annotation, deps });
  // How the value of a registration names what it needs: array, $inject, implicit (parameter names only), none (no
  // parameter) or unknown (a value the tool cannot follow).
  const annotationOf = (part) => {
    if (!part || part[0] >= part[1]) return annotated('unknown');
    const [s, e] = part;
    let t = tokens[s];
    if (isPunct(t, '[') && close[s] === e - 1) return annotated('array', stringsOf(s));
    let k = s;
    if (isName(t, 'async')) t = tokens[(k += 1)];
    if (isName(t, 'function')) {
      const p = isPunct(tokens[k + 1], '(') ? k + 1 : isPunct(tokens[k + 2], '(') ? k + 2 : -1;
      if (p < 0) return annotated('unknown');
      const params = paramsOf(p);
      return params.length ? annotated('implicit', params) : annotated('none');
    }
    if (isPunct(t, '(') && close[k] > 0 && isPunct(tokens[close[k] + 1], '=>')) {
      const params = paramsOf(k);
      return params.length ? annotated('implicit', params) : annotated('none');
    }
    if (isName(t) && isPunct(tokens[k + 1], '=>')) return annotated('implicit', [t.value]);
    if (isName(t) && e - s === 1) {
      if (injects.has(t.value)) return annotated('$inject', injects.get(t.value));
      const c = classes.get(t.value);
      if (c && c.inject) return annotated('$inject', c.inject);
      if (c) return c.params && c.params.length ? annotated('implicit', c.params) : annotated('none');
      if (functions.has(t.value)) {
        const params = functions.get(t.value);
        return params.length ? annotated('implicit', params) : annotated('none');
      }
    }
    return annotated('unknown');
  };

  // One registration of a kind with the parts of its arguments, on the module ref.
  const register = (kind, nameToken, args, ref) => {
    const base = { kind, module: ref, offset: nameToken.offset };
    if (UNNAMED.includes(kind)) {
      registrations.push({ ...base, name: '', ...annotationOf(args[0]) });
      return;
    }
    const valueOf = (part) => {
      if (NOT_INJECTED.includes(kind)) return annotated(null);
      if (kind === 'component') {
        if (!part || !isPunct(tokens[part[0]], '{')) return annotated('unknown');
        const controller = entriesOf(part[0]).find((x) => x.key === 'controller');
        if (!controller) return annotated('none');
        const name = stringOf(controller.value);
        return name === null ? annotationOf(controller.value) : annotated(`controller ${name}`);
      }
      return annotationOf(part);
    };
    const first = args[0];
    if (first && isPunct(tokens[first[0]], '{') && close[first[0]] === first[1] - 1) {
      // The object form: every key of the object is a registration of its own.
      for (const entry of entriesOf(first[0])) registrations.push({ ...base, offset: tokens[entry.keyIndex].offset, name: entry.key, ...valueOf(entry.value) });
      return;
    }
    const name = stringOf(first);
    registrations.push({ ...base, name, ...valueOf(args[1]) });
  };

  // The registrations chained from j onwards, on the module ref.
  const chain = (ref, j) => {
    while ((isPunct(tokens[j], '.') || isPunct(tokens[j], '?.')) && isName(tokens[j + 1]) && REGISTRATION_KINDS.includes(tokens[j + 1].value) && isPunct(tokens[j + 2], '(')) {
      const args = partsOf(j + 2);
      if (args === null) return;
      register(tokens[j + 1].value, tokens[j + 1], args, ref);
      j = close[j + 2] + 1;
    }
  };

  // The variable a module call at k is assigned to: var app = angular.module(...), with a TypeScript type or not, or
  // window.app = angular.module(...).
  const variableBefore = (k) => {
    if (!isPunct(tokens[k - 1], '=')) return null;
    const b = k - 2;
    if (isName(tokens[b]) && !isPunct(tokens[b - 1], '.') && !isPunct(tokens[b - 1], ':')) return tokens[b].value;
    if (isName(tokens[b]) && isPunct(tokens[b - 1], '.') && isName(tokens[b - 2]) && ['window', 'globalThis', 'self'].includes(tokens[b - 2].value) && !isPunct(tokens[b - 3], '.')) return tokens[b].value;
    // A type annotation: walk back over it to the colon.
    for (let j = b; j >= Math.max(0, b - 12); j -= 1) {
      if (isPunct(tokens[j], ':')) return isName(tokens[j - 1]) && isName(tokens[j - 2]) && ['var', 'let', 'const'].includes(tokens[j - 2].value) ? tokens[j - 1].value : null;
      if (!(isName(tokens[j]) || ['.', '<', '>', '[', ']', ','].some((v) => isPunct(tokens[j], v)))) return null;
    }
    return null;
  };

  for (let k = 0; k < tokens.length; k += 1) {
    const t = tokens[k];
    if (t.type === 'string') {
      if (t.value === '$scope' || t.value === '$rootScope') {
        const r = t.value === '$scope' ? risks.scope : risks.rootScope;
        if (r.count === 0) r.offset = t.offset;
        r.count += 1;
      }
    }
    if (t.type !== 'name' && t.type !== 'string') continue;
    // Bindings and template addresses in a definition object or a class.
    if (BINDING_KEYS.includes(t.value) && (isPunct(tokens[k + 1], ':') || isPunct(tokens[k + 1], '=')) && isPunct(tokens[k + 2], '{') && !isPunct(tokens[k - 1], '.')) {
      for (const entry of entriesOf(k + 2)) {
        const value = stringOf(entry.value);
        if (value !== null && TWO_WAY.test(value)) twoWay.push({ key: entry.key, value, context: t.value, offset: tokens[entry.value[0]].offset });
      }
    }
    if (t.value === 'templateUrl' && (isPunct(tokens[k + 1], ':') || isPunct(tokens[k + 1], '=')) && tokens[k + 2] && tokens[k + 2].type === 'string') templateUrls.push({ value: tokens[k + 2].value, offset: tokens[k + 2].offset });
    if (t.type !== 'name') continue;

    if (t.value === '$scope' || t.value === '$rootScope') {
      const r = t.value === '$scope' ? risks.scope : risks.rootScope;
      if (r.count === 0) r.offset = t.offset;
      r.count += 1;
    }
    const called = isPunct(tokens[k + 1], '(');
    const member = isPunct(tokens[k - 1], '.') || isPunct(tokens[k - 1], '?.');
    const receiver = member && isName(tokens[k - 2]) ? tokens[k - 2].value : null;
    if (called && member && WATCH_METHODS.includes(t.value)) risks.watch.push({ method: t.value, receiver, offset: t.offset });
    if (called && member && EVENT_METHODS.includes(t.value)) {
      const args = partsOf(k + 1) ?? [];
      risks.events.push({ method: t.value, receiver, event: stringOf(args[0]), offset: t.offset });
    }
    if (called && t.value === '$compile' && !isName(tokens[k - 1], 'function')) risks.compile.push({ offset: t.offset });
    if (called && TIMER_SERVICES.includes(t.value) && !isName(tokens[k - 1], 'function')) risks.timers.push({ method: t.value, offset: t.offset });

    // angular.module(name, [dependencies]) and the registrations chained on it.
    if (t.value === 'angular' && isPunct(tokens[k + 1], '.') && isName(tokens[k + 2], 'module') && isPunct(tokens[k + 3], '(')) {
      const args = partsOf(k + 3);
      if (args === null || args.length === 0) continue;
      const name = stringOf(args[0]);
      const entry = { name, offset: tokens[k + 2].offset, declaration: args.length >= 2, deps: [], dynamicDeps: 0 };
      if (entry.declaration) {
        const list = args[1];
        if (isPunct(tokens[list[0]], '[') && close[list[0]] === list[1] - 1) {
          for (const part of partsOf(list[0])) {
            const dep = stringOf(part);
            if (dep === null) entry.dynamicDeps += 1;
            else entry.deps.push(dep);
          }
        } else entry.dynamicDeps = 1;
      }
      modules.push(entry);
      const ref = name === null ? { dynamic: true } : { name };
      const variable = variableBefore(k);
      if (variable !== null && name !== null) variables.push({ variable, module: name, offset: t.offset });
      chain(ref, close[k + 3] + 1);
      continue;
    }
    // A variable followed by a registration: app.controller(...), resolved to a module in src/analyse.js.
    if (!member && isPunct(tokens[k + 1], '.') && isName(tokens[k + 2]) && REGISTRATION_KINDS.includes(tokens[k + 2].value) && isPunct(tokens[k + 3], '(') && t.value !== 'angular') {
      chain({ variable: t.value }, k + 1);
    }
  }
  return { modules, registrations, variables, twoWay, templateUrls, risks };
}
