/**
 * The one way scripts call Claude.
 *
 * Four scripts each built their own client with the same model id, the same
 * beta string and the same refusal check, copied by hand. They also shared
 * the same two blind spots: a response cut off at max_tokens went straight
 * into JSON.parse and died with "Unexpected end of JSON input", and a revoked
 * key (401) looked like any other crash — which is how every Claude-written
 * feature failed silently from 12 September (refactor plan, "What the audit
 * found").
 *
 * Server-side only, like every script here. The key never reaches a page (§4).
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Beta } from "@anthropic-ai/sdk/resources/beta/beta";

/**
 * Which model does what. Decided 2026-10-12 (docs/refactor-plan.md).
 *
 * Both ids verified against the model list in @anthropic-ai/sdk 0.133.0.
 */
export const MODELS = {
  /** Short, scoped prose: game reasons, unit notes, profile lines. */
  prose: "claude-sonnet-5-5",
  /** Move rubric drafts — a judgement task (is it a move, how big), not just writing. */
  moveDrafts: "claude-opus-5-5",
} as const;

/**
 * Server-side refusal fallback. If a safety classifier declines, the API
 * re-runs the request on the model's default fallback instead of handing back
 * an empty refusal. `fallbacks` exists only on the beta messages endpoint
 * (still true in SDK 0.133.0), so the beta string stays.
 */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export const hasKey = () => Boolean(process.env.ANTHROPIC_API_KEY);

let client: Anthropic | undefined;
const getClient = () => (client ??= new Anthropic());

/** The model declined, even after the server-side fallback. */
export class ClaudeRefusal extends Error {
  category: string | null;
  constructor(label: string, category: string | null) {
    super(`${label}: model declined (${category ?? "unknown"})`);
    this.name = "ClaudeRefusal";
    this.category = category;
  }
}

/** The response was cut off, so its JSON is incomplete and must not be used. */
export class ClaudeTruncated extends Error {
  constructor(label: string, stopReason: string, maxTokens: number) {
    super(
      `${label}: response stopped at ${stopReason} (max_tokens ${maxTokens}) — ` +
        "the output is incomplete. Send fewer items per request or raise maxTokens.",
    );
    this.name = "ClaudeTruncated";
  }
}

/** A successful response with no text in it. Rare; treated like a refusal. */
export class ClaudeEmpty extends Error {
  constructor(label: string) {
    super(`${label}: no text block in the response`);
    this.name = "ClaudeEmpty";
  }
}

/**
 * Exit code for "the API refused our setup": a bad key (401/403), or a
 * request it will never accept (400 — a bad parameter; 404 — a bad model id).
 * Retrying tomorrow cannot fix any of them, so they stop the process.
 *
 * Distinct from 1 on purpose: the data workflow (scripts/ci/step.sh) lets an
 * ordinary failure — ESPN down, a truncated reply — pass with a warning so the
 * rest of the refresh still lands, but fails the job on this code. A key that
 * silently 401s for a month is exactly what happened from 12 September.
 */
export const CONFIG_EXIT = 3;

/** Why this error means the setup is wrong, or null for an ordinary failure. */
export function configProblem(err: unknown): string | null {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return (
      `the Anthropic API rejected the key (${err.status}). ` +
      "Rotate ANTHROPIC_API_KEY — locally in .env.local, in CI under the repo's Actions secrets."
    );
  }
  if (err instanceof Anthropic.NotFoundError) {
    return `the API returned 404 — usually a model id it doesn't recognise (${err.message}).`;
  }
  if (err instanceof Anthropic.BadRequestError) {
    // `fallbacks` (server-side refusal fallback) is a beta parameter this
    // project has not seen documented outside the SDK's types. If the API
    // ever rejects it, say so plainly rather than leaving a generic 400.
    const hint = /fallback/i.test(err.message)
      ? " The request's `fallbacks` parameter (beta server-side-fallback-2026-07-01) was rejected —" +
        " remove it and FALLBACK_BETA from scripts/lib/claude.mts."
      : "";
    return `the API rejected the request as invalid (400): ${err.message}.${hint}`;
  }
  return null;
}

