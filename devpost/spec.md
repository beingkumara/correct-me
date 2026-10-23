---
doc: spec
status: approved
---

# Correct Me — Technical Spec

## How This Works, In Plain Language
Correct Me has three pieces:

1. **The page** (plain HTML, CSS, and JavaScript) is everything the student sees: the upload box, the photo, the numbered lines, the marks, and the buttons. Before uploading, it **shrinks the phone photo** in the browser so it's quick to send. It keeps everything for the current session (the photo, the lines, the edits, and the last verdict) in memory, so a failure never wipes the student's work.
2. **A small Node.js + Express server** runs on your laptop. It holds the Groq API key in `.env`, so **the key never reaches the browser**. It does two jobs, each one AI call:
   - **Read:** it sends the photo to a **vision model** (`qwen/qwen3.8-27b`), which returns the numbered lines and how confident it was about each one.
   - **Check:** it sends **only the current text lines** to a **text reasoning model** (`openai/gpt-oss-120b`), which judges each line as `ok`, `wrong`, or `unsure`, with a note and a hint.
3. **Your rules, in plain code, on the server.** The model only *judges*. The server *enforces*: it stops at the first wrong line and greys out everything after it, carries on past an unsure line and adds the "this assumes line X" note, picks which all-clear message to show, **checks every note and hint for a leaked answer before it's shown**, and turns any broken or incomplete AI reply into "Try again" instead of a verdict. "The prompt can't forget a rule if the rule isn't in the prompt."

Why this shape: one page doesn't need a framework, and one small server is the minimum needed to keep the key secret. Splitting reading from checking means Check always judges the student's **current edited text** and uses a model built for reasoning. Putting the rules in code makes the behavior from your PRD guaranteed instead of hoped for.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

1. **Upload.** The student picks a photo. `image.js` draws it on a canvas, resizes it so the long edge is at most 1600 px, and turns it into a JPEG (quality 0.85). The page shows the photo immediately with the red-pen sweep and "Reading your problem...".
2. **Read.** The page calls `POST /api/read` with `{ image: "data:image/jpeg;base64,..." }`. The server sends it to the reader model with the read prompt and a strict JSON schema, validates the reply, and returns `{ status, lines: [{ text, confident }] }`.
   - `status: "unreadable"` or `"not_math"` → the page shows the honest red note and the upload-another button, with no lines.
   - Invalid or failed → the page shows "Try again", and the photo stays.
3. **Confirm.** The page renders line 1 as **the question** and the rest as editable rows. Lines with `confident: false` show "?" and "not sure I read this right". The student edits, and the edits live only in the page's memory.
4. **Check.** The page calls `POST /api/check` with `{ lines: ["I = ∫ x·cos x dx", "u = x, dv = cos x dx", ...] }`, which is the current text with line 1 as the question.
5. **Judge.** The server sends the lines to the checker model and gets back per-line verdicts plus the **private** `correctedLine` and `finalAnswer` fields.
6. **Validate.** The reply must have exactly one verdict for each of lines 2…N, in order, each with a valid status. Otherwise it's a failure, which shows "Try again" and is never a verdict.
7. **Guard.** For each note and hint on a `wrong` or `unsure` line, the leak guard looks for the corrected line, its right-hand side, the final answer, or the answer's right-hand side (each with and without "+ C"), after normalizing. On a hit, it replaces the text with a generic note and hint and logs exactly what it caught.
8. **Apply rules.** `rules.js` turns the verdicts into what's displayed: ticks, the first cross, "not checked", unsure marks, assumption notes, and the result message.
9. **Strip.** `correctedLine` and `finalAnswer` are deleted. The browser receives only what it shows.
10. **Show and fix.** The page draws the marks. When the student edits line *k*, it marks that line "edited", fades lines *k+1*…N to "needs re-check", keeps the marks above, and the button becomes **Check again**. That repeats from step 4, re-judging every line from the top.

## Stack
Agreed with the learner: plain HTML/CSS/JS for the page, Node.js + Express for the server, Groq for both AI calls, no framework, no build step, no database.

