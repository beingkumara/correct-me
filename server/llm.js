// Model Gateway: the one module that talks to AI providers.
// Provider, key, and model for each role come from .env, so swapping a model is a config change.

const ROLES = ['reader', 'checker'];
const SETTINGS = ['BASE_URL', 'API_KEY', 'MODEL'];
// Reads are capped hard: a reader that loops on a strange photo must end in seconds, not minutes.
const DEFAULTS = {
  reader: { timeoutMs: 20_000, maxTokens: 1500 },
  checker: { timeoutMs: 40_000, maxTokens: null },
};

export class LlmError extends Error {
  constructor(kind, message, detail = null) {
    super(message);
    this.name = 'LlmError';
    this.kind = kind; // 'ai_failed' | 'timeout' | 'truncated' | 'bad_ai_reply' | 'rate_limited'
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

export function configFor(role, env = process.env) {
  if (!ROLES.includes(role)) throw new Error(`Unknown model role: ${role}`);
  const prefix = role.toUpperCase();
  return {
    baseUrl: env[`${prefix}_BASE_URL`].replace(/\/+$/, ''),
    apiKey: env[`${prefix}_API_KEY`],
    model: env[`${prefix}_MODEL`],
    jsonMode: env[`${prefix}_JSON_MODE`] === 'json_object' ? 'json_object' : 'json_schema',
    timeoutMs: Number(env[`${prefix}_TIMEOUT_MS`]) || DEFAULTS[role].timeoutMs,
    maxTokens: Number(env[`${prefix}_MAX_TOKENS`]) || DEFAULTS[role].maxTokens,
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

/** One timer covers the whole exchange — headers AND body — so a reply that keeps streaming still ends. */
async function post(config, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status, text: await res.text() };
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new LlmError('timeout', `The ${config.model} model did not answer within ${config.timeoutMs / 1000}s.`);
    }
    throw new LlmError('ai_failed', `Could not reach the ${config.model} model: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

function errorFor(status, text) {
  if (status === 429) return new LlmError('rate_limited', 'Rate limited by the AI provider.', text);
  // Groq returns 400 json_validate_failed when the model can't produce valid JSON (e.g. it looped).
  if (status === 400 && /json_validate_failed/.test(text)) {
    const kind = /max completion tokens/i.test(text) ? 'truncated' : 'bad_ai_reply';
    return new LlmError(kind, 'The model could not produce a valid JSON reply.', text);
  }
  return new LlmError('ai_failed', `AI provider error ${status}.`, text);
}

/**
 * Ask a model for JSON matching `schema`.
 * Uses strict json_schema by default; `<ROLE>_JSON_MODE=json_object` in .env switches a model
 * to plain JSON mode (needed for Qwen with images, which loops under strict mode).
 * Either way our validators enforce the shape.
 * Reader replies are capped by READER_MAX_TOKENS and READER_TIMEOUT_MS (defaults above).
 * Returns { data, raw, mode }.
 */
export async function chatJSON({ role, messages, schema, name }, env = process.env) {
  const config = configFor(role, env);
  const responseFormat =
    config.jsonMode === 'json_object'
      ? { type: 'json_object' }
      : { type: 'json_schema', json_schema: { name, strict: true, schema } };

  const res = await post(config, {
    model: config.model,
    messages,
    temperature: 0,
    response_format: responseFormat,
    ...(config.maxTokens ? { max_completion_tokens: config.maxTokens } : {}),
  });
  if (!res.ok) throw errorFor(res.status, res.text);

  let body;
  try {
    body = JSON.parse(res.text);
  } catch {
    throw new LlmError('bad_ai_reply', 'The provider reply was not JSON.', res.text.slice(0, 2000));
  }
  const choice = body?.choices?.[0];
  const raw = choice?.message?.content;
  // Hit the token cap: the model was still going (usually looping), so the reply is incomplete.
  if (choice?.finish_reason === 'length') {
    throw new LlmError('truncated', `The ${config.model} reply hit the ${config.maxTokens}-token cap.`, raw?.slice(-500));
  }
  return { data: parseJsonContent(raw), raw, mode: responseFormat.type };
}
