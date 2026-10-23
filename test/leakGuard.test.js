import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guard, normalize, fragmentsFrom, GENERIC } from '../server/leakGuard.js';

const refs = { correctedLine: '∫ sin x dx = −cos x', finalAnswer: 'I = x·sin x + cos x + C' };
const wrongLine = (note, hint) => ({ line: 5, status: 'wrong', note, hint });

test('normalize unifies spacing, multiplication signs, minus signs, and + C', () => {
  assert.equal(normalize('X · sin x + cos x + C'), 'xsinx+cosx');
  assert.equal(normalize('x*sin x – cos x'), 'xsinx-cosx');
  assert.equal(normalize('−cos x'), '-cosx');
});

test('builds full and right-hand-side fragments', () => {
  const types = fragmentsFrom(refs).map((f) => f.fragmentType);
  assert.deepEqual(types, ['correctedLine', 'correctedLine_rhs', 'finalAnswer', 'finalAnswer_rhs']);
});

test('a clean note and hint pass through untouched', () => {
  const v = wrongLine('Sign error while integrating.', 'What do you get when you differentiate cos x?');
  const out = guard([v], refs);
  assert.deepEqual(out.verdicts, [v]);
  assert.equal(out.hits.length, 0);
});

test('catches the right-hand side of the corrected line', () => {
  const out = guard([wrongLine('Sign error.', 'Should this be - cos x?')], refs);
  assert.deepEqual(out.verdicts[0], { line: 5, status: 'wrong', ...GENERIC.wrong });
  assert.equal(out.hits[0].fragmentType, 'correctedLine_rhs');
  assert.equal(out.hits[0].field, 'hint');
});

test('catches the final answer written differently, with or without + C', () => {
  for (const note of ['The answer is x*sin x + cos x.', 'You should get x sin x + cos x + c']) {
    const out = guard([wrongLine(note, null)], refs);
    assert.ok(out.hits.some((h) => h.fragmentType === 'finalAnswer_rhs'), note);
    assert.equal(out.verdicts[0].note, GENERIC.wrong.note);
  }
});

test('unsure lines get the unsure generic text', () => {
  const v = { line: 3, status: 'unsure', note: 'Maybe it is x sin x + cos x?', hint: null };
  const out = guard([v], refs);
  assert.deepEqual(out.verdicts[0], { line: 3, status: 'unsure', ...GENERIC.unsure });
});

test('skips fragments shorter than 3 characters and reports them', () => {
  const out = guard([wrongLine('Check x here.', null)], { correctedLine: 'y = x', finalAnswer: null });
  assert.equal(out.hits.length, 0);
  assert.deepEqual(out.skipped.map((s) => s.fragmentType), ['correctedLine_rhs']);
});

test('ok lines are never touched, and missing refs are fine', () => {
  const v = { line: 2, status: 'ok', note: null, hint: null };
  assert.deepEqual(guard([v], { correctedLine: null, finalAnswer: null }).verdicts, [v]);
});
