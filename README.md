# Correct Me

Upload a photo of your handwritten math working. Correct Me reads it into numbered lines you can fix, then finds the first line where it went wrong and asks a hint question. It does not solve the problem for you.

A proof of concept built for the Devpost *Build With AI: Basics* hackathon.

## Requirements

- Node.js 20.6 or newer (uses the built-in `fetch` and `--env-file`)
- A Groq API key. Free keys are at https://console.groq.com/keys
- A modern desktop browser

## Setup

```bash
npm install
cp .env.example .env
```

Open `.env` and set `READER_API_KEY` and `CHECKER_API_KEY` to your Groq key. You can use the same key for both. Never commit `.env`.

| Variable | Default in `.env.example` | Purpose |
|---|---|---|
| `READER_BASE_URL` / `CHECKER_BASE_URL` | `https://api.groq.com/openai/v1` | OpenAI-compatible endpoint |
| `READER_MODEL` | `qwen/qwen3.8-27b` | Vision model that reads the photo |
| `CHECKER_MODEL` | `openai/gpt-oss-120b` | Model that checks each line against the one before |
| `READER_JSON_MODE` / `CHECKER_JSON_MODE` | `json_object` / `json_schema` | Response format per model |
| `PORT` | `3000` | Local server port |

## Run

```bash
npm start
```

Open http://localhost:3000, upload a photo of a handwritten solution (try `samples/sample_question.jpeg`), confirm or fix the lines it read, and press **Check**.

## Tests

```bash
npm test
```

## Reality check (terminal)

Runs one photo through the reader and checker and prints the raw model replies next to the final result:

```bash
npm run reality-check samples/sample_question.jpeg
npm run reality-check -- --lines samples/lines/six-line-sign-error.txt
```

## Project layout

```text
public/     the page: HTML, CSS, and JS (state, render, API client, image shrinker)
server/     Express server: routes, model gateway, prompts, reply validation, rules, leak guard
scripts/    reality-check.js
test/       node:test unit and route tests
samples/    the demo photo and typed line files
devpost/    planning docs (scope, PRD, spec, build checklist) and the app map
.agents/    the course skill pack used to plan and build this project
```

The API key stays on the server. The browser never sees it.
