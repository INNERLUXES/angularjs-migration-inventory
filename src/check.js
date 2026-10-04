// A run: read the configuration and the files, run the checks, and build the report of the run. A path on the command
// line that cannot be used (missing, a link, a folder with no file to read, a file of no kind the tool reads), a
// configuration with a problem, or input past the limit of a run stops the run with an InputError and no result. A file
// of the input that cannot be read, or that the tokenizer or the template reader cannot place, is an error finding of
// its own, so the run fails at the default level and never passes because a part of the input was passed over.

import { READ_LIMITS, analyse, readInput, unreadableInput } from './analyse.js';
import { ConfigError, defaultConfig, readConfig } from './config.js';
import { LEVELS, NOTICE, POINTS, pointPage } from './data.js';
import { FILE_LIMITS, collectFiles, readText, readTextFile } from './files.js';
import { fileKind } from './kinds.js';
import { RULES, atOrAbove, decide } from './rules.js';
import { grouped, plural } from './size.js';
import { safeText } from './text.js';

export const LIMITS = { ...FILE_LIMITS, ...READ_LIMITS, maxFindingsPerRule: 500 };
export const MAX_PROBLEMS = 20;

export class InputError extends Error {
  constructor(problems) {
    super(problems.join('; '));
    this.problems = problems;
  }
}

// A copy of a value with every text in it cleaned by safeText, for the parts of the report that come from the input.
export function cleanTexts(value) {
  if (typeof value === 'string') return safeText(value, 300);
  if (Array.isArray(value)) return value.map(cleanTexts);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cleanTexts(v)]));
  return value;
}

// A list of problems for an error message: the first twenty, then a count.
export function capped(problems) {
  return problems.length > MAX_PROBLEMS ? [...problems.slice(0, MAX_PROBLEMS), `and ${grouped(problems.length - MAX_PROBLEMS)} more`] : problems;
}

// The level of a rule under a configuration: the rules of input problems are always errors.
export const levelOf = (rule, config) => (rule.key === null ? 'error' : config.rules[rule.key]);

