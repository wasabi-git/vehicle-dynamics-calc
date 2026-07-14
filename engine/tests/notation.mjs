/**
 * notation.mjs — ASCII unit-notation resolution for the acceptance runner.
 *
 * TESTS.md semantics #8: cases.v0.1.json uses ASCII notation for registered
 * units ("-" = dimensionless) and is resolved against data/units.v0.1.json.
 * This is display-token resolution only — it introduces no new units.
 *
 * Resolution order:
 *   1. exact unit_id            ("slug", "radian")
 *   2. exact display_symbol     ("mm", "in", "mph", "%")
 *   3. case-insensitive display_symbol ("RPM" -> rpm, "HP" -> hp)
 *   4. ASCII alias of a registered display symbol (table below)
 */

const ASCII_ALIASES = {
  "-": "decimal",           // ASCII form of the dimensionless dash
  "lb": "pound_force",      // course notation for pound-force
  "ft-lb": "foot_pound_force",
  "ft·lb": "foot_pound_force",
  "ft/s^2": "foot_per_second_squared",
  "m/s^2": "meter_per_second_squared",
};

export function resolveUnitNotation(token, units) {
  if (typeof token !== "string" || token.length === 0) return null;
  if (units.has(token)) return token;
  for (const [unitId, unit] of units) {
    if (unit.display_symbol === token) return unitId;
  }
  const lower = token.toLowerCase();
  for (const [unitId, unit] of units) {
    if (typeof unit.display_symbol === "string" && unit.display_symbol.toLowerCase() === lower) {
      return unitId;
    }
  }
  if (Object.prototype.hasOwnProperty.call(ASCII_ALIASES, lower)) {
    const unitId = ASCII_ALIASES[lower];
    return units.has(unitId) ? unitId : null;
  }
  return null;
}
