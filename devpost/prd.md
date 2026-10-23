---
doc: prd
status: approved
---

# Correct Me — Product Requirements

A web app for students practicing math. They upload a photo of their handwritten working, and Correct Me finds the first line where the reasoning broke and says what went wrong there, without solving the problem for them.
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

## The Core Journey
Develops `scope.md > The Core Loop` and `scope.md > What "Working" Looks Like`.

1. **Arrive.** The student opens Correct Me and sees the name, a one-line promise, and a large upload box.
2. **Upload.** They choose one photo of their handwritten working. Line 1 of the working is the question (e.g. `I = ∫ x·cos x dx`).
3. **Reading.** Their photo appears right away, with "Reading your problem..." and a red-pen line moving down the page.
4. **Confirm the lines.** On a laptop, the photo sits on the left and the numbered lines the app read sit on the right, as editable rows on ruled notebook lines. Line 1 is marked as the question. Lines the app couldn't read confidently show a "?". The student fixes any misread line.
5. **Check.** They press **Check**, the red button directly below the last line.
6. **Verdict.** Lines are judged from the top, each against the ones before it:
   - Confident correct lines get a green tick.
   - The **first** wrong line gets a red cross, plus a handwritten note naming the kind of mistake and a hint question. It never gets the corrected line or the answer.
   - Lines after the red cross are greyed out as "not checked".
   - A line the app is unsure about gets an amber circled "?" and checking carries on below it.
7. **Fix.** The student edits any line. The marks stay on screen so the hint stays visible. The edited line gets an "edited" mark, every line below fades to "needs re-check", and the button becomes **Check again**.
8. **Check again** re-judges every line from the top using the current text. Repeat until the result is "No mistakes found."

**Success:** in the demo, the planted sign error on line 5 is flagged. After fixing line 5, line 6 is flagged next because it still carries the old sign. After fixing line 6, the result is "No mistakes found."

## Screens and Layout
One page that moves through states. It has no other screens.

- **Header (always):** the name **Correct Me**, then the line: *"Upload your handwritten working. I'll check your solution, and if it's wrong, I'll find where it went wrong, but I won't solve it for you."*
- **Start state:** a large upload box below the header, for one image at a time.
- **Working state, on a laptop:** two columns. **Left:** the uploaded photo, so the student can compare it with what the app read. **Right:** the numbered, editable lines on ruled notebook lines, with the **Check** button directly below the last line. A small **"Upload a different photo"** link is nearby.
- **Working state, on a narrow (phone-width) screen:** the photo stacks above the lines.

## Look and Feel
- **Overall:** modern, classy, clean, and calm, like a good exercise book. References: Apple Notes and Notion, but calmer. Plenty of space, no heavy shadows or gradients.
- **Paper:** warm cream, not stark white, with faint blue ruled lines and a thin red margin line on the left.
- **The student's work:** clean printed math in a textbook math font (e.g. STIX Two or Latin Modern), not fake handwriting. Clean print makes a misread obvious.
- **The teacher's marks:** the only handwriting on the page. The red cross, notes, and hint questions look like a teacher's red pen in the margin, in a handwriting font like Caveat. *Whose words are whose should be obvious at a glance.*
- **Color meanings:** ticks are green. Crosses and notes are red ink. "Unsure" is an amber or pencil-grey circled "?". "Not checked" and "needs re-check" lines fade to light grey pencil.
- **Interface text:** one simple sans-serif font for buttons and labels.
- **Main button:** **Check** / **Check again**, in red-pen color.
- **Loading:** a red-pen line moving down the photo with "Reading your problem...". *No spinner in the middle of a blank screen.*

## Features and Behavior

### Upload
- [ ] The start screen shows the name, the one-line promise, and a large upload box. Nothing else competes with it.
- [ ] Only one image can be uploaded at a time.
- [ ] After upload, the photo appears immediately, before any lines are read.

