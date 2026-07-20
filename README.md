# Vehicle Dynamics Formula Solver

A metadata-driven vehicle-dynamics calculation system designed to derive every result supported by the currently available inputs, while preserving units, assumptions, model identity, source traceability, and derivation paths.

> **Development status:** the project architecture, the v0.1 formula-data package, the v0.1 core derivation engine (`engine/`, zero-dependency ES modules for Node and the browser), and the v0.1 user interface (root `index.html`, vanilla ES modules, no build step) are complete on the current branch.

## Project objective

The long-term solver is intended to let a user enter any known vehicle-dynamics variables and then:

- convert mixed input units into a consistent internal SI system;
- identify and execute every registered calculation path whose requirements are satisfied;
- derive intermediate and final results recursively;
- explain missing conditions when a target cannot be calculated;
- preserve user-entered, assumed, constant, and derived values as separate runtime results;
- distinguish different physical models that produce the same variable;
- show equations, substitutions, unit conversions, assumptions, sources, and dependency paths;
- apply engineering-range and unit-misuse checks without silently overwriting data.

The project does **not** perform unrestricted symbolic algebraic inversion. Every executable output direction must be explicitly registered and validated.

## Current v0.1 scope

The first closed calculation chain is the **Acceleration Performance Minimal Closed Loop**.

```text
Tire size
  -> wheel radius

Engine speed + wheel radius + combined gear ratio
  -> vehicle speed

Engine torque + engine speed
  -> engine power

Engine torque + combined gear ratio + drivetrain efficiency + wheel radius
  -> tractive force

Combined gear ratio
  -> mass factor

Vehicle weight + gravity
  -> vehicle mass

Tractive force + mass factor + mass + road-load terms
  -> engine-limited longitudinal acceleration

Engine power + vehicle speed + mass
  -> ideal constant-power longitudinal acceleration
```

The v0.1 catalog contains:

- **20 variables**
- **8 executable formula records**
- **3 model groups**
- **8 physical models**
- **1 cross-model recommendation record**
- **27 registered units**

The dependency graph is a directed acyclic graph with a current maximum formula depth of 3.

## Model handling

Two v0.1 models can produce `longitudinal_acceleration`:

- **Engine-limited acceleration** — the recommended model when its requirements are satisfied;
- **Ideal constant-power acceleration** — a separate idealized comparison model.

Results from different physical models are retained separately. They are not treated as ordinary conflicts and do not silently overwrite one another.

If the recommended model is unavailable, the system is configured **not** to switch automatically to the comparison model. A user selection is required.

## Data architecture

The machine-readable JSON files are the authoritative source for development.

```text
data/
├─ catalog.meta.json
├─ variables.v0.1.json
├─ formulas.v0.1.json
├─ models.v0.1.json
├─ recommendations.v0.1.json
├─ sources.v0.1.json
├─ units.v0.1.json
└─ engine-config.v0.1.json

schemas/
├─ catalog.schema.json
├─ condition.schema.json
├─ variable.schema.json
├─ formula.schema.json
├─ model.schema.json
├─ recommendation.schema.json
├─ source.schema.json
├─ unit.schema.json
└─ engine-config.schema.json

docs/
├─ generated/
│  ├─ VARIABLES.generated.md
│  ├─ FORMULAS.generated.md
│  ├─ MODELS.generated.md
│  └─ DEPENDENCIES.generated.md
├─ reference/
│  ├─ FORMULA_NOTES_PHASE2.md
│  └─ DISCREPANCIES.md
├─ 背景说明V3.md
├─ Part_2_Product_Rules_Confirmed_FIXED.md
└─ Part_3_Formula_and_Variable_System.md

validation/
├─ validation-report.v0.1.json
├─ acceptance/          (anonymized acceptance suite: cases.v0.1.json, TESTS.md)
└─ tools/cross_check.py (reviewer-maintained independent cross-check)

tools/
├─ validate_catalog.py
└─ test_validate_catalog.py

engine/
├─ loader.mjs / units.mjs / conditions.mjs / result.mjs
├─ expr.mjs / derive.mjs / reverse.mjs / index.mjs
├─ ENGINE.md            (API and semantics, one page)
├─ smoke.html           (browser ES Module smoke test)
└─ tests/               (node engine/tests/run.js — one-shot gate)
```

Generated Markdown is documentation only. It must not be edited and then used to overwrite the JSON catalogs.

## Core design rules

### Explicit formula directions

One executable direction is represented by:

```text
formula_id + required_inputs + one output
```

A mathematically reversible relation does not become executable in another direction until that direction receives its own formula record.

### Unit-safe execution

Internally consistent formulas use SI values directly. Source-native formulas declare the exact substitution units and native output unit required by the source expression.

Examples include:

- tire geometry using millimeters and inches;
- engine horsepower using `ft·lbf`, `rpm`, and the course constant 5252.

Unit conversions are defined in `data/units.v0.1.json`. The standard-gravity unit references the single `gravity.constant_value_si` value of `9.80665 m/s²` rather than duplicating that constant.

### Explicit condition semantics

Machine-executable condition groups use explicit Boolean wrappers:

- `all` for constraints that must all be satisfied;
- `any` for invalid conditions where any matching condition is sufficient.

Bare condition arrays are not permitted.

### Derived dependency graph