| Piece | Choice | Docs | Why |
|---|---|---|---|
| Runtime | **Node.js 20.6+** (for the built-in `fetch` and `--env-file`) | https://nodejs.org/docs/latest-v20.x/api/cli.html#--env-fileconfig | Your choice; `--env-file` loads `.env` with no `dotenv` dependency |
| Server | **Express 5** | https://expressjs.com/en/5x/api.html | Your choice; serves the page and two API routes |
| Page | **Plain HTML, CSS, ES modules** | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules | Your choice: "a framework would only add weight" |
| Reader model | **`qwen/qwen3.8-27b`** on Groq (vision, **preview**) | https://console.groq.com/docs/vision | The only generally available vision model on Groq right now. It's a preview model and may be discontinued, which is why the reader can be swapped in `.env` |
| Checker model | **`openai/gpt-oss-120b`** on Groq (production, reasoning) | https://console.groq.com/docs/models | You asked for the strongest text reasoning model. It's Groq's flagship reasoning model (by my judgment; Groq publishes no ranking) |
| Structured replies | Groq **strict JSON schema** (`response_format.type: "json_schema"`, `strict: true`) | https://console.groq.com/docs/structured-outputs | Forces the reply to match our shape. Not supported with streaming, so we don't stream |
| Tests | **`node:test`** (built in) | https://nodejs.org/api/test.html | Unit tests for the pure rule and guard code, with no extra dependency |
| Fonts | Google Fonts: **STIX Two Text**, **Caveat**, **Inter** | https://fonts.google.com | From `prd.md > Look and Feel`, with system fallbacks |

**Verified on 2026-10-23 from Groq's docs:** the model IDs above; Qwen is a preview model; strict mode on both models (the docs contradict themselves on Qwen's strict support, so we verify it early); 20 MB per image-URL request and 3 images per request; about 2,048 tokens per image; no streaming with structured outputs.
**Unverified (check early in the build):** the **free-tier rate limits**, which you'll read from your Groq console (the docs page showed only Developer plan figures, e.g. Qwen at 8K tokens per minute); whether strict schema works *together with an image* on Qwen (if it doesn't, fall back to `json_object` mode plus our own validation); and the 4 MB base64 cap you mentioned (not in the current docs, though shrinking to about 1600 px keeps us far under it anyway).

## Where It Runs and How Someone Tries It
- **Runs locally** on your laptop: the Express server serves the page at **http://localhost:3000**.
- **Needs:** Node.js 20.6+, a Groq API key (free), and a modern desktop browser.
- **Start:**
  ```
  npm install
  cp .env.example .env      # then put your GROQ key in .env
  npm start                 # = node --env-file=.env server/index.js
  ```
  Open http://localhost:3000.
- **Tests:** `npm test` (= `node --test`).
- **Demo recording (for `6-ship`):** upload the real ∫ x·cos x photo with the sign error planted on line 5 → confirm the lines → Check → line 5 gets the cross and hint → fix line 5 → Check again → line 6 is flagged → fix line 6 → "No mistakes found." Record locally.
- **Submission:** a short demo video plus a public GitHub repo. `.env` is never committed, and `.env.example` holds no secrets.
- **Deployment:** optional, **only if there's spare time**. No target chosen.

## Look and Feel
Carried from `prd.md > Look and Feel` and `scope.md > Inspiration & Identity`. Defined as CSS custom properties in `public/styles/tokens.css`.

