// Verdict rules, in plain code: the model judges, this enforces.
// Stops at the first wrong line, carries on past unsure lines, and picks the result message.

/** Verdicts the checker is less sure about than this become "unsure", whatever their status. */
export const MIN_CONFIDENCE = 0.75;

export const MISREAD_NOTE = 'I might have misread this line. Check it against your photo.';
export const lowConfidenceNote = (line) => `Not sure this follows from line ${line - 1}. Worth checking yourself.`;

/**
 * Turn the model's raw verdicts into ones the student can trust, before applyRules.
 * - A "wrong" verdict on a doubtful line (read with "?" and confirmed, not edited) blames the
 *   reader, not the student: it becomes "unsure" with MISREAD_NOTE.
 * - Any verdict below MIN_CONFIDENCE becomes "unsure", keeping the model's hint question.
 * @param verdicts validated verdicts with `confidence`
 * @param {{ doubtfulLines?: number[], minConfidence?: number }} options
 */
export function calibrate(verdicts, { doubtfulLines = [], minConfidence = MIN_CONFIDENCE } = {}) {
  return verdicts.map((v) => {
    if (v.status === 'wrong' && doubtfulLines.includes(v.line)) {
      return { ...v, status: 'unsure', note: MISREAD_NOTE, hint: null, calibrated: 'misread' };
    }
    if (v.status !== 'unsure' && v.confidence < minConfidence) {
      return { ...v, status: 'unsure', note: lowConfidenceNote(v.line), calibrated: 'low_confidence' };
    }
    return v;
  });
}

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
