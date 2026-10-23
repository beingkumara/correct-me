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
