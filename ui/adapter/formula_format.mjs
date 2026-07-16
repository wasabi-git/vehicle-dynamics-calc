/**
 * formula_format.mjs — §7.9 restricted LaTeX-subset formatter, PARSER layer.
 *
 * Pure JS: returns a safe render tree of plain objects and never touches
 * document, HTMLElement, or innerHTML. The renderer
 * (ui/render/formula_view.mjs) converts the tree to DOM with textContent.
 *
 * Closed lexical table: ASCII + - = / ( ); whitespace; decimal numbers;
 * Latin identifiers; { } _ ^; and the LaTeX commands \frac \cdot \sin
 * \omega \eta \theta \pi. The minus sign is ASCII "-". ANY other token
 * fails the whole expression into {type:"fallback", text: original} (M1) —
 * partial rendering is forbidden.
 *
 * Safe tree node types:
 *   {type:"seq",  children: node[]}
 *   {type:"frac", num: node, den: node}
 *   {type:"sub",  base: node, script: node}
 *   {type:"sup",  base: node, script: node}
 *   {type:"sym",  text}          — identifier run / named function / greek
 *   {type:"num",  text}
 *   {type:"op",   text}          — + - = / ( ) ·
 *   {type:"fallback", text}      — whole original expression, escaped later
 */

const COMMANDS = Object.freeze({
  frac: "frac",
  cdot: "op:·",
  sin: "sym:sin",
  omega: "sym:ω",
  eta: "sym:η",
  theta: "sym:θ",
  pi: "sym:π",
});

const OPS = new Set(["+", "-", "=", "/", "(", ")"]);

function lex(text) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === " " || ch === "\t" || ch === "\n") {
      tokens.push({ kind: "space" });
      i += 1;
      while (i < text.length && (text[i] === " " || text[i] === "\t" || text[i] === "\n")) i += 1;
      continue;
    }
    if (OPS.has(ch)) {
      tokens.push({ kind: "op", text: ch });
      i += 1;
      continue;
    }
    if (ch === "{" || ch === "}" || ch === "_" || ch === "^") {
      tokens.push({ kind: ch });
      i += 1;
      continue;
    }
    if (ch >= "0" && ch <= "9") {
      let j = i + 1;
      while (j < text.length && text[j] >= "0" && text[j] <= "9") j += 1;
      if (text[j] === "." && text[j + 1] >= "0" && text[j + 1] <= "9") {
        j += 2;
        while (j < text.length && text[j] >= "0" && text[j] <= "9") j += 1;
      }
      tokens.push({ kind: "number", text: text.slice(i, j) });
      i = j;
      continue;
    }
    if (/[A-Za-z]/.test(ch)) {
      tokens.push({ kind: "letter", text: ch });
      i += 1;
      continue;
    }
    if (ch === "\\") {
      let j = i + 1;
      while (j < text.length && /[a-z]/.test(text[j])) j += 1;
      const name = text.slice(i + 1, j);
      if (!(name in COMMANDS)) return null;
      tokens.push({ kind: "command", name });
      i = j;
      continue;
    }
    return null; // outside the closed table -> whole-expression fallback
  }
  return tokens;
}

