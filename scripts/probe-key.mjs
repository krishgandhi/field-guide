/**
 * Daily check that ANTHROPIC_API_KEY still works. Generates nothing, bills
 * nothing (see probeKey in scripts/lib/claude.mts).
 *
 * Exit 3 (CONFIG_EXIT) on a rejected key or unknown model id, which
 * scripts/ci/step.sh turns into a failed job. Exit 1 on a network failure,
 * which is only a warning: it says nothing about the key.
 *
 * In CI a missing key is also exit 3 — the secret is gone, and every writer
 * would quietly skip. Locally a missing key is the normal state.
 *
 *   node scripts/probe-key.mjs
 */

import { CONFIG_EXIT, MODELS, hasKey, probeKey } from "./lib/claude.mts";

if (!hasKey()) {
  if (process.env.GITHUB_ACTIONS) {
    console.error("ANTHROPIC_API_KEY is not set. Add it under the repo's Actions secrets.");
    process.exit(CONFIG_EXIT);
  }
  console.log("No ANTHROPIC_API_KEY — nothing to check.");
  process.exit(0);
}

try {
  const problem = await probeKey();
  if (problem) {
    console.error(`Claude key check: ${problem}`);
    process.exit(CONFIG_EXIT);
  }
  console.log(`Claude key accepted; ${[...new Set(Object.values(MODELS))].join(", ")} available.`);
} catch (err) {
  console.error(`Claude key check could not reach the API: ${err.message}`);
  process.exit(1);
}
