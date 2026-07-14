/**
 * reconcile.mjs — strict item-by-item reconciliation between the engine's
 * numeric acceptance scan and validation/tools/cross_check.py.
 *
 * Enforced (final-review directive; any violation fails the gate):
 *   - cross_check output must parse to exactly EXPECTED_CC_ITEMS (23) rows;
 *   - every cross_check row must match exactly one engine judgment
 *     (matched count = 23);
 *   - exactly one engine judgment may remain unmatched (cases-only), and it
 *     must be precisely A3 wheel_radius [in] — the duplicate the script does
 *     not re-check — and it must be a PASS;
 *   - PASS/FAIL tags must agree on every matched pair;
 *   - got values must agree within GOT_TOLERANCE_DEFAULT (absolute, sized to
 *     the script's 5-decimal print precision); the sole documented exception
 *     is A3 longitudinal_acceleration, where cross_check evaluates the grade
 *     as full-precision atan(0.05) while the case bank supplies the
 *     truncated 0.049958 rad input (observed difference ~1e-5).
 */

export const EXPECTED_CC_ITEMS = 23;

export const EXPECTED_CASES_ONLY = Object.freeze({
  label: "A3",
  variable_id: "wheel_radius",
  unit: "in",
});

export const GOT_TOLERANCE_DEFAULT = 1e-5;

export const GOT_TOLERANCE_EXCEPTIONS = Object.freeze([
  {
    label: "A3",
    variable_id: "longitudinal_acceleration",
    unit: "ft/s^2",
    tolerance: 5e-5,
    note: "cross_check uses atan(0.05); the case bank supplies 0.049958 rad",
  },
]);

/** cross_check prints short names / ASCII variants; map back to case tokens. */
const CC_NAME_MAP = { long_accel: "longitudinal_acceleration" };
const CC_UNIT_MAP = { "ft/s2": "ft/s^2" };
const CC_LINE = /^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+got=\s*(-?[\d.]+)\s+exp=\s*(-?[\d.]+)\s+dev=\s*([\d.]+)%\s+(PASS|FAIL)\s*$/;

export function parseCrossCheckOutput(stdout) {
  const items = [];
  for (const line of (stdout || "").split(/\r?\n/)) {
    const match = CC_LINE.exec(line.trim());
    if (match) {
      items.push({
        label: match[1],
        variable_id: CC_NAME_MAP[match[2]] ?? match[2],
        unit: CC_UNIT_MAP[match[3]] ?? match[3],
        got: Number(match[4]),
        expected: Number(match[5]),
        tag: match[7],
      });
    }
  }
  return items;
}

function gotTolerance(item) {
  const exception = GOT_TOLERANCE_EXCEPTIONS.find(
    (e) => e.label === item.label && e.variable_id === item.variable_id && e.unit === item.unit
  );
  return exception ? exception.tolerance : GOT_TOLERANCE_DEFAULT;
}

/**
 * @param {Array} engineItems - numeric items from the acceptance runner.
 * @param {Array} ccItems - parsed cross_check rows.
 * @returns {{ lines: string[], failures: string[], failed: boolean,
 *             matchedCount: number, casesOnly: Array }}
 */
export function reconcile(engineItems, ccItems) {
  const lines = [];
  const failures = [];

  if (ccItems.length !== EXPECTED_CC_ITEMS) {
    failures.push(`cross_check parsed ${ccItems.length} items; exactly ${EXPECTED_CC_ITEMS} required`);
  }

  const matched = new Set();
  let matchedCount = 0;
  for (const ccItem of ccItems) {
    const engineItem = engineItems.find(
      (i) =>
        !matched.has(i) &&
        i.label === ccItem.label &&
        i.variable_id === ccItem.variable_id &&
        i.unit === ccItem.unit &&
        // cross_check prints exp with 4 decimals; match at print precision.
        Math.abs(i.expected - ccItem.expected) <= 1e-4 * Math.max(1, Math.abs(ccItem.expected))
    );
    if (!engineItem) {
      failures.push(`${ccItem.label} ${ccItem.variable_id} [${ccItem.unit}]: no engine counterpart`);
      lines.push(`FAIL  ${ccItem.label}  ${ccItem.variable_id} [${ccItem.unit}]: no engine counterpart`);
      continue;
    }
    matched.add(engineItem);
    matchedCount += 1;

    const problems = [];
    const engineTag = engineItem.pass ? "PASS" : "FAIL";
    if (engineTag !== ccItem.tag) {
      problems.push(`tag mismatch (engine ${engineTag}, cross_check ${ccItem.tag})`);
    }
    if (engineItem.got === null) {
      problems.push("engine produced no value");
    } else {
      const tolerance = gotTolerance(ccItem);
      const delta = Math.abs(engineItem.got - ccItem.got);
      if (delta > tolerance) {
        problems.push(`got mismatch: engine ${engineItem.got} vs cross_check ${ccItem.got} (|d|=${delta.toExponential(2)} > ${tolerance})`);
      }
    }
    const head = `${ccItem.label}  ${ccItem.variable_id} [${ccItem.unit}]`.padEnd(44);
    if (problems.length > 0) {
      failures.push(`${ccItem.label} ${ccItem.variable_id} [${ccItem.unit}]: ${problems.join("; ")}`);
      lines.push(`FAIL  ${head} ${problems.join("; ")}`);
    } else {
      lines.push(
        `ok    ${head} engine ${engineTag} (got ${engineItem.got.toFixed(5)})` +
        ` <-> cross_check ${ccItem.tag} (got ${ccItem.got.toFixed(5)})  exp ${ccItem.expected}`
      );
    }
  }

  if (matchedCount !== EXPECTED_CC_ITEMS) {
    failures.push(`matched ${matchedCount} items; exactly ${EXPECTED_CC_ITEMS} required`);
  }

  const casesOnly = engineItems.filter((i) => !matched.has(i));
  if (casesOnly.length !== 1) {
    failures.push(`cases-only extras: ${casesOnly.length}; exactly 1 required (A3 wheel_radius [in])`);
  }
  for (const item of casesOnly) {
    const isExpected =
      item.label === EXPECTED_CASES_ONLY.label &&
      item.variable_id === EXPECTED_CASES_ONLY.variable_id &&
      item.unit === EXPECTED_CASES_ONLY.unit;
    if (!isExpected) {
      failures.push(`unexpected cases-only item: ${item.label} ${item.variable_id} [${item.unit}]`);
      lines.push(`FAIL  ${item.label}  ${item.variable_id} [${item.unit}]  unexpected cases-only item`);
      continue;
    }
    if (!item.pass) {
      failures.push("cases-only A3 wheel_radius [in] did not PASS");
    }
    lines.push(
      `note  ${item.label}  ${item.variable_id} [${item.unit}]  cases-only duplicate judgment ` +
      `(engine ${item.pass ? "PASS" : "FAIL"}; not re-checked by cross_check.py)`
    );
  }

  lines.push(
    `enforced: ${ccItems.length}/${EXPECTED_CC_ITEMS} parsed, ${matchedCount}/${EXPECTED_CC_ITEMS} matched, ` +
    `cases-only ${casesOnly.length}/1 (must be A3 wheel_radius [in]); tags and got values compared ` +
    `(default |d| <= ${GOT_TOLERANCE_DEFAULT}, sole exception A3 longitudinal_acceleration <= ${GOT_TOLERANCE_EXCEPTIONS[0].tolerance})`
  );

  return { lines, failures, failed: failures.length > 0, matchedCount, casesOnly };
}
