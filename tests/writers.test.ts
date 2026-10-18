/**
 * The prose writers end to end, against a local stand-in for the API.
 *
 * What's under test is the failure path: a batch that fails part-way must
 * not throw away what earlier batches wrote. Each script runs as a child
 * process in a scratch copy of the data it reads, so the repo's own files are
 * never touched, and no real request is made.
 */

import { spawn } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

let server: Server;
let base = "";
/** One handler per request, in order; the last one repeats. */
let replies: ((body: { messages: { content: string }[] }) => { status: number; body: unknown })[] = [];
let calls = 0;

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const reply = replies[Math.min(calls, replies.length - 1)](JSON.parse(raw || "{}"));
      calls++;
      res.writeHead(reply.status, { "content-type": "application/json" });
      res.end(JSON.stringify(reply.body));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => server.close());

const message = (json: unknown) => ({
  status: 200,
  body: {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5-5",
    content: [{ type: "text", text: JSON.stringify(json) }],
    stop_reason: "end_turn",
    stop_sequence: null,
    stop_details: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  },
});
const overloaded = () => ({
  status: 529,
  body: { type: "error", error: { type: "overloaded_error", message: "Overloaded" } },
});

/** A scratch working directory holding copies of what the writers read. */
function scratch() {
  const dir = mkdtempSync(path.join(tmpdir(), "writers-"));
  mkdirSync(path.join(dir, "src/data"), { recursive: true });
  for (const f of ["people.json", "prose-cache.json", "team-detail.json"]) {
    cpSync(path.join(ROOT, "src/data", f), path.join(dir, "src/data", f));
  }
  cpSync(path.join(ROOT, "content/moves"), path.join(dir, "content/moves"), { recursive: true });
  return dir;
}

function run(script: string, cwd: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, "scripts", script)], {
      cwd,
      env: { ...process.env, ANTHROPIC_API_KEY: "test-key", ANTHROPIC_BASE_URL: base },
      stdio: "ignore",
    });
    child.on("exit", (code) => resolve(code ?? -1));
  });
}

/** The ids asked about in one request, from the JSON in its user message. */
const askedIn = (body: { messages: { content: string }[] }, field: string): string[] => {
  const text = body.messages[0].content;
  return JSON.parse(text.slice(text.indexOf("["))).map((x: Record<string, string>) => x[field]);
};

describe("write-profiles", () => {
  it("keeps the first batch's results when a later batch fails", async () => {
    const dir = scratch();
    calls = 0;
    let firstBatch: string[] = [];
    replies = [
      (body) => {
        firstBatch = askedIn(body, "id");
        // Too short to pass validation, so each is recorded as a rejection —
        // which is visible in the cache only if this batch was saved.
        return message({ profiles: firstBatch.map((id) => ({ id, blurb: "Too short." })) });
      },
      overloaded,
    ];
    const code = await run("write-profiles.mjs", dir);
    const cache = JSON.parse(readFileSync(path.join(dir, "src/data/prose-cache.json"), "utf8"));
    expect(firstBatch.length).toBe(6);
    for (const id of firstBatch) expect(cache.profiles[id]?.rejectedKey).toBeTruthy();
    // The overloaded batches are a real failure, and say so.
    expect(code).toBe(1);
    rmSync(dir, { recursive: true });
  }, 60_000);
});

describe("write-unit-notes", () => {
  it("keeps the first batch's results when a later batch fails", async () => {
    const dir = scratch();
    calls = 0;
    let firstBatch: string[] = [];
    replies = [
      (body) => {
        firstBatch = askedIn(body, "key");
        return message({ notes: firstBatch.map((key) => ({ key, blurb: "Too short." })) });
      },
      overloaded,
    ];
    const code = await run("write-unit-notes.mjs", dir);
    const cache = JSON.parse(readFileSync(path.join(dir, "src/data/prose-cache.json"), "utf8"));
    expect(firstBatch.length).toBe(12);
    for (const key of firstBatch) expect(cache.units[key]?.rejectedKey).toBeTruthy();
    expect(code).toBe(1);
    rmSync(dir, { recursive: true });
  }, 120_000);
});
