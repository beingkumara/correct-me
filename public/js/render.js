// Draws the state into the page. All dynamic text goes in through textContent, never innerHTML.

import { canCheck, linesNeedingReview } from './state.js';

export const MESSAGES = {
  unsupported_file: "I can't open this file type. Please upload a JPEG or PNG.",
  unreadable: "I can't read this page clearly. Try another photo in better light.",
  not_math: "This doesn't look like a math solution. Correct Me only checks math working for now.",
};

const STATUS_TEXT = { reading: 'Reading your problem...', checking: 'Checking your working...' };

const listLines = (numbers) =>
  numbers.length === 1 ? `line ${numbers[0]}` : `lines ${numbers.slice(0, -1).join(', ')} and ${numbers.at(-1)}`;

export function resultMessage(result) {
  if (!result) return '';
  if (result.kind === 'clear') return 'No mistakes found.';
  if (result.kind === 'clear_with_unsure') {
    return `No mistakes found, but I wasn't sure about ${listLines(result.lines)}. Check ${result.lines.length > 1 ? 'those' : 'that one'} yourself.`;
  }
  return `Have a look at line ${result.line}.`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function buildRow(line, index) {
  const number = index + 1;
  const row = el('li', number === 1 ? 'row row-question' : 'row');
  row.dataset.index = String(index);

  const input = el('input', 'row-input');
  input.type = 'text';
  input.value = line.text;
  input.spellcheck = false;
  input.autocomplete = 'off';
  input.setAttribute('aria-label', number === 1 ? 'Line 1, the question' : `Line ${number}`);

  row.append(el('span', 'row-number', String(number)), input, el('div', 'row-aside'), el('div', 'row-note'));
  return row;
}

/** What the right-hand margin of a row shows: a read doubt, a teacher's mark, or a small label. */
function asideKind(state, line, index) {
  if (!line.confident && !line.edited && !line.confirmed) return 'doubt';
  const mark = state.verdict?.lines[index]?.mark;
  if (mark) return mark;
  if (index === 0) return 'question';
  if (line.edited) return 'edited';
  return line.confirmed ? 'confirmed' : 'none';
}

const ASIDE = {
  doubt: (index) => {
    const confirm = el('button', 'confirm-button', 'Looks right');
    confirm.type = 'button';
    confirm.dataset.action = 'confirm';
    confirm.setAttribute('aria-label', `Line ${index + 1} looks right as read`);
    const doubt = el('div', 'read-doubt');
    doubt.append(el('span', 'read-doubt-mark', '?'), el('span', 'read-doubt-text', 'not sure I read this right'), confirm);
    return doubt;
  },
  question: () => el('span', 'row-tag', 'Question'),
  edited: () => el('span', 'read-ok', 'edited'),
  confirmed: () => el('span', 'read-ok', 'confirmed'),
  none: () => null,
  tick: () => el('span', 'mark mark-tick', '✓'),
  cross: () => el('span', 'mark mark-cross', '✗'),
  unsure: () => el('span', 'mark mark-unsure', '?'),
  not_checked: () => el('span', 'mark-label', 'not checked'),
};

const MARK_LABEL = { tick: 'correct', cross: 'mistake here', unsure: 'not sure', not_checked: 'not checked' };

function renderAside(row, kind, index) {
  const aside = row.querySelector('.row-aside');
  if (aside.dataset.kind === kind) return;
  const content = ASIDE[kind](index);
  aside.replaceChildren(...(content ? [content] : []));
  aside.dataset.kind = kind;
  const input = row.querySelector('.row-input');
  const base = index === 0 ? 'Line 1, the question' : `Line ${index + 1}`;
  input.setAttribute('aria-label', MARK_LABEL[kind] ? `${base}, ${MARK_LABEL[kind]}` : base);
}

/** The teacher's handwritten note under a crossed or unsure line. */
function renderNote(row, verdictLine) {
  const note = row.querySelector('.row-note');
  const show = verdictLine && (verdictLine.mark === 'cross' || verdictLine.mark === 'unsure');
  const parts = show
    ? [
        verdictLine.note,
        verdictLine.hint,
        verdictLine.assumes?.length ? `This assumes ${listLines(verdictLine.assumes)} was right, which I wasn't sure about.` : null,
      ].filter(Boolean)
    : [];
  const signature = JSON.stringify([verdictLine?.mark, parts]);
  if (note.dataset.signature === signature) return;
  note.dataset.signature = signature;
  note.className = `row-note${show ? ` row-note-${verdictLine.mark}` : ''}`;
  note.replaceChildren(...parts.map((text, i) => el('p', i === 1 && verdictLine.hint === text ? 'note-hint' : 'note-text', text)));
}

function renderLines(state, els, busy) {
  if (els.lines.dataset.readId !== String(state.readId)) {
    els.lines.replaceChildren(...state.lines.map(buildRow));
    els.lines.dataset.readId = String(state.readId);
  }
  [...els.lines.children].forEach((row, index) => {
    const line = state.lines[index];
    const verdictLine = state.verdict?.lines[index];
    const input = row.querySelector('.row-input');
    if (document.activeElement !== input && input.value !== line.text) input.value = line.text;
    input.disabled = busy;
    row.classList.toggle('is-not-checked', verdictLine?.mark === 'not_checked');
    renderAside(row, asideKind(state, line, index), index);
    renderNote(row, verdictLine);
  });
}

function noteFor(state) {
  if (state.phase === 'message') return MESSAGES[state.message] ?? MESSAGES.unreadable;
  if (state.phase === 'failed') return state.failure?.message ?? null;
  return null;
}

export function render(state, els) {
  const working = state.phase !== 'start';
  els.start.hidden = working;
  els.work.hidden = !working;
  if (!working) return;

  if (state.photoUrl && els.photo.getAttribute('src') !== state.photoUrl) els.photo.src = state.photoUrl;
  els.photoStack.hidden = !state.photoUrl;
  const busy = state.phase === 'reading' || state.phase === 'checking';
  els.photoStack.classList.toggle('is-busy', busy);
  els.photoStatus.textContent = STATUS_TEXT[state.phase] ?? '';

  const note = noteFor(state);
  els.note.hidden = !note;
  els.note.textContent = note ?? '';

  renderLines(state, els, busy);

  const result = state.verdict?.result;
  els.result.hidden = !result;
  els.result.textContent = resultMessage(result);
  els.result.dataset.kind = result?.kind ?? '';

  els.actions.hidden = state.lines.length === 0;
  const pending = linesNeedingReview(state);
  els.check.disabled = busy || !canCheck(state);
  els.checkGate.textContent =
    pending.length === 0 ? '' : `Fix or confirm ${listLines(pending)} first.`;
}
