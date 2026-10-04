// The reports: text for a terminal, JSON for other tools, and GitHub workflow commands that turn each finding into an
// annotation on the file, line and column. The CSV of the inventory is in src/csv.js. Every text from the input (a
// file name, a module or registration name, a value of a template) was cleaned by safeText before it reached the report
// object. The GitHub commands also escape the characters a command gives a meaning to, so a text in the input cannot
// end a command early or start another one.

import { KINDS } from './kinds.js';
import { REGISTRATION_KINDS } from './scripts.js';
import { grouped, listText, plural } from './size.js';
import { safeText } from './text.js';

const clean = (t, max = 200) => safeText(t, max);
const pathsText = (r) => r.input.paths.join(', ');

function kindsText(r) {
  const n = r.inventory.counts.byKind;
  return KINDS.filter((k) => n[k]).map((k) => `${grouped(n[k])} ${k}`).join(', ');
}

function inputLine(r) {
  const kinds = kindsText(r);
  return `${pathsText(r)} (${plural(r.inventory.counts.files, 'file')}${kinds ? `: ${kinds}` : ''})`;
}

function configLine(r) {
  const c = r.config;
  const where = c.file ? `${c.file}${c.name ? ` (${clean(c.name, 120)})` : ''}` : 'built-in defaults';
  return `${where}: ${plural(c.files.length, 'file pattern')}, ${plural(c.exclude.length, 'exclude pattern')}; minimum severity ${c.minSeverity}; fail on ${c.failOn}`;
}

const rulesLine = (r) => r.config.rules.map((x) => `${x.id} (${x.level})`).join('; ');

function findingsLine(r) {
  const b = r.totals.byLevel;
  const parts = ['error', 'warning', 'info'].filter((l) => b[l]).map((l) => `${grouped(b[l])} ${l}`);
  return `${grouped(r.totals.findings)}${parts.length ? ` (${parts.join(', ')})` : ''}${r.totals.hidden ? `; ${grouped(r.totals.hidden)} below ${r.config.minSeverity} not shown` : ''}`;
}

// A table with a header row and its columns padded to the widest cell.
function table(head, rows) {
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i].length)));
  const line = (cells) => `  ${cells.map((c, i) => (i === cells.length - 1 ? c : c.padEnd(widths[i]))).join('  ')}`.trimEnd();
  return [line(head), ...rows.map(line)];
}

const registrationsText = (counts) => REGISTRATION_KINDS.filter((k) => counts[k]).map((k) => `${k} ${grouped(counts[k])}`).join(', ') || 'none';

// The inventory: the modules in the suggested migration order with their dependencies, the registrations, the
// templates and the files with the highest score.
function inventoryLines(r) {
  const inv = r.inventory;
  const out = [];
  out.push('Modules, in the suggested migration order', '');
  const mods = inv.modules;
  if (!mods.length) out.push('  none');
  else {
    const rows = mods.map((m) => [
      m.order === null ? '-' : `${grouped(m.order)}${m.brokeCycle ? '*' : ''}`,
      m.name,
      grouped(m.dependents.length),
      grouped(m.files),
      grouped(m.lines),
      grouped(m.risks),
      grouped(m.score),
      registrationsText(m.registrations)
    ]);
    out.push(...table(['order', 'module', 'dependents', 'files', 'lines', 'risks', 'score', 'registrations'], rows));
    out.push('');
    const deps = mods.map((m) => [m.name, m.declared ? `${m.file}:${m.line}` : 'not declared in the files read', m.dependencies.length || m.dynamicDependencies ? `${m.dependencies.join(', ')}${m.dynamicDependencies ? `${m.dependencies.length ? ' ' : ''}(and ${grouped(m.dynamicDependencies)} not named)` : ''}` : '-']);
    out.push(...table(['module', 'declared at', 'depends on'], deps));
  }
  if (mods.some((m) => m.brokeCycle)) out.push('', '  * placed to break a cycle of dependencies');
  if (inv.external.length) out.push('', `  modules not declared in the files read: ${inv.external.map((e) => `${e.name} (${grouped(e.dependents.length)})`).join(', ')}`);
  out.push('');
  const c = inv.counts;
  const a = inv.registrations.annotations;
  out.push('Registrations', '');
  out.push(`  ${grouped(c.registrations)}: ${registrationsText(inv.registrations.byKind)}`);
  out.push(`  annotations: array ${grouped(a.array)}, $inject ${grouped(a.$inject)}, parameter names only ${grouped(a.implicit)}, no dependency ${grouped(a.none)}, not visible ${grouped(a.unknown)}`, '');
  const t = inv.templates;
  out.push('Templates', '');
  out.push(`  ${plural(t.files, 'template')}: ng-controller ${grouped(t.controllers)}, ng-include ${grouped(t.includes)}`);
  out.push(`  filters: ${t.filters.length ? t.filters.map((f) => `${f.name} ${grouped(f.uses)} (${f.origin === 'custom' ? `custom, ${f.module}` : f.origin})`).join(', ') : 'none'}`);
  out.push(`  directives: ${t.directives.length ? listText(t.directives.map((d) => `${d.name} ${grouped(d.uses)}${d.kind === 'built in' ? '' : ` (${d.kind}, ${d.module})`}`), 12) : 'none'}`, '');
  out.push('Files, highest score first', '');
  const files = [...inv.files].sort((x, y) => y.score - x.score || (x.file < y.file ? -1 : x.file > y.file ? 1 : 0));
  const shown = files.slice(0, 25);
  out.push(...table(['score', 'lines', 'registrations', 'risks', 'module', 'file'], shown.map((f) => [grouped(f.score), grouped(f.lines), grouped(f.registrations), grouped(f.risks), f.module ?? '-', `${f.file}${f.read ? '' : ' (not read)'}`])));
  if (files.length > shown.length) out.push(`  and ${plural(files.length - shown.length, 'more file')}`);
  out.push('', `  score = lines / ${grouped(inv.weights.linesPerPoint)} (rounded up) + ${grouped(inv.weights.registration)} per registration + ${grouped(inv.weights.risk)} per risk`);
  return out;
}

