import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyRules, calibrate, MIN_CONFIDENCE, MISREAD_NOTE } from '../server/rules.js';

const ok = (line) => ({ line, status: 'ok', note: null, hint: null });
const wrong = (line) => ({ line, status: 'wrong', note: 'Sign error.', hint: 'Differentiate it?' });
const unsure = (line) => ({ line, status: 'unsure', note: 'Not sure.', hint: null });
const marks = (out) => out.lines.map((l) => l.mark);

test('line 1 is always the question', () => {
  const out = applyRules([ok(2)], 2);
  assert.equal(out.lines[0].mark, 'question');
});

test('ticks before the first wrong line, cross on it, not_checked after', () => {
  const out = applyRules([ok(2), ok(3), wrong(4), ok(5), wrong(6)], 6);
  assert.deepEqual(marks(out), ['question', 'tick', 'tick', 'cross', 'not_checked', 'not_checked']);
  assert.deepEqual(out.result, { kind: 'mistake', line: 4 });
  assert.equal(out.lines[3].note, 'Sign error.');
  assert.equal(out.lines[4].note, null);
});

test('every confident tick gives a clean all-clear', () => {
  const out = applyRules([ok(2), ok(3)], 3);
  assert.deepEqual(out.result, { kind: 'clear' });
});

test('checking carries on past unsure lines and the cross records the assumption', () => {
  const out = applyRules([ok(2), unsure(3), ok(4), unsure(5), wrong(6)], 6);
  assert.deepEqual(marks(out), ['question', 'tick', 'unsure', 'tick', 'unsure', 'cross']);
  assert.deepEqual(out.lines[5].assumes, [3, 5]);
  assert.deepEqual(out.result, { kind: 'mistake', line: 6 });
});

test('unsure lines after the cross are not_checked, not unsure', () => {
  const out = applyRules([wrong(2), unsure(3)], 3);
  assert.deepEqual(marks(out), ['question', 'cross', 'not_checked']);
  assert.deepEqual(out.lines[1].assumes, []);
});

test('no cross with unsure lines gives the caveated all-clear', () => {
  const out = applyRules([ok(2), unsure(3), ok(4)], 4);
  assert.deepEqual(out.result, { kind: 'clear_with_unsure', lines: [3] });
});

test('does not mutate the input verdicts', () => {
  const verdicts = Object.freeze([ok(2), Object.freeze(wrong(3))]);
  assert.doesNotThrow(() => applyRules(verdicts, 3));
});

const withConfidence = (v, confidence) => ({ ...v, confidence });

test('a wrong verdict on a doubtful (misread) line becomes unsure, never a cross', () => {
  const out = calibrate([withConfidence(ok(2), 0.95), withConfidence(wrong(3), 0.99)], { doubtfulLines: [3] });
  assert.deepEqual(
    { status: out[1].status, note: out[1].note, hint: out[1].hint },
    { status: 'unsure', note: MISREAD_NOTE, hint: null },
  );
  assert.deepEqual(applyRules(out, 3).result, { kind: 'clear_with_unsure', lines: [3] });
});

test('an ok verdict on a doubtful line stays ok', () => {
  const out = calibrate([withConfidence(ok(2), 0.95)], { doubtfulLines: [2] });
  assert.equal(out[0].status, 'ok');
});

test('low-confidence wrong and ok verdicts become unsure; the hint is kept', () => {
  const out = calibrate([withConfidence(ok(2), MIN_CONFIDENCE - 0.01), withConfidence(wrong(3), 0.5)]);
  assert.deepEqual(out.map((v) => v.status), ['unsure', 'unsure']);
  assert.equal(out[0].note, 'Not sure this follows from line 1. Worth checking yourself.');
  assert.equal(out[1].hint, 'Differentiate it?');
});

test('confident verdicts pass through unchanged', () => {
  const verdicts = [withConfidence(ok(2), 0.9), withConfidence(wrong(3), MIN_CONFIDENCE)];
  assert.deepEqual(calibrate(verdicts), verdicts);
});
