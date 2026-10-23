// Reply validation beyond the schema. Any mismatch is a failure ("Try again"), never a partial result.

export const MAX_LINES = 40;
const READ_STATUSES = ['ok', 'unreadable', 'not_math'];

const fail = (reason) => ({ ok: false, reason });

export function validateRead(reply) {
  if (!reply || typeof reply !== 'object') return fail('reply is not an object');
  if (!READ_STATUSES.includes(reply.status)) return fail(`unknown status: ${reply.status}`);

  if (reply.status !== 'ok') return { ok: true, value: { status: reply.status, lines: [] } };

  if (!Array.isArray(reply.lines)) return fail('lines is not an array');
  if (reply.lines.length < 1 || reply.lines.length > MAX_LINES) {
    return fail(`expected 1–${MAX_LINES} lines, got ${reply.lines.length}`);
  }

  const badIndex = reply.lines.findIndex(
    (l) => !l || typeof l.text !== 'string' || l.text.trim() === '' || typeof l.confident !== 'boolean',
  );
  if (badIndex !== -1) return fail(`line ${badIndex + 1} is missing text or confident`);

  const lines = reply.lines.map((l) => ({ text: l.text.trim(), confident: l.confident }));
  return { ok: true, value: { status: 'ok', lines } };
}

const CHECK_STATUSES = ['ok', 'wrong', 'unsure'];

const optionalText = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

/** Exactly one verdict per line 2…lineCount, in order; wrong/unsure must carry a note. */
export function validateCheck(reply, lineCount) {
  if (!reply || typeof reply !== 'object') return fail('reply is not an object');
  const { verdicts } = reply;
  if (!Array.isArray(verdicts)) return fail('verdicts is not an array');
  if (verdicts.length !== lineCount - 1) {
    return fail(`expected ${lineCount - 1} verdicts, got ${verdicts.length}`);
  }

  for (const [i, v] of verdicts.entries()) {
    const expectedLine = i + 2;
    if (!v || v.line !== expectedLine) return fail(`verdict ${i + 1} is for line ${v?.line}, expected ${expectedLine}`);
    if (!CHECK_STATUSES.includes(v.status)) return fail(`line ${expectedLine} has unknown status ${v.status}`);
    if (v.status !== 'ok' && !optionalText(v.note)) return fail(`line ${expectedLine} is ${v.status} with no note`);
    if (typeof v.confidence !== 'number' || v.confidence < 0 || v.confidence > 1) {
      return fail(`line ${expectedLine} has confidence ${v.confidence}, expected 0–1`);
    }
    if (v.alternativeReading != null && typeof v.alternativeReading !== 'string') {
      return fail(`line ${expectedLine} has a non-text alternativeReading`);
    }
    if (v.followsUnderAlternative != null && typeof v.followsUnderAlternative !== 'boolean') {
      return fail(`line ${expectedLine} has a non-boolean followsUnderAlternative`);
    }
  }

  return {
    ok: true,
    value: {
      verdicts: verdicts.map((v) => ({
        line: v.line,
        status: v.status,
        confidence: v.confidence,
        alternativeReading: optionalText(v.alternativeReading),
        followsUnderAlternative: v.followsUnderAlternative === true,
        note: v.status === 'ok' ? null : optionalText(v.note),
        hint: v.status === 'ok' ? null : optionalText(v.hint),
      })),
      correctedLine: optionalText(reply.correctedLine),
      finalAnswer: optionalText(reply.finalAnswer),
    },
  };
}
