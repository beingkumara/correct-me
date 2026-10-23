---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast — learner wants a careful look at raw AI output at the slice-2 checkpoint (their learning goal)

## Slices

- [x] **1. Your photo becomes numbered lines in the terminal**
  Becomes usable: `npm run reality-check samples/<your photo>` sends your real handwritten photo to the reader model and prints the raw reply next to the validated, numbered lines, with `confident: false` lines marked "?". Unreadable and not-math photos print their honest status instead of lines.
  Why now: The riskiest unknown in the whole plan is whether Groq's free vision model can read your handwriting at all, and whether strict JSON schema works with an image on Qwen. If it can't, the reader model has to change before anything is built on top of it. Bootstrapping (package.json, `.env.example`, startup env checks) lives here.
  PRD ref: `prd.md > Reading the Handwriting`, `prd.md > States and Boundaries` (unreadable, not math, partly readable)
  Spec ref: `spec.md > Stack`, `spec.md > Model Gateway`, `spec.md > Prompts`, `spec.md > Reply Validator`, `spec.md > External Services and Dependencies`, `spec.md > The useful unknown: can free open models do this job?`
  Build: Scaffold `package.json` (start, test, reality-check scripts; Express 5), `.env.example`, and `.gitignore` additions for `logs/`. Write `server/llm.js` (one gateway, provider/model from `.env`, strict schema, 40 s timeout, typed errors, fallback to `json_object` if strict-with-image fails), the read prompt and schema in `server/prompts.js`, read validation in `server/validate.js` with unit tests, and the read half of `scripts/reality-check.js`. Add your planted-mistake photo to `samples/`.
  Verify (mechanical): `npm test` passes the read-validation tests. `npm run reality-check samples/<photo>` exits cleanly, prints the raw reader reply and the parsed lines, and records whether strict schema was accepted. Missing `.env` keys cause a clear startup error.
  Learner check: Run the reality check on your photo. Compare the printed lines with your handwriting, line by line: are all 6 lines there, read correctly, and is any misread at least marked "?"?
  Commit: `feat: read handwritten photo into numbered lines via reality check`

- [x] **2. The red pen works in the terminal: first wrong line, hint, no leaked answer**
  Becomes usable: The reality check now also sends the lines to the checker model and prints the raw verdicts (including the private `correctedLine`/`finalAnswer`) next to the final rule-applied result: ticks, the first cross with a note and hint, "not checked" after it, unsure marks with "assumes line X", and the right all-clear message. A `--lines` text file lets you re-run the check with line 5 fixed to see line 6 get flagged.
  Why now: This is the unique kernel — diagnosing your solution instead of re-solving it. It's the second big unknown (will the free reasoning model judge line-by-line and say "unsure" honestly?), and the rules and leak guard are pure code that everything visible later depends on.
  PRD ref: `prd.md > Checking a Solution`, `prd.md > Unsure Verdicts`, `prd.md > The Core Journey` (Success)
  Spec ref: `spec.md > Prompts`, `spec.md > Reply Validator`, `spec.md > Verdict Rules`, `spec.md > Leak Guard`, `spec.md > Data Model` (Check reply, Check response)
  Build: Add the check prompt and schema, check validation, `server/rules.js` (`applyRules`), and `server/leakGuard.js` (normalize, detect, replace, log to `logs/leak-guard.jsonl`, strip private fields), each with `node:test` unit tests. Extend `scripts/reality-check.js` to run the check and accept `--lines <file>` to skip reading.
  Verify (mechanical): `npm test` passes rules, leak-guard, and validation tests (first-wrong stop, unsure carry-on with `assumes`, both all-clear kinds, RHS and `+ C` leak variants, wrong-length replies rejected). The reality check on your photo flags line 5; with line 5 fixed it flags line 6; with both fixed it reports "No mistakes found." No note or hint in the final output contains the fix.
  Learner check: Read the raw verdicts next to the final result for all three runs. Is line 5 the cross, is the hint useful without giving the answer away, and does line 6 get flagged after the fix? Try one deliberately ambiguous line and see whether "unsure" ever appears.
  Commit: `feat: check lines with first-wrong rules and leak guard`

