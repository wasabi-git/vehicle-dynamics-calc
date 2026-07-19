# RELEASE.md — Part 9 living document (release and documentation)

> Part 9 builds on the Part 8 closure baseline recorded below. Engine,
> data, schemas, tools, UI product code, `ui/tests/`, and
> `validation/system/` stay frozen; `docs/TESTING.md` is the closed
> Part 8 evidence archive. Part 9 touches only this document,
> `CHANGELOG.md`, and two approved README edits, and performs two
> approved release actions: the annotated tag `v0.1.0` and its GitHub
> Release.

## Baseline (six fields, verbatim from the approved Part 9 work package)

```text
Part 9 基线 full SHA:      35263e28b13adb5f233e7540c12223f8339b8a14
Part 9 基线 short SHA:     35263e2        （= Part 8 收口 T7R1；净树；与 origin/main 及 ls-remote 一致）
B1（数据卫生基线）:         93875fa80df0f770fc20c20b617a4ce28a135c53
sha256(patterns.txt):      b1fe82c51392fcd8179fdbcffd7c6776aa59ed5dab1965221459ecde55f7bf15
sha256(g8_exceptions.txt): 4875f5ef4e77719bb48fe8d6a7f181bda03693a06e6da15aa6ef948187ed1298
sha256(g8_scan.sh):        e9806b3e95804f97b06f7b26410d2b854c66c85de6ca0f8c5262efe0282ddbfd
```

## Plan — commit and action sequence

| Step | Content | Files / target |
|---|---|---|
| V1 | This document (plan + fixed statements + evidence slots) | `docs/RELEASE.md` |
| V2 | Changelog + README version-history link | `CHANGELOG.md`, `README.md` |
| PRE | Reviewer pre-release audit (independent re-verification; PRE-RELEASE PASS required before any release action) | none (read-only) |
| TAG | Annotated tag `v0.1.0` at the V2 commit (owner-triggered) | remote tag ref |
| REL | GitHub Release for `v0.1.0`, body extracted from `CHANGELOG.md` (owner-triggered) | GitHub Release |
| V3 | Evidence backfill + roadmap advance — executed only after the reviewer's final verification PASS and owner approval | `docs/RELEASE.md`, `README.md` |

Every commit runs the full fixed gate chain (validator `--no-write`,
engine gate, UI gate, system gate, G8 scans, exact-path staging, clean
tree, time-limited push) and the per-push Pages discipline (leftover-run
probe before and after, deployment-identity verification, changed-path
content fingerprints). The release actions run only after the reviewer's
independent pre-release audit of a frozen, hash-pinned candidate
checklist (V2 commit, live changelog, exact commands) passes, and an
explicit owner go decision is given in a fixed authorization sentence on
that same audited checklist; the actions are verified mechanically:
remote tag refs count and peeled target, annotated tag object type, a
same-commit before/after comparison of the Actions run set around the
tag push, the pinned Pages publishing source, release count and field
set (incl. zero assets), and body identity against the changelog
extract. A final read-only formal closing gate after V3 re-verifies the
branch identity, the full gate chain, the tag, the Release, the exact V3
file set, and the slot backfill; the literal verdict `V3 CLOSING PASS`
is issued by the reviewer after independent re-verification before
Part 9 may be declared closed.

## Release identity (filled at V3)

| Field | Value |
|---|---|
| Tag | v0.1.0 |
| Tagged commit | adea3b098cdd39ee6f35f62ba7aec7665e6324c9 |
| Tag verification | annotated (object.type "tag"); remote tag refs 2/2; peeled ref = tagged commit; verified 2026-07-18 |
| Release id / URL | id 356232580; https://github.com/wasabi-git/vehicle-dynamics-calc/releases/tag/v0.1.0 |
| Release body identity | normalized body identical to the changelog extract; asserted 2026-07-19 |

## Release cycle log (per push; V1/V2/TAG filled at V3 per the work-package slot templates; the V3 cycle is recorded in the closure report, outside the repository)

