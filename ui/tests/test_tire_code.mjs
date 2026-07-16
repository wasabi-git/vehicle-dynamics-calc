/**
 * test_tire_code.mjs — §7.12 syntax, mapping, precheck matrix, scratch dry
 * run, and live-failure-stops behavior.
 */

import {
  parseTireCode,
  precheckTireCode,
  applyTireCode,
  composeTireCode,
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

  t.section("C9R4: three-box composition feeds the same syntax gate");
  t.ok("boxes compose the canonical string", composeTireCode("195", "55", "16") === "195/55R16");
  t.ok("composed canonical string parses identically",
    JSON.stringify(parseTireCode(composeTireCode(" 195 ", "55", "16"))) === JSON.stringify(parseTireCode("195/55R16")));
  t.ok("junk in any box is rejected by the same parser with the fixed hint",
    parseTireCode(composeTireCode("195", "55x", "16")).message === TIRE_CODE_HINT &&
    parseTireCode(composeTireCode("", "55", "16")).ok === false);

  t.section("precheck matrix");
  const { engine, adapter } = await t.freshApp();
  const createScratchEngine = async () => (await t.freshApp()).engine;

  t.ok("valid code passes the full precheck (real adapter + scratch dry run)",
    (await precheckTireCode(parsed, { adapter, createScratchEngine })).ok === true);
  const zeroWidth = await precheckTireCode(parseTireCode("00/55R16"), { adapter, createScratchEngine });
  t.ok("zero width fails the positive check",
    zeroWidth.stage === "positive");
  t.ok("C9R2: the positive-check copy uses the variable name, not the internal id",
    zeroWidth.message.includes(adapter.variablesById.section_width.name) && !zeroWidth.message.includes("section_width"));
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
  const dryRunFail = await precheckTireCode(parsed, { adapter, createScratchEngine: failingScratch });
  t.ok("scratch dry-run failure is reported as dry_run stage", dryRunFail.stage === "dry_run");
  t.ok("C9R2: dry-run copy is friendly; the raw diagnostic survives as developerFallback",
    dryRunFail.message.includes(adapter.variablesById.aspect_ratio.name) &&
    !dryRunFail.message.includes("aspect_ratio") &&
    dryRunFail.developerFallback === "dry-run refusal");

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
