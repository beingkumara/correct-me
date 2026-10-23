// Page controller: wires events → state updates → render.

import {
  initialState, withPhoto, withLines, withEdit, withConfirm, withMessage, withFailure, withChecking, withVerdict,
  canCheck, doubtfulLines,
} from './state.js';
import { shrinkPhoto, UnsupportedFileError } from './image.js';
import { readPhoto, checkLines } from './api.js';
import { render } from './render.js';

const $ = (id) => document.getElementById(id);
const els = {
  start: $('start'),
  work: $('work'),
  photoInput: $('photo-input'),
  photo: $('photo'),
  photoStack: document.querySelector('.photo-stack'),
  photoStatus: $('photo-status'),
  replacePhoto: $('replace-photo'),
  note: $('notebook-note'),
  lines: $('lines'),
  actions: $('actions'),
  check: $('check'),
  checkGate: $('check-gate'),
  result: $('result'),
};

let state = initialState();

function setState(next) {
  state = next;
  render(state, els);
}

async function readCurrentPhoto() {
  const photoUrl = state.photoUrl;
  const res = await readPhoto(photoUrl);
  if (state.photoUrl !== photoUrl) return; // a newer photo replaced this one while we waited
  if (!res.ok) return setState(withFailure(state, { ...res.error, retry: 'read' }));
  if (res.data.status !== 'ok') return setState(withMessage(state, res.data.status));
  return setState(withLines(state, res.data.lines));
}

async function handleFile(file) {
  els.photoInput.value = '';
  if (!file) return;
  try {
    setState(withPhoto(state, await shrinkPhoto(file)));
  } catch (err) {
    if (err instanceof UnsupportedFileError) return setState(withMessage(initialState(), 'unsupported_file'));
    throw err;
  }
  await readCurrentPhoto();
}

async function checkCurrentLines() {
  if (!canCheck(state)) return;
  const photoUrl = state.photoUrl;
  setState(withChecking(state));
  const res = await checkLines(state.lines.map((l) => l.text), doubtfulLines(state));
  if (state.photoUrl !== photoUrl) return;
  if (!res.ok) return setState(withFailure(state, { ...res.error, retry: 'check' }));
  return setState(withVerdict(state, res.data));
}

const rowIndex = (target) => Number(target.closest('.row')?.dataset.index);

els.photoInput.addEventListener('change', () => handleFile(els.photoInput.files[0]));
els.replacePhoto.addEventListener('click', () => els.photoInput.click());
els.check.addEventListener('click', checkCurrentLines);

els.lines.addEventListener('input', (event) => {
  if (!event.target.classList.contains('row-input')) return;
  setState(withEdit(state, rowIndex(event.target), event.target.value));
});

els.lines.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action="confirm"]');
  if (!button) return;
  const index = rowIndex(button);
  setState(withConfirm(state, index));
  els.lines.children[index]?.querySelector('.row-input')?.focus();
});

render(state, els);
