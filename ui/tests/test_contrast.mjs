/**
 * test_contrast.mjs — §11.2 fixed contrast matrix, machine-asserted
 * combination by combination against the LIVE values in ui/tokens.css
 * (WCAG relative-luminance contrast ratio).
 */

import { readFile } from "node:fs/promises";

export const name = "contrast: §11.2 fixed matrix over tokens.css";

function channel(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** §11.2 matrix: [foreground token, background token, threshold]. */
const MATRIX = [
  ["--text-primary", "--surface-card", 4.5],
  ["--text-primary", "--surface-page", 4.5],
  ["--text-secondary", "--surface-card", 4.5],
  ["--text-secondary", "--surface-page", 4.5],
  ["--accent", "--surface-card", 4.5],
  ["--accent", "--surface-page", 4.5],
  ["--on-accent", "--accent", 4.5],
  ["--warning-text", "--warning-bg", 4.5],
  ["--danger-text", "--danger-bg", 4.5],
  ["--text-primary", "--surface-card", 3.0], // hero 42px large-text floor
  ["--text-secondary", "--surface-card", 3.0], // information-bearing dot floor
];

export async function run(t) {
  const css = await readFile(new URL("../tokens.css", import.meta.url), "utf8");
  const tokens = {};
  for (const [, name, value] of css.matchAll(/(--[a-z-]+):\s*(#[0-9A-Fa-f]{6})/g)) {
    if (!(name in tokens)) tokens[name] = value; // first (light-theme root) wins
  }

  t.section("token extraction");
  t.ok("every matrix token resolves to a hex value in tokens.css",
    MATRIX.every(([f, b]) => tokens[f] && tokens[b]));

  t.section("matrix, combination by combination");
  for (const [fg, bg, threshold] of MATRIX) {
    const ratio = contrast(tokens[fg], tokens[bg]);
    t.ok(`${fg} on ${bg} ≥ ${threshold} (measured ${ratio.toFixed(2)})`, ratio >= threshold);
  }

  t.section("reference sanity");
  t.ok("primary-on-white is deep black-level contrast (≈16)", contrast(tokens["--text-primary"], "#FFFFFF") > 15);
  t.ok("decoration color is NOT asserted for text (it may not carry information)",
    tokens["--color-decoration"] !== undefined);
}
