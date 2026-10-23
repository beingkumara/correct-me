// fetch wrappers for the two routes. Every failure comes back as { ok: false, error: { kind, message } },
// so the page can show "Try again" without touching the student's work.

// A little longer than the server's own limits (20s read, 40s check) so the server's honest message wins.
const ROUTES = {
  read: {
    path: '/api/read',
    timeoutMs: 25_000,
    failure: { kind: 'ai_failed', message: "Couldn't reach the photo reader. Your photo is safe." },
  },
  check: {
    path: '/api/check',
    timeoutMs: 45_000,
    failure: { kind: 'ai_failed', message: "Couldn't reach the checker. Your photo and edits are safe." },
  },
};

async function post(route, body) {
  const { path, timeoutMs, failure } = ROUTES[route];
  const networkFailure = { ok: false, error: failure };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
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
    return networkFailure;
  } catch {
    return networkFailure;
  } finally {
    clearTimeout(timer);
  }
}

export const readPhoto = (image) => post('read', { image });

export const checkLines = (lines, doubtfulLines) => post('check', { lines, doubtfulLines });
