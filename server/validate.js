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