- [ ] **3. Upload a photo in the browser and see what the app read, beside it**
  Becomes usable: `npm start`, open http://localhost:3000: the Correct Me header and promise, a large upload box, your photo shown immediately with the red-pen sweep and "Reading your problem...", then two columns — photo left, numbered editable lines on cream ruled paper right, line 1 labeled Question, unsure reads marked "?" — and the red **Check** button below the last line.
  Why now: With reading and checking proven, the first visible slice puts the real reader behind the real page and sets the notebook look everything else is drawn on.
  PRD ref: `prd.md > The Core Journey` (steps 1–5), `prd.md > Screens and Layout`, `prd.md > Look and Feel`, `prd.md > Upload`, `prd.md > Reading the Handwriting`
  Spec ref: `spec.md > Look and Feel`, `spec.md > Page Shell and Layout`, `spec.md > Session State`, `spec.md > Image Shrinker`, `spec.md > API Client`, `spec.md > Lines Editor and Marks`, `spec.md > Page Controller`, `spec.md > Server and Routes`
  Build: `server/index.js` (static files, `POST /api/read`, input checks, the `{ ok, data | error }` envelope); `public/index.html`, the three stylesheets, `state.js`, `image.js`, `api.js`, `render.js` (rows only, `textContent` only; "?" rows get a Confirm control and Check stays disabled until each is edited or confirmed), `app.js` (upload → shrink → read → render).
  Verify (mechanical): Server starts with no errors. `curl` to `/api/read` with a bad body returns `invalid_input`; with the sample photo returns `ok: true` and lines. In a browser (Playwright screenshot at 1440 px), uploading the sample shows the two-column view with numbered rows.
  Learner check: Open http://localhost:3000, upload your photo, and watch it read. Do the lines match your handwriting, can you fix a line by typing, and does the page look like the calm exercise book you pictured?
  Commit: `feat: upload photo and confirm transcribed lines in the browser`

- [ ] **4. Press Check and get the teacher's marks**
  Becomes usable: Pressing **Check** shows "Checking your working...", then green ticks, one red cross with a handwritten Caveat note and hint, greyed "not checked" lines, amber circled "?" for unsure lines with the "assumes" note, and "No mistakes found." (or the caveated version).
  Why now: This puts the kernel from slice 2 on screen — the demo's "oh, that's cool" beat.
  PRD ref: `prd.md > Checking a Solution`, `prd.md > Unsure Verdicts`, `prd.md > The Core Journey` (step 6)
  Spec ref: `spec.md > Server and Routes`, `spec.md > Lines Editor and Marks`, `spec.md > Look and Feel`, `spec.md > Data Model` (Check response)
  Build: `POST /api/check` taking `{ lines, doubtfulLines }` (confirmed-but-unedited "?" lines) through `server/check.js`; render marks, notes, hints, and result messages; Check button wiring with the loading state.
  Verify (mechanical): `curl` to `/api/check` with the demo lines returns a cross on line 5 and no `correctedLine`/`finalAnswer` in the body. Browser run: upload → Check shows ticks on 2–4, cross on 5, "not checked" on 6+.
  Learner check: Upload your photo, press Check, and read the marks. Does line 5 get the red cross with a hint you'd find useful, and are lines after it clearly greyed out?
  Commit: `feat: show ticks, first cross, hint, and results after Check`

- [ ] **5. Fix a line and Check again until no mistakes**
  Becomes usable: Editing any line keeps the marks visible, adds an "edited" mark, fades every line below to "needs re-check", and turns the button into **Check again**, which re-judges from the top. The full demo loop works: line 5 → fix → line 6 → fix → "No mistakes found."
  Why now: Completes the core journey and the second demo beat (line 6 flagged because it no longer follows from the fixed line 5).
  PRD ref: `prd.md > Editing and Re-checking`, `prd.md > The Core Journey` (steps 7–8, Success)
  Spec ref: `spec.md > Session State`, `spec.md > Page Controller`, `spec.md > Lines Editor and Marks`
  Build: `withEdit` in `state.js` (lowest edited line → `editedFrom`), "edited" and "needs re-check" rendering, Check again label and re-check flow.
  Verify (mechanical): Browser run of the full demo: Check → line 5 cross → edit line 5 → line 5 shows "edited", lines 6+ faded, button says "Check again" → Check again → line 6 cross → fix line 6 → "No mistakes found."
  Learner check: Do the whole demo yourself: fix line 5, Check again, see line 6 flagged, fix it, and get "No mistakes found."
  Commit: `feat: edit lines and check again with re-check marks`

