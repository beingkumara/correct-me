// Verdict rules, in plain code: the model judges, this enforces.
// Stops at the first wrong line, carries on past unsure lines, and picks the result message.

/**
 * @param {{ line: number, status: 'ok'|'wrong'|'unsure', note: string|null, hint: string|null }[]} verdicts lines 2…N
 * @param {number} lineCount N, including the question on line 1
 * @returns {{ lines: { line: number, mark: string, note: string|null, hint: string|null, assumes: number[] }[], result: object }}
 */
export function applyRules(verdicts, lineCount) {
  const byLine = new Map(verdicts.map((v) => [v.line, v]));
  const question = { line: 1, mark: 'question', note: null, hint: null, assumes: [] };

  const walk = Array.from({ length: lineCount - 1 }, (_, i) => i + 2).reduce(
    (acc, line) => {
      if (acc.crossAt !== null) {
        return { ...acc, lines: [...acc.lines, { line, mark: 'not_checked', note: null, hint: null, assumes: [] }] };
      }
      const v = byLine.get(line);
      if (v.status === 'ok') {
        return { ...acc, lines: [...acc.lines, { line, mark: 'tick', note: null, hint: null, assumes: [] }] };
      }
      if (v.status === 'unsure') {
        return {
          ...acc,
          unsure: [...acc.unsure, line],
          lines: [...acc.lines, { line, mark: 'unsure', note: v.note, hint: v.hint, assumes: [] }],
        };
      }
      return {
        ...acc,
        crossAt: line,
        lines: [...acc.lines, { line, mark: 'cross', note: v.note, hint: v.hint, assumes: [...acc.unsure] }],
      };
    },
    { lines: [question], unsure: [], crossAt: null },
  );

  const result =
    walk.crossAt !== null
      ? { kind: 'mistake', line: walk.crossAt }
      : walk.unsure.length > 0
        ? { kind: 'clear_with_unsure', lines: walk.unsure }
        : { kind: 'clear' };

  return { lines: walk.lines, result };
}
