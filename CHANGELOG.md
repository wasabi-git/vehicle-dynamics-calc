# Changelog

All notable changes to this project are documented in this file. Release
dates are the dates the release content was frozen in this repository.
The version tag `v0.1.0` identifies the project's v0.1 package.

<!-- release-notes-start -->
## v0.1.0 — 2026-07-18

First tagged release of the Vehicle Dynamics Formula Solver — a
metadata-driven, zero-dependency, pure-front-end vehicle-dynamics
calculator, deployed on GitHub Pages:
<https://wasabi-git.github.io/vehicle-dynamics-calc/>

### Scope

The v0.1 calculation scope is the acceleration-performance minimal closed
loop: 20 variables, 8 executable formula records, 3 model groups, 8
physical models, 1 cross-model recommendation record, 3 source records,
and 27 registered units, over a dependency graph of 28 nodes and 34 edges
with a maximum formula depth of 3.

### Delivered

- Data-driven catalog (`data/`, JSON Schema validated) with explicit
  formula directions, unit-safe execution, explicit condition semantics,
  and no automatic algebraic inversion.
- Zero-dependency derivation engine (`engine/`, vanilla ES modules for
  Node and the browser): fixed-point forward derivation, registered-only
  reverse target queries, four-source result provenance, instance-level
  stale propagation, four-tier range checks, and unit-misuse detection.
- Browser calculator (root `index.html` + `ui/`, no build step):
  unit-aware inputs with tire-code quick entry, layered results with
  model selection and derivation details, warning and unit-misuse
  handling, assumption and constant panels, and reverse target queries
  with satisfied-condition display.
- Validation and test system: catalog validator; engine gate (121
  assertions); UI gate (397 Node assertions, 53 browser assertions);
  system-level gate (104 Node assertions closing 49 mechanized
  checkpoints, 41 browser assertions); and a deployed-content
  fingerprint verifier. Evidence archives: `docs/TESTING.md` (system
  testing), `docs/UI.md` (interface).

### Known limitations

The authoritative list is the "Known v0.1 limitations" section of
`README.md` at this tag. Formula-module expansion (roadmap Part 7) is
deferred to v0.2. Two registered v0.1 interaction deviations (D24, the
Conflict/Verified mechanism; D25, the use-derived form) are deferred to
v0.2 review, as recorded in the `docs/UI.md` deviation register.
<!-- release-notes-end -->
