/**
 * Malformed-input fixtures for the M0 loader gate.
 *
 * Each fixture mutates a deep clone of the real catalog documents and states
 * which diagnostic codes the loader must emit. The loader must return
 * structured diagnostics for every fixture — never throw.
 *
 * `docs` shape: { catalogText, catalog, byPath } where byPath maps a
 * registered path to its parsed document (mutable clone).
 */

function findVariable(docs, id) {
  return docs.byPath["data/variables.v0.1.json"].variables.find((v) => v.variable_id === id);
}

function findFormula(docs, id) {
  return docs.byPath["data/formulas.v0.1.json"].formulas.find((f) => f.formula_id === id);
}

function findUnit(docs, id) {
  return docs.byPath["data/units.v0.1.json"].units.find((u) => u.unit_id === id);
}

export const MALFORMED_FIXTURES = [
  {
    name: "catalog file is not JSON",
    expectCodes: ["json_parse_failed"],
    mutate(docs) {
      docs.catalogText = "{ this is not json";
    },
  },
  {
    name: "catalog top level is an array",
    expectCodes: ["top_level_not_object"],
    mutate(docs) {
      docs.catalogText = "[1, 2, 3]";
    },
  },
  {
    name: "catalog does not register the formulas role",
    expectCodes: ["catalog_missing_role"],
    mutate(docs) {
      docs.catalog.files = docs.catalog.files.filter((f) => f.role !== "formulas");
    },
  },
  {
    name: "registered role file is missing on disk",
    expectCodes: ["file_read_failed"],
    mutate(docs) {
      delete docs.byPath["data/units.v0.1.json"];
    },
  },
  {
    name: "formula_constraints is a bare condition array",
    expectCodes: ["bare_condition_array"],
    mutate(docs) {
      const f007 = findFormula(docs, "F007_engine_limited_acceleration");
      f007.formula_constraints = [
        { operator: "gt", variable: "vehicle_mass", value: 0, unit: "kilogram" },
      ];
    },
  },
  {
    name: "formula_constraints uses any instead of all",
    expectCodes: ["condition_semantics_violation"],
    mutate(docs) {
      const f005 = findFormula(docs, "F005_mass_factor_from_total_gear_ratio");
      f005.formula_constraints = {
        any: [{ operator: "gt", variable: "combined_gear_ratio", value: 0, unit: "decimal" }],
      };
    },
  },
  {
    name: "invalid_range uses all instead of any",
    expectCodes: ["condition_semantics_violation"],
    mutate(docs) {
      findVariable(docs, "vehicle_mass").invalid_range = {
        all: [{ operator: "lte", value: 0, unit: "kilogram" }],
      };
    },
  },
  {
    name: "valid_domain is a bare condition array",
    expectCodes: ["bare_condition_array"],
    mutate(docs) {
      findVariable(docs, "wheel_radius").valid_domain = [
        { operator: "gt", value: 0, unit: "meter" },
      ];
    },
  },
  {
    name: "formulas key is not an array",
    expectCodes: ["missing_field"],
    mutate(docs) {
      docs.byPath["data/formulas.v0.1.json"].formulas = {};
    },
  },
  {
    name: "variable row is not an object",
    expectCodes: ["row_not_object"],
    mutate(docs) {
      docs.byPath["data/variables.v0.1.json"].variables.push("not an object");
    },
  },
  {
    name: "duplicate variable_id",
    expectCodes: ["duplicate_id"],
    mutate(docs) {
      const vars = docs.byPath["data/variables.v0.1.json"].variables;
      vars.push(JSON.parse(JSON.stringify(vars[0])));
    },
  },
  {
    name: "formula references an unknown input variable",
    expectCodes: ["unknown_reference"],
    mutate(docs) {
      findFormula(docs, "F002_vehicle_speed_from_engine_speed").required_inputs.push("warp_factor");
    },
  },
  {
    name: "variable allows an unregistered unit",
    expectCodes: ["unknown_unit"],
    mutate(docs) {
      findVariable(docs, "vehicle_speed").allowed_units.push("furlong_per_fortnight");
    },
  },
  {
    name: "variable internal_unit has the wrong dimension",
    expectCodes: ["dimension_mismatch"],
    mutate(docs) {
      findVariable(docs, "vehicle_speed").internal_unit = "kilogram";
    },
  },
  {
    name: "unit has a non-positive linear scale",
    expectCodes: ["unit_scale_invalid"],
    mutate(docs) {
      findUnit(docs, "millimeter").si_conversion.scale = -0.001;
    },
  },
  {
    name: "constant-reference unit points at a non-constant variable",
    expectCodes: ["unit_constant_invalid"],
    mutate(docs) {
      findUnit(docs, "standard_gravity").si_conversion.variable_id = "vehicle_mass";
    },
  },
  {
    name: "expression uses an identifier outside required_inputs",
    expectCodes: ["expression_identifier_unknown"],
    mutate(docs) {
      findFormula(docs, "F005_mass_factor_from_total_gear_ratio").calculation_expression =
        "1 + 0.04 * gear_ratio + 0.0025 * gear_ratio ^ 2";
    },
  },
  {
    name: "source-native formula lacks substitution_units",
    expectCodes: ["substitution_units_missing"],
    mutate(docs) {
      delete findFormula(docs, "F003_engine_power_from_torque_rpm").substitution_units;
    },
  },
  {
    name: "engine config enables algebraic inversion",
    expectCodes: ["inversion_must_stay_disabled"],
    mutate(docs) {
      docs.byPath["data/engine-config.v0.1.json"].allow_automatic_algebraic_inversion = true;
    },
  },
  {
    name: "assumable variable lacks default_assumption",
    expectCodes: ["assumption_invalid"],
    mutate(docs) {
      delete findVariable(docs, "aerodynamic_drag").default_assumption;
    },
  },
];
