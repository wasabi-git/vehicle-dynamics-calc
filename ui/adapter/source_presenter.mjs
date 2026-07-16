/**
 * source_presenter.mjs — §7.13: the ONLY outlet for source display fields.
 *
 * Input: the sources-registry record plus one formula source_reference
 * {source_id, locator, note}. Output: a closed {label, locator, note}
 * object. The presenter NEVER reads, passes through, or dynamically uses
 * the source record's `title` or `file_name` — every public label comes
 * from the fixed approved map below. (S002's approved label happens to
 * equal its current title string; that is a mapping CONSTANT, not a data
 * pass-through. file_name was removed from the data by D32; the ban stays
 * as defense in depth.) locator/note pass through: every live value was
 * individually reviewed as engineering text.
 *
 * Renderers must never touch raw source / source_reference fields —
 * derivation details, formula cards, and every source line go through
 * this function.
 */

const APPROVED_LABELS = Object.freeze({
  S001_vehicle_dynamics_formulae: "Formula reference",
  S002_fundamentals_vehicle_dynamics: "Fundamentals of Vehicle Dynamics, Revised Edition",
  S003_course_subtitles: "Validated lecture reference",
});

const FALLBACK_LABEL = "Reference";

/**
 * The three D33R-approved private-reference placeholders. They stay in the
 * public data for traceability (sanitized, reviewer-approved — they carry
 * no recoverable information even when inspected via devtools or the
 * repository), but the UI suppresses them (owner-directed C9R8): the
 * approved label alone represents such a source. Exact-match only — any
 * other text keeps passing through verbatim.
 */
const PRIVATE_PLACEHOLDERS = Object.freeze(
  new Set([
    "(reference kept privately)",
    "(engine-power derivation reference kept privately)",
    "(low-speed model behavior reference kept privately)",
  ])
);

/**
 * @param {object} _sourceRecord — accepted to prove no pass-through; never read.
 * @param {object} reference — {source_id, locator, note}
 * @returns {{label: string, locator: string|null, note: string|null}}
 */
export function presentSource(_sourceRecord, reference) {
  return {
    label: APPROVED_LABELS[reference.source_id] ?? FALLBACK_LABEL,
    locator: PRIVATE_PLACEHOLDERS.has(reference.locator) ? null : reference.locator,
    note: PRIVATE_PLACEHOLDERS.has(reference.note) ? null : reference.note,
  };
}

/** Present every source_reference of one formula record. */
export function presentFormulaSources(adapter, formula) {
  return (formula.source_reference ?? []).map((reference) =>
    presentSource(adapter.sourcesById[reference.source_id] ?? null, reference)
  );
}
