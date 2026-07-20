# PORTFOLIO.md — Part 10 living document (verified-claim inventory and citation map)

> **What this page is, and what it is not.** This page is a *citation map*.
> It lists the closed set of claims this document makes about v0.1 and
> points each one at the public artifact that verifies it. **It is not
> itself evidence for any of those claims.** Where this page and an anchor
> disagree, the anchor governs. Nothing here should be believed because it
> is written here.

## How to verify anything on this page

1. Read the claim and its anchor.
2. Open the anchor at the pinned revision. Claims about the released
   package are pinned to tag `v0.1.0` and its tagged commit
   `adea3b098cdd39ee6f35f62ba7aec7665e6324c9`. Claims about how the project
   was run are pinned to the `main` branch, which moved after the tag.
3. Compare. Every number below is meant to appear verbatim in its anchor.

The authoritative anchor list is the "Citation basis" section of
[RELEASE.md](RELEASE.md). GitHub's auto-generated source archives are not
anchors; the tagged commit SHA is. Implementation-session dialogue logs are
not citable.

## How this project was built

This is a **human-owned, AI-executed, independently AI-reviewed** project.
The division of work is part of the record, not a footnote:

- The **owner** specifies the product rules and the scope, decides and
  approves every registered deviation, reviews the running application, and
  rules on every conflict. Every external write requires the owner's
  explicit authorization and is carried out by the execution session. Owner
  review is always recorded as "broadly reviewed, no issue reported" —
  never as exhaustive verification.
- **AI implementation sessions** produce the code, the tests, and the
  document text, verbatim under an approved work package. A drafting
  session writes the work package; a separate execution session carries it
  out.
- A **separate AI reviewer session** independently re-verifies each branch
  and holds verification the implementation sessions never see.

Personal authorship of the implementation is therefore not claimed anywhere
in this project, and this page does not claim it.

## Where this page sits in the project

The v0.1 product and its release were completed in part 9: the tag, the
Release, the deployed site, and the three acceptance archives all predate
this page and stand on their own. Part 10 packaged the portfolio afterwards
and closed roadmap item 10 and the v0.1 cycle. This page does not make v0.1
released, complete, or official; it makes v0.1 checkable by a reader who was
not here.

## Verified claim inventory

