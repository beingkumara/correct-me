import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRead, validateCheck, MAX_LINES } from '../server/validate.js';

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

const verdict = (line, status = 'ok', note = null, hint = null, confidence = 0.95) => ({ line, status, confidence, note, hint });

test('accepts one verdict per line 2…N and clears notes on ok lines', () => {
  const result = validateCheck(
    { verdicts: [verdict(2, 'ok', 'stray'), verdict(3, 'wrong', 'Sign error.', ' Why? ')], correctedLine: 'a = b', finalAnswer: '' },
    3,
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.verdicts[0].note, null);
  assert.equal(result.value.verdicts[1].hint, 'Why?');
  assert.equal(result.value.finalAnswer, null);
});

test('rejects the wrong number of verdicts', () => {
  assert.equal(validateCheck({ verdicts: [verdict(2)] }, 4).ok, false);
});

test('rejects verdicts out of order or for the wrong lines', () => {
  assert.equal(validateCheck({ verdicts: [verdict(3), verdict(2)] }, 3).ok, false);
  assert.equal(validateCheck({ verdicts: [verdict(1), verdict(2)] }, 3).ok, false);
});

test('rejects unknown statuses and wrong/unsure lines without a note', () => {
  assert.equal(validateCheck({ verdicts: [verdict(2, 'maybe')] }, 2).ok, false);
  assert.equal(validateCheck({ verdicts: [verdict(2, 'wrong', '  ')] }, 2).ok, false);
  assert.equal(validateCheck({ verdicts: [verdict(2, 'unsure')] }, 2).ok, false);
});

test('rejects missing or out-of-range confidence', () => {
  for (const confidence of [undefined, -0.1, 1.5, '0.9']) {
    const v = { line: 2, status: 'ok', confidence, note: null, hint: null };
    assert.equal(validateCheck({ verdicts: [v] }, 2).ok, false, String(confidence));
  }
});

test('keeps alternative readings and rejects wrongly typed ones', () => {
  const base = { line: 2, status: 'wrong', confidence: 0.96, note: 'Chain rule.', hint: null };
  const good = validateCheck({ verdicts: [{ ...base, alternativeReading: '(sin x)²', followsUnderAlternative: true }] }, 2);
  assert.equal(good.value.verdicts[0].alternativeReading, '(sin x)²');
  assert.equal(good.value.verdicts[0].followsUnderAlternative, true);
  assert.equal(validateCheck({ verdicts: [{ ...base, alternativeReading: 7 }] }, 2).ok, false);
  assert.equal(validateCheck({ verdicts: [{ ...base, followsUnderAlternative: 'yes' }] }, 2).ok, false);
});
