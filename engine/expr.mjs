/**
 * expr.mjs — micro restricted expression parser for calculation_expression.
 *
 * v0.1 grammar (Part 3 §3.10 十九):
 *   +  -  *  /  ^  ( )  unary +/-  sin(x)
 *   identifiers must be formal variable_ids from the formula's
 *   required_inputs; numeric literals are plain decimals.
 *
 * No eval, no Function constructor, no dynamic code of any kind: the text is
 * tokenized, parsed into an AST by recursive descent, and evaluated by
 * walking the AST. Unknown syntax and unknown identifiers are compile-time
 * structured diagnostics.
 *
 *   expr  := term (('+'|'-') term)*
 *   term  := unary (('*'|'/') unary)*
 *   unary := ('+'|'-') unary | power
 *   power := primary ('^' unary)?          // right-associative exponent
 *   primary := NUMBER | IDENT | 'sin' '(' expr ')' | '(' expr ')'
 */

const FUNCTIONS = Object.freeze({ sin: Math.sin });

function err(code, message) {
  return {
    ok: false,
    diagnostic: { severity: "error", code, file: null, path: null, message },
  };
}

function tokenize(text) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i += 1;
      continue;
    }
    if ("+-*/^()".includes(ch)) {
      tokens.push({ type: ch, position: i });
      i += 1;
      continue;
    }
    if (ch >= "0" && ch <= "9") {
      let j = i;
      while (j < text.length && text[j] >= "0" && text[j] <= "9") j += 1;
      if (text[j] === ".") {
        j += 1;
        while (j < text.length && text[j] >= "0" && text[j] <= "9") j += 1;
      }
      tokens.push({ type: "number", value: Number(text.slice(i, j)), position: i });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < text.length && /[A-Za-z0-9_]/.test(text[j])) j += 1;
      tokens.push({ type: "identifier", name: text.slice(i, j), position: i });
      i = j;
      continue;
    }
    return { error: err("expression_token_invalid", `Unexpected character ${JSON.stringify(ch)} at position ${i}.`) };
  }
  tokens.push({ type: "end", position: text.length });
  return { tokens };
}

/**
 * Compile an expression against the formula's required_inputs.
 * Returns { ok, evaluate, identifiers, diagnostic }:
 *   evaluate(env) -> { ok, value, diagnostic } with env = { variable_id: number }.
 */
export function compileExpression(text, allowedNames) {
  if (typeof text !== "string" || text.trim() === "") {
    return { ...err("expression_empty", "calculation_expression is empty."), evaluate: null, identifiers: [] };
  }
  const allowed = new Set(allowedNames);
  const { tokens, error } = tokenize(text);
  if (error) return { ...error, evaluate: null, identifiers: [] };

  let pos = 0;
  const identifiers = new Set();
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function fail(message) {
    const e = new Error(message);
    e.expression_error = true;
    return e;
  }

  function parseExpr() {
    let node = parseTerm();
    while (peek().type === "+" || peek().type === "-") {
      const op = next().type;
      node = { kind: "binary", op, left: node, right: parseTerm() };
    }
    return node;
  }

  function parseTerm() {
    let node = parseUnary();
    while (peek().type === "*" || peek().type === "/") {
      const op = next().type;
      node = { kind: "binary", op, left: node, right: parseUnary() };
    }
    return node;
  }

  function parseUnary() {
    if (peek().type === "+" || peek().type === "-") {
      const op = next().type;
      return { kind: "unary", op, operand: parseUnary() };
    }
    return parsePower();
  }

  function parsePower() {
    const base = parsePrimary();
    if (peek().type === "^") {
      next();
      return { kind: "binary", op: "^", left: base, right: parseUnary() };
    }
    return base;
  }

  function parsePrimary() {
    const token = next();
    if (token.type === "number") return { kind: "number", value: token.value };
    if (token.type === "identifier") {
      if (Object.prototype.hasOwnProperty.call(FUNCTIONS, token.name)) {
        if (next().type !== "(") throw fail(`Function ${token.name} requires parentheses.`);
        const argument = parseExpr();
        if (next().type !== ")") throw fail(`Unclosed argument list for ${token.name}.`);
        return { kind: "call", name: token.name, argument };
      }
      if (!allowed.has(token.name)) {
        throw fail(`Identifier ${JSON.stringify(token.name)} is not among required_inputs.`);
      }
      identifiers.add(token.name);
      return { kind: "variable", name: token.name };
    }
    if (token.type === "(") {
      const inner = parseExpr();
      if (next().type !== ")") throw fail("Unclosed parenthesis.");
      return inner;
    }
    throw fail(`Unexpected token ${JSON.stringify(token.type)} at position ${token.position}.`);
  }

  let ast;
  try {
    ast = parseExpr();
    if (peek().type !== "end") {
      throw fail(`Trailing input at position ${peek().position}.`);
    }
  } catch (cause) {
    if (!cause.expression_error) throw cause;
    return { ...err("expression_syntax_invalid", cause.message), evaluate: null, identifiers: [] };
  }

  function walk(node, env) {
    switch (node.kind) {
      case "number":
        return node.value;
      case "variable":
        return env[node.name];
      case "unary":
        return node.op === "-" ? -walk(node.operand, env) : walk(node.operand, env);
      case "call":
        return FUNCTIONS[node.name](walk(node.argument, env));
      case "binary": {
        const left = walk(node.left, env);
        const right = walk(node.right, env);
        switch (node.op) {
          case "+": return left + right;
          case "-": return left - right;
          case "*": return left * right;
          case "/": return left / right;
          case "^": return Math.pow(left, right);
          default: return NaN;
        }
      }
      default:
        return NaN;
    }
  }

  function evaluate(env) {
    for (const name of identifiers) {
      if (typeof env[name] !== "number" || !Number.isFinite(env[name])) {
        return { ...err("expression_input_not_finite", `Input ${name} is missing or not finite.`), value: null };
      }
    }
    const value = walk(ast, env);
    return { ok: true, value, diagnostic: null };
  }

  return { ok: true, evaluate, identifiers: [...identifiers], diagnostic: null };
}
