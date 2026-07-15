/**
 * test_tire_code.mjs — §7.12 syntax, mapping, precheck matrix, scratch dry
 * run, and live-failure-stops behavior.
 */

import {
  parseTireCode,
  precheckTireCode,
  applyTireCode,
  TIRE_CODE_HINT,
  TIRE_FIELDS,
} from "../adapter/tire_code.mjs";

export const name = "tire_code: syntax + precheck + live writes (§7.12)";

export async function run(t) {
  t.section("syntax: the only accepted shape");
  t.ok("195/55R16 parses", parseTireCode("195/55R16").ok === true);
  t.ok("whitespace and lowercase r are tolerated", parseTireCode("  195 / 55 r 16 ").ok === true);
  t.ok("suffixes reject the whole string", parseTireCode("195/55R16 91V").ok === false);
  t.ok("wrong separators reject", parseTireCode("195-55R16").ok === false);
  t.ok("three-digit aspect rejects", parseTireCode("195/555R16").ok === false);
  t.ok("three-digit rim rejects", parseTireCode("195/55R165").ok === false);
  t.ok("empty string rejects", parseTireCode("").ok === false);
  t.ok("rejection carries the fixed hint", parseTireCode("junk").message === TIRE_CODE_HINT);

  t.section("mapping: fixed variable/unit assignment (default units)");
  const parsed = parseTireCode("195/55R16");
  t.ok(
    "width -> section_width @ millimeter = 195",
    parsed.values[0].variableId === "section_width" && parsed.values[0].unitId === "millimeter" && parsed.values[0].value === 195
  );
  t.ok(
    "aspect -> aspect_ratio @ percent = 55",
    parsed.values[1].variableId === "aspect_ratio" && parsed.values[1].unitId === "percent" && parsed.values[1].value === 55
  );
  t.ok(
    "rim -> rim_diameter @ inch = 16",
    parsed.values[2].variableId === "rim_diameter" && parsed.values[2].unitId === "inch" && parsed.values[2].value === 16
  );
  t.ok("field table is frozen", Object.isFrozen(TIRE_FIELDS) && TIRE_FIELDS.every(Object.isFrozen));

  t.section("precheck matrix");
  const { engine, adapter } = await t.freshApp();
  const createScratchEngine = async () => (await t.freshApp()).engine;

  t.ok("valid code passes the full precheck (real adapter + scratch dry run)",
    (await precheckTireCode(parsed, { adapter, createScratchEngine })).ok === true);
  t.ok("zero width fails the positive check",
    (await precheckTireCode(parseTireCode("00/55R16"), { adapter, createScratchEngine })).stage === "positive");
  t.ok("unregistered variable fails the variable check",
    (await precheckTireCode(parsed, { adapter: { variablesById: {} }, createScratchEngine })).stage === "variable");
  const noInputAdapter = {
    variablesById: {
      ...adapter.variablesById,
      section_width: { ...adapter.variablesById.section_width, can_be_user_input: false },
    },
  };
  t.ok("can_be_user_input=false fails the variable check",
    (await precheckTireCode(parsed, { adapter: noInputAdapter, createScratchEngine })).stage === "variable");
  const noUnitAdapter = {
    variablesById: {
      ...adapter.variablesById,
      section_width: { ...adapter.variablesById.section_width, allowed_units: ["inch"] },
    },
  };
  t.ok("unit outside allowed_units fails the unit check",
    (await precheckTireCode(parsed, { adapter: noUnitAdapter, createScratchEngine })).stage === "unit");
  const failingScratch = async () => ({
    setUserInput: (variableId) =>
      variableId === "aspect_ratio"
        ? { ok: false, result: null, diagnostic: { code: "x", message: "dry-run refusal" } }
        : { ok: true, result: {}, diagnostic: null },
  });
  t.ok("scratch dry-run failure is reported as dry_run stage",
    (await precheckTireCode(parsed, { adapter, createScratchEngine: failingScratch })).stage === "dry_run");

  t.section("precheck never touches the live engine");
  const before = engine.getResults().length;
  await precheckTireCode(parsed, { adapter, createScratchEngine });
  t.ok("live pool is unchanged by a full precheck", engine.getResults().length === before);

  t.section("live writes: full pass");
  const report = applyTireCode(parsed, engine);
  t.ok("all three values written in order", report.ok === true && report.applied.length === 3);
  t.ok("written instances are real user inputs",
    report.applied.every((a) => a.result.source === "user_input" && typeof a.result.result_id === "string"));

  t.section("live writes: first failure stops the remaining writes");
  const calls = [];
  const scripted = {
    setUserInput(variableId, value, unitId) {
      calls.push(variableId);
      if (variableId === "aspect_ratio") {
        return { ok: false, result: null, diagnostic: { code: "x", message: "live refusal" } };
      }
      return { ok: true, result: { result_id: `fake_${variableId}`, source: "user_input" }, diagnostic: null };
    },
  };
  const partial = applyTireCode(parsed, scripted);
  t.ok("failure is reported with the failing variable",
    partial.ok === false && partial.failure.variableId === "aspect_ratio");
  t.ok("the write before the failure is listed honestly",
    partial.applied.length === 1 && partial.applied[0].variableId === "section_width");
  t.ok("no further write is attempted after the failure",
    JSON.stringify(calls) === JSON.stringify(["section_width", "aspect_ratio"]));
}
