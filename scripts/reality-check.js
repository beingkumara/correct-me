// Reality check: run one real photo through the AI calls and print the raw model
// replies next to the validated result, so you can judge the AI output yourself.
// Usage: npm run reality-check samples/<photo>            read the photo, then check the lines
//        npm run reality-check -- --lines <file.txt>     skip reading; check one line per row

import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { assertConfigured, chatJSON, LlmError } from '../server/llm.js';
import { READ_SCHEMA, readMessages } from '../server/prompts.js';
import { validateRead } from '../server/validate.js';
import { checkLines } from '../server/check.js';

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

function section(title) {
  console.log(`\n=== ${title} ${'='.repeat(Math.max(0, 60 - title.length))}`);
}

async function toDataUrl(path) {
  const mime = MIME[extname(path).toLowerCase()];
  if (!mime) throw new Error(`Unsupported file type ${extname(path)}. Use JPEG, PNG, or WebP.`);
  const bytes = await readFile(path);
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

async function runRead(photoPath) {
  const dataUrl = await toDataUrl(photoPath);
  section(`READ  (${process.env.READER_MODEL})`);
  const { data, raw, mode } = await chatJSON({
    role: 'reader',
    messages: readMessages(dataUrl),
    schema: READ_SCHEMA,
    name: 'read',
  });
  console.log(`response_format: ${mode}`);
  console.log('\n--- raw reply ---');
  console.log(raw);

  const checked = validateRead(data);
  console.log('\n--- validated ---');
  if (!checked.ok) {
    console.log(`INVALID reply → would show "Try again": ${checked.reason}`);
    return null;
  }
  if (checked.value.status !== 'ok') {
    console.log(`status: ${checked.value.status} (no lines shown to the student)`);
    return null;
  }
  checked.value.lines.forEach((l, i) => {
    const label = i === 0 ? 'Question' : '';
    console.log(`${String(i + 1).padStart(2)} ${l.confident ? ' ' : '?'} ${l.text}  ${label}`);
  });
  return checked.value.lines;
}

const MARK = { question: 'Q', tick: '✓', cross: '✗', unsure: '?', not_checked: '·' };

function resultMessage(result) {
  if (result.kind === 'mistake') return `Mistake found on line ${result.line}.`;
  if (result.kind === 'clear') return 'No mistakes found.';
  return `No mistakes found, but I wasn't sure about line ${result.lines.join(', ')}. Check that one yourself.`;
}

async function runCheck(lines, doubtfulLines = []) {
  section(`CHECK (${process.env.CHECKER_MODEL})`);
  const { display, raw, guardEvents, calibrations } = await checkLines(lines, { doubtfulLines });
  console.log('--- raw reply (includes PRIVATE correctedLine / finalAnswer) ---');
  console.log(JSON.stringify(JSON.parse(raw), null, 2));

  console.log('\n--- calibration (code rules) ---');
  if (doubtfulLines.length > 0) console.log(`doubtful lines (read with "?"): ${doubtfulLines.join(', ')}`);
  console.log(
    calibrations.length === 0
      ? 'no verdicts changed'
      : calibrations.map((c) => `line ${c.line} → unsure (${c.reason}, confidence ${c.confidence})`).join('\n'),
  );

  console.log('\n--- leak guard ---');
  console.log(guardEvents.length === 0 ? 'no hits, nothing skipped' : `${guardEvents.length} event(s), see above and logs/leak-guard.jsonl`);

  console.log('\n--- what the student would see ---');
  display.lines.forEach((l) => {
    const status = l.mark === 'not_checked' ? '  (not checked)' : '';
    console.log(`${String(l.line).padStart(2)} ${MARK[l.mark]} ${lines[l.line - 1]}${status}`);
    if (l.note) console.log(`       note: ${l.note}`);
    if (l.hint) console.log(`       hint: ${l.hint}`);
    if (l.assumes.length > 0) console.log(`       This assumes line ${l.assumes.join(', ')} was right, which I wasn't sure about.`);
  });
  console.log(`\nResult: ${resultMessage(display.result)}`);
}

async function readLinesFile(path) {
  const text = await readFile(path, 'utf8');
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

async function main() {
  const args = process.argv.slice(2);
  const linesIndex = args.indexOf('--lines');
  if (args.length === 0 || (linesIndex !== -1 && !args[linesIndex + 1])) {
    console.error('Usage: npm run reality-check samples/<photo>\n       npm run reality-check -- --lines <file.txt>');
    process.exit(1);
  }
  assertConfigured();

  if (linesIndex !== -1) {
    const lines = await readLinesFile(args[linesIndex + 1]);
    section(`LINES from ${args[linesIndex + 1]}`);
    lines.forEach((l, i) => console.log(`${String(i + 1).padStart(2)}   ${l}`));
    await runCheck(lines);
    return;
  }

  const read = await runRead(args[0]);
  // As if the student confirmed every "?" line without editing it.
  if (!read) return;
  const doubtful = read.flatMap((l, i) => (l.confident ? [] : [i + 1]));
  await runCheck(read.map((l) => l.text), doubtful);
}

main().catch((err) => {
  if (err instanceof LlmError) {
    console.error(`\n[${err.kind}] ${err.message}`);
    if (err.detail) console.error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail, null, 2));
  } else {
    console.error(`\n${err.message}`);
  }
  process.exit(1);
});
