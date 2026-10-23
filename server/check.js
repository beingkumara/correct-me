// The check pipeline shared by the reality check and POST /api/check:
// checker model → validate → calibrate (misreads, low confidence) → leak guard → rules → strip private fields.

import { chatJSON, LlmError } from './llm.js';
import { CHECK_SCHEMA, checkMessages } from './prompts.js';
import { validateCheck } from './validate.js';
import { guard, logGuardEvents } from './leakGuard.js';
import { applyRules, calibrate } from './rules.js';

/**
 * @param {string[]} lines current text, line 1 is the question
 * @param {{ doubtfulLines?: number[] }} options lines read with "?" that the student confirmed without editing
 * @returns {Promise<{ display: object, raw: string, guardEvents: object[], calibrations: object[] }>}
 *   `display` is the only thing that may reach the browser; `raw` includes the private fields.
 */
export async function checkLines(lines, { doubtfulLines = [] } = {}) {
  const { data, raw } = await chatJSON({
    role: 'checker',
    messages: checkMessages(lines),
    schema: CHECK_SCHEMA,
    name: 'check',
  });

  const checked = validateCheck(data, lines.length);
  if (!checked.ok) throw new LlmError('bad_ai_reply', `Invalid check reply: ${checked.reason}`, raw);

  const { verdicts, correctedLine, finalAnswer } = checked.value;
  const calibrated = calibrate(verdicts, { doubtfulLines });
  const guarded = guard(calibrated, { correctedLine, finalAnswer });
  const guardEvents = [...guarded.hits, ...guarded.skipped];
  await logGuardEvents(guardEvents);

  // correctedLine and finalAnswer stop here: applyRules only sees the guarded verdicts.
  const calibrations = calibrated
    .filter((v) => v.calibrated)
    .map((v) => ({ line: v.line, reason: v.calibrated, confidence: v.confidence, alternativeReading: v.alternativeReading }));
  return { display: applyRules(guarded.verdicts, lines.length), raw, guardEvents, calibrations };
}
