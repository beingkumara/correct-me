// Leak guard: checks every note and hint for the fix before the student sees it.
// The model holds correctedLine / finalAnswer privately; if any of them (or their right-hand
// sides) shows up in a note or hint after normalizing, the text is swapped for a generic one.

import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export const MIN_FRAGMENT_LENGTH = 3;
export const LOG_PATH = resolve('logs/leak-guard.jsonl');

export const GENERIC = {
  wrong: {
    note: "There's a mistake on this line.",
    hint: 'Compare this line with the one before it. What changed, and is that step allowed?',
  },
  unsure: { note: 'Not sure this follows. Worth checking yourself.', hint: null },
};

const LATEX_SYMBOLS = { int: '∫', pi: 'π', theta: 'θ', infty: '∞', sqrt: '√' };

/**
 * Backup safety net: turn common LaTeX into the plain Unicode the student sees,
 * in case the model writes its private fields (or a hint) in LaTeX despite the prompt.
 */
export function delatex(text) {
  let out = text.replace(/\$/g, '').replace(/\\(left|right)\b/g, '');
  // \frac{a}{b} → (a)/(b); repeat for simple nesting
  for (let i = 0; i < 3; i += 1) out = out.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)');
  return out
    .replace(/\\sqrt\{([^{}]*)\}/g, '√($1)')
    .replace(/\\(mathrm|operatorname|text)\{([^{}]*)\}/g, '$2')
    .replace(/\\(cdot|times|ast)\b/g, '·')
    .replace(/\\[,;:! ]|\\quad\b|\\qquad\b/g, ' ')
    .replace(/\\([a-zA-Z]+)/g, (_, name) => LATEX_SYMBOLS[name] ?? name)
    .replace(/\^\{([^{}]*)\}/g, '^$1')
    .replace(/[{}]/g, '');
}

/**
 * Lowercase, drop whitespace, multiplication signs and brackets, unify minus signs and powers,
 * drop a trailing + C. Applied to both the fragments and the note/hint text.
 */
export function normalize(text) {
  return delatex(text)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[·×∙⋅*]/g, '')
    .replace(/[()[\]]/g, '')
    .replace(/[−–—‐]/g, '-')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/\+(c|constant)$/, '');
}

const rightHandSide = (text) => (text.includes('=') ? text.slice(text.lastIndexOf('=') + 1) : null);

/** The normalized fragments to look for, with where each came from. */
export function fragmentsFrom({ correctedLine, finalAnswer }) {
  const sources = [
    ['correctedLine', correctedLine],
    ['correctedLine_rhs', correctedLine && rightHandSide(correctedLine)],
    ['finalAnswer', finalAnswer],
    ['finalAnswer_rhs', finalAnswer && rightHandSide(finalAnswer)],
  ];
  return sources
    .filter(([, text]) => typeof text === 'string' && text.trim() !== '')
    .map(([fragmentType, text]) => ({ fragmentType, fragment: normalize(text), original: text }));
}

/**
 * @param verdicts validated check verdicts (lines 2…N)
 * @param privateRefs { correctedLine, finalAnswer } from the model — never sent to the browser
 * @returns {{ verdicts, hits, skipped }} new verdicts with leaked text replaced
 */
export function guard(verdicts, privateRefs) {
  const all = fragmentsFrom(privateRefs);
  const skipped = all
    .filter((f) => f.fragment.length < MIN_FRAGMENT_LENGTH)
    .map((f) => ({ event: 'skipped_short', ...f }));
  const fragments = all.filter((f) => f.fragment.length >= MIN_FRAGMENT_LENGTH);

  const hits = [];
  const guarded = verdicts.map((v) => {
    if (v.status === 'ok') return v;
    const leaks = ['note', 'hint'].flatMap((field) => {
      const text = v[field];
      if (!text) return [];
      const normalized = normalize(text);
      return fragments
        .filter((f) => normalized.includes(f.fragment))
        .map((f) => ({ event: 'hit', line: v.line, field, fragmentType: f.fragmentType, fragment: f.original, original: text }));
    });
    if (leaks.length === 0) return v;
    hits.push(...leaks);
    return { ...v, ...GENERIC[v.status] };
  });

  return { verdicts: guarded, hits, skipped };
}

/** Append guard events to logs/leak-guard.jsonl and echo them, so leaks can be counted. */
export async function logGuardEvents(events, path = LOG_PATH) {
  if (events.length === 0) return;
  const time = new Date().toISOString();
  const lines = events.map((e) => JSON.stringify({ time, ...e })).join('\n') + '\n';
  events.forEach((e) => console.warn(`[leak-guard] ${e.event}: ${e.fragmentType} "${e.fragment}"${e.line ? ` on line ${e.line} ${e.field}` : ''}`));
  try {
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, lines);
  } catch (err) {
    console.error(`[leak-guard] could not write log: ${err.message}`);
  }
}