export function toText(r, { explain = false } = {}) {
  const out = [];
  out.push(`angularjs-migration-inventory: ${pathsText(r)}`);
  out.push(`input: ${inputLine(r)}`);
  out.push(`config: ${configLine(r)}`);
  out.push(`rules: ${rulesLine(r)}`);
  out.push(`findings: ${findingsLine(r)}`);
  out.push('', `Findings (${grouped(r.findings.length)})`, '');
  if (!r.findings.length) out.push('  none', '');
  const width = Math.max(...r.config.rules.map((x) => x.id.length));
  const pad = ' '.repeat(11);
  for (const f of r.findings) {
    out.push(`  ${f.level.toUpperCase().padEnd(8)} ${f.rule.padEnd(width)}  ${f.at}`);
    out.push(`${pad}${f.found}`);
    if (f.modern) out.push(`${pad}in Angular: ${f.modern}`);
    if (explain) {
      out.push(`${pad}rule: ${r.config.rules.find((x) => x.id === f.rule).rule}`);
      for (const b of f.basis) out.push(`${pad}basis: ${b.text} (${b.source}, ${b.url})`);
      if (f.own) out.push(`${pad}the tool's own choice: ${f.own}`);
    }
    out.push('');
  }
  out.push(...inventoryLines(r), '');
  for (const n of r.notes) out.push(`note: ${n}`);
  if (r.notes.length) out.push('');
  out.push(r.notice, '');
  out.push(`RESULT: ${r.result.text}`);
  return `${out.join('\n')}\n`;
}

export function toJson(r, { explain = false } = {}) {
  const out = { ...r, findings: r.findings.map((f) => (explain ? f : { ...f, basis: undefined, own: undefined })) };
  return `${JSON.stringify(out, null, 2)}\n`;
}

// The message of a workflow command: %, CR and LF escaped.
export const escapeData = (t) => String(t).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

// A property of a workflow command: also : and , escaped.
export const escapeProperty = (t) => escapeData(t).replace(/:/g, '%3A').replace(/,/g, '%2C');

const COMMANDS = { error: 'error', warning: 'warning', info: 'notice' };

export function toGithub(r) {
  const out = [];
  for (const f of r.findings) {
    const props = [`file=${escapeProperty(f.file)}`, `line=${f.line}`, ...(f.column ? [`col=${f.column}`] : []), `title=${escapeProperty(`angularjs-migration-inventory ${f.rule}`)}`];
    out.push(`::${COMMANDS[f.level]} ${props.join(',')}::${escapeData(`${f.found}${f.modern ? `; in Angular: ${f.modern}` : ''}`)}`);
  }
  out.push(`angularjs-migration-inventory: ${pathsText(r)}: ${plural(r.inventory.counts.files, 'file')}, ${plural(r.inventory.counts.modules, 'module')}, ${plural(r.inventory.counts.registrations, 'registration')}, ${grouped(r.totals.findings)} ${r.totals.findings === 1 ? 'finding' : 'findings'}; RESULT: ${r.result.text}`);
  return `${out.join('\n')}\n`;
}