| Cycle | Pre/post probe | Deployment identity | Changed-path fingerprints | Notes |
|---|---|---|---|---|
| V1 | queued / queued | success; built e33a21ece66c8393328d670ff72918d48e89cfd6 | 1/1 PASS | |
| V2 | queued / queued | success; built adea3b098cdd39ee6f35f62ba7aec7665e6324c9 | 2/2 PASS | |
| TAG | queued / queued | no new run for the tagged commit; head-sha run set unchanged; latest build built adea3b098cdd39ee6f35f62ba7aec7665e6324c9 | n/a (no content change) | tag push only; no new build expected |
| V3 | closure report | closure report | closure report | includes the 33-path closure fingerprint set and the formal closing gate (V3 CLOSING PASS) |

## Leftover Actions run (read-only watch item)

Actions run 29540514903 (an incident-period leftover on the Pages
build-and-deployment workflow; head commit bfc9418) was observed
`queued` on all seventeen read-only probes recorded in
`docs/TESTING.md` (through the T6 push cycle); the closing cycles are
recorded in the Part 8 closure report, outside the repository. It did
not block any recorded Part 8 deployment; every push re-verifies
deployment identity independently. Part 9 keeps the same read-only
probe discipline before and after every push: still `queued`, or
gone/recycled → proceed (deployment-identity verification is mandatory
regardless); any transition to `in_progress` or another state → stop
and report. Never rerun, never request builds, never touch Pages or
Actions configuration. Part 9 observations are recorded at V3 below.

Part 9 observations: V1 queued/queued; V2 queued/queued; TAG queued/queued; V3 recorded in the closure report.

## Known limitations at release

The authoritative limitation list for the v0.1 release is the "Known
v0.1 limitations" section of `README.md` at tag `v0.1.0`. Roadmap Part 7
(formula-module expansion) is deferred to v0.2. The registered
interaction deviations D24 (Conflict/Verified mechanism) and D25
(use-derived form) remain deferred to v0.2 review, as recorded in the
`docs/UI.md` deviation register. The v0.1 not-doing boundary is the
confirmed product-rule list in
`docs/Part_2_Product_Rules_Confirmed_FIXED.md`.

## Citation basis (for Part 10 and external readers)

The verifiable citation anchors for v0.1 are: the annotated tag `v0.1.0`
and its tagged commit; the GitHub Release for that tag; the public GitHub
Pages deployment; `docs/TESTING.md` (Part 8 system-testing evidence);
`docs/UI.md` (Part 6 interface evidence); `validation/validation-report.v0.1.json`;
and this document. Claims about v0.1 must be traceable to these public
artifacts; implementation-session dialogue logs are not citable. GitHub's
auto-generated source archives are not citation anchors — the tagged
commit SHA is.

## Acceptance records

Reviewer pre-release audit (PRE-RELEASE, after the V2 cycle, before the
owner go): PASS, 2026-07-18, bound to checklist sha256 6ed6e16fa0fa7e7c8f2e0a930849831d2f4ff4c3b0e826e39a6bb694fdced011 (reviewer evidence archived privately).

SB-GO (owner release trigger, after PRE-RELEASE PASS, before TAG): given 2026-07-18 — the owner's fixed authorization sentence for commit adea3b098cdd39ee6f35f62ba7aec7665e6324c9.

SB2 (owner batch, after REL, before final verification): signed 2026-07-18 — owner broadly reviewed the live tag and Release pages; no issue reported.

Owner-review evidence is always recorded as "broadly reviewed, no issue
reported" — never as exhaustive per-item verification.

## Final verification (§9.4)

- [x] Final branch verification record (reviewer re-run, §9.4): PASS — independent reviewer verification, 2026-07-18, across the full §9.4 scope: per-tree gate re-runs for V1 and V2; independent deployment-identity verification and the 33-path closure fingerprint set at the V2 head; independent tag and Release verification including body identity; wording and evidence-strength audit; both private validations PASS (reviewer evidence archived privately). The owner approved V3 on that verdict, 2026-07-18.
