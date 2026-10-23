// Draws the state into the page. All dynamic text goes in through textContent, never innerHTML.

import { canCheck, linesNeedingReview } from './state.js';

export const MESSAGES = {
  unsupported_file: "I can't open this file type. Please upload a JPEG or PNG.",
  unreadable: "I can't read this page clearly. Try another photo in better light.",
  not_math: "This doesn't look like a math solution. Correct Me only checks math working for now.",
};

const STATUS_TEXT = { reading: 'Reading your problem...', checking: 'Checking your working...' };

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

  row.append(el('span', 'row-number', String(number)), input, el('div', 'row-aside'));
  return row;
}

function renderAside(aside, line, index) {
  const needsReview = !line.confident && !line.edited && !line.confirmed;
  if (needsReview) {
    if (aside.dataset.kind === 'doubt') return;
    const confirm = el('button', 'confirm-button', 'Looks right');
    confirm.type = 'button';
    confirm.dataset.action = 'confirm';
    confirm.setAttribute('aria-label', `Line ${index + 1} looks right as read`);
    const doubt = el('div', 'read-doubt');
    doubt.append(el('span', 'read-doubt-mark', '?'), el('span', 'read-doubt-text', 'not sure I read this right'), confirm);
    aside.replaceChildren(doubt);
    aside.dataset.kind = 'doubt';
    return;
  }

  const kind = index === 0 ? 'question' : line.edited ? 'edited' : line.confirmed ? 'confirmed' : 'none';
  if (aside.dataset.kind === kind) return;
  const content = {
    question: () => el('span', 'row-tag', 'Question'),
    edited: () => el('span', 'read-ok', 'edited'),
    confirmed: () => el('span', 'read-ok', 'confirmed'),
    none: () => null,
  }[kind]();
  aside.replaceChildren(...(content ? [content] : []));
  aside.dataset.kind = kind;
}

function renderLines(state, els) {
  if (els.lines.dataset.readId !== String(state.readId)) {
    els.lines.replaceChildren(...state.lines.map(buildRow));
    els.lines.dataset.readId = String(state.readId);
  }
  [...els.lines.children].forEach((row, index) => {
    const line = state.lines[index];
    const input = row.querySelector('.row-input');
    if (document.activeElement !== input && input.value !== line.text) input.value = line.text;
    renderAside(row.querySelector('.row-aside'), line, index);
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

  renderLines(state, els);

  const hasLines = state.lines.length > 0;
  els.actions.hidden = !hasLines;
  const pending = linesNeedingReview(state);
  els.check.disabled = busy || !canCheck(state);
  els.checkGate.textContent =
    pending.length === 0 ? '' : `Fix or confirm line${pending.length > 1 ? 's' : ''} ${pending.join(', ')} first.`;
}
