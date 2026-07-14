/** Node-side reader factory: resolves catalog-relative paths against the repo root. */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** Repository root = two levels above engine/tests/. */
export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** readText for loadCatalog: real repository data. */
export function repoReader() {
  return (relPath) => readFile(join(REPO_ROOT, relPath), "utf8");
}

/** readText over an in-memory map of path -> text (malformed fixtures). */
export function virtualReader(fileMap) {
  return async (relPath) => {
    if (!Object.prototype.hasOwnProperty.call(fileMap, relPath)) {
      throw new Error(`no such fixture file: ${relPath}`);
    }
    return fileMap[relPath];
  };
}
