#!/usr/bin/env python3
"""Regression tests for tools/validate_catalog.py crash-point and mirror checks.

Every scenario copies the catalog into a temporary directory, applies one
malformed mutation, and asserts that the validator:
  * exits with code 1 (validation failure), not 2 (crash);
  * emits no traceback and never hits the generic unexpected-failure handler;
  * reports an explicit structured validation error for the mutation.

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


def mutate_formula(root: Path, formula_id: str, mutate) -> None:
    formulas_path = root / "data" / "formulas.v0.1.json"
    doc = json.loads(formulas_path.read_text(encoding="utf-8"))
    target = next(f for f in doc["formulas"] if f["formula_id"] == formula_id)
    mutate(target)
    formulas_path.write_text(json.dumps(doc), encoding="utf-8")


def cross_file_errors(report: dict) -> list[str]:
    return report.get("cross_file_validation", {}).get("errors", [])


def schema_file_errors(report: dict) -> list[str]:
    errors: list[str] = []
    for file_result in report.get("schema_validation", {}).get("files", []):
        errors.extend(file_result.get("errors", []))
    return errors


def bare_condition_array(root: Path) -> None:
    def mutate(target):
        target["formula_constraints"] = [
            {"operator": "gt", "variable": "vehicle_mass", "value": 0, "unit": "kilogram"}
        ]

    mutate_formula(root, "F007_engine_limited_acceleration", mutate)


def risk_warning_missing_variable(root: Path) -> None:
    def mutate(target):
        target["risk_warnings"] = [
            {
                "condition": {"operator": "lt", "value": 10, "unit": "mile_per_hour"},
                "code": "low_speed_check",
                "message": "Risk zone below the anchor speed.",
            }
        ]

    mutate_formula(root, "F008_ideal_power_acceleration_si", mutate)


def risk_warning_non_input_variable(root: Path) -> None:
    def mutate(target):
        target["risk_warnings"] = [
            {
                "condition": {
                    "variable": "vehicle_weight",
                    "operator": "lt",
                    "value": 10,
                    "unit": "newton",
                },
                "code": "low_speed_check",
                "message": "Risk zone below the anchor speed.",
            }
        ]

    mutate_formula(root, "F008_ideal_power_acceleration_si", mutate)


def risk_warning_bad_unit(root: Path) -> None:
    def mutate(target):
        target["risk_warnings"] = [
            {
                "condition": {
                    "variable": "vehicle_speed",
                    "operator": "lt",
                    "value": 10,
                    "unit": "warp_unit",
                },
                "code": "low_speed_check",
                "message": "Risk zone below the anchor speed.",
            },
            {
                "condition": {
                    "variable": "vehicle_speed",
                    "operator": "lt",
                    "value": 10,
                    "unit": "kilogram",
                },
                "code": "low_speed_check",
                "message": "Risk zone below the anchor speed.",
            },
        ]

    mutate_formula(root, "F008_ideal_power_acceleration_si", mutate)


def risk_warning_bad_code(root: Path) -> None:
    def mutate(target):
        target["risk_warnings"] = [
            {
                "condition": {
                    "variable": "vehicle_speed",
                    "operator": "lt",
                    "value": 10,
                    "unit": "mile_per_hour",
                },
                "code": "Bad_Code",
                "message": "Risk zone below the anchor speed.",
            }
        ]

    mutate_formula(root, "F008_ideal_power_acceleration_si", mutate)


SCENARIOS = [
    {
        "name": "bare condition array in formula_constraints",
        "apply": bare_condition_array,
        "check": lambda report: any(
            "formula_constraints" in e and "bare condition arrays" in e
            for e in cross_file_errors(report)
        ),
        "missing": "explicit bare-condition-array validation error",
    },
    {
        "name": "risk warning condition missing variable",
        "apply": risk_warning_missing_variable,
        "check": lambda report: any(
            "risk warning condition must name a required-input variable" in e
            for e in cross_file_errors(report)
        ),
        "missing": "risk-warning missing-variable validation error",
    },
    {
        "name": "risk warning variable outside required_inputs",
        "apply": risk_warning_non_input_variable,
        "check": lambda report: any(
            "risk warning condition references non-input vehicle_weight" in e
            for e in cross_file_errors(report)
        ),
        "missing": "risk-warning non-input-variable validation error",
    },
    {
        "name": "risk warning comparison unit unregistered or wrong dimension",
        "apply": risk_warning_bad_unit,
        "check": lambda report: any(
            "risk warning condition uses unknown unit warp_unit" in e
            for e in cross_file_errors(report)
        )
        and any(
            "risk warning condition unit dimension mismatch for vehicle_speed" in e
            for e in cross_file_errors(report)
        ),
        "missing": "risk-warning unknown-unit and dimension-mismatch validation errors",
    },
    {
        "name": "risk warning code violates pattern",
        "apply": risk_warning_bad_code,
        "check": lambda report: any(
            "risk_warnings" in e and "does not match" in e
            for e in schema_file_errors(report)
        ),
        "missing": "schema-level risk-warning code pattern error",
    },
]


def run_scenario(scenario: dict) -> list[str]:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        for folder in ("data", "schemas"):
            shutil.copytree(REPO_ROOT / folder, root / folder)

        scenario["apply"](root)

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
            if not scenario["check"](report):
                failures.append(f"report lacks the {scenario['missing']}")
        return failures


def main() -> int:
    failed = 0
    for scenario in SCENARIOS:
        failures = run_scenario(scenario)
        if failures:
            failed += 1
            print(f"validate_catalog regression [{scenario['name']}]: FAIL")
            for item in failures:
                print(f"  - {item}")
        else:
            print(f"validate_catalog regression [{scenario['name']}]: PASS")

    if failed:
        print(f"validate_catalog regression: FAIL ({failed} of {len(SCENARIOS)} scenarios)")
        return 1

    print(
        f"validate_catalog regression: PASS "
        f"({len(SCENARIOS)} scenarios: exit 1, structured error, no traceback)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
