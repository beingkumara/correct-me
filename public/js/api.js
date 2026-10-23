// fetch wrappers for the two routes. Every failure comes back as { ok: false, error: { kind, message } },
// so the page can show "Try again" without touching the student's work.

const TIMEOUT_MS = 45_000;
const NETWORK_FAILURE = {
  ok: false,
  error: { kind: 'ai_failed', message: "Couldn't reach the checker. Your photo and edits are safe." },
};

async function post(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await res.json().catch(() => null);
    if (json?.ok === true && json.data) return json;
    if (json?.ok === false && json.error?.message) return json;
    return NETWORK_FAILURE;
  } catch {
    return NETWORK_FAILURE;
  } finally {
    clearTimeout(timer);
  }
}

export const readPhoto = (image) => post('/api/read', { image });

export const checkLines = (lines, doubtfulLines) => post('/api/check', { lines, doubtfulLines });