- [ ] **6. Honest messages when things go wrong, and starting over**
  Becomes usable: A HEIC or other unopenable file gets "I can't open this file type..."; a blurry or blank photo gets the can't-read note; a non-math photo gets the not-math note — each with an upload-another button. Network, AI, malformed-reply, and rate-limit failures show a message and **Try again** without losing the photo or edits. "Upload a different photo" resets. The layout stacks below 900 px.
  Why now: The happy path is complete; these states protect the student's work and the app's honesty, and the spec lists them as required.
  PRD ref: `prd.md > States and Boundaries`, `prd.md > Starting Over`, `prd.md > Screens and Layout` (narrow screens)
  Spec ref: `spec.md > Important Failure Modes`, `spec.md > Image Shrinker`, `spec.md > API Client`, `spec.md > Server and Routes`, `spec.md > Look and Feel` (Layout)
  Build: Message and failure states in `state.js`/`render.js`/`app.js`, `withFailure` and retry of the last request, the upload-another and reset flows, the narrow-screen layout, the 429 → `rate_limited` path.
  Verify (mechanical): Browser runs: upload a `.heic`/non-image file → unsupported message; a blank image → unreadable; a non-math photo → not-math; stop the server mid-check → failure message, lines kept, Try again works after restart. Screenshot at 375 px shows the stacked layout with no horizontal scroll. `npm test` still passes.
  Learner check: Try a selfie, a blank page, and turning off Wi-Fi before pressing Check. Does each message feel honest, and do your edits survive the failure?
  Commit: `feat: honest error states, retry, and start over`

## Hands-on Checkpoints

- [x] Early usable behavior explored — after slice 2: you judge the raw reader and checker output on your own photo, which can change the prompts or models before the page is built
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: [what actually happened; real document/test/code references; unfinished work if interrupted]
Route and stops: [actual paths and symbols; guided stops completed, or reference-only route]
Edit outcome: [tried/kept/reverted/declined/not applicable; verification if changed]
Reflection: [offered/answered/declined/already covered — personal answer belongs only in the ignored profile]
Activity mode: [live app and editor, explicit static fallback, focused alternative, prior practice, or recap]

## Revisions

- Reader JSON mode is now a per-model `.env` setting (`READER_JSON_MODE=json_object`) instead of an automatic fallback; Groq's `json_validate_failed` maps to `bad_ai_reply` — Qwen accepts strict `json_schema` with an image but loops to the token limit, and an automatic retry would waste the free tier's 7K input-tokens-per-minute budget.
- Slice 2 verification uses the actual sample photo (4 lines, mistake on line 4: `− cos x` should be `+ cos x`) plus a typed 6-line `--lines` file to test the follow-on flag — the committed photo isn't the planned 6-line, line-5 demo. What the demo shows is the learner's call at the slice-2 checkpoint.
- Added `server/check.js` (checker → validate → guard → rules) so the reality check and `POST /api/check` share one pipeline; the guard runs on validated verdicts before `applyRules`, so `correctedLine`/`finalAnswer` never reach the display object — keeps the slice-4 route from duplicating the reality-check logic.
- Slice-2 checkpoint feedback (learner): Check disabled until every "?" line is edited or confirmed; a `wrong` on a confirmed-but-unedited "?" line becomes unsure ("I might have misread this line"); the checker returns per-line `confidence` and code turns verdicts below 0.75 into unsure; private fields requested in plain Unicode, with `delatex()` normalization in the leak guard as a backup — the end-to-end photo run crossed a line for the reader's misread `f`, "unsure" never appeared from prompting alone, and LaTeX private fields slipped past string matching.
- Self-reported confidence alone did not produce "unsure" for `y = sin x²` → `dy/dx = 2 sin x cos x` (`samples/lines/ambiguous-sin-x-squared.txt`): the checker said wrong at 0.96 and never considered `(sin x)²`. Learner chose a code rule: the checker also reports `alternativeReading`/`followsUnderAlternative` (restricted in the prompt to re-parsing the same notation, never a different value or sign), and `calibrate()` turns wrong-but-right-under-the-alternative into unsure. Live: sin x² → unsure; 6-line sign error → cross on 5, then 6.
- Demo photo replaced by the learner's 6-line version (sign error on line 5); `samples/sample_question.jpeg` now matches the planned demo, and the reality check flags line 5 with no leak.
- Known limitation, accepted by the learner: the leak guard catches copied answers, not reworded near-answers. With line 5 fixed, the checker once hinted "What is x·sin x − (−cos x) equal to?", one step from the answer but containing no answer string. The learner kept it (it still makes the student do the last step) rather than tighten the prompt and risk weaker hints everywhere near the deadline.
- Reader left as is for the squashed `u = x  dv = cos x dx` gap on lines 2–3 of the demo photo: the learner will fix it in the edit box during the demo, which shows the confirm-what-it-read step on a real misread.
