// Prompts and strict JSON schemas for the two AI calls.
// Rules about stopping, greying, and result messages are NOT here — they live in rules.js.

export const READ_PROMPT = `You are transcribing a photo of a student's handwritten math working.

Rules:
- Transcribe each handwritten line of working as one entry, top to bottom, EXACTLY as written — including any mistakes. Never fix, simplify, complete, or add lines.
- A line that wraps or has a stacked fraction (e.g. d/dx written above and below) is still one line.
- Use plain Unicode math, not LaTeX: ∫ · − ² ³ √ π θ, fractions as (a)/(b), derivatives as d/dx(…).
- Keep the student's own symbols and letters (e.g. "I = …").
- Set "confident": false for any line where you are not sure you read every symbol correctly.
- If the photo is too blurry, blank, or illegible to transcribe, return status "unreadable" with no lines.
- If the photo is not handwritten math working (prose, a selfie, a drawing), return status "not_math" with no lines.
- Otherwise return status "ok".

Reply only with JSON: {"status": "ok" | "unreadable" | "not_math", "lines": [{"text": string, "confident": boolean}]}`;

export const READ_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['ok', 'unreadable', 'not_math'] },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          confident: { type: 'boolean' },
        },
        required: ['text', 'confident'],
        additionalProperties: false,
      },
    },
  },
  required: ['status', 'lines'],
  additionalProperties: false,
};

export function readMessages(imageDataUrl) {
  return [
    {
      role: 'user',
      content: [
        { type: 'text', text: READ_PROMPT },
        { type: 'image_url', image_url: { url: imageDataUrl } },
      ],
    },
  ];
}

export const CHECK_PROMPT = `You are a careful math teacher marking a student's handwritten working, line by line.

Line 1 is the question. For EACH line from 2 to N, decide only whether that line follows correctly from the question and the lines before it, exactly as the student wrote them.
- Treat earlier lines as given, even if one of them is wrong: judge each step, not the final result.
- A line that starts with "=" continues the expression from the line before it.
- Do NOT compare against your own solution path. Accept any valid method, notation, or order of steps.
- Missing "+ C" on an indefinite integral is not a mistake unless the line is presented as the final answer and the student clearly omits it everywhere; prefer "ok".

Statuses:
- "ok": you are confident the line follows correctly.
- "wrong": you are confident the line does NOT follow. Give "note": a short name for the kind of mistake (e.g. "Sign error while integrating."), and "hint": ONE short question that helps the student find it themselves (e.g. "What do you get when you differentiate cos x?").
- "unsure": you are not confident either way, or the line is ambiguous or hard to read. Give "note" saying what you're unsure about, and optionally a "hint" question. A confident wrong verdict is worse than "unsure", because students trust it.

For "ok" lines, "note" and "hint" are null.

For EVERY line also give "confidence": a number from 0 to 1, the probability that your status for that line is right. Be honest and calibrated, not polite:
- Below 0.7 when the verdict depends on how ambiguous notation is read (e.g. "1/2x" could mean 1/(2x) or x/2), on steps the student skipped that you can't verify, or on writing that may have been transcribed wrongly.
- Above 0.9 only when there is exactly one sensible reading and you checked the step carefully.

NEVER put the corrected line, the right value for a step, or the final answer in "note" or "hint". The student must find the fix themselves.

Write ALL text — notes, hints, and the private fields below — in the same plain Unicode math as the student's lines (∫ · − ² √ π, fractions as (a)/(b)). Never use LaTeX (no backslashes, no $, no \\frac or \\int).

Separately, fill these PRIVATE fields (never shown to the student, used only to check you didn't leak them):
- "correctedLine": the corrected version of the FIRST wrong line, or null if no line is wrong.
- "finalAnswer": the correct final answer to the question, or null if you can't tell.

Reply only with JSON: {"verdicts": [{"line": number, "status": "ok"|"wrong"|"unsure", "confidence": number, "note": string|null, "hint": string|null}], "correctedLine": string|null, "finalAnswer": string|null}. Include exactly one verdict for every line from 2 to N, in order.`;

const nullableString = { type: ['string', 'null'] };

export const CHECK_SCHEMA = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          line: { type: 'integer' },
          status: { type: 'string', enum: ['ok', 'wrong', 'unsure'] },
          confidence: { type: 'number' },
          note: nullableString,
          hint: nullableString,
        },
        required: ['line', 'status', 'confidence', 'note', 'hint'],
        additionalProperties: false,
      },
    },
    correctedLine: nullableString,
    finalAnswer: nullableString,
  },
  required: ['verdicts', 'correctedLine', 'finalAnswer'],
  additionalProperties: false,
};

export function checkMessages(lines) {
  const numbered = lines
    .map((text, i) => (i === 0 ? `Line 1 (the question): ${text}` : `Line ${i + 1}: ${text}`))
    .join('\n');
  return [
    { role: 'system', content: CHECK_PROMPT },
    { role: 'user', content: `${numbered}\n\nN = ${lines.length}.` },
  ];
}
