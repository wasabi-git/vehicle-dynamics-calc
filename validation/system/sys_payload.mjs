/**
 * sys_payload.mjs — §7.4 static-payload freeze.
 *
 * The 42-file startup set is closed: every blob exists in HEAD with a
 * positive size, the file count is exactly 42, and the byte total equals
 * the re-pinned P₁. Sizes come from `git cat-file -s` on HEAD blobs — the
 * same source as the P₁ definition — so checkout line-ending settings can
 * never skew the measurement. Prints the per-file byte table.
 */

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const name = "sys_payload: 42-file startup set freeze (§7.4)";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

const STARTUP_FILES = [
  "index.html",
  "ui/tokens.css",
  "ui/app.css",
  "ui/main.mjs",
  "ui/adapter/catalog_adapter.mjs",
  "ui/adapter/formula_format.mjs",
  "ui/adapter/path_view_model.mjs",
  "ui/adapter/source_presenter.mjs",
  "ui/adapter/tire_code.mjs",
  "ui/adapter/upstream_trace.mjs",
  "ui/adapter/view_model.mjs",
  "ui/adapter/warning_presenter.mjs",
  "ui/render/assumptions_controller.mjs",
  "ui/render/assumptions_view.mjs",
  "ui/render/derivation_controller.mjs",
  "ui/render/dom_util.mjs",
  "ui/render/formula_view.mjs",
  "ui/render/inputs_controller.mjs",
  "ui/render/inputs_view.mjs",
  "ui/render/results_controller.mjs",
  "ui/render/results_view.mjs",
  "ui/render/targets_controller.mjs",
  "ui/render/targets_view.mjs",
  "ui/render/warnings_controller.mjs",
  "ui/render/warnings_view.mjs",
  "ui/state/store.mjs",
  "engine/conditions.mjs",
  "engine/derive.mjs",
  "engine/expr.mjs",
  "engine/index.mjs",
  "engine/loader.mjs",
  "engine/reverse.mjs",
  "engine/result.mjs",
  "engine/units.mjs",
  "data/catalog.meta.json",
  "data/engine-config.v0.1.json",
  "data/formulas.v0.1.json",
  "data/models.v0.1.json",
  "data/recommendations.v0.1.json",
  "data/sources.v0.1.json",
  "data/units.v0.1.json",
  "data/variables.v0.1.json",
];

const EXPECTED_FILE_COUNT = 42;
const EXPECTED_TOTAL_BYTES = 330250; // P₁, measured on the U1 tree (16d2b6e)

export async function run(t) {
  t.section("startup payload freeze (HEAD blob sizes)");
  const sizes = [];
  let missing = 0;
  for (const path of STARTUP_FILES) {
    try {
      const out = execFileSync("git", ["cat-file", "-s", `HEAD:${path}`], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      sizes.push({ path, bytes: Number(out.trim()) });
    } catch {
      missing += 1;
      sizes.push({ path, bytes: 0 });
    }
  }
  for (const { path, bytes } of sizes) {
    console.log(`  ${String(bytes).padStart(7)}  ${path}`);
  }
  const total = sizes.reduce((acc, s) => acc + s.bytes, 0);
  console.log(`  total: ${sizes.length} files, ${total} bytes`);
  t.ok("every startup blob exists in HEAD", missing === 0);
  t.ok("every startup blob has a positive byte size",
    sizes.every((s) => Number.isInteger(s.bytes) && s.bytes > 0));
  t.ok("the startup set holds exactly 42 files", sizes.length === EXPECTED_FILE_COUNT);
  t.ok("the byte total equals the re-pinned P₁ (330250)", total === EXPECTED_TOTAL_BYTES);
}
