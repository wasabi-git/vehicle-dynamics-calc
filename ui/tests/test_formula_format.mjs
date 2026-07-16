/**
 * test_formula_format.mjs — §7.9 parser layer: safe AST structure, the 8
 * verbatim compatibility fixtures (0 fallbacks), the malicious fixtures
 * (whole-string fallback, no partial rendering), and catalog coverage.
 */

import { formatFormula, isFallback, splitSymbol, plainSymbol } from "../adapter/formula_format.mjs";

export const name = "formula_format: M3 parser (§7.9)";

const COMPAT = [
  "r_w = \\frac{w_s AR}{25.4} + \\frac{d_{rim}}{2}",
  "V = \\frac{r_w \\omega_e}{N_{tf}}",
  "HP = \\frac{T_e \\cdot RPM}{5252}",
  "F_x = \\frac{T_e N_{tf} \\eta_{tf}}{r_w}",
  "M_f = 1 + 0.04N_{tf} + 0.0025N_{tf}^2",
  "M = \\frac{W}{g}",
  "a_x = \\frac{F_x-D_A-R_x-W\\sin\\theta-R_{hx}}{M_fM}",
  "a_x = \\frac{P}{VM}",
];

const MALICIOUS = [
  "<img src=x onerror=alert(1)>",
  "<script>alert(1)</script>",
  "A & B < C",
];

function nodeTypes(tree, out = new Set()) {
  out.add(tree.type);
  if (tree.children) for (const c of tree.children) nodeTypes(c, out);
  if (tree.num) nodeTypes(tree.num, out);
  if (tree.den) nodeTypes(tree.den, out);
  if (tree.base) nodeTypes(tree.base, out);
  if (tree.script) nodeTypes(tree.script, out);
  return out;
}

function collectText(tree, out = []) {
  if (tree.text !== undefined) out.push(tree.text);
  if (tree.children) for (const c of tree.children) collectText(c, out);
  if (tree.num) collectText(tree.num, out);
  if (tree.den) collectText(tree.den, out);
  if (tree.base) collectText(tree.base, out);
  if (tree.script) collectText(tree.script, out);
  return out;
}

export async function run(t) {
  t.section("compatibility fixtures: 8/8 parse without fallback");
  const trees = COMPAT.map(formatFormula);
  trees.forEach((tree, i) => {
    t.ok(`fixture ${i + 1} parses (no fallback anywhere in the tree)`,
      !isFallback(tree) && !nodeTypes(tree).has("fallback"));
  });

  t.section("structural spot checks");
  t.ok("fixture 1: two fractions and a plus at the top level",
    (() => {
      const kids = trees[0].children;
      return kids.filter((n) => n.type === "frac").length === 2 &&
        kids.some((n) => n.type === "op" && n.text === "+") &&
        kids.some((n) => n.type === "op" && n.text === "=");
    })());
  t.ok("fixture 2: omega renders as the greek symbol with a subscript",
    collectText(trees[1]).includes("ω"));
  t.ok("fixture 3: cdot renders as the middle-dot operator",
    collectText(trees[2]).includes("·"));
  t.ok("fixture 5: N_{tf}^2 chains subscript then superscript",
    (() => {
      const kids = trees[4].children;
      const sup = kids.find((n) => n.type === "sup");
      return sup && sup.base.type === "sub" && sup.script.text === "2";
    })());
  t.ok("fixture 7: ASCII minus and \\sin\\theta survive in the numerator",
    (() => {
      const frac = trees[6].children.find((n) => n.type === "frac");
      const texts = collectText(frac.num);
      return texts.includes("sin") && texts.includes("θ") && texts.filter((x) => x === "-").length === 4;
    })());
  t.ok("fixture 7: M_fM denominator is M-sub-f followed by M",
    (() => {
      const frac = trees[6].children.find((n) => n.type === "frac");
      const den = frac.den;
      return den.type === "seq" && den.children[0].type === "sub" && den.children[1].type === "sym" && den.children[1].text === "M";
    })());

  t.section("malicious fixtures: whole-string fallback, nothing partial");
  for (const source of MALICIOUS) {
    const tree = formatFormula(source);
    t.ok(`falls back whole: ${source.slice(0, 24)}`,
      isFallback(tree) && tree.text === source && Object.keys(tree).length === 2);
  }

  t.section("unsupported tokens always fall back whole");
  t.ok("unknown command", isFallback(formatFormula("\\sqrt{2}")));
  t.ok("unbalanced group", isFallback(formatFormula("\\frac{a}{b")));
  t.ok("stray brace", isFallback(formatFormula("a } b")));
  t.ok("empty input", isFallback(formatFormula("")));
  t.ok("non-string input", isFallback(formatFormula(null)));

  t.section("catalog coverage: every registered display expression parses");
  const { adapter } = await t.freshApp();
  const failures = adapter.formulas.filter((f) => isFallback(formatFormula(f.expression)));
  t.ok(`all ${adapter.formulas.length} catalog expressions render without fallback`, failures.length === 0);

  t.section("parser is DOM-free");
  t.ok("module exposes plain objects only",
    typeof formatFormula("M = \\frac{W}{g}") === "object" && typeof globalThis.document === "undefined");

  t.section("symbol typesetting helpers (C9R1: no raw underscore reaches the user)");
  t.ok("splitSymbol: F_x -> F + x",
    JSON.stringify(splitSymbol("F_x")) === JSON.stringify({ base: "F", sub: "x" }));
  t.ok("splitSymbol: greek base ω_e -> ω + e",
    JSON.stringify(splitSymbol("ω_e")) === JSON.stringify({ base: "ω", sub: "e" }));
  t.ok("splitSymbol: multi-letter subscript R_hx -> R + hx",
    JSON.stringify(splitSymbol("R_hx")) === JSON.stringify({ base: "R", sub: "hx" }));
  t.ok("splitSymbol: plain M passes through",
    JSON.stringify(splitSymbol("M")) === JSON.stringify({ base: "M", sub: null }));
  t.ok("splitSymbol tolerates empty and null", splitSymbol("").sub === null && splitSymbol(null).base === "");
  t.ok("plainSymbol strips the underscore for option-safe text",
    plainSymbol("F_x") === "Fx" && plainSymbol("ω_e") === "ωe" && plainSymbol("M") === "M");
  t.ok("every catalog variable symbol has an underscore-free plain form",
    adapter.variables.every((v) => !plainSymbol(v.symbol).includes("_")));
  t.ok("every registered unit exposes an underscore-free display_symbol",
    adapter.units.every((u) => typeof u.display_symbol === "string" && u.display_symbol.length > 0 && !u.display_symbol.includes("_")));
  t.ok("the units named by the owner map to their common symbols",
    adapter.unitsById.newton.display_symbol === "N" &&
    adapter.unitsById.radian.display_symbol === "rad" &&
    adapter.unitsById.kilogram.display_symbol === "kg");
}
