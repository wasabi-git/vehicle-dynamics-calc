#!/usr/bin/env python3
"""Regression test for tools/validate_catalog.py crash-point fixes.

A malformed catalog (bare condition array in formula_constraints) must:
  * exit with code 1 (validation failure), not 2 (crash);
  * emit no traceback and never hit the generic unexpected-failure handler;
  * report an explicit structured validation error for the bare array.

Run from anywhere:  python tools/test_validate_catalog.py
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        for folder in ("data", "schemas"):
            shutil.copytree(REPO_ROOT / folder, root / folder)

        formulas_path = root / "data" / "formulas.v0.1.json"
        doc = json.loads(formulas_path.read_text(encoding="utf-8"))
        target = next(
            f for f in doc["formulas"]
            if f["formula_id"] == "F007_engine_limited_acceleration"
        )
        target["formula_constraints"] = [
            {"operator": "gt", "variable": "vehicle_mass", "value": 0, "unit": "kilogram"}
        ]
        formulas_path.write_text(json.dumps(doc), encoding="utf-8")

        report_path = root / "report.json"
        proc = subprocess.run(
            [
                sys.executable,
                str(REPO_ROOT / "tools" / "validate_catalog.py"),
                "--root", str(root),
                "--output", str(report_path),
            ],
            capture_output=True,
            text=True,
        )

        failures: list[str] = []
        combined = proc.stdout + proc.stderr
        if proc.returncode != 1:
            failures.append(f"expected exit code 1 (validation fail), got {proc.returncode}")
        if "Traceback" in combined:
            failures.append("validator emitted a traceback")
        if "Validator failed unexpectedly" in combined:
            failures.append("validator crashed into the generic failure handler")
        if not report_path.exists():
            failures.append("validator wrote no report")
        else:
            report = json.loads(report_path.read_text(encoding="utf-8"))
            errors = report.get("cross_file_validation", {}).get("errors", [])
            if not any(
                "formula_constraints" in e and "bare condition arrays" in e
                for e in errors
            ):
                failures.append("report lacks the explicit bare-condition-array validation error")

        if failures:
            print("validate_catalog regression: FAIL")
            for item in failures:
                print(f"  - {item}")
            return 1

        print("validate_catalog regression: PASS (exit 1, structured error, no traceback)")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
