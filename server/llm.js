// Model Gateway: the one module that talks to AI providers.
// Provider, key, and model for each role come from .env, so swapping a model is a config change.

const ROLES = ['reader', 'checker'];
const SETTINGS = ['BASE_URL', 'API_KEY', 'MODEL'];
const TIMEOUT_MS = 40_000;

export class LlmError extends Error {
  constructor(kind, message, detail = null) {
    super(message);
    this.name = 'LlmError';
    this.kind = kind; // 'ai_failed' | 'bad_ai_reply' | 'rate_limited'
    this.detail = detail;
  }
}

export function missingSettings(env = process.env) {
  return ROLES.flatMap((role) =>
    SETTINGS.map((s) => `${role.toUpperCase()}_${s}`).filter((key) => !env[key]),
  );
}

export function assertConfigured(env = process.env) {
  const missing = missingSettings(env);
  if (missing.length > 0) {
    throw new Error(
      `Missing settings in .env: ${missing.join(', ')}. Copy .env.example to .env and fill them in.`,
    );
  }
}

function configFor(role, env = process.env) {
  if (!ROLES.includes(role)) throw new Error(`Unknown model role: ${role}`);
  const prefix = role.toUpperCase();
  return {
    baseUrl: env[`${prefix}_BASE_URL`].replace(/\/+$/, ''),
    apiKey: env[`${prefix}_API_KEY`],
    model: env[`${prefix}_MODEL`],
    jsonMode: env[`${prefix}_JSON_MODE`] === 'json_object' ? 'json_object' : 'json_schema',
  };
}

// Some models wrap output in <think>…</think> or ```json fences even in JSON mode.
export function parseJsonContent(content) {
  if (typeof content !== 'string' || content.trim() === '') {
    throw new LlmError('bad_ai_reply', 'The model returned an empty reply.');
  }
  const cleaned = content
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new LlmError('bad_ai_reply', 'The model reply was not valid JSON.', content);
  }
}

async function post(config, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    const reason = err.name === 'AbortError' ? `timed out after ${TIMEOUT_MS / 1000}s` : err.message;
    throw new LlmError('ai_failed', `Could not reach the ${config.model} model: ${reason}`);
  } finally {
    clearTimeout(timer);
  }
}

function errorFor(status, text) {
  if (status === 429) return new LlmError('rate_limited', 'Rate limited by the AI provider.', text);
  // Groq returns 400 json_validate_failed when the model can't produce valid JSON (e.g. it looped).
  if (status === 400 && /json_validate_failed/.test(text)) {
    return new LlmError('bad_ai_reply', 'The model could not produce a valid JSON reply.', text);
  }
  return new LlmError('ai_failed', `AI provider error ${status}.`, text);
}

/**
 * Ask a model for JSON matching `schema`.
 * Uses strict json_schema by default; `<ROLE>_JSON_MODE=json_object` in .env switches a model
 * to plain JSON mode (needed for Qwen with images, which loops under strict mode).
 * Either way our validators enforce the shape.
 * Returns { data, raw, mode }.
 */
export async function chatJSON({ role, messages, schema, name }) {
  const config = configFor(role);
  const responseFormat =
    config.jsonMode === 'json_object'
      ? { type: 'json_object' }
      : { type: 'json_schema', json_schema: { name, strict: true, schema } };

  const res = await post(config, {
    model: config.model,
    messages,
    temperature: 0,
    response_format: responseFormat,
  });
  if (!res.ok) throw errorFor(res.status, await res.text());

  const body = await res.json();
  const raw = body?.choices?.[0]?.message?.content;
  return { data: parseJsonContent(raw), raw, mode: responseFormat.type };
}
