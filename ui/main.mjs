/**
 * main.mjs — bootstrap.
 *
 * cachingReadText -> createEngine + catalog adapter -> first frame.
 * Every catalog path is fetched exactly once (plan B, D27): the cache map
 * below serves both the engine loader and the adapter's own JSON copy.
 * The load self-check renders into the footer status line.
 */

import { createEngine } from "../engine/index.mjs";
import { buildCatalogAdapter } from "./adapter/catalog_adapter.mjs";
import { createStore } from "./state/store.mjs";
import { initInputsView } from "./render/inputs_view.mjs";
import { initResultsView } from "./render/results_view.mjs";
import { initTargetsView } from "./render/targets_view.mjs";
import { initAssumptionsView } from "./render/assumptions_view.mjs";

const ROOT = new URL("./", document.baseURI);
const textCache = new Map();

export function cachingReadText(relPath) {
  if (!textCache.has(relPath)) {
    textCache.set(
      relPath,
      fetch(new URL(relPath, ROOT)).then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} for ${relPath}`);
        }
        return response.text();
      })
    );
  }
  return textCache.get(relPath);
}

function setBootStatus(text) {
  const el = document.getElementById("boot-status");
  if (el) el.textContent = text;
}

async function boot() {
  setBootStatus("Loading catalog…");
  try {
    const { ok, engine, diagnostics } = await createEngine(cachingReadText);
    if (!ok) {
      const detail = diagnostics.map((d) => d.message ?? String(d)).join(" | ");
      setBootStatus(`Catalog failed to load. ${detail}`);
      return;
    }
    const adapter = await buildCatalogAdapter(cachingReadText);

    const counts =
      `${adapter.variables.length} variables, ` +
      `${adapter.units.length} units, ` +
      `${adapter.formulas.length} formulas, ` +
      `${adapter.models.length} models`;
    setBootStatus(
      `Catalog loaded (${counts}). Engine ready. ` +
      `Loader diagnostics: ${diagnostics.length}. Fetches: ${textCache.size} files, each read once.`
    );

    const store = createStore();
    const createScratchEngine = async () => {
      const scratch = await createEngine(cachingReadText); // cache hit, zero network
      if (!scratch.ok) throw new Error("scratch engine failed to load");
      return scratch.engine;
    };
    app = { engine, adapter, store, createScratchEngine, diagnostics };
    initInputsView(app);
    initResultsView(app);
    initTargetsView(app);
    initAssumptionsView(app);
  } catch (error) {
    setBootStatus(`Startup failed: ${error.message}`);
  }
}

let app = null;

/** Application context for the render layer; null until boot completes. */
export function getApp() {
  return app;
}

boot();