### Reading the Handwriting
Develops `scope.md > The Core Loop` step 2.
- [ ] While reading, the photo shows "Reading your problem..." with a moving red-pen line, and no blank-screen spinner.
- [ ] Each handwritten line becomes one numbered, editable row in the right column, in clean printed math.
- [ ] Line 1 is labeled as **the question** and is never ticked or crossed.
- [ ] A line the app couldn't read confidently shows a small "?" with "not sure I read this right".
- [ ] **Check** stays disabled until the student has edited or confirmed every "?" line. *(Added at the build checkpoint: a misread should never be blamed on the student.)*
- [ ] The app never invents lines that aren't on the page.
- [ ] If the photo doesn't start with the question, the student can type the question into line 1.

### Checking a Solution
Develops `scope.md > The Unique Kernel`.
- [ ] Pressing **Check** judges each line against the lines before it, starting from line 2.
- [ ] Every confidently correct line before the first mistake gets a green tick.
- [ ] The first wrong line gets a red cross and a handwritten margin note naming the kind of mistake (e.g. "Sign error while integrating") plus a hint question (e.g. "What do you get when you differentiate cos x?").
- [ ] The note and the hint **never** contain the corrected line, the right value for that step, or the final answer.
- [ ] Lines after the red cross are greyed out and labeled "not checked".
- [ ] If every line gets a confident tick, the app says clearly: **"No mistakes found."**
- [ ] The verdict depends on the student's own lines, not on a known final answer. In the demo, line 6 is flagged after line 5 is fixed.

### Unsure Verdicts
The learner's principle: *a confident wrong verdict is worse than an honest "I'm not sure", because students would trust it.*
- [ ] A line the app can't confidently judge gets an amber or pencil-grey circled "?" (not red, not a cross) and a handwritten note like "Not sure this follows from line X. Worth checking yourself." It may include a hint question but never an answer. It should feel like a teacher's "hmm?", not a point against the student.
- [ ] Checking **continues** past an unsure line, treating it as correct.
- [ ] If the student confirmed a "?" line without editing it and the checker still calls it wrong, it shows as unsure with "I might have misread this line." The student is never crossed for the app's misread. *(Build checkpoint.)*
- [ ] The checker gives a confidence for every line, and the code, not the prompt, turns low-confidence verdicts into unsure. *(Build checkpoint: asking for "unsure" alone never produced one.)*
- [ ] If the checker says a line is wrong but would be correct under another reading of the same written notation (e.g. sin x² as (sin x)²), the code shows it as unsure: "This could also be read as (sin x)². Which did you mean?" A different value or sign is never an alternative reading, so real mistakes keep their cross. *(Build checkpoint: the checker was 0.96 sure on an ambiguous line, so confidence alone can't be trusted.)*
- [ ] If a later line gets a red cross, its note adds that this verdict assumes line X was right, which the app wasn't sure about.
- [ ] If the check reaches the end with no cross but one or more unsure lines, the result is **"No mistakes found, but I wasn't sure about line X. Check that one yourself."**, not a clean "No mistakes found."
- [ ] A clean "No mistakes found." appears only when every line is a confident tick.

### Editing and Re-checking
Develops `scope.md > The Core Loop` step 5.
- [ ] Any line can be edited at any time, not just the red one.
- [ ] After a verdict, the ticks, cross, note, and hint stay visible while the student edits, so they can keep reading the hint.
- [ ] The edited line shows a small "edited" mark.
- [ ] Every line **below** the edited line fades to "needs re-check". Ticks **above** it stay solid.
- [ ] Editing a line above the red cross fades everything from that line down in the same way.
- [ ] After any edit, the button reads **Check again**.
- [ ] **Check again** re-judges every line from the top using the current text.

### Starting Over
- [ ] A small **"Upload a different photo"** link replaces the current photo and lines with a new upload.

## States and Boundaries
- **First use:** start screen with the upload box only.
- **Reading:** the photo is visible with the red-pen animation and "Reading your problem...".
- **Lines ready:** two columns, editable lines, some possibly marked "?", and the **Check** button.
- **Verdict:** ticks, one red cross with a note and hint, "not checked" lines, and any unsure "?" marks. Or "No mistakes found." (with or without the unsure caveat).
- **Editing after a verdict:** marks stay, the edited line is marked "edited", lines below show "needs re-check", and the button reads **Check again**.
- **Unreadable photo** (blurry, blank, incomprehensible): no lines appear. A red handwritten note says something like *"I can't read this page clearly. Try another photo in better light."* There is one button to upload another photo. No half-guessed lines.
- **File can't be opened** (e.g. an iPhone HEIC photo in a browser that can't decode it): *"I can't open this file type. Please upload a JPEG or PNG."* with an upload-another option. This is never presented as a handwriting problem. *(Added during `4-spec`.)*
- **Not math** (English notes, a selfie, a drawing): an honest note, *"This doesn't look like a math solution. Correct Me only checks math working for now."*, with the same upload-another option.
- **Partly readable:** the readable lines appear normally, and unclear ones are marked "?" ("not sure I read this right") for the student to fix before checking.
- **Something failed** (no internet, AI service error), during reading or checking: the photo and every edit so far **stay as they are**. A message explains it, and a **Try again** button retries. The student never loses work.
- **Persistence:** nothing is saved between visits. Closing the page ends the session (`scope.md > Explicitly Cut`: saved history, accounts).