// The run as a report object, from the files that were read (src/analyse.js) and the configuration.
export function buildReport({ input, files, config, minSeverity, failOn, version, limits = LIMITS }) {
  const { findings: raw, inventory } = analyse(files, config);
  const ruleOrder = new Map(RULES.map((r, i) => [r.id, i]));
  const fileOrder = new Map(files.map((f, i) => [f.file, i]));
  const level = (id) => levelOf(RULES.find((r) => r.id === id), config);
  const order = (a, b) => LEVELS.indexOf(b.level) - LEVELS.indexOf(a.level) || fileOrder.get(a.file) - fileOrder.get(b.file) || a.line - b.line || a.column - b.column || ruleOrder.get(a.rule) - ruleOrder.get(b.rule);
  const all = raw.filter((f) => level(f.rule) !== 'off').map((f) => ({ ...f, level: level(f.rule) })).sort(order);
  const shown = all.filter((f) => atOrAbove(f.level, minSeverity));
  const hidden = all.length - shown.length;
  const perRule = new Map();
  const findings = [];
  let cut = 0;
  for (const f of shown) {
    const n = (perRule.get(f.rule) ?? 0) + 1;
    perRule.set(f.rule, n);
    if (n > limits.maxFindingsPerRule) cut += 1;
    else {
      const rule = RULES.find((r) => r.id === f.rule);
      const file = safeText(f.file);
      findings.push({
        rule: f.rule,
        level: f.level,
        category: rule.category,
        file,
        line: f.line,
        column: f.column,
        at: `${file}:${f.line}`,
        found: safeText(f.found, 600),
        module: f.module === null ? null : safeText(f.module, 200),
        modern: rule.modern ?? null,
        basis: rule.basis.map((k) => ({ text: POINTS[k].text, source: pointPage(k).title, url: pointPage(k).url })),
        own: rule.own
      });
    }
  }
  // The result counts every finding at or above the minimum severity, including the ones past the limit of a rule.
  const result = decide(shown, failOn);
  const notes = [];
  if (input.skippedLinks) notes.push(`${plural(input.skippedLinks, 'symbolic link')} inside the folders ${input.skippedLinks === 1 ? 'was' : 'were'} skipped, not followed`);
  if (cut) notes.push(`${plural(cut, 'finding')} past the limit of ${grouped(limits.maxFindingsPerRule)} per rule ${cut === 1 ? 'is' : 'are'} counted but not listed`);
  if (hidden) notes.push(`${plural(hidden, 'finding')} below ${minSeverity} ${hidden === 1 ? 'is' : 'are'} not shown`);
  if (inventory.counts.unplacedRegistrations) notes.push(`${plural(inventory.counts.unplacedRegistrations, 'call')} such as x.controller(...) on a variable that holds no module the tool could find ${inventory.counts.unplacedRegistrations === 1 ? 'is' : 'are'} not counted as a registration`);
  const off = RULES.filter((r) => r.key !== null && config.rules[r.key] === 'off');
  if (off.length) notes.push(`${plural(off.length, 'rule')} ${off.length === 1 ? 'is' : 'are'} off: ${off.map((r) => r.id).join(', ')}`);
  const byLevel = { error: 0, warning: 0, info: 0 };
  for (const f of shown) byLevel[f.level] += 1;
  return {
    tool: 'angularjs-migration-inventory',
    version,
    input: { paths: input.paths.map((p) => safeText(p)), files: files.map((f) => ({ file: safeText(f.file), kind: f.kind })) },
    config: {
      file: config.file === null ? null : safeText(config.file),
      name: config.name === null ? null : safeText(config.name, 120),
      files: config.files,
      exclude: config.exclude,
      minSeverity,
      failOn,
      weights: config.weights,
      rules: RULES.map((r) => ({ id: r.id, key: r.key, category: r.category, level: levelOf(r, config), rule: safeText(r.rule(config), 600) }))
    },
    findings,
    inventory: cleanTexts(inventory),
    totals: { findings: shown.length, byLevel, hidden, notListed: cut },
    result,
    notes: notes.map((n) => safeText(n, 600)),
    notice: NOTICE
  };
}

// Reads the configuration and the files named and checks them: the report object of the run.
export async function checkPaths({ inputs, config: configPath = null, minSeverity = null, failOn = null, version = '0.0.0', limits = LIMITS, base = process.cwd() }) {
  let config;
  try {
    if (configPath) {
      const c = await readTextFile(configPath, base, limits.maxConfigBytes);
      config = readConfig(c.text, c.file);
    } else config = defaultConfig();
  } catch (error) {
    if (error instanceof ConfigError) throw new InputError(capped(error.problems));
    throw new InputError([error.message]);
  }
  let collected;
  try {
    collected = await collectFiles(inputs, base, config, limits);
  } catch (error) {
    throw new InputError([error.message]);
  }
  const files = [];
  const problems = [];
  let total = 0;
  for (const { full, shown } of collected.files) {
    const kind = fileKind(shown);
    if (kind === null) {
      problems.push(`${shown}: not a kind of file the tool reads (a .js, .mjs, .cjs, .ts, .mts, .cts, .html or .htm file)`);
      continue;
    }
    let read;
    try {
      read = await readText(full, shown, limits.maxFileBytes);
    } catch (error) {
      files.push(unreadableInput(shown, kind, error.reason ?? error.message));
      continue;
    }
    total += read.size;
    if (total > limits.maxTotalBytes) {
      problems.push(`${shown}: the files read so far hold more than ${grouped(limits.maxTotalBytes)} bytes, the limit of one run`);
      break;
    }
    files.push(readInput(read.text, shown, kind, limits));
  }
  if (problems.length) throw new InputError(capped(problems));
  return buildReport({ input: { paths: collected.named, skippedLinks: collected.skippedLinks }, files, config, minSeverity: minSeverity ?? config.minSeverity, failOn: failOn ?? config.failOn, version, limits });
}
