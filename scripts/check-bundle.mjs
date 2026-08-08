/**
 * Bundle-size budget (PRD §2): the gzipped transfer of everything a fresh
 * visitor downloads (html + js + css) must stay under 300 KB. Run after
 * `vite build`; exits non-zero over budget.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_BYTES = 300 * 1024;
const exts = new Set(['.js', '.css', '.html']);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

let total = 0;
const rows = [];
for (const file of walk('dist')) {
  const ext = file.slice(file.lastIndexOf('.'));
  if (!exts.has(ext)) continue;
  const gz = gzipSync(readFileSync(file)).length;
  total += gz;
  rows.push(`${gz.toString().padStart(8)}  ${file}`);
}
console.log(rows.sort().join('\n'));
console.log(`${total.toString().padStart(8)}  TOTAL gzipped (budget ${BUDGET_BYTES})`);
if (total > BUDGET_BYTES) {
  console.error(`Bundle over budget: ${total} > ${BUDGET_BYTES}`);
  process.exit(1);
}