| # | Claim | Anchor |
|---|---|---|
| C01 | The deployed application has no runtime dependencies: the browser loads vanilla ES modules directly, with no bundler and no build step. Python, Node, and the GitHub CLI are development and validation tooling; the running application does not use them. | README.md; CHANGELOG.md |
| C02 | The calculator is publicly deployed on GitHub Pages at https://wasabi-git.github.io/vehicle-dynamics-calc/ | the public Pages deployment; RELEASE.md |
| C03 | v0.1.0 is released: an annotated tag (object `3185542088f774c6d1f594a62a88d36cf0aac03f`) at commit `adea3b098cdd39ee6f35f62ba7aec7665e6324c9`, with exactly one zero-asset GitHub Release whose body is text-identical to the changelog extract after newline normalization. | tag `v0.1.0` and its tagged commit; the Release for that tag; RELEASE.md |
| C04 | The v0.1 catalog holds 20 variables, 8 executable formula records, 3 model groups, 8 physical models, 1 cross-model recommendation record, 3 source records, and 27 registered units. | validation/validation-report.v0.1.json; README.md; CHANGELOG.md |
| C05 | The dependency graph is a validated DAG of 28 nodes and 34 edges with a maximum formula depth of 3; the reverse-search depth limit is 5. | validation/validation-report.v0.1.json |
| C06 | The system performs no automatic algebraic inversion. Every executable direction is an explicitly registered record of formula id, required inputs, and a single output. | README.md; CHANGELOG.md; data/engine-config.v0.1.json |
| C07 | The engine gate runs 121 assertions. | TESTING.md |
| C08 | The interface gate runs 397 Node assertions and 53 browser assertions. | TESTING.md |
| C09 | The system gate runs 104 Node assertions closing 49 mechanized checkpoints, and 41 browser assertions closing 32 of them. | TESTING.md |
| C10 | A four-environment browser matrix — local Chrome, Edge, and Firefox plus the online Chrome run — passed at the Part 8 matrix time point. Browser versions are those recorded for that time point, not current installed versions. | TESTING.md |
| C11 | Deployed content is verified byte for byte against the repository: a 31-path closure set at Part 8 and a 33-path closure set at Part 9, all PASS. | TESTING.md; RELEASE.md |
| C12 | Registered v0.1 limits and deferrals: formula-module expansion (roadmap part 7) is deferred to v0.2; interaction deviations D24 (Conflict/Verified mechanism) and D25 (use-derived form) are registered and deferred to v0.2 review. | README.md "Known v0.1 limitations"; UI.md deviation register; CHANGELOG.md |
| C13 | Execution boundaries for this project's Claude Code sessions are enforced by a project-level pre-tool-use gate, fail-closed before a tool runs, with 76 self-tested checks. It binds those sessions only; it does not bind the independent reviewer session, and it was added after the tagged commit, so it is pinned to `main` and is not part of the v0.1.0 tree. It is a project-level first barrier — not operating-system isolation and not a sandbox. The owner being present, the separate reviewer, and the external-write stop points remain the operative controls. | PRINCIPLES.md; CLAUDE.md; validation/system/governance_gate.mjs |
| C14 | The v0.1 scope boundary is an explicit enumerated not-doing list of 17 items in the confirmed product-rule document, together with the README's known-limitations section. | docs/Part_2_Product_Rules_Confirmed_FIXED.md; README.md; RELEASE.md |
| C15 | Unit handling is explicit and checked: 27 registered units with dimension and canonical-SI consistency validation; source-native formulas declare their exact substitution units and native output unit; standard gravity resolves to a single registered constant rather than a duplicated literal; probable unit misuse is a first-class warning path. | validation/validation-report.v0.1.json; README.md; TESTING.md |
| C16 | The acceptance baseline is external evidence that predates the system: independently marked coursework from years before the project serves as the numeric reference, and its in-repository form is an anonymized acceptance suite. | PRINCIPLES.md (principle P3); validation/acceptance/; TESTING.md |
| C17 | The engine gate additionally reconciles against that anonymized acceptance suite (23/23 enforced) and runs a reviewer-maintained independent cross-check. | TESTING.md; README.md |
| C18 | The project runs a three-role model: a single human owner who decides and approves every registered decision and deviation, AI implementation sessions that draft and execute the approved work packages, and a separate independent AI reviewer session that holds verification the implementer cannot see. | PRINCIPLES.md; CLAUDE.md; RELEASE.md, TESTING.md, and UI.md acceptance and final-verification records |

## What v0.1 does not do

The scope boundary is enumerated, not implied. The confirmed product-rule
document lists seventeen things v0.1 does not do, including user accounts,
cloud storage, a backend, multi-vehicle comparison, charts, PDF export,
automatic algebraic transformation of all formulas, and full coverage of a
formula handbook. The README's "Known v0.1 limitations" section records the
modelling limits: the ideal constant-power formula is singular near zero
speed, the mass-factor equation is an empirical approximation without a
documented source error bound, tire traction limits are not evaluated, and
road-load terms are accepted rather than derived. Roadmap part 7 is
deferred to v0.2.

## Wording rules this page holds itself to

- Every claim above carries exactly one anchor group. A claim without an
  anchor does not belong on this page.
- Numbers appear verbatim as their anchor records them. They are never
  rounded, hedged, or summed across gates.
- No superlatives and no unquantified quality adjectives.
- No claim of personal authorship of the implementation, and no wording
  that hides the AI sessions' role or that reduces the owner's role to
  requesting features.
- Owner review is recorded as broad review, never as exhaustive
  verification.
- Nothing on this page claims that part 10 made v0.1 real. Part 9 did that.

## Publication record

| Cycle | Record |
|---|---|
| W1 | deployment identity verified: workflow run 29711126907 completed/success for commit 23af0b35dbe1c3847476715a8a405123bad0c11f; latest Pages build reported that commit; changed-path fingerprints 2/2 PASS |
| W2 | recorded in the Part 10 closure report, outside this repository |

## Final verification

- [x] Final branch verification record (reviewer re-run, §9.4): PASS — independent reviewer verification, 2026-07-19, across the full §9.4 scope, including both private validations (reviewer evidence archived privately). The owner approved W2 on that verdict, 2026-07-19.

## v0.1 cycle closure

The v0.1 cycle closed on 2026-07-19, the date the owner approved the closing commit. The v0.1 product and its release were completed in part 9; part 10 packaged the portfolio afterwards and closed roadmap item 10. Roadmap terminal state: parts 1-6, 8, 9, and 10 Complete; part 7 deferred to v0.2.
