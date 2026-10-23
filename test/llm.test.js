import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonContent, missingSettings, LlmError } from '../server/llm.js';

test('parses JSON wrapped in think tags or code fences', () => {
  assert.deepEqual(parseJsonContent('<think>hmm</think>\n```json\n{"a":1}\n```'), { a: 1 });
});

test('empty or invalid content is a bad_ai_reply', () => {
  for (const content of ['', null, '{not json']) {
    assert.throws(() => parseJsonContent(content), (e) => e instanceof LlmError && e.kind === 'bad_ai_reply');
  }
});

test('lists every missing reader/checker setting; JSON_MODE is optional', () => {
  const env = { READER_BASE_URL: 'u', READER_API_KEY: 'k', READER_MODEL: 'm' };
  assert.deepEqual(missingSettings(env), ['CHECKER_BASE_URL', 'CHECKER_API_KEY', 'CHECKER_MODEL']);
});

// A tiny fake provider so the gateway is tested over real HTTP, abort and all.
import http from 'node:http';
import { chatJSON, configFor } from '../server/llm.js';

async function withFakeProvider(handler, run) {
  const seen = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      seen.push(JSON.parse(body));
      handler(req, res);
    });
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://localhost:${server.address().port}`;
  const env = {
    READER_BASE_URL: base, READER_API_KEY: 'k', READER_MODEL: 'reader', READER_JSON_MODE: 'json_object', READER_TIMEOUT_MS: '300',
    CHECKER_BASE_URL: base, CHECKER_API_KEY: 'k', CHECKER_MODEL: 'checker',
  };
  try {
    return await run(env, seen);
  } finally {
    server.closeAllConnections();
    server.close();
  }
}

const reply = (res, content, finish_reason = 'stop') => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ choices: [{ finish_reason, message: { content } }] }));
};
const readArgs = { role: 'reader', messages: [], schema: {}, name: 'read' };
const isKind = (kind) => (e) => e instanceof LlmError && e.kind === kind;

test('reader defaults: 20s timeout and a 1500-token cap; checker has no cap', () => {
  const env = { READER_BASE_URL: 'u', READER_API_KEY: 'k', READER_MODEL: 'm', CHECKER_BASE_URL: 'u', CHECKER_API_KEY: 'k', CHECKER_MODEL: 'm' };
  assert.deepEqual([configFor('reader', env).timeoutMs, configFor('reader', env).maxTokens], [20_000, 1500]);
  assert.equal(configFor('checker', env).maxTokens, null);
});

test('the reader request carries the token cap', async () => {
  await withFakeProvider((req, res) => reply(res, '{"status":"not_math","lines":[]}'), async (env, seen) => {
    const out = await chatJSON(readArgs, env);
    assert.equal(out.data.status, 'not_math');
    assert.equal(seen[0].max_completion_tokens, 1500);
  });
});

test('a reply cut off at the token cap (a loop) is "truncated", not a network failure', async () => {
  await withFakeProvider((req, res) => reply(res, '{"status":"ok","lines":[{"text":"STAY WILD"},{"text":"STAY', 'length'), async (env) => {
    await assert.rejects(chatJSON(readArgs, env), isKind('truncated'));
  });
});

test("Groq's json_validate_failed at the token cap is also truncated", async () => {
  const body = JSON.stringify({ error: { code: 'json_validate_failed', failed_generation: 'max completion tokens reached before generating a valid document' } });
  await withFakeProvider((req, res) => res.writeHead(400).end(body), async (env) => {
    await assert.rejects(chatJSON(readArgs, env), isKind('truncated'));
  });
});

test('a reply that keeps streaming is stopped by the timeout, body included', async () => {
  const dripping = (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write('{"choices":[{"message":{"content":"');
    const timer = setInterval(() => res.write('x'), 20);
    res.on('close', () => clearInterval(timer));
  };
  await withFakeProvider(dripping, async (env) => {
    const started = Date.now();
    await assert.rejects(chatJSON(readArgs, env), isKind('timeout'));
    assert.ok(Date.now() - started < 1500, 'gave up near the 300ms limit');
  });
});