## Product Decisions
- **"Try a sample" is Later.** Demo with their own photo, and spend build time on the core path and unsure behavior.
- **Name: Correct Me.** Chosen by the learner. It replaces the "Red Pen" placeholder.
- **Line 1 is the question.** There's no separate problem field. If the photo lacks it, the student types it into line 1. This keeps the input to one photo.
- **The photo stays visible beside the lines** so misreads are easy to spot by comparing them.
- **Marks persist while editing.** "If the marks vanished the moment they typed, they'd lose the hint that helped them."
- **An edit invalidates only the lines below it.** Those lines depend on the changed line, and the ticks above stay valid.
- **Any line is editable**, because the real mistake, or a misread, may come before the red line.
- **Check again re-judges from the top** with the current text. That's what makes line 6 get flagged next.
- **Clean printed math for the student, red handwriting for the teacher.** Clean print makes misreads obvious, and the handwriting makes the teacher's voice distinct.
- **Honesty over confidence.** The app gives an "unsure" verdict instead of guessing, uses a "?" on uncertain reads, and never invents lines. "A confident wrong verdict is worse than an honest 'I'm not sure.'"
- **Checking continues past an unsure line** so an early hesitation doesn't leave the student with nothing, and later verdicts state that assumption.
- **No lost work on failure.** The photo and edits survive errors.

## What We're Building
- The one-page Correct Me app: the start screen, upload, the reading animation, and the two-column working view (stacked on narrow screens).
- Transcription of one photo into numbered, editable, printed-math lines, with line 1 as the question and "?" on unclear reads.
- A first-wrong-line check with ticks, one red cross with a mistake-type note and a hint question, "not checked" lines, and "No mistakes found."
- Unsure verdicts, with the carry-on rule, assumption notes, and the caveated all-clear.
- Editing with "edited" and "needs re-check" marks and **Check again**.
- Unopenable-file, unreadable, not-math, partly readable, and failure states, with no lost work.
- "Upload a different photo."

## Deferred From the POC
- **Coding solutions.** The mistake is often an idea spread over several lines (`scope.md > Later`).
- **Re-uploading a corrected photo** to continue the same check. For now, fixes happen in the edit boxes.
- **More hints when still stuck.** One hint per flagged line for now.
- **History of checks / common-mistake patterns.** Needs saved data, and saved history was cut.
- **Multiple photos/pages, PDF upload.** One photo of 5–20 lines proves the idea.

## Possible Later Enhancements
- A "Try a sample" link that loads the ∫ x·cos x example. The learner chose Later so build time goes to the core path and unsure behavior.
- A dedicated mobile app.

## Non-Goals
- **Never show the corrected line, the right value for a step, or the final answer.** This is permanent and is the kernel (`scope.md > Explicitly Cut`).
- **No accounts or login.** They aren't needed to prove the diagnosis.
- **No typing a solution from scratch.** The photo is the real workflow; typing only fixes lines.
- **No confident verdicts the app doesn't actually have.** "Unsure" exists so the app never pretends.
- **No subjects beyond math** in this version.

## Open Questions
- None blocking. Resolved at review: **"Try a sample" stays in Later.** The learner will demo with their own photo and spend build time on the core path and the unsure behavior. **The promise wording is fine for now.**