- **Paper:** warm cream `--paper: #f8f3e6`. Faint blue rules `--rule: #c9d8ea`, drawn as a `repeating-linear-gradient` behind the line rows at a fixed row height (`--row-h: 46px`) so every editable row sits on a ruled line. Thin red margin line `--margin: #e3a5a5` on the left.
- **Ink:** text `--ink: #1f2a3a`. Ticks `--green: #237a4b`. Crosses, notes, and the main button `--red: #c3202c`. Unsure `--amber: #b7791f`, circled "?". "Not checked" and "needs re-check" lines at `opacity: 0.38` in pencil grey `--pencil: #a2a7ae`.
- **Type:** student lines in **STIX Two Text** (printed math). Teacher marks, notes, hints, and result messages in **Caveat**. Buttons and labels in **Inter**. Each has system fallbacks.
- **Feel:** spacious and calm, like Apple Notes or Notion but quieter. No heavy shadows or gradients (except the ruled lines). Generous whitespace.
- **Layout:** two columns at ≥ 900 px (photo left, sticky; lines right). Stacked below 900 px, photo on top.
- **Loading:** a 2 px red line animated with `transform: translateY` down the photo, plus "Reading your problem..." and "Checking your working..." for Check. No blank-screen spinner. With `prefers-reduced-motion`, the line holds still.
- **Copy tone:** a kind, brief teacher. Handwritten notes are short sentences or questions.
- **Math as text:** lines are plain Unicode text (∫ · − ² √ π) shown in STIX Two inside ordinary inputs. **No LaTeX rendering** (see Simplified).

## Components

### Page Shell and Layout — `public/index.html`, `public/styles/*`
The header (name and promise), the start state with the upload box, and the working state with two columns. One page that switches between states by toggling sections, with no routing.
PRD ref: `prd.md > Screens and Layout`, `prd.md > Look and Feel`.

### Session State — `public/js/state.js`
Holds the in-memory session and nothing else: `{ phase, photoUrl, lines, verdict, editedFrom }`. It exposes pure update functions that return a new state (`withLines`, `withEdit`, `withVerdict`, `withFailure`). Nothing is persisted, so closing the tab ends the session.
PRD ref: `prd.md > States and Boundaries` (persistence, no lost work).

### Image Shrinker — `public/js/image.js`
Takes the chosen `File`, decodes it with `createImageBitmap`, draws it on a canvas so the long edge is ≤ 1600 px, and exports `image/jpeg` at 0.85 as a data URL. It accepts JPEG, PNG, and WebP. If the browser can't decode the file (e.g. an iPhone HEIC photo in Chrome), it sets `message: 'unsupported_file'` and shows **"I can't open this file type. Please upload a JPEG or PNG."** It never shows the handwriting message, because the handwriting isn't the problem (learner decision, same honesty rule as the rest of the app). Nothing is sent to the server.
PRD ref: `prd.md > Upload`.

### API Client — `public/js/api.js`
`readPhoto(dataUrl)` and `checkLines(lines)` wrap `fetch` with a 45-second timeout. Any network error, timeout, non-200 response, or `{ ok: false }` becomes a typed failure the page shows as "Try again", with state untouched.
PRD ref: `prd.md > States and Boundaries` (something failed).

### Lines Editor and Marks — `public/js/render.js`
Draws the numbered rows on ruled lines: line 1 labeled **Question**, the editable inputs, the "?" for unconfident reads, ticks and crosses, the amber circled "?", margin notes and hints in Caveat, "not checked", "edited", "needs re-check", the result message, and the **Check** / **Check again** button directly below the last line. All dynamic text goes in through `textContent`, never `innerHTML`.
PRD ref: `prd.md > Reading the Handwriting`, `prd.md > Checking a Solution`, `prd.md > Unsure Verdicts`, `prd.md > Editing and Re-checking`.

### Page Controller — `public/js/app.js`
Wires the events together: upload → shrink → read → render; input on line *k* → `withEdit(k)` (marks stay, lines below are flagged for re-check, the button label changes); Check → check → render; "Upload a different photo" → reset; "Try again" → repeat the last failed request with the current state.
PRD ref: `prd.md > The Core Journey`, `prd.md > Starting Over`.

### Server and Routes — `server/index.js`
Express 5 app: `express.static('public')`, `express.json({ limit: '8mb' })`, `POST /api/read`, `POST /api/check`. It validates input at the boundary (the image must be a `data:image/` URL; `lines` must be an array of 2–40 strings, each ≤ 300 characters) and responds with a single envelope shape: `{ ok: true, data }` or `{ ok: false, error: { kind, message } }`. Error kinds are `invalid_input`, `ai_failed`, `bad_ai_reply`, and `rate_limited`. Detailed errors are logged on the server, and the browser gets a friendly message.

