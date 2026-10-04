// The kind of a file, from its path: what the tool reads it as. The path is the one the report shows, with forward
// slashes. A file of no kind is not read: named on the command line, or matched by a pattern of the configuration, it
// stops the run, so a file is never passed over in silence.

import { asciiLower, baseName } from './words.js';

// The kinds, in the order the report counts them.
export const KINDS = ['javascript', 'typescript', 'template'];

// The kind of a path, or null. JSX and TSX are not read: the tokenizer does not know markup inside code.
export function fileKind(path) {
  const lower = asciiLower(baseName(path));
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) return 'javascript';
  if (lower.endsWith('.ts') || lower.endsWith('.mts') || lower.endsWith('.cts')) return 'typescript';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'template';
  return null;
}
