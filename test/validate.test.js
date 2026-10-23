import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRead, MAX_LINES } from '../server/validate.js';

test('accepts an ok read and trims line text', () => {
  const result = validateRead({
    status: 'ok',
    lines: [
      { text: '  I = ∫ x·cos x dx ', confident: true },
      { text: 'I = x sin x − cos x', confident: false },
    ],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.lines[0], { text: 'I = ∫ x·cos x dx', confident: true });
  assert.equal(result.value.lines[1].confident, false);
});

test('unreadable and not_math return no lines even if the model sent some', () => {
  for (const status of ['unreadable', 'not_math']) {
    const result = validateRead({ status, lines: [{ text: 'guess', confident: false }] });
    assert.deepEqual(result, { ok: true, value: { status, lines: [] } });
  }
});

test('rejects unknown status', () => {
  assert.equal(validateRead({ status: 'maybe', lines: [] }).ok, false);
});

test('rejects an ok read with no lines or too many lines', () => {
  assert.equal(validateRead({ status: 'ok', lines: [] }).ok, false);
  const many = Array.from({ length: MAX_LINES + 1 }, () => ({ text: 'x', confident: true }));
  assert.equal(validateRead({ status: 'ok', lines: many }).ok, false);
});

test('rejects empty text or missing confident', () => {
  assert.equal(validateRead({ status: 'ok', lines: [{ text: '  ', confident: true }] }).ok, false);
  assert.equal(validateRead({ status: 'ok', lines: [{ text: 'x = 1' }] }).ok, false);
});

test('rejects non-object replies', () => {
  assert.equal(validateRead(null).ok, false);
  assert.equal(validateRead('ok').ok, false);
});