### Model Gateway — `server/llm.js`
**The one small module that talks to AI providers.** `chatJSON({ role: 'reader' | 'checker', messages, schema })` reads `READER_*` or `CHECKER_*` settings from the environment and POSTs to `${BASE_URL}/chat/completions` (OpenAI-compatible) with `response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } }` (or plain `{ type: 'json_object' }` when `<ROLE>_JSON_MODE=json_object`, which the Qwen reader needs) and a 40-second `AbortController` timeout. It parses `choices[0].message.content` as JSON and throws a typed error if anything fails. Because Groq and Gemini both offer OpenAI-compatible endpoints, switching between them is an `.env` change. Claude would need a small adapter in this same file, which is not built now.
Implements the learner's requirement: "The model call should sit behind one small module, with the provider and model set in .env."

### Prompts — `server/prompts.js`
- **Read prompt:** transcribe each handwritten line exactly as written, *including mistakes*; never fix, complete, or invent lines; use plain Unicode math; mark `confident: false` for any line you're not sure you read correctly; report `unreadable` or `not_math` instead of guessing.
- **Check prompt:** line 1 is the question. For each line 2…N, judge only whether it **follows correctly from the question and the lines before it, as written**. Don't judge it against your own solution path, and accept valid alternative methods. Use `unsure` whenever you are not confident, because a confident wrong verdict is worse than "unsure". For `wrong` lines, name the kind of mistake briefly and ask one hint question. Never state the corrected line, the right value, or the final answer in `note` or `hint`. Separately, fill `correctedLine` (for the first wrong line) and `finalAnswer`, which are private and used only for checking.
- The rules about stopping, greying, and messages are **not** in the prompt. They live in `rules.js`.

### Reply Validator — `server/validate.js`
Checks the parsed replies against what the rules need, beyond the schema:
- **Read:** `status` is one of `ok | unreadable | not_math`. If `ok`: 1–40 lines, each `text` a non-empty string.
- **Check:** exactly **N−1** verdicts with `line` values 2…N in order. Each `status` is one of `ok | wrong | unsure`. Every `wrong` or `unsure` has a non-empty `note`.
- Any violation → `bad_ai_reply` → "Try again". **Never a partial verdict.**

### Verdict Rules — `server/rules.js`
A pure function, `applyRules(verdicts, lineCount)`, that returns `{ lines: [{ line, mark, note, hint, assumes }], result }`:
- `mark` is one of `question | tick | cross | unsure | not_checked`.
- It walks lines 2…N. `ok` gives a tick. `unsure` gives an unsure mark, records the line, and continues. The first `wrong` gives a cross and stops; every later line is `not_checked`.
- If a cross comes after one or more unsure lines, `assumes: [those lines]` is added, and the page writes "This assumes line X was right, which I wasn't sure about."
- `result`: `{ kind: 'mistake', line }` | `{ kind: 'clear' }` (every line ticked) | `{ kind: 'clear_with_unsure', lines }` → "No mistakes found, but I wasn't sure about line X. Check that one yourself."
PRD ref: `prd.md > Checking a Solution`, `prd.md > Unsure Verdicts`.

### Leak Guard — `server/leakGuard.js`
A pure `guard(lines, privateRefs)` that returns `{ lines, hits }`, plus a logger.
- **Fragments to look for:** `correctedLine`; its **right-hand side** (the text after the last `=`); `finalAnswer`; its right-hand side. Each comes both as written and with a trailing `+ C` / `+ c` / `+ constant` removed.
- **Normalize** both the fragments and the note and hint text: lowercase; remove all whitespace; **remove** `·` `×` `∙` `⋅` `*` (so `x·sin x`, `x*sin x`, and implicit `x sin x` all match; found by testing the rule while drafting); map `−` `–` `—` `‐` `-` → `-`; remove a trailing `+c`.
- **Hit** = a normalized fragment appears as a substring of the normalized note or hint. Fragments **shorter than 3 characters** after normalizing are skipped (to avoid false alarms on `x` or `1`) and logged as `skipped_short`.
- **On a hit:** the note becomes "There's a mistake on this line." and the hint becomes "Compare this line with the one before it. What changed, and is that step allowed?" (for unsure lines: "Not sure this follows. Worth checking yourself.").
- **Log** every hit and skip as one JSON line appended to `logs/leak-guard.jsonl` and echoed with `console.warn`: `{ time, line, field, fragmentType, fragment, original }`. This lets you count how often the model tries to leak.
- `correctedLine` and `finalAnswer` are **deleted** after the guard runs and never reach the response.
Implements the learner's requirements: hint and note are checked in code, catching the RHS-only case and formatting tweaks, with logging.

