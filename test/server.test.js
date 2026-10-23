import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCheckBody } from '../server/index.js';

test('accepts 2+ lines and in-range doubtful lines, trimming text', () => {
  assert.deepEqual(parseCheckBody({ lines: [' I = ∫ x dx ', 'I = x²/2 + C'], doubtfulLines: [2] }), {
    lines: ['I = ∫ x dx', 'I = x²/2 + C'],
    doubtfulLines: [2],
  });
  assert.deepEqual(parseCheckBody({ lines: ['a', 'b'] }).doubtfulLines, []);
});

test('rejects too few, empty, too long, or non-string lines', () => {
  for (const lines of [['only one'], ['a', '  '], ['a', 'x'.repeat(301)], ['a', 2], 'a\nb', undefined]) {
    assert.equal(parseCheckBody({ lines }), null, JSON.stringify(lines)?.slice(0, 40));
  }
  assert.equal(parseCheckBody({ lines: Array(41).fill('x') }), null);
});

test('rejects doubtful lines that are out of range or not integers', () => {
  for (const doubtfulLines of [[0], [3], [1.5], ['2'], 'all']) {
    assert.equal(parseCheckBody({ lines: ['a', 'b'], doubtfulLines }), null, String(doubtfulLines));
  }
});
