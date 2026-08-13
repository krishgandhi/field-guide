import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // The build scripts are plain Node ESM, not TypeScript, so nothing was
  // checking for undefined references in them. That let a refactor leave a
  // dangling `rubric` in draft-moves.mjs — a crash that only surfaces when a
  // trade happens, months after the mistake. no-undef catches it at lint time.
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly", fetch: "readonly",
                 URL: "readonly", AbortSignal: "readonly", Headers: "readonly" },
    },
    rules: { "no-undef": "error" },
  },
]);

export default eslintConfig;
