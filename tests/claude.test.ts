/**
 * The shared Claude helper, against a local stand-in for the API.
 *
 * No real request is made: ANTHROPIC_BASE_URL points the SDK at a server in
 * this process that returns canned responses. What's under test is our
 * handling of them — truncation, refusal, and a rejected key.
 */

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let server: Server;
let next: { status: number; body: unknown };
let lastRequest: { headers: Record<string, unknown>; body: Record<string, unknown> } | null;
/** Milliseconds the stand-in waits before answering. */
let delay = 0;
let requests = 0;

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      requests++;
      lastRequest = { headers: req.headers, body: JSON.parse(raw || "{}") };
      setTimeout(() => {
        if (res.destroyed) return;
        res.writeHead(next.status, { "content-type": "application/json" });
        res.end(JSON.stringify(next.body));
      }, delay);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.ANTHROPIC_API_KEY = "test-key";
});

afterAll(() => {
  server.close();
  delete process.env.ANTHROPIC_BASE_URL;
  delete process.env.ANTHROPIC_API_KEY;
});

const message = (over: Record<string, unknown>) => ({
  id: "msg_test",
  type: "message",
  role: "assistant",
  model: "claude-sonnet-5-5",
  content: [{ type: "text", text: '{"ok":true}' }],
  stop_reason: "end_turn",
  stop_sequence: null,
  stop_details: null,
  usage: { input_tokens: 10, output_tokens: 5 },
  ...over,
});

const request = {
  label: "test",
  model: "claude-sonnet-5-5",
  system: "s",
  user: "u",
  schema: { type: "object" },
  maxTokens: 100,
  effort: "medium" as const,
};

const load = () => import("../scripts/lib/claude.mjs");

describe("generateJson", () => {
  it("returns the parsed JSON and the usage", async () => {
    const { generateJson } = await load();
    next = { status: 200, body: message({}) };
    await expect(generateJson(request)).resolves.toEqual({
      data: { ok: true },
      usage: { input: 10, output: 5 },
    });
    // The fallback beta and structured output travel with every request.
    expect(String(lastRequest?.headers["anthropic-beta"])).toContain("server-side-fallback");
    expect(lastRequest?.body).toMatchObject({
      model: "claude-sonnet-5-5",
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema" } },
    });
    expect(lastRequest?.body).not.toHaveProperty("thinking");
  });

  it("throws ClaudeTruncated instead of parsing half a payload", async () => {
    const { generateJson, ClaudeTruncated } = await load();
    next = {
      status: 200,
      body: message({ stop_reason: "max_tokens", content: [{ type: "text", text: '{"ok":' }] }),
    };
    await expect(generateJson(request)).rejects.toBeInstanceOf(ClaudeTruncated);
  });

  it("throws ClaudeRefusal with the category", async () => {
    const { generateJson, ClaudeRefusal, isNoResult } = await load();
    next = {
      status: 200,
      body: message({
        stop_reason: "refusal",
        content: [],
        stop_details: { type: "refusal", category: "cyber", explanation: null },
      }),
    };
    const err = await generateJson(request).catch((e) => e);
    expect(err).toBeInstanceOf(ClaudeRefusal);
    expect(err.category).toBe("cyber");
    expect(isNoResult(err)).toBe(true);
  });

  it("exits non-zero on a rejected key instead of throwing something catchable", async () => {
    const { generateJson } = await load();
    next = {
      status: 401,
      body: { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } },
    };
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exited");
    }) as never);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(generateJson(request)).rejects.toThrow("exited");
    expect(exit).toHaveBeenCalledWith(3);
    exit.mockRestore();
    log.mockRestore();
  });

  it.each([
    [400, "invalid_request_error", "max_tokens: must be positive", /invalid \(400\)/],
    [400, "invalid_request_error", "fallbacks: Extra inputs are not permitted", /fallbacks.*rejected/],
    [404, "not_found_error", "model: claude-nope", /404.*model id/],
  ])("exits loudly on %i (%s)", async (status, type, message, expected) => {
    const { generateJson, CONFIG_EXIT } = await load();
    next = { status, body: { type: "error", error: { type, message } } };
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exited");
    }) as never);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(generateJson(request)).rejects.toThrow("exited");
    expect(exit).toHaveBeenCalledWith(CONFIG_EXIT);
    expect(String(log.mock.calls[0]?.[0])).toMatch(expected);
    exit.mockRestore();
    log.mockRestore();
  });

  it("a 500 is an ordinary, catchable failure", async () => {
    const { generateJson } = await load();
    next = { status: 500, body: { type: "error", error: { type: "api_error", message: "boom" } } };
    const exit = vi.spyOn(process, "exit");
    await expect(generateJson({ ...request, label: "t" })).rejects.toThrow();
    expect(exit).not.toHaveBeenCalled();
    exit.mockRestore();
  }, 30_000);
});

describe("time limits", () => {
  it("gives up on a hung request after the timeout and one retry, as an ordinary error", async () => {
    const { generateJson, MAX_RETRIES } = await load();
    next = { status: 200, body: message({}) };
    delay = 1_000;
    requests = 0;
    const exit = vi.spyOn(process, "exit");
    const started = Date.now();
    await expect(generateJson({ ...request, timeoutMs: 100 })).rejects.toThrow(/timed out/i);
    // Two attempts of 100ms plus the SDK's short backoff — nowhere near the
    // half hour its own defaults would allow.
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(requests).toBe(MAX_RETRIES + 1);
    expect(exit).not.toHaveBeenCalled();
    exit.mockRestore();
    delay = 0;
  }, 15_000);
});

describe("probeKey", () => {
  it("asks the Models API for each model id — a GET, nothing generated", async () => {
    const { probeKey, MODELS } = await load();
    next = { status: 200, body: { type: "model", id: MODELS.prose, display_name: "x", created_at: "2026-01-01T00:00:00Z" } };
    await expect(probeKey()).resolves.toBeNull();
    // No body: a lookup, not a message.
    expect(lastRequest?.body).toEqual({});
  });

  it("returns the problem for a rejected key", async () => {
    const { probeKey } = await load();
    next = {
      status: 401,
      body: { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } },
    };
    await expect(probeKey()).resolves.toMatch(/rejected the key \(401\)/);
  });

  it("returns the problem for an unknown model id", async () => {
    const { probeKey } = await load();
    next = { status: 404, body: { type: "error", error: { type: "not_found_error", message: "model: nope" } } };
    await expect(probeKey()).resolves.toMatch(/404/);
  });

  it("throws on a 500, which says nothing about the key", async () => {
    const { probeKey } = await load();
    next = { status: 500, body: { type: "error", error: { type: "api_error", message: "boom" } } };
    await expect(probeKey()).rejects.toThrow();
  }, 30_000);
});