/**
 * Does the API accept the key, and does it know our model ids?
 *
 * The writers only call Claude when their cache misses, so on a quiet day
 * nothing calls it at all and a revoked key goes unnoticed until the day it
 * matters. This is a Models API GET (`models.retrieve`) per model id:
 * authenticated, so a bad key gets the same 401 a real request would, but no
 * tokens are generated or billed.
 *
 * Returns the problem (as configProblem words it) or null. A network failure
 * or a 5xx is thrown: that says nothing about the key.
 */
export async function probeKey(): Promise<string | null> {
  try {
    for (const id of new Set(Object.values(MODELS))) await getClient().models.retrieve(id);
    return null;
  } catch (err) {
    const problem = configProblem(err);
    if (problem) return problem;
    throw err;
  }
}

/** Nothing usable came back, but nothing is broken either: keep what's there. */
export const isNoResult = (err: unknown) =>
  err instanceof ClaudeRefusal || err instanceof ClaudeEmpty;

export type Usage = { input: number; output: number };

export type JsonRequest = {
  /** Shown in logs and errors, e.g. "write-reasons". */
  label: string;
  model: string;
  system: string;
  user: string;
  /** JSON schema the response must match (structured outputs). */
  schema: Record<string, unknown>;
  maxTokens: number;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  /** Adaptive thinking. Off unless asked for; it bills as output. */
  thinking?: boolean;
  /** Per-attempt timeout. Defaults to DEFAULT_TIMEOUT_MS. */
  timeoutMs?: number;
};

/**
 * Per-attempt timeout, and one retry at most.
 *
 * The SDK's own defaults scale the timeout with max_tokens (up to 30
 * minutes here) and retry twice, so four draft batches could in theory run
 * for hours — well past the refresh job's limit, which would kill the job
 * before its commit step and lose everything else it fetched. A request
 * that hasn't answered in a few minutes isn't going to; the batch fails as
 * an ordinary error and waits for tomorrow.
 */
export const DEFAULT_TIMEOUT_MS = 4 * 60_000;
export const MAX_RETRIES = 1;

/**
 * One structured-output call. Resolves with the parsed JSON, or throws:
 *   ClaudeRefusal   — declined; callers decide whether that is fatal.
 *   ClaudeEmpty     — no text came back; same treatment as a refusal.
 *   ClaudeTruncated — hit max_tokens; never parse a half-written payload.
 * A rejected key or an invalid request (401/403/400/404) exits the process
 * with CONFIG_EXIT rather than throwing, so no caller's catch block can turn
 * it into a quiet "nothing to do".
 */
export async function generateJson<T>(req: JsonRequest): Promise<{ data: T; usage: Usage }> {
  let response: Beta.BetaMessage;
  try {
    response = await getClient().beta.messages.create({
      model: req.model,
      max_tokens: req.maxTokens,
      system: req.system,
      output_config: {
        effort: req.effort,
        format: { type: "json_schema", schema: req.schema },
      },
      ...(req.thinking ? { thinking: { type: "adaptive" as const } } : {}),
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      messages: [{ role: "user", content: req.user }],
    }, { timeout: req.timeoutMs ?? DEFAULT_TIMEOUT_MS, maxRetries: MAX_RETRIES });
  } catch (err) {
    const fatal = configProblem(err);
    if (fatal) {
      const message = `${req.label}: ${fatal}`;
      console.error(`\n${message}\n`);
      // A workflow annotation, so it shows on the run's summary page and not
      // only in a log nobody opens.
      if (process.env.GITHUB_ACTIONS) console.log(`::error title=Claude API::${message}`);
      process.exit(CONFIG_EXIT);
    }
    throw err;
  }

  const usage = { input: response.usage.input_tokens, output: response.usage.output_tokens };
  // Logged per call so spend can be attributed to the script that made it.
  console.log(
    `  [${req.label}] ${response.model}: ${usage.input} tokens in, ${usage.output} out` +
      ` (stop: ${response.stop_reason})`,
  );

  // Check before reading content: a refusal returns HTTP 200 with empty or
  // partial content.
  if (response.stop_reason === "refusal") {
    throw new ClaudeRefusal(req.label, response.stop_details?.category ?? null);
  }
  if (response.stop_reason === "max_tokens" || response.stop_reason === "model_context_window_exceeded") {
    throw new ClaudeTruncated(req.label, response.stop_reason, req.maxTokens);
  }

  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text" || !text.text) {
    throw new ClaudeEmpty(req.label);
  }
  return { data: JSON.parse(text.text) as T, usage };
}
