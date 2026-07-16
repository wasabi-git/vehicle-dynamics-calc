/**
 * formula_view.mjs — §7.9 RENDERER layer: converts the safe render tree of
 * formula_format.mjs into DOM. Text lands exclusively through textContent
 * (dom_util.el); the fallback renders as an escaped monospace block. No
 * string ever reaches innerHTML or an event attribute.
 */

import { el } from "./dom_util.mjs";
import { splitSymbol, tokenizeSymbolRuns } from "../adapter/formula_format.mjs";

function renderNode(node) {
  switch (node.type) {
    case "seq":
      return el("span", { class: "formula-seq" }, node.children.map(renderNode));
    case "frac":
      return el("span", { class: "frac" }, [
        el("span", { class: "frac__num" }, [renderNode(node.num)]),
        el("span", { class: "frac__den" }, [renderNode(node.den)]),
      ]);
    case "sub": {
      const wrap = el("span", {}, [renderNode(node.base)]);
      wrap.append(el("sub", {}, [renderNode(node.script)]));
      return wrap;
    }
    case "sup": {
      const wrap = el("span", {}, [renderNode(node.base)]);
      wrap.append(el("sup", {}, [renderNode(node.script)]));
      return wrap;
    }
    case "sym":
      return el("span", { class: "formula-sym", text: ` ${node.text}` });
    case "num":
      return el("span", { class: "num", text: ` ${node.text}` });
    case "op":
      return el("span", { class: "formula-op", text: ` ${node.text}` });
    case "fallback":
      return el("span", { class: "formula-fallback", text: node.text });
    default:
      return el("span", { class: "formula-fallback", text: "" });
  }
}

/** Render a safe tree into a .formula-block element. */
export function formulaBlock(tree) {
  return el("div", { class: "formula-block" }, [renderNode(tree)]);
}

/**
 * Render a catalog variable symbol ("F_x", "ω_e", "R_hx", "M") as typeset
 * DOM: the part after the first underscore becomes a subscript. Plain
 * symbols pass through. textContent only — same safety rule as formulas.
 * Splitting comes from the pure adapter helper so Node can assert it.
 */
export function symbolSpan(symbolText, className = "formula-sym") {
  const { base, sub } = splitSymbol(symbolText);
  if (sub === null) return el("span", { class: className, text: base });
  const wrap = el("span", { class: className, text: base });
  wrap.append(el("sub", { text: sub }));
  return wrap;
}

/**
 * Render prose that embeds symbol notation (source notes): `base_sub` runs
 * typeset with real subscripts, everything else stays literal text.
 * textContent only — no raw underscore reaches the user.
 */
export function proseWithSymbols(text, className = "") {
  const wrap = el("span", { class: className });
  for (const token of tokenizeSymbolRuns(text)) {
    if (token.kind === "sym") {
      const sym = el("span", { text: token.base });
      sym.append(el("sub", { text: token.sub }));
      wrap.append(sym);
    } else {
      wrap.append(el("span", { text: token.text }));
    }
  }
  return wrap;
}