The dependency graph is generated from each formula's `required_inputs` and `output`. ASCII diagrams are explanatory only and are not machine-readable definitions.

### Runtime provenance

Static variable and formula metadata do not store runtime values. Runtime result objects preserve the actual source, dependencies, formula path, assumptions, model, active state, stale state, and warnings for each result instance (see [`engine/ENGINE.md`](engine/ENGINE.md)).

## Validation status

The current package reports `pass_with_warnings`.

Completed checks include:

- JSON Schema validation for all authoritative data files;
- unique IDs and cross-file reference integrity;
- unit dimension and canonical-SI consistency;
- source-native substitution-unit coverage;
- restricted calculation-expression identifiers;
- formula-constraint input membership;
- model and recommendation consistency;
- gravity and `standard_gravity` single-source consistency;
- dependency-graph DAG validation.

Current validation summary:

```text
Variables:              20
Formulas:                8
Model groups:            3
Models:                  8
Recommendations:         1
Sources:                 3
Units:                   27
Dependency nodes:       28
Dependency edges:       34
Maximum formula depth:   3
Reverse-search limit:    5
```

See [`validation/validation-report.v0.1.json`](validation/validation-report.v0.1.json) for the complete report.

System-level test evidence (scenario, degradation, consistency, payload, and deployed-fingerprint checks) is recorded in [docs/TESTING.md](docs/TESTING.md).

Reproduce the validation report from the repository root:

```bash
python -m pip install jsonschema
python tools/validate_catalog.py
```

## Known v0.1 limitations

- The ideal constant-power formula is singular as vehicle speed approaches zero. The course uses **10 mph** as a plotting lower bound; the enacted low-speed policy (Stage 5) keeps V = 0 constraint-blocked and attaches the `low_speed_ideal_model` risk warning to derivations below 10 mph.
- The mass-factor equation is an empirical approximation without a documented source error bound.
- Tire traction limits are not evaluated.
- Aerodynamic drag and rolling resistance are not yet calculated from dedicated road-load formulas; v0.1 accepts explicit values or approved assumptions.
- The tire-size formula produces a nominal geometric radius, used as the course-model approximation for wheel radius.
- Engine maps, shift logic, time integration, and 0–60 mph prediction are outside the current scope.

## Documentation authority

Use the following priority when resolving project definitions:

1. `data/*.json` — authoritative machine-readable definitions;
2. JSON Schemas and the validation report;
3. confirmed Part 2 and Part 3 design documents;
4. generated Markdown documentation;
5. historical Phase 2 reference notes and discrepancy records;
6. ASCII diagrams and discussion artifacts.

The Phase 2 formula notes preserve cleaned formulas and future-module reference material, but their legacy formula IDs are not valid runtime IDs in the new architecture.

## Roadmap

```text
1. Environment preparation                 Complete
2. Product-rule confirmation               Complete
3. Formula and variable system             Complete
4. Core inference engine                   Complete
5. Units and engineering safety            Complete
6. Interface and interaction               Complete
7. Formula-module expansion                Deferred to v0.2
8. System testing and validation           Complete
9. Release and documentation               Complete
10. Promotion and portfolio packaging      Complete
```

v0.1 redline: 2026-08-03. If the redline is missed, v0.1 development stops unconditionally and the current project state is archived as-is.

Version history: [CHANGELOG.md](CHANGELOG.md).

Verified-claim inventory and citation map: [docs/PORTFOLIO.md](docs/PORTFOLIO.md).

The two deferred obligations registered in Part 5 were fulfilled in Part 6 (user-confirmed flow; upstream-abnormality rendering).

## Engine (v0.1)

The core derivation engine lives in `engine/` — pure ES modules, zero dependencies, no build step. See [`engine/ENGINE.md`](engine/ENGINE.md) for the API and semantics.

```bash
node engine/tests/run.js        # one-shot gate: unit/mechanism tests,
                                # acceptance scan, cross_check reconciliation,
                                # python validator regression
python -m http.server           # then open /engine/smoke.html for the
                                # browser ES Module smoke test
```

## Current repository behavior

The root `index.html` provides the v0.1 browser calculator: inputs with unit selection and direct picker entry, tire-code quick input, solve/recalculate flow, layered results with model selection and derivation details, warning and unit-misuse handling, assumption and constant panels, and reverse target queries with inline entry for missing inputs. The validated data architecture, the documentation foundation, and the v0.1 core derivation engine with its acceptance runner and browser smoke page back it; the engine stayed frozen for this branch except one owner-approved read-only addition, the `convertUnitValue` API (recorded in `docs/UI.md`).

## Usage

```bash
python -m http.server           # from the repository root,
                                # then open http://localhost:8000/index.html
node ui/tests/run.js            # UI logic gate (Node, zero dependencies)
                                # /ui/tests/tests.html runs the browser
                                # assertion page on the same local server
node validation/system/run.js   # system gate (Node, zero dependencies)
                                # /validation/system/system.html runs the browser system page
```

On GitHub Pages the calculator is served from the repository root of the existing Pages configuration (standard form `https://wasabi-git.github.io/vehicle-dynamics-calc/`).

Local-development note: `python -m http.server` sends no cache headers, so browsers may keep serving older `.mjs` modules after an update. Hard-refresh (Ctrl+F5) or enable "Disable cache" in the developer-tools Network tab when the page seems stale.
