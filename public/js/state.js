// The in-memory session. Nothing is persisted: closing the tab ends it.
// Every update returns a new state; nothing here touches the DOM or the network.

export const initialState = () => ({
  phase: 'start', // 'start' | 'reading' | 'lines' | 'checking' | 'verdict' | 'message' | 'failed'
  photoUrl: null,
  readId: 0, // bumps on every new set of lines so the editor knows to rebuild its rows
  lines: [], // [{ text, confident, edited, confirmed }]
  verdict: null,
  editedFrom: null, // lowest line edited since the last check
  failure: null, // { kind, message, retry: 'read' | 'check' }
  message: null, // 'unsupported_file' | 'unreadable' | 'not_math'
});

export const withPhoto = (state, photoUrl) => ({ ...initialState(), readId: state.readId, phase: 'reading', photoUrl });

export const withMessage = (state, message) => ({ ...state, phase: 'message', message, lines: [], failure: null });

export const withLines = (state, lines) => ({
  ...state,
  phase: 'lines',
  readId: state.readId + 1,
  lines: lines.map((l) => ({ text: l.text, confident: l.confident, edited: false, confirmed: false })),
  verdict: null,
  editedFrom: null,
  failure: null,
  message: null,
});

const replaceLine = (lines, index, changes) => lines.map((l, i) => (i === index ? { ...l, ...changes } : l));

export function withEdit(state, index, text) {
  const line = state.lines[index];
  if (!line || line.text === text) return state;
  const lineNumber = index + 1;
  return {
    ...state,
    lines: replaceLine(state.lines, index, { text, edited: true }),
    editedFrom: state.verdict ? Math.min(state.editedFrom ?? lineNumber, lineNumber) : state.editedFrom,
  };
}

export const withConfirm = (state, index) =>
  state.lines[index] ? { ...state, lines: replaceLine(state.lines, index, { confirmed: true }) } : state;

export const withFailure = (state, failure) => ({ ...state, phase: 'failed', failure });

/** Lines read with "?" that the student has neither edited nor confirmed. */
export const linesNeedingReview = (state) =>
  state.lines.flatMap((l, i) => (!l.confident && !l.edited && !l.confirmed ? [i + 1] : []));

/** "?" lines confirmed without editing: a cross on these blames the reader, not the student. */
export const doubtfulLines = (state) => state.lines.flatMap((l, i) => (!l.confident && !l.edited ? [i + 1] : []));

export const canCheck = (state) =>
  state.lines.length >= 2 &&
  state.lines.every((l) => l.text.trim() !== '') &&
  linesNeedingReview(state).length === 0;
