// Express app: serves the page and the two API routes. Holds the API keys; the browser never sees them.

import express from 'express';
import { fileURLToPath } from 'node:url';
import { assertConfigured, chatJSON, LlmError } from './llm.js';
import { READ_SCHEMA, readMessages } from './prompts.js';
import { validateRead, MAX_LINES } from './validate.js';
import { checkLines } from './check.js';

const MAX_IMAGE_CHARS = 8 * 1024 * 1024;
const MAX_LINE_CHARS = 300;

/** lines: 2–40 non-empty strings ≤ 300 chars; doubtfulLines: optional line numbers within range. */
export function parseCheckBody(body) {
  const { lines, doubtfulLines = [] } = body ?? {};
  const linesOk =
    Array.isArray(lines) &&
    lines.length >= 2 &&
    lines.length <= MAX_LINES &&
    lines.every((l) => typeof l === 'string' && l.trim() !== '' && l.length <= MAX_LINE_CHARS);
  const doubtfulOk =
    Array.isArray(doubtfulLines) && doubtfulLines.every((n) => Number.isInteger(n) && n >= 1 && n <= (lines?.length ?? 0));
  return linesOk && doubtfulOk ? { lines: lines.map((l) => l.trim()), doubtfulLines } : null;
}

const FRIENDLY = {
  invalid_input: 'That request was not something I can check.',
  ai_failed: "Couldn't reach the checker. Your photo and edits are safe.",
  bad_ai_reply: 'Something went wrong reading the reply. Try again.',
  rate_limited: 'Too many checks in a row. Wait a minute and try again.',
};
const STATUS = { invalid_input: 400, ai_failed: 502, bad_ai_reply: 502, rate_limited: 429 };

const sendOk = (res, data) => res.json({ ok: true, data });
const sendError = (res, kind) =>
  res.status(STATUS[kind] ?? 500).json({ ok: false, error: { kind, message: FRIENDLY[kind] ?? FRIENDLY.ai_failed } });

/** Log the detail server-side; the browser only gets the friendly message. */
function handleFailure(res, route, err) {
  if (err instanceof LlmError) {
    console.error(`[${route}] ${err.kind}: ${err.message}`, err.detail ? String(JSON.stringify(err.detail)).slice(0, 2000) : '');
    return sendError(res, err.kind);
  }
  console.error(`[${route}] unexpected error`, err);
  return sendError(res, 'ai_failed');
}

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '8mb' }));
  app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));

  app.post('/api/read', async (req, res) => {
    const image = req.body?.image;
    if (typeof image !== 'string' || !image.startsWith('data:image/') || image.length > MAX_IMAGE_CHARS) {
      return sendError(res, 'invalid_input');
    }
    try {
      const { data } = await chatJSON({ role: 'reader', messages: readMessages(image), schema: READ_SCHEMA, name: 'read' });
      const checked = validateRead(data);
      if (!checked.ok) throw new LlmError('bad_ai_reply', `Invalid read reply: ${checked.reason}`, data);
      return sendOk(res, checked.value);
    } catch (err) {
      return handleFailure(res, 'read', err);
    }
  });

  app.post('/api/check', async (req, res) => {
    const input = parseCheckBody(req.body);
    if (!input) return sendError(res, 'invalid_input');
    try {
      const { display } = await checkLines(input.lines, { doubtfulLines: input.doubtfulLines });
      return sendOk(res, display);
    } catch (err) {
      return handleFailure(res, 'check', err);
    }
  });

  // Malformed JSON bodies and oversize payloads land here.
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    console.error(`[${req.path}] bad request: ${err.message}`);
    return sendError(res, 'invalid_input');
  });

  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    assertConfigured();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, () => console.log(`Correct Me running at http://localhost:${port}`));
}
