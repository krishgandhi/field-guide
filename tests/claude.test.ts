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

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      lastRequest = { headers: req.headers, body: JSON.parse(raw || "{}") };
      res.writeHead(next.status, { "content-type": "application/json" });
      res.end(JSON.stringify(next.body));
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
    expect(exit).toHaveBeenCalledWith(1);
    exit.mockRestore();
    log.mockRestore();
  });
});
