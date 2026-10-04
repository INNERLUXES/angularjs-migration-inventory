// Reading each file as its kind, and the analysis: the findings of every rule and the inventory of the run, with the
// modules, their dependencies and dependents, the registrations by kind, the templates and the directives they use,
// the size score of every file and module, and the suggested migration order. docs/method.md describes every step.

import { byCode, cyclesOf, migrationOrder } from './graph.js';
import { HTML_LIMITS, HtmlError, htmlProblem, readHtml } from './html.js';
import { lineStarts, positionOf } from './json.js';
import { KINDS } from './kinds.js';
import { LEX_LIMITS, LexError, lexProblem, tokenize } from './lexer.js';
import { RULES } from './rules.js';
import { REGISTRATION_KINDS, readScript } from './scripts.js';
import { plural } from './size.js';
import { isNgName, normalizeName, readTemplate } from './templates.js';

export const READ_LIMITS = { ...LEX_LIMITS, ...HTML_LIMITS };

// The filters AngularJS itself registers.
export const BUILT_IN_FILTERS = ['currency', 'date', 'filter', 'json', 'limitTo', 'lowercase', 'number', 'orderBy', 'uppercase'];

// The number of lines of a text that hold more than white space.
export function countLines(text) {
  let n = 0;
  for (const line of text.split(/\r\n|\r|\n/)) if (line.trim() !== '') n += 1;
  return n;
}

// Reads the text of a file as its kind: { file, kind, lines, at, script | template | problem }. A file the tokenizer
// or the template reader cannot place gets a problem with its reason and offset, and nothing else is read from it.
export function readInput(text, file, kind, limits = READ_LIMITS) {
  const starts = lineStarts(text);
  const at = (offset) => positionOf(starts, offset);
  const base = { file, kind, lines: countLines(text), at };
  try {
    if (kind === 'javascript' || kind === 'typescript') return { ...base, script: readScript(tokenize(text, limits)) };
    if (kind === 'template') return { ...base, template: readTemplate(readHtml(text, limits)) };
  } catch (error) {
    if (error instanceof LexError) return { ...base, problem: { reason: lexProblem(error, text), offset: error.offset } };
    if (error instanceof HtmlError) return { ...base, problem: { reason: htmlProblem(error, text), offset: error.offset } };
    throw error;
  }
  throw new Error(`${file}: not a kind of file the tool reads`);
}

// A file that could not be read at all: { file, kind, lines: 0, unreadable }.
export const unreadableInput = (file, kind, reason) => ({ file, kind, lines: 0, at: () => ({ line: 1, column: 1 }), unreadable: reason });

const quoted = (list) => list.join(', ');

// How a registration names its dependencies, for a message.
function annotationText(r) {
  if (r.annotation === null) return '';
  if (r.annotation === 'array') return r.deps.length ? `; dependencies in an array: ${quoted(r.deps)}` : '; an array with no dependency';
  if (r.annotation === '$inject') return r.deps.length ? `; dependencies in $inject: ${quoted(r.deps)}` : '; an empty $inject';
  if (r.annotation === 'implicit') return `; dependencies only as parameter names, which a minifier breaks: ${quoted(r.deps)}`;
  if (r.annotation === 'none') return '; no dependency';
  if (r.annotation.startsWith('controller ')) return `; its controller is registered as ${r.annotation.slice(11)}`;
  return '; its dependencies are not visible in this file';
}

const CONTEXTS = { scope: 'the isolate scope of a directive', bindToController: 'bindToController', bindings: 'the bindings of a component' };