## Data Model

### Browser (in memory, `state.js`)
```js
{
  phase: 'start' | 'reading' | 'lines' | 'checking' | 'verdict' | 'message' | 'failed',
  photoUrl: 'data:image/jpeg;base64,...',
  lines: [{ text: 'I = ∫ x·cos x dx', confident: true, edited: false }, ...],
  verdict: null | { lines: [{ line, mark, note, hint, assumes }], result },
  editedFrom: null | 5,      // lowest edited line since the last check; lines below show "needs re-check"
  failure: null | { kind, message, retry: 'read' | 'check' },
  message: null | 'unsupported_file' | 'unreadable' | 'not_math'
}
```
- **Where:** a JS variable in the page. **Updated:** only through the pure `with*` functions. **Leave and come back:** gone, by design (`prd.md > States and Boundaries`, persistence).

### Read reply (reader model → server; strict schema)
```json
{ "status": "ok", "lines": [ { "text": "I = ∫ x·cos x dx", "confident": true } ] }
```

### Check reply (checker model → server; strict schema)
```json
{
  "verdicts": [
    { "line": 2, "status": "ok", "note": null, "hint": null },
    { "line": 5, "status": "wrong", "note": "Sign error while integrating.", "hint": "What do you get when you differentiate cos x?" }
  ],
  "correctedLine": "∫ sin x dx = −cos x",
  "finalAnswer": "I = x·sin x + cos x + C"
}
```
In strict mode, optional values are `type: ["string", "null"]`, every property is listed in `required`, and every object has `additionalProperties: false`.

### Check response (server → browser): the private fields are gone
```json
{ "ok": true, "data": { "lines": [ { "line": 5, "mark": "cross", "note": "...", "hint": "...", "assumes": [] } ], "result": { "kind": "mistake", "line": 5 } } }
```

### Server logs
`logs/leak-guard.jsonl` is local only and gitignored.

## File Structure
```
hackathon-project/
├── public/                      # served as-is; no build step
│   ├── index.html               # header, start state, working state markup
│   ├── styles/
│   │   ├── tokens.css           # palette, fonts, spacing, row height
│   │   ├── notebook.css         # paper, ruled rows, margin line, marks, notes
│   │   └── layout.css           # two columns / stacked, upload box, buttons, loading line
│   └── js/
│       ├── app.js               # page controller: wires events → state → render
│       ├── state.js             # in-memory session + pure with* updaters
│       ├── render.js            # draws rows, marks, notes, results (textContent only)
│       ├── api.js               # fetch wrappers for /api/read and /api/check, timeouts
│       └── image.js             # shrink photo to ≤1600px JPEG data URL
├── server/
│   ├── index.js                 # Express app, static files, the two routes, input checks
│   ├── llm.js                   # Model Gateway: one module, provider/model from .env
│   ├── prompts.js               # read + check prompts and JSON schemas
│   ├── validate.js              # reply validation → bad_ai_reply on any mismatch
│   ├── rules.js                 # first-wrong / unsure / result logic (pure)
│   └── leakGuard.js             # normalize, detect, replace, log, strip private fields
├── scripts/
│   └── reality-check.js         # runs one photo through read + check, prints raw + final
├── test/
│   ├── rules.test.js
│   ├── leakGuard.test.js
│   └── validate.test.js
├── samples/                     # the planted-mistake photo (committed, so the repo shows the real input)
├── logs/                        # leak-guard.jsonl (gitignored)
├── .env.example                 # keys/models with no secrets
├── package.json                 # "start", "test", "reality-check" scripts
├── README.md
└── devpost/                     # Devpost learning workspace
```

