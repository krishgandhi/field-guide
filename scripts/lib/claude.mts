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
};

/**
 * One structured-output call. Resolves with the parsed JSON, or throws:
 *   ClaudeRefusal   — declined; callers decide whether that is fatal.
 *   ClaudeEmpty     — no text came back; same treatment as a refusal.
 *   ClaudeTruncated — hit max_tokens; never parse a half-written payload.
 * A rejected key (401/403) exits the process non-zero rather than throwing,
 * so no caller's catch block can turn it into a quiet "nothing to do".
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
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      console.error(
        `\n${req.label}: the Anthropic API rejected the key (${err.status}). ` +
          "Rotate ANTHROPIC_API_KEY — locally in .env.local, in CI under the repo's Actions secrets.\n",
      );
      process.exit(1);
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
