---
doc: scope
status: approved
---

# Red Pen *(working title)*

Upload a photo of your handwritten math solution, and it finds the first line where your reasoning broke and tells you what went wrong there, without giving you the right answer.

## The Unique Kernel
It **diagnoses your solution instead of re-solving the problem.** It respects your approach, finds the *first* line where it breaks, names the mistake, and asks a hint question. It never shows the corrected line or the final answer. General AI tools "re-solve the problem and hand me their solution. I want a diagnosis of mine."

## Who It's For
Students practicing math problems (algebra, differentiation, integration, short derivations) to sharpen their problem solving. Today, when an answer is wrong, they recheck from the top again and again and test examples. Sometimes every example gives the expected output, "and that teaches me nothing."

## The Core Loop
1. Upload a photo of a handwritten solution (usually 5–20 lines).
2. Check the numbered lines the app read from the handwriting, and fix any misread line in place.
3. Press **Check**.
4. Lines before the mistake get a green tick. The first wrong line gets a red cross, a short note on the kind of mistake, and a hint question. Lines after it are greyed out as "not checked" because they inherit the mistake.
5. Edit the wrong line in the same edit box and check again. Each check re-judges every line against the one before it, so a later line that carried the old mistake gets flagged next. Repeat until the app clearly says there are no mistakes.

They come back every time a practice answer comes out wrong.

## Inspiration & Identity
"A teacher marking my notebook with a red pen, but clean and minimal." Green ticks, one red cross, greyed-out lines after it.

## Why This Matters to the Learner
It comes from their own practice: "What excites me is an app that respects my idea, and even better, understands it, but still tells me where my reasoning broke." It also serves their learning goal of evaluating AI output, since a planted mistake makes the app's verdict something they can check.

## What "Working" Looks Like
A one-minute demo:
- Upload a handwritten solution to **∫ x·cos(x) dx** by integration by parts, with a planted mistake on line 5: **∫ sin x dx written as +cos x instead of −cos x**.
- Confirm the transcribed lines and press Check.
- Lines 1–4 are ticked, line 5 gets a red cross with "sign error while integrating" and a hint like *"What do you get when you differentiate cos x?"*, and lines 6 onward are greyed out as not checked.
- Fix line 5 in the app and check again. Lines 1–5 are now ticked, but **line 6 gets the red cross**, because it still carries the old sign. Line 5 is fixed, but line 6 no longer follows from it.
- Fix line 6 and check again: "no mistakes".

**The "oh, that's cool" beat:** the app lands on exactly the line where the mistake was planted and explains it without giving away the solution. Viewers can see the verdict is right. The second flag, on line 6, shows that the app **checks each line against the one before it, not against a known answer**.

## The POC Boundary
- One photo of a handwritten **math** solution.
- Transcription into numbered, editable lines, confirmed before checking.
- A check that finds the **first** wrong line: ticks before it, a red cross on it with the kind of mistake and a hint question, "not checked" after it.
- An "all correct" result stated clearly.
- Re-checking after editing a line in the app.

## Later
- Coding solutions, where mistakes are often an idea spread across several lines.
- Re-uploading a corrected photo.
- More hints when the student is still stuck.
- History of past checks, to see which kinds of mistakes come up most.

## Explicitly Cut
- **Showing the correct solution or final answer.** Cut permanently, because it would defeat the kernel.
- Accounts and login. Not needed to prove the diagnosis.
- Saved history. Moved to Later.
- Typing a solution from scratch instead of uploading a photo. The photo is the real student workflow, and editing covers corrections.
- Multiple photos or pages, and PDF upload. One photo of 5–20 lines proves the idea.
- A mobile app. A web page is enough for the demo.
- Coding problems in this version. The math chain of "line N follows from line N−1" is precise and checkable first.

## Open for the PRD
- Does the student give the problem statement separately, or is it read from the first line of the photo?
- The project name. "Red Pen" is only a placeholder.
