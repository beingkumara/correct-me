// Reality check: run one real photo through the AI calls and print the raw model
// replies next to the validated result, so you can judge the AI output yourself.
// Usage: npm run reality-check samples/<photo>

import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { assertConfigured, chatJSON, LlmError } from '../server/llm.js';
import { READ_SCHEMA, readMessages } from '../server/prompts.js';
import { validateRead } from '../server/validate.js';

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

async function main() {
  const photoPath = process.argv[2];
  if (!photoPath) {
    console.error('Usage: npm run reality-check samples/<photo>');
    process.exit(1);
  }
  assertConfigured();
  await runRead(photoPath);
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
