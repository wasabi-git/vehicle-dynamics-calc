/**
 * formula_view.mjs — §7.9 RENDERER layer: converts the safe render tree of
 * formula_format.mjs into DOM. Text lands exclusively through textContent
 * (dom_util.el); the fallback renders as an escaped monospace block. No
 * string ever reaches innerHTML or an event attribute.
 */

import { el } from "./dom_util.mjs";

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
