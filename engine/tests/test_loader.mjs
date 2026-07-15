/** M0 gate tests: real-data full load + malformed fixtures produce diagnostics. */

import { loadCatalog, CATALOG_ENTRY_PATH, REQUIRED_DATA_ROLES } from "../loader.mjs";
import { repoReader, virtualReader } from "./node_reader.mjs";
import { test, assert, assertEqual, hasDiagnostic } from "./harness.mjs";
import { MALFORMED_FIXTURES } from "./fixtures/malformed.mjs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { REPO_ROOT } from "./node_reader.mjs";

export async function run() {
  console.log("test_loader (M0)");

  await test("real catalog loads fully with zero error diagnostics", async () => {
    const result = await loadCatalog(repoReader());
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    assertEqual(errors.length, 0, `unexpected errors: ${JSON.stringify(errors, null, 2)}`);
    assert(result.ok, "result.ok must be true");
    assertEqual(result.data.variables.size, 20, "variable count");
    assertEqual(result.data.formulas.size, 8, "formula count");
    assertEqual(result.data.modelGroups.size, 3, "model group count");
    assertEqual(result.data.models.size, 8, "model count");
    assertEqual(result.data.recommendations.size, 1, "recommendation count");
    assertEqual(result.data.sources.size, 3, "source count");
    assertEqual(result.data.units.size, 27, "unit count");
    assertEqual(result.data.engineConfig.allow_automatic_algebraic_inversion, false, "inversion stays disabled");
  });

  await test("loader resolves every role from the catalog registration", async () => {
    const result = await loadCatalog(repoReader());
    for (const role of REQUIRED_DATA_ROLES) {
      assert(typeof result.data.paths[role] === "string", `missing path for role ${role}`);
    }
  });

  // Build the base virtual map once from the real repository files.
  const catalogText = await readFile(join(REPO_ROOT, CATALOG_ENTRY_PATH), "utf8");
  const catalog = JSON.parse(catalogText);
  const dataPaths = catalog.files
    .filter((f) => REQUIRED_DATA_ROLES.includes(f.role))
    .map((f) => f.path);
  const baseByPath = {};
  for (const p of dataPaths) {
    baseByPath[p] = JSON.parse(await readFile(join(REPO_ROOT, p), "utf8"));
  }

  for (const fixture of MALFORMED_FIXTURES) {
    await test(`malformed: ${fixture.name}`, async () => {
      const docs = {
        catalogText: null,
        catalog: JSON.parse(catalogText),
        byPath: JSON.parse(JSON.stringify(baseByPath)),
      };
      fixture.mutate(docs);

      const files = {};
      for (const [p, doc] of Object.entries(docs.byPath)) {
        files[p] = JSON.stringify(doc);
      }
      files[CATALOG_ENTRY_PATH] = docs.catalogText !== null ? docs.catalogText : JSON.stringify(docs.catalog);

      const result = await loadCatalog(virtualReader(files));
      assertEqual(result.ok, false, "malformed input must not load ok");
      for (const code of fixture.expectCodes) {
        assert(
          hasDiagnostic(result.diagnostics, code),
          `expected diagnostic code ${code}; got ${JSON.stringify(result.diagnostics.map((d) => d.code))}`
        );
      }
    });
  }
}