/** Parser over the token stream. Throws {fallback:true} on any mismatch. */
function makeParser(tokens) {
  let pos = 0;
  const bail = () => {
    const err = new Error("fallback");
    err.fallback = true;
    throw err;
  };
  const peek = () => tokens[pos] ?? null;
  const next = () => tokens[pos++] ?? bail();

  function parseGroup() {
    const open = next();
    if (open.kind !== "{") bail();
    const children = parseSequence(["}"]);
    const close = next();
    if (!close || close.kind !== "}") bail();
    return children.length === 1 ? children[0] : { type: "seq", children };
  }

  /** One script argument: a group or a single letter/digit token. */
  function parseScriptArg() {
    const token = peek();
    if (!token) bail();
    if (token.kind === "{") return parseGroup();
    if (token.kind === "letter") {
      next();
      return { type: "sym", text: token.text };
    }
    if (token.kind === "number") {
      next();
      return { type: "num", text: token.text };
    }
    if (token.kind === "command") {
      next();
      const spec = COMMANDS[token.name];
      if (spec.startsWith("sym:")) return { type: "sym", text: spec.slice(4) };
      bail();
    }
    bail();
    return null;
  }

  /** Attach _ and ^ scripts (either order, at most one of each). */
  function withScripts(base) {
    let node = base;
    while (peek() && (peek().kind === "_" || peek().kind === "^")) {
      const marker = next();
      const script = parseScriptArg();
      node = { type: marker.kind === "_" ? "sub" : "sup", base: node, script };
    }
    return node;
  }

  function parseAtom() {
    const token = next();
    if (token.kind === "letter") {
      // merge an unbroken letter run into one symbol; scripts bind to the
      // full run only when they follow it directly (LaTeX: `_` takes the
      // next single token, so `M_fM` is M-sub-f followed by M — the run
      // merge stops before `_`).
      let text = token.text;
      while (peek() && peek().kind === "letter") text += next().text;
      return withScripts({ type: "sym", text });
    }
    if (token.kind === "number") return withScripts({ type: "num", text: token.text });
    if (token.kind === "op") return { type: "op", text: token.text };
    if (token.kind === "command") {
      const spec = COMMANDS[token.name];
      if (spec === "frac") {
        const num = parseGroup();
        const den = parseGroup();
        return withScripts({ type: "frac", num, den });
      }
      if (spec.startsWith("op:")) return { type: "op", text: spec.slice(3) };
      return withScripts({ type: "sym", text: spec.slice(4) });
    }
    bail();
    return null;
  }

  function parseSequence(stopKinds) {
    const children = [];
    while (peek()) {
      const token = peek();
      if (stopKinds.includes(token.kind)) break;
      if (token.kind === "space") {
        next();
        continue; // spaces only separate letter runs; layout adds spacing
      }
      if (token.kind === "}" || token.kind === "_" || token.kind === "^") bail();
      children.push(parseAtom());
    }
    return children;
  }

  return { parseSequence, atEnd: () => pos >= tokens.length };
}

/**
 * Parse one source expression into the safe render tree.
 * Unsupported input returns {type:"fallback", text: originalExpression} —
 * never a partial tree.
 */
export function formatFormula(expression) {
  const original = String(expression ?? "");
  const tokens = lex(original);
  if (tokens === null) return { type: "fallback", text: original };
  try {
    const parser = makeParser(tokens);
    const children = parser.parseSequence([]);
    if (!parser.atEnd() || children.length === 0) return { type: "fallback", text: original };
    return children.length === 1 ? children[0] : { type: "seq", children };
  } catch (error) {
    if (error && error.fallback) return { type: "fallback", text: original };
    throw error;
  }
}

/** True when the tree is the whole-expression fallback. */
export function isFallback(tree) {
  return Boolean(tree) && tree.type === "fallback";
}

/**
 * Split a catalog variable symbol at its first underscore into base and
 * subscript ("F_x" -> {base:"F", sub:"x"}, "M" -> {base:"M", sub:null}).
 * Pure and Node-testable; the single source both for the DOM typesetter
 * (ui/render/formula_view.mjs symbolSpan) and for the plain-text form.
 */
export function splitSymbol(symbolText) {
  const text = String(symbolText ?? "");
  const cut = text.indexOf("_");
  if (cut <= 0) return { base: text, sub: null };
  return { base: text.slice(0, cut), sub: text.slice(cut + 1) };
}

/**
 * Underscore-free plain-text form for surfaces that cannot carry subscript
 * markup (native <option> text): "F_x" -> "Fx", "ω_e" -> "ωe", "M" -> "M".
 * The raw underscore form must never reach a user-visible position.
 */
export function plainSymbol(symbolText) {
  const { base, sub } = splitSymbol(symbolText);
  return sub === null ? base : `${base}${sub}`;
}

/**
 * Tokenize prose that may embed symbol notation (source notes such as
 * "V = r_w ω_e / N_tf"): every `base_sub` run becomes a symbol token, the
 * rest stays literal text. Pure and Node-testable; the DOM side
 * (ui/render/formula_view.mjs proseWithSymbols) renders symbol tokens with
 * real subscripts so no raw underscore reaches the user.
 */
export function tokenizeSymbolRuns(text) {
  const source = String(text ?? "");
  const out = [];
  const re = /([A-Za-zΑ-ω]+)_([A-Za-z0-9]+)/g;
  let last = 0;
  let match;
  while ((match = re.exec(source)) !== null) {
    if (match.index > last) out.push({ kind: "text", text: source.slice(last, match.index) });
    out.push({ kind: "sym", base: match[1], sub: match[2] });
    last = match.index + match[0].length;
  }
  if (last < source.length) out.push({ kind: "text", text: source.slice(last) });
  return out;
}
