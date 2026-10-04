// The inventory as CSV, written as RFC 4180 describes it: a header line, records ended by CRLF, and a field that holds
// a comma, a double quote or a line break put in double quotes with every double quote inside written twice. One record
// per module declared or registered on, then one per registration and one per file. The texts come from the report
// object, where safeText cleaned them. A field that starts with =, +, -, @, a tab or a carriage return gets a single
// quote in front, so a spreadsheet does not read a name from the input as a formula; docs/threat-model.md says why that
// is a help and not a guarantee.

export const CSV_COLUMNS = ['record', 'module', 'kind', 'name', 'file', 'line', 'annotation', 'dependencies', 'order', 'dependents', 'files', 'lines', 'registrations', 'risks', 'score', 'note'];

const FORMULA = /^[=+\-@\t\r]/;

// One field: text with a leading formula character neutralized, quoted when it must be.
export function csvField(value) {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (FORMULA.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const record = (cells) => cells.map(csvField).join(',');

export function toCsv(r) {
  const inv = r.inventory;
  const rows = [CSV_COLUMNS.join(',')];
  const row = (values) => rows.push(record(CSV_COLUMNS.map((c) => values[c] ?? null)));
  for (const m of inv.modules) {
    row({
      record: 'module',
      module: m.name,
      kind: m.declared ? 'declared' : 'not declared',
      name: m.name,
      file: m.file,
      line: m.line,
      dependencies: m.dependencies.join(' '),
      order: m.order,
      dependents: m.dependents.join(' '),
      files: m.files,
      lines: m.lines,
      registrations: Object.values(m.registrations).reduce((a, b) => a + b, 0),
      risks: m.risks,
      score: m.score
    });
  }
  for (const x of inv.registrations.list) {
    row({ record: 'registration', module: x.module, kind: x.kind, name: x.name, file: x.file, line: x.line, annotation: x.annotation, dependencies: x.deps.join(' ') });
  }
  for (const f of inv.files) {
    row({ record: 'file', module: f.module, kind: f.kind, file: f.file, lines: f.lines, registrations: f.registrations, risks: f.risks, score: f.score, note: f.read ? null : 'not read' });
  }
  return `${rows.join('\r\n')}\r\n`;
}