## External Services and Dependencies

### Groq API (both models)
- **Endpoint:** `POST https://api.groq.com/openai/v1/chat/completions`. Docs: https://console.groq.com/docs/api-reference#chat-create
- **Auth:** header `Authorization: Bearer $GROQ_API_KEY`. Get a key at https://console.groq.com/keys
- **Read payload:**
  ```json
  { "model": "qwen/qwen3.8-27b",
    "messages": [{ "role": "user", "content": [
      { "type": "text", "text": "<read prompt>" },
      { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,..." } } ] }],
    "response_format": { "type": "json_schema", "json_schema": { "name": "read", "strict": true, "schema": { } } },
    "temperature": 0 }
  ```
- **Check payload:** same shape with `"model": "openai/gpt-oss-120b"`, a system message holding the check prompt, a user message listing the numbered lines, and `"name": "check"`.
- **Response:** `choices[0].message.content` is a JSON string.
- **Limits and cost:** free tier. Exact free-tier limits are **to be read from your Groq console** (the docs showed Developer-plan Qwen limits of 30 RPM / 8K TPM / 1K RPD). One check is two calls at most, plus about 2K image tokens per read. A `429` → `rate_limited` → "Too many checks in a row. Wait a minute and try again."
- **Model status:** Qwen 3.8 27B is a **preview** model (https://console.groq.com/docs/models). If it disappears, swap `READER_MODEL` (and `READER_BASE_URL`/`READER_API_KEY` for another provider).

### `.env` settings
```
READER_BASE_URL=https://api.groq.com/openai/v1
READER_API_KEY=            # your Groq key
READER_MODEL=qwen/qwen3.8-27b
READER_JSON_MODE=json_object   # Qwen loops under strict mode with an image
CHECKER_BASE_URL=https://api.groq.com/openai/v1
CHECKER_API_KEY=           # your Groq key (same one is fine)
CHECKER_MODEL=openai/gpt-oss-120b
CHECKER_JSON_MODE=json_schema
PORT=3000
```
The server checks that all of these are present at startup and exits with a clear message if any is missing.

### Google Fonts
STIX Two Text, Caveat, and Inter, loaded with `display=swap`. Without a network connection the page falls back to system fonts, though the app needs the network for Groq anyway.

## Important Failure Modes
- **The AI reply is malformed, incomplete, or the wrong length** → `bad_ai_reply` → "Something went wrong reading the reply. Try again." The photo and edits are kept. *(Learner requirement: never a verdict.)*
- **No internet, a Groq error, or a timeout (40 s server / 45 s page)** → "Couldn't reach the checker. Your photo and edits are safe." plus **Try again**, which repeats the same request with the current state.
- **The model leaks the fix in a note or hint** → the leak guard swaps in the generic note and hint and logs the catch. Reworded leaks can get through string matching, and that limit is accepted.
- **The browser can't open the file (e.g. HEIC in Chrome)** → "I can't open this file type. Please upload a JPEG or PNG." plus the upload-another button. This is never presented as a handwriting problem.
- **Qwen misreads the handwriting** → the student fixes it in the edit rows. "?" marks the lines the model wasn't sure about. Measured in the first build step (see the investigation below).
- **Rate limited (429)** → a plain "wait a minute" message with the state kept.

## What Was Simplified and Why
- **Plain Unicode math in text inputs** instead of rendered LaTeX (e.g. KaTeX) with a math editor. Students edit lines as simple text, and STIX Two keeps it looking like printed math. Fractions and powers read as `(x+1)/(x−1)`, `x²`. The fuller version would add a math renderer and a richer editor.
- **String-matching leak guard** instead of a second AI "does this give the answer away?" call. It's deterministic, free, and its catches are logged. The fuller version would add an LLM review and a retry call, deferred by the learner.
- **Generic hint on a leak** instead of retrying the check call. The fuller version would retry once with a stricter prompt.
- **Session kept in page memory** instead of `localStorage` or a database. The PRD wants nothing saved between visits.
- **OpenAI-compatible gateway only** (Groq now, Gemini by `.env` change). A Claude adapter would be a small addition to `llm.js` if needed.
- **Local only.** Deployment is optional, if there's spare time.

## Decisions and Open Issues

### Learner decisions
- **Plain HTML/CSS/JS plus a small Node + Express server**, no framework or build step. "It's one page, so a framework would only add weight." The server exists to keep the key out of the browser.
- **Groq for both calls**, because it's free. Accepted tradeoff: open models may read handwriting less well and be less honest about saying "unsure". Mitigated by the reality check and the swappable models.
- **Reader and checker are separate `.env` settings**, swappable independently.
- **Two AI calls with the rules in code.** The model judges and the code enforces.
- **The checker is the strongest text reasoning model on Groq**, looked up from the docs: `openai/gpt-oss-120b`.
- **Leak guard in code:** it catches the full corrected line, the right-hand side alone, the final answer, and the answer's right-hand side, with and without "+ C", across spacing, multiplication-sign, and minus-sign variants. Every catch is logged with exactly what it caught. On a catch, a generic hint is shown, and a retry call is for later.
- **The model may hold the answer privately** as reference for the guard, as long as it's removed before anything reaches the browser.
- **A malformed or incomplete AI reply is a failure** ("Try again"), never a verdict.
- **Shrink photos before sending.**
- **An unopenable file gets its own honest message** ("I can't open this file type. Please upload a JPEG or PNG."), not the can't-read-handwriting one, because the handwriting isn't the problem.
- **Accepted the agent-proposed details:** the 1600 px shrink, the timeouts, the 3-character guard minimum, and plain Unicode math.
- **The sample photo is committed to the public repo** so people looking at the repo can see the real input.
- **No database, no accounts, nothing that needs a build step.** Runs locally; deploy only with spare time.

### Implementation details derived from those decisions (agent)
- The 1600 px / JPEG 0.85 shrink target, the timeouts, the input limits (2–40 lines, ≤ 300 characters each), and the 3-character minimum fragment length for the guard (prevents false alarms on fragments like `x`).
- `temperature: 0` for both calls.
- `node --env-file` instead of `dotenv`, and `node:test` for unit tests.

### The useful unknown: can free open models do this job?
- **Learner's uncertainty:** whether Groq's open vision model reads handwriting well enough, and whether the models will honestly say "unsure" instead of guessing. This is also the learner's goal of evaluating AI output instead of trusting it.
- **Agreed investigation (first build step):** `npm run reality-check samples/<your photo>` runs your real planted-mistake photo through both calls and prints the **raw model replies** next to the final, rule-applied result.
- **Evidence needed:** (1) all 6 lines transcribed correctly, or the misreads at least marked `confident: false`; (2) line 5 is flagged `wrong` with a note and hint that don't give the fix away; (3) after fixing line 5 in the input, line 6 is flagged; (4) clean lines give the clean all-clear. Also try one deliberately ambiguous line to see whether `unsure` ever appears.
- **If it falls short:** first tighten the prompts. Then swap `READER_MODEL` or `CHECKER_MODEL` in `.env` (e.g. Gemini through its OpenAI-compatible endpoint). Neither needs a rewrite.

### Open issues
- **Free-tier rate limits.** The learner will check them in the Groq console **before the build**. Not blocking spec approval.
- ~~**Strict JSON schema with an image on Qwen.**~~ Resolved in build slice 1: strict is accepted but the model loops until it runs out of tokens (`json_validate_failed`, even at 4,096 tokens). `json_object` mode plus `validate.js` reads the sample in about 106 tokens. Set via `READER_JSON_MODE=json_object`.
- **Free-tier rate limit observed:** Qwen reader is 7,000 input tokens per minute (about 3 reads a minute at ~2.1K tokens per image). A 429 maps to `rate_limited`.
- Carried from `prd.md > Open Questions`: none blocking ("Try a sample" is Later, and the promise wording is fine).