// The checks and the inventory of every file read: { findings, inventory }. Each finding is { rule, file, line, column,
// found, module } before the report gives it a level.
export function analyse(files, config) {
  const findings = [];
  const levelOf = (rule) => {
    const r = RULES.find((x) => x.id === rule);
    return r.key === null ? 'error' : config.rules[r.key];
  };
  const add = (f, rule, offset, found, module = null) => {
    const pos = f.at(Math.max(0, offset));
    findings.push({ rule, file: f.file, line: pos.line, column: pos.column, found, module });
  };

  // The variables that hold a module: in each file, and across all files when a name always holds the same module.
  const across = new Map();
  for (const f of files) {
    for (const v of f.script?.variables ?? []) {
      if (!across.has(v.variable)) across.set(v.variable, new Set());
      across.get(v.variable).add(v.module);
    }
  }
  const resolve = (f, ref, offset) => {
    if (ref.name) return { module: ref.name, placed: true };
    if (ref.dynamic) return { module: null, placed: true };
    const own = (f.script.variables ?? []).filter((v) => v.variable === ref.variable);
    if (own.length) {
      const before = own.filter((v) => v.offset <= offset);
      return { module: (before.at(-1) ?? own[0]).module, placed: true };
    }
    const all = across.get(ref.variable);
    if (all && all.size === 1) return { module: [...all][0], placed: true };
    return { module: null, placed: false };
  };

  // Modules: the first declaration of each name, with the files that declare it again.
  const declared = new Map();
  const registrations = [];
  let unplaced = 0;
  let dynamicModules = 0;
  for (const f of files) {
    if (!f.script) continue;
    for (const m of f.script.modules) {
      if (m.name === null) {
        dynamicModules += 1;
        add(f, 'dynamic-name', m.offset, `angular.module is called with a name that is not a string literal${m.declaration ? ', so the module it declares cannot be named' : ''}; registrations chained on it are counted on no module`);
        continue;
      }
      if (!m.declaration) continue;
      const deps = m.deps;
      const depsText = deps.length || m.dynamicDeps ? `${plural(deps.length + m.dynamicDeps, 'dependency', 'dependencies')}${deps.length ? `: ${quoted(deps)}` : ''}${m.dynamicDeps ? `${deps.length ? ', and' : ','} ${plural(m.dynamicDeps, 'that is', 'that are')} not a string literal` : ''}` : 'no dependency';
      if (declared.has(m.name)) {
        const first = declared.get(m.name);
        add(f, 'duplicate-module', m.offset, `module ${m.name} is declared again; it was declared first at ${first.file}:${first.line}, and a second declaration replaces the module with everything registered on it before`, m.name);
        continue;
      }
      const pos = f.at(m.offset);
      declared.set(m.name, { name: m.name, file: f.file, line: pos.line, deps: [...new Set(deps)], dynamicDeps: m.dynamicDeps });
      add(f, 'module-declaration', m.offset, `module ${m.name} is declared with ${depsText}`, m.name);
    }
    for (const r of f.script.registrations) {
      const where = resolve(f, r.module, r.offset);
      if (!where.placed) {
        unplaced += 1;
        continue;
      }
      const reg = { ...r, file: f.file, module: where.module, line: f.at(r.offset).line };
      registrations.push(reg);
      const what = r.kind === 'config' || r.kind === 'run' ? `${r.kind} block` : r.name === null ? `${r.kind}` : `${r.kind} ${r.name}`;
      if (r.name === null) {
        add(f, 'dynamic-name', r.offset, `a ${r.kind} is registered${where.module ? ` on ${where.module}` : ''} with a name that is not a string literal, so the inventory cannot name it`, where.module);
      } else if (where.module === null) {
        add(f, 'dynamic-name', r.offset, `the ${what} is registered on a module whose name is not a string literal, so it is placed on no module`);
      } else add(f, 'module-registration', r.offset, `${what} on ${where.module}${annotationText(r)}`, where.module);
    }
  }

  const regsOfFile = new Map();
  for (const r of registrations) {
    if (!regsOfFile.has(r.file)) regsOfFile.set(r.file, []);
    regsOfFile.get(r.file).push(r);
  }

  // The registered directives and components by the name templates use, and the filters by name.
  const directiveNames = new Map();
  const filterNames = new Map();
  const controllerNames = new Map();
  for (const r of registrations) {
    if (!r.name || !r.module) continue;
    if (r.kind === 'directive' || r.kind === 'component') if (!directiveNames.has(r.name)) directiveNames.set(r.name, { kind: r.kind, module: r.module });
    if (r.kind === 'filter' && !filterNames.has(r.name)) filterNames.set(r.name, r.module);
    if (r.kind === 'controller' && !controllerNames.has(r.name)) controllerNames.set(r.name, r.module);
  }

  // The risks of the scripts, the template findings and the input problems.
  const templateUses = new Map();
  for (const f of files) {
    if (f.unreadable) {
      add(f, 'unreadable-file', 0, `the file cannot be read: ${f.unreadable}; nothing in it is counted`);
      continue;
    }
    if (f.problem) {
      add(f, 'untokenizable-file', f.problem.offset, `${f.problem.reason}; the file was not read past this point, and nothing in it is counted but its lines`);
      continue;
    }
    if (f.script) {
      const s = f.script;
      if (s.risks.scope.count) add(f, 'scope-use', s.risks.scope.offset, `$scope ${s.risks.scope.count === 1 ? 'appears once in this file' : `appears ${plural(s.risks.scope.count, 'time')} in this file, first here`}`);
      if (s.risks.rootScope.count) add(f, 'root-scope-use', s.risks.rootScope.offset, `$rootScope ${s.risks.rootScope.count === 1 ? 'appears once in this file' : `appears ${plural(s.risks.rootScope.count, 'time')} in this file, first here`}`);
      for (const w of s.risks.watch) add(f, 'scope-watch', w.offset, `${w.method} is called${w.receiver ? ` on ${w.receiver}` : ''}`);
      for (const e of s.risks.events) add(f, 'scope-event', e.offset, `${e.method}${e.event !== null ? ` of "${e.event}"` : ''} is called${e.receiver ? ` on ${e.receiver}` : ''}`);
      for (const c of s.risks.compile) add(f, 'compile-use', c.offset, '$compile is called to compile markup while the app runs');
      for (const t of s.risks.timers) add(f, 'timer-use', t.offset, `${t.method} is called`);
      for (const b of s.twoWay) add(f, 'two-way-binding', b.offset, `${b.key}: '${b.value.trim()}' in ${CONTEXTS[b.context]} binds two ways`);
    }
    if (f.template) {
      const t = f.template;
      for (const c of t.controllers) {
        const module = controllerNames.get(c.controller) ?? null;
        add(f, 'template-controller', c.offset, `ng-controller="${c.value}" attaches the controller ${c.controller || '(none)'} to this markup${module ? ` (registered on ${module})` : ''}`, module);
      }
      for (const i of t.includes) add(f, 'template-include', i.offset, `${i.element ? `<ng-include src="${i.value}">` : `ng-include="${i.value}"`} fetches and compiles a template while the app runs`);
      const byFilter = new Map();
      for (const x of t.filters) {
        if (!byFilter.has(x.name)) byFilter.set(x.name, { first: x.offset, uses: 0 });
        byFilter.get(x.name).uses += 1;
      }
      for (const [name, x] of byFilter) {
        const module = filterNames.get(name) ?? null;
        const origin = module ? `registered on ${module}` : BUILT_IN_FILTERS.includes(name) ? 'built in' : 'not registered in the files read';
        add(f, 'template-filter', x.first, `filter ${name} (${origin}) is used ${x.uses === 1 ? 'once' : plural(x.uses, 'time')} in this template${x.uses > 1 ? ', first here' : ''}`, module);
      }
      for (const u of t.names) {
        const known = directiveNames.get(u.name);
        const counted = isNgName(u.name) || (known && (known.kind === 'directive' || u.element));
        if (!counted) continue;
        if (!templateUses.has(u.name)) templateUses.set(u.name, { name: u.name, kind: known ? known.kind : 'built in', module: known ? known.module : null, uses: 0, templates: new Set() });
        const x = templateUses.get(u.name);
        x.uses += 1;
        x.templates.add(f.file);
      }
    }
  }

  // The module graph: dependencies inside the files read, dependents, cycles.
  const localDeps = new Map([...declared.values()].map((m) => [m.name, m.deps.filter((d) => declared.has(d))]));
  const dependents = new Map([...declared.keys()].map((n) => [n, []]));
  const external = new Map();
  for (const m of declared.values()) {
    for (const d of m.deps) {
      if (declared.has(d)) dependents.get(d).push(m.name);
      else {
        if (!external.has(d)) external.set(d, []);
        external.get(d).push(m.name);
      }
    }
  }
  const cycles = cyclesOf(localDeps);
  for (const c of cycles) {
    const first = declared.get(c[0]);
    const f = files.find((x) => x.file === first.file);
    const path = c.length === 1 ? `${c[0]} depends on itself` : `${c.join(' -> ')} -> ${c[0]} depend on each other`;
    const at = f.script.modules.find((m) => m.name === c[0] && m.declaration).offset;
    add(f, 'module-cycle', at, `modules ${path}; none of them can move before the others`, c[0]);
  }

  // The size score of every file, and the module each file counts toward.
  const w = config.weights;
  const risky = new Set(RULES.filter((r) => r.category === 'risk' && levelOf(r.id) !== 'off').map((r) => r.id));
  const fileRisks = new Map();
  for (const x of findings) if (risky.has(x.rule)) fileRisks.set(x.file, (fileRisks.get(x.file) ?? 0) + 1);
  const fileModule = new Map();
  for (const f of files) {
    if (!f.script) continue;
    const counts = new Map();
    for (const m of f.script.modules) if (m.name !== null && m.declaration && declared.get(m.name)?.file === f.file) counts.set(m.name, (counts.get(m.name) ?? 0) + 1);
    for (const r of regsOfFile.get(f.file) ?? []) if (r.module) counts.set(r.module, (counts.get(r.module) ?? 0) + 1);
    let best = null;
    for (const [name, n] of counts) if (best === null || n > counts.get(best)) best = name;
    if (best !== null) fileModule.set(f.file, best);
  }
  // A template counts toward the module of the first script whose templateUrl names it.
  // Every template is found by each tail of its path: app/cart/cart.html by cart.html, cart/cart.html and the whole.
  const byTail = new Map();
  for (const t of files.filter((f) => f.kind === 'template')) {
    const parts = t.file.split('/');
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      const tail = parts.slice(i).join('/');
      if (!byTail.has(tail)) byTail.set(tail, []);
      byTail.get(tail).push(t.file);
    }
  }
  for (const f of files) {
    if (!f.script || !fileModule.has(f.file)) continue;
    for (const u of f.script.templateUrls) {
      const url = u.value.split('?')[0].split('#')[0].replace(/^(?:\.\/|\/)+/, '');
      for (const t of byTail.get(url) ?? []) if (!fileModule.has(t)) fileModule.set(t, fileModule.get(f.file));
    }
  }
  const fileRows = files.map((f) => {
    const regs = (regsOfFile.get(f.file) ?? []).length;
    const risks = fileRisks.get(f.file) ?? 0;
    const score = Math.ceil(f.lines / w.linesPerPoint) + w.registration * regs + w.risk * risks;
    return { file: f.file, kind: f.kind, module: fileModule.get(f.file) ?? null, lines: f.lines, registrations: regs, risks, score, read: !f.unreadable && !f.problem };
  });

  // The modules, in the migration order.
  const moduleRows = new Map();
  for (const m of declared.values()) {
    moduleRows.set(m.name, { name: m.name, declared: true, file: m.file, line: m.line, dependencies: m.deps, dynamicDependencies: m.dynamicDeps, localDependencies: localDeps.get(m.name), dependents: [...new Set(dependents.get(m.name))].sort(byCode), registrations: {}, files: 0, lines: 0, risks: 0, score: 0, order: null, brokeCycle: false });
  }
  for (const r of registrations) {
    if (!r.module) continue;
    if (!moduleRows.has(r.module)) moduleRows.set(r.module, { name: r.module, declared: false, file: null, line: null, dependencies: [], dynamicDependencies: 0, localDependencies: [], dependents: [], registrations: {}, files: 0, lines: 0, risks: 0, score: 0, order: null, brokeCycle: false });
    const row = moduleRows.get(r.module);
    row.registrations[r.kind] = (row.registrations[r.kind] ?? 0) + 1;
  }
  for (const row of fileRows) {
    if (!row.module) continue;
    const m = moduleRows.get(row.module);
    m.files += 1;
    m.lines += row.lines;
    m.risks += row.risks;
    m.score += row.score;
  }
  const order = migrationOrder(new Map([...declared.keys()].map((n) => [n, { deps: localDeps.get(n), dependents: moduleRows.get(n).dependents, score: moduleRows.get(n).score }])));
  for (const o of order) {
    moduleRows.get(o.name).order = o.position;
    moduleRows.get(o.name).brokeCycle = o.brokeCycle;
  }
  const modules = [...moduleRows.values()].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || byCode(a.name, b.name));
  for (const m of modules) m.registrations = Object.fromEntries(REGISTRATION_KINDS.filter((k) => m.registrations[k]).map((k) => [k, m.registrations[k]]));

  const byKind = Object.fromEntries(REGISTRATION_KINDS.map((k) => [k, registrations.filter((r) => r.kind === k).length]));
  const annotations = { array: 0, $inject: 0, implicit: 0, none: 0, unknown: 0 };
  for (const r of registrations) {
    if (r.annotation === null) continue;
    const a = r.annotation.startsWith('controller ') ? 'none' : r.annotation;
    annotations[a] += 1;
  }
  const filesByKind = Object.fromEntries(KINDS.map((k) => [k, files.filter((f) => f.kind === k).length]));
  const templateFindings = (rule) => findings.filter((x) => x.rule === rule).length;
  const filters = new Map();
  for (const f of files) {
    for (const x of f.template?.filters ?? []) {
      if (!filters.has(x.name)) filters.set(x.name, { name: x.name, origin: filterNames.has(x.name) ? 'custom' : BUILT_IN_FILTERS.includes(x.name) ? 'built in' : 'unknown', module: filterNames.get(x.name) ?? null, uses: 0, templates: new Set() });
      filters.get(x.name).uses += 1;
      filters.get(x.name).templates.add(f.file);
    }
  }
  const usage = (map) => [...map.values()].map((x) => ({ ...x, templates: x.templates.size })).sort((a, b) => b.uses - a.uses || byCode(a.name, b.name));

  const inventory = {
    counts: {
      files: files.length,
      byKind: filesByKind,
      lines: files.reduce((a, f) => a + f.lines, 0),
      notRead: files.filter((f) => f.unreadable || f.problem).length,
      modules: declared.size,
      dynamicModules,
      registrations: registrations.length,
      unplacedRegistrations: unplaced
    },
    registrations: { byKind, annotations, list: registrations.map((r) => ({ module: r.module, kind: r.kind, name: r.name, file: r.file, line: r.line, annotation: r.annotation, deps: r.deps })) },
    modules,
    external: [...external.entries()].map(([name, by]) => ({ name, dependents: [...new Set(by)].sort(byCode) })).sort((a, b) => byCode(a.name, b.name)),
    cycles,
    order: order.map((o) => o.name),
    templates: { files: filesByKind.template, controllers: templateFindings('template-controller'), includes: templateFindings('template-include'), filters: usage(filters), directives: usage(templateUses) },
    files: fileRows,
    weights: { ...w }
  };
  return { findings, inventory };
}
