// Page controller: wires events → state updates → render.

import {
  initialState, withPhoto, withLines, withEdit, withConfirm, withMessage, withFailure, withChecking, withVerdict,
  withRetry,
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
  alert: $('notebook-alert'),
  note: $('notebook-note'),
  retry: $('retry'),
  uploadAnother: $('upload-another'),
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

async function checkCurrentLines({ retrying = false } = {}) {
  if (!canCheck(state)) return;
  const photoUrl = state.photoUrl;
  if (!retrying) setState(withChecking(state));
  const res = await checkLines(state.lines.map((l) => l.text), doubtfulLines(state));
  if (state.photoUrl !== photoUrl) return;
  if (!res.ok) return setState(withFailure(state, { ...res.error, retry: 'check' }));
  return setState(withVerdict(state, res.data));
}

const rowIndex = (target) => Number(target.closest('.row')?.dataset.index);

els.photoInput.addEventListener('change', () => handleFile(els.photoInput.files[0]));
els.replacePhoto.addEventListener('click', () => els.photoInput.click());
els.check.addEventListener('click', () => checkCurrentLines());
els.uploadAnother.addEventListener('click', () => els.photoInput.click());
els.retry.addEventListener('click', () => {
  const retry = state.failure?.retry;
  setState(withRetry(state));
  if (retry === 'check') checkCurrentLines({ retrying: true });
  else readCurrentPhoto();
});

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
