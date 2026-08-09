/** Installs the "@/..." resolver. Used via `node --import ./scripts/register-alias.mjs`. */
import { register } from "node:module";
register("./ts-alias-loader.mjs", import.meta.url);
