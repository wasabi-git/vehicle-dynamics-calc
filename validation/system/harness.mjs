/**
 * harness.mjs — Part 8 system-test fixtures.
 *
 * freshApp() builds the real product stack for one test: engine from
 * createEngine, the frozen catalog adapter, a UI store, and the async
 * createScratchEngine used by the tire-code flow (same form as the
 * bootstrap in ui/main.mjs). Everything reads repository files directly —
 * nothing here imports ui/tests or engine/tests. createCoverage() backs
 * the runner's t.cover(id) checkpoint registration.
 */

import { readFile } from "node:fs/promises";
import { createEngine } from "../../engine/index.mjs";
import { buildCatalogAdapter } from "../../ui/adapter/catalog_adapter.mjs";
import { createStore } from "../../ui/state/store.mjs";

const REPO_ROOT = new URL("../../", import.meta.url);

/** Repository-root text reader (same contract as the bootstrap readText). */
export const readText = (relPath) => readFile(new URL(relPath, REPO_ROOT), "utf8");

/** One real, isolated app fixture: engine + adapter + store + scratch factory. */
export async function freshApp() {
  const { ok, engine, diagnostics } = await createEngine(readText);
  if (!ok) {
    throw new Error(`catalog failed to load: ${diagnostics.map((d) => d.message).join("; ")}`);
  }
  const adapter = await buildCatalogAdapter(readText);
  const store = createStore();
  const createScratchEngine = async () => {
    const scratch = await createEngine(readText);
    if (!scratch.ok) throw new Error("scratch engine failed to load");
    return scratch.engine;
  };
  return { engine, adapter, store, createScratchEngine };
}

/** Coverage collector: the runner exposes cover(id) to every module. */
export function createCoverage() {
  const covered = new Set();
  return {
    covered,
    cover(id) {
      covered.add(id);
    },
  };
}
