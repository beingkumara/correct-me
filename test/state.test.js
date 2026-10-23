import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState, withPhoto, withLines, withEdit, withConfirm, withChecking, withVerdict, canCheck, linesNeedingReview, doubtfulLines,
} from '../public/js/state.js';

const read = [
  { text: 'I = ∫ x cos x dx', confident: true },
  { text: 'u = x dv = cos x dx', confident: false },
  { text: 'du = dx v = sin x', confident: false },
];
const withRead = () => withLines(withPhoto(initialState(), 'data:image/jpeg;base64,x'), read);

test('Check is disabled until every "?" line is edited or confirmed', () => {
  let state = withRead();
  assert.deepEqual(linesNeedingReview(state), [2, 3]);
  assert.equal(canCheck(state), false);

  state = withConfirm(state, 1);
  assert.equal(canCheck(state), false);

  state = withEdit(state, 2, 'du = dx,  v = sin x');
  assert.deepEqual(linesNeedingReview(state), []);
  assert.equal(canCheck(state), true);
});

test('only confirmed-but-unedited "?" lines count as doubtful', () => {
  const state = withEdit(withConfirm(withRead(), 1), 2, 'du = dx,  v = sin x');
  assert.deepEqual(doubtfulLines(state), [2]);
});

test('an emptied line blocks Check', () => {
  const state = withEdit(withConfirm(withConfirm(withRead(), 1), 2), 0, '  ');
  assert.equal(canCheck(state), false);
});

test('updates never mutate the previous state', () => {
  const before = withRead();
  const snapshot = structuredClone(before);
  withEdit(withConfirm(before, 1), 0, 'changed');
  assert.deepEqual(before, snapshot);
});

test('a new photo starts a fresh session; new lines bump readId', () => {
  const first = withRead();
  const next = withPhoto(first, 'data:image/jpeg;base64,y');
  assert.deepEqual(next.lines, []);
  assert.equal(withLines(next, read).readId, first.readId + 1);
});

test('a verdict clears "edited" marks but a once-edited "?" line never becomes doubtful again', () => {
  const ready = withEdit(withConfirm(withRead(), 1), 2, 'du = dx,  v = sin x');
  const verdict = { lines: [], result: { kind: 'clear' } };
  const after = withVerdict(withChecking(ready), verdict);
  assert.equal(after.phase, 'verdict');
  assert.equal(after.lines.some((l) => l.edited), false);
  assert.deepEqual(doubtfulLines(after), [2]);
});

test('after a verdict, editedFrom tracks the lowest edited line until the next verdict', () => {
  const checked = withVerdict(withChecking(withConfirm(withConfirm(withRead(), 1), 2)), { lines: [], result: { kind: 'clear' } });
  assert.equal(checked.editedFrom, null);
  const editedLow = withEdit(withEdit(checked, 2, 'du = dx,  v = sin x'), 1, 'u = x,  dv = cos x dx');
  assert.equal(editedLow.editedFrom, 2);
  assert.equal(withEdit(editedLow, 2, 'again').editedFrom, 2);
  assert.equal(withVerdict(editedLow, { lines: [], result: { kind: 'clear' } }).editedFrom, null);
});

test('before any verdict, editing does not set editedFrom', () => {
  assert.equal(withEdit(withRead(), 2, 'changed').editedFrom, null);
});
