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
