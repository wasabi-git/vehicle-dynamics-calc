#!/usr/bin/env python3
"""Validate the vehicle-dynamics v0.1 catalog and regenerate its report.

Run from the repository root:

    python tools/validate_catalog.py

The validator performs JSON Schema checks, cross-file reference and unit checks,
restricted-expression checks, and dependency-graph validation. It writes
``validation/validation-report.v0.1.json`` by default and exits nonzero on errors.
"""

from __future__ import annotations

import argparse
import ast
import json
import math
import sys
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Iterator, Mapping, Sequence

try:
    from jsonschema import Draft202012Validator
    from referencing import Registry, Resource
except ImportError as exc:  # pragma: no cover - exercised only on missing dependency
    print(
        "Missing dependency: jsonschema. Install it with:\n"
        "  python -m pip install jsonschema",
        file=sys.stderr,
    )
    raise SystemExit(2) from exc

VALIDATOR_VERSION = "1.0.0"
DEFAULT_REPORT_PATH = Path("validation/validation-report.v0.1.json")
ALLOWED_EXPRESSION_FUNCTIONS = {"sin": 1}
ALLOWED_EXPRESSION_NODES = (
    ast.Expression,
    ast.BinOp,
    ast.UnaryOp,
    ast.Add,
    ast.Sub,
    ast.Mult,
    ast.Div,
    ast.Pow,
    ast.UAdd,
    ast.USub,
    ast.Call,
    ast.Name,
    ast.Load,
    ast.Constant,
)


class ValidationFailure(RuntimeError):
    """Raised for a fatal validator setup problem."""


@dataclass(frozen=True)
class CatalogData:
    root: Path
    catalog: dict[str, Any]
    variables_file: dict[str, Any]
    formulas_file: dict[str, Any]
    models_file: dict[str, Any]
    recommendations_file: dict[str, Any]
    sources_file: dict[str, Any]
    units_file: dict[str, Any]
    engine_config: dict[str, Any]

    @property
    def variables(self) -> list[dict[str, Any]]:
        return self.variables_file["variables"]

    @property
    def formulas(self) -> list[dict[str, Any]]:
        return self.formulas_file["formulas"]

    @property
    def model_groups(self) -> list[dict[str, Any]]:
        return self.models_file["model_groups"]

    @property
    def models(self) -> list[dict[str, Any]]:
        return self.models_file["models"]

    @property
    def recommendations(self) -> list[dict[str, Any]]:
        return self.recommendations_file["recommendations"]

    @property
    def sources(self) -> list[dict[str, Any]]:
        return self.sources_file["sources"]

    @property
    def units(self) -> list[dict[str, Any]]:
        return self.units_file["units"]


def parse_args() -> argparse.Namespace:
    default_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(
        description="Validate the vehicle-dynamics catalog and regenerate its report."
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=default_root,
        help="Repository root. Defaults to the parent directory of tools/.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Report path. Relative paths are resolved from --root.",
    )
    parser.add_argument(
        "--no-write",
        action="store_true",
        help="Validate and print a summary without writing the report.",
    )
    return parser.parse_args()


def load_json(path: Path) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as handle:
            value = json.load(handle)
    except FileNotFoundError as exc:
        raise ValidationFailure(f"Required file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValidationFailure(
            f"Invalid JSON in {path}: line {exc.lineno}, column {exc.colno}: {exc.msg}"
        ) from exc
    if not isinstance(value, dict):
        raise ValidationFailure(f"Top-level JSON value must be an object: {path}")
    return value


def resolve_inside_root(root: Path, relative: str | Path) -> Path:
    candidate = (root / Path(relative)).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise ValidationFailure(f"Catalog path escapes repository root: {relative}") from exc
    return candidate


def format_json_path(parts: Iterable[Any]) -> str:
    path = "$"
    for part in parts:
        if isinstance(part, int):
            path += f"[{part}]"
        else:
            path += f".{part}"
    return path


def duplicate_values(values: Sequence[str]) -> list[str]:
    seen: set[str] = set()
    duplicates: set[str] = set()
    for value in values:
        if value in seen:
            duplicates.add(value)
        seen.add(value)
    return sorted(duplicates)


def index_unique(
    rows: Sequence[Mapping[str, Any]], key: str, errors: list[str], label: str
) -> dict[str, Mapping[str, Any]]:
    values = [str(row.get(key, "")) for row in rows]
    for duplicate in duplicate_values(values):
        errors.append(f"Duplicate {label} {key}: {duplicate}")
    return {str(row[key]): row for row in rows if key in row}


def load_catalog_data(root: Path) -> CatalogData:
    catalog = load_json(root / "data/catalog.meta.json")
    role_to_path: dict[str, Path] = {}
    for entry in catalog.get("files", []):
        if not isinstance(entry, dict) or "role" not in entry or "path" not in entry:
            continue
        role_to_path[str(entry["role"])] = resolve_inside_root(root, str(entry["path"]))

    required_roles = {
        "variables",
        "formulas",
        "models",
        "recommendations",
        "sources",
        "units",
        "engine_config",
    }
    missing_roles = sorted(required_roles - role_to_path.keys())
    if missing_roles:
        raise ValidationFailure(
            "catalog.meta.json is missing required roles: " + ", ".join(missing_roles)
        )

    return CatalogData(
        root=root,
        catalog=catalog,
        variables_file=load_json(role_to_path["variables"]),
        formulas_file=load_json(role_to_path["formulas"]),
        models_file=load_json(role_to_path["models"]),
        recommendations_file=load_json(role_to_path["recommendations"]),
        sources_file=load_json(role_to_path["sources"]),
        units_file=load_json(role_to_path["units"]),
        engine_config=load_json(role_to_path["engine_config"]),
    )


def build_schema_registry(root: Path) -> tuple[Registry, dict[str, dict[str, Any]], list[str]]:
    registry = Registry()
    schemas: dict[str, dict[str, Any]] = {}
    meta_errors: list[str] = []
    schema_dir = root / "schemas"
    if not schema_dir.is_dir():
        return registry, schemas, ["Missing schemas directory"]

    for path in sorted(schema_dir.glob("*.json")):
        try:
            schema = load_json(path)
            Draft202012Validator.check_schema(schema)
            schema_id = schema.get("$id")
            if not isinstance(schema_id, str) or not schema_id:
                meta_errors.append(f"{path.relative_to(root)}: missing non-empty $id")
                continue
            schemas[schema_id] = schema
            registry = registry.with_resource(schema_id, Resource.from_contents(schema))
        except Exception as exc:  # jsonschema raises several schema-specific subclasses
            meta_errors.append(f"{path.relative_to(root)}: {exc}")
    return registry, schemas, meta_errors


def validate_schemas(
    data: CatalogData,
    registry: Registry,
    schemas: Mapping[str, dict[str, Any]],
    schema_meta_errors: list[str],
    output_path: Path,
) -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    root = data.root

    for entry in data.catalog.get("files", []):
        if not isinstance(entry, dict) or "schema_path" not in entry:
            continue
        file_rel = str(entry.get("path", ""))
        schema_rel = str(entry["schema_path"])
        file_path = resolve_inside_root(root, file_rel)
        schema_path = resolve_inside_root(root, schema_rel)
        errors: list[str] = []

        if not file_path.exists():
            # A validation report may be regenerated from scratch.
            if file_path.resolve() != output_path.resolve():
                errors.append("File does not exist")
        elif not schema_path.exists():
            errors.append("Schema file does not exist")
        else:
            try:
                instance = load_json(file_path)
                schema = load_json(schema_path)
                validator = Draft202012Validator(schema, registry=registry)
                schema_errors = sorted(
                    validator.iter_errors(instance),
                    key=lambda error: list(error.absolute_path),
                )
                errors.extend(
                    f"{format_json_path(error.absolute_path)}: {error.message}"
                    for error in schema_errors
                )
            except ValidationFailure as exc:
                errors.append(str(exc))
            except Exception as exc:
                errors.append(f"Schema validation failed: {exc}")

        results.append(
            {
                "file": file_rel,
                "schema": schema_rel,
                "status": "pass" if not errors else "fail",
                "error_count": len(errors),
                "errors": errors,
            }
        )

    status = "pass" if not schema_meta_errors and all(r["status"] == "pass" for r in results) else "fail"
    return {
        "status": status,
        "schema_meta_errors": schema_meta_errors,
        "files": results,
    }


def iter_conditions(expression: Any) -> Iterator[dict[str, Any]]:
    if not isinstance(expression, dict):
        return
    if "operator" in expression:
        yield expression
        return
    for group_key in ("all", "any"):
        group = expression.get(group_key)
        if isinstance(group, list):
            for child in group:
                yield from iter_conditions(child)


def validate_expression(expression: str) -> tuple[set[str], list[str]]:
    errors: list[str] = []
    names: set[str] = set()
    python_expression = expression.replace("^", "**")
    try:
        tree = ast.parse(python_expression, mode="eval")
    except SyntaxError as exc:
        return names, [f"invalid expression syntax: {exc.msg}"]

    for node in ast.walk(tree):
        if not isinstance(node, ALLOWED_EXPRESSION_NODES):
            errors.append(f"disallowed expression syntax: {type(node).__name__}")
            continue
        if isinstance(node, ast.Constant) and not isinstance(node.value, (int, float)):
            errors.append("only numeric constants are allowed")
        elif isinstance(node, ast.Call):
            if not isinstance(node.func, ast.Name):
                errors.append("only direct function calls are allowed")
                continue
            function_name = node.func.id
            expected_args = ALLOWED_EXPRESSION_FUNCTIONS.get(function_name)
            if expected_args is None:
                errors.append(f"function is not allowed: {function_name}")
            elif len(node.args) != expected_args or node.keywords:
                errors.append(
                    f"function {function_name} requires {expected_args} positional argument(s)"
                )
        elif isinstance(node, ast.Name):
            if node.id not in ALLOWED_EXPRESSION_FUNCTIONS:
                names.add(node.id)

    return names, sorted(set(errors))


def unit_scale_to_si(
    unit_id: str,
    unit_index: Mapping[str, Mapping[str, Any]],
    variable_index: Mapping[str, Mapping[str, Any]],
    stack: tuple[str, ...] = (),
) -> float:
    if unit_id in stack:
        raise ValidationFailure("Unit conversion cycle: " + " -> ".join((*stack, unit_id)))
    unit = unit_index[unit_id]
    conversion = unit["si_conversion"]
    conversion_type = conversion["type"]
    if conversion_type == "linear":
        return float(conversion["scale"])
    if conversion_type == "constant_reference":
        variable_id = str(conversion["variable_id"])
        variable = variable_index[variable_id]
        constant_value = float(variable["constant_value_si"])
        internal_unit = str(variable["internal_unit"])
        return constant_value * unit_scale_to_si(
            internal_unit, unit_index, variable_index, (*stack, unit_id)
        )
    raise ValidationFailure(f"Unsupported conversion type for {unit_id}: {conversion_type}")


def validate_catalog_files(
    data: CatalogData, output_path: Path, errors: list[str]
) -> None:
    for entry in data.catalog.get("files", []):
        if not isinstance(entry, dict):
            errors.append("catalog.meta.json contains a non-object file entry")
            continue
        path_value = entry.get("path")
        if not isinstance(path_value, str):
            errors.append("catalog.meta.json contains a file entry without a string path")
            continue
        path = resolve_inside_root(data.root, path_value)
        required = entry.get("required") is True
        if required and not path.exists() and path.resolve() != output_path.resolve():
            errors.append(f"Required catalog file is missing: {path_value}")


def validate_cross_file(data: CatalogData, output_path: Path) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []

    variable_index = index_unique(data.variables, "variable_id", errors, "variable")
    formula_index = index_unique(data.formulas, "formula_id", errors, "formula")
    group_index = index_unique(data.model_groups, "model_group", errors, "model group")
    model_index = index_unique(data.models, "model_name", errors, "model")
    recommendation_index = index_unique(
        data.recommendations, "recommendation_id", errors, "recommendation"
    )
    source_index = index_unique(data.sources, "source_id", errors, "source")
    unit_index = index_unique(data.units, "unit_id", errors, "unit")

    validate_catalog_files(data, output_path, errors)

    catalog_schema_version = data.catalog.get("schema_version")
    catalog_data_version = data.catalog.get("data_version")
    for name, document in (
        ("variables", data.variables_file),
        ("formulas", data.formulas_file),
        ("models", data.models_file),
        ("recommendations", data.recommendations_file),
        ("sources", data.sources_file),
        ("units", data.units_file),
        ("engine_config", data.engine_config),
    ):
        if document.get("schema_version") != catalog_schema_version:
            errors.append(f"{name} schema_version does not match catalog.meta.json")
        if document.get("data_version") != catalog_data_version:
            errors.append(f"{name} data_version does not match catalog.meta.json")

    for group in data.model_groups:
        if not str(group.get("display_name", "")).strip():
            errors.append(f"Model group has an empty display_name: {group.get('model_group')}")

    for model in data.models:
        model_name = str(model.get("model_name", ""))
        group_name = str(model.get("model_group", ""))
        if group_name not in group_index:
            errors.append(f"Model {model_name} references unknown model_group {group_name}")
        if not str(model.get("display_name", "")).strip():
            errors.append(f"Model has an empty display_name: {model_name}")

    for unit in data.units:
        unit_id = str(unit.get("unit_id", ""))
        dimension = str(unit.get("dimension", ""))
        canonical = str(unit.get("canonical_si_unit", ""))
        conversion = unit.get("si_conversion", {})
        if canonical not in unit_index:
            errors.append(f"Unit {unit_id} references unknown canonical_si_unit {canonical}")
            continue
        if str(unit_index[canonical].get("dimension")) != dimension:
            errors.append(f"Unit {unit_id} dimension does not match canonical unit {canonical}")
        conversion_type = conversion.get("type") if isinstance(conversion, dict) else None
        if conversion_type == "linear":
            scale = conversion.get("scale")
            offset = conversion.get("offset")
            if not isinstance(scale, (int, float)) or isinstance(scale, bool) or scale <= 0:
                errors.append(f"Unit {unit_id} must have a positive linear scale")
            if not isinstance(offset, (int, float)) or isinstance(offset, bool):
                errors.append(f"Unit {unit_id} must have a numeric linear offset")
        elif conversion_type == "constant_reference":
            variable_id = str(conversion.get("variable_id", ""))
            variable = variable_index.get(variable_id)
            if variable is None:
                errors.append(f"Unit {unit_id} references unknown constant variable {variable_id}")
            else:
                if variable.get("is_constant") is not True:
                    errors.append(f"Unit {unit_id} references non-constant variable {variable_id}")
                if variable.get("dimension") != dimension:
                    errors.append(
                        f"Unit {unit_id} dimension differs from constant variable {variable_id}"
                    )
                if variable.get("internal_unit") == unit_id:
                    errors.append(f"Unit {unit_id} has a direct constant-reference cycle")
        else:
            errors.append(f"Unit {unit_id} has unsupported conversion type {conversion_type}")

    for variable in data.variables:
        variable_id = str(variable.get("variable_id", ""))
        dimension = str(variable.get("dimension", ""))
        internal_unit = str(variable.get("internal_unit", ""))
        default_unit = str(variable.get("default_unit", ""))
        allowed_units = [str(value) for value in variable.get("allowed_units", [])]

        if internal_unit not in unit_index:
            errors.append(f"Variable {variable_id} references unknown internal_unit {internal_unit}")
        elif unit_index[internal_unit].get("dimension") != dimension:
            errors.append(f"Variable {variable_id} internal_unit dimension mismatch")
        if default_unit not in unit_index:
            errors.append(f"Variable {variable_id} references unknown default_unit {default_unit}")
        elif unit_index[default_unit].get("dimension") != dimension:
            errors.append(f"Variable {variable_id} default_unit dimension mismatch")
        if default_unit not in allowed_units:
            errors.append(f"Variable {variable_id} default_unit is not in allowed_units")

        for unit_id in allowed_units:
            unit = unit_index.get(unit_id)
            if unit is None:
                errors.append(f"Variable {variable_id} references unknown allowed unit {unit_id}")
            elif unit.get("dimension") != dimension:
                errors.append(f"Variable {variable_id} allowed unit {unit_id} dimension mismatch")

        for range_name in ("normal_range", "warning_range"):
            range_value = variable.get(range_name, {})
            unit_id = str(range_value.get("unit", ""))
            unit = unit_index.get(unit_id)
            if unit is None:
                errors.append(f"Variable {variable_id} {range_name} uses unknown unit {unit_id}")
            elif unit.get("dimension") != dimension:
                errors.append(f"Variable {variable_id} {range_name} unit dimension mismatch")
            min_value = range_value.get("min")
            max_value = range_value.get("max")
            if isinstance(min_value, (int, float)) and isinstance(max_value, (int, float)):
                if min_value > max_value:
                    errors.append(f"Variable {variable_id} {range_name} min exceeds max")

        try:
            normal = variable["normal_range"]
            warning = variable["warning_range"]
            normal_scale = unit_scale_to_si(
                str(normal["unit"]), unit_index, variable_index
            )
            warning_scale = unit_scale_to_si(
                str(warning["unit"]), unit_index, variable_index
            )
            normal_min = float(normal["min"]) * normal_scale
            normal_max = float(normal["max"]) * normal_scale
            warning_min = float(warning["min"]) * warning_scale
            warning_max = float(warning["max"]) * warning_scale
            if warning_min > normal_min or warning_max < normal_max:
                errors.append(f"Variable {variable_id} warning_range does not enclose normal_range")
        except (KeyError, TypeError, ValueError, ValidationFailure) as exc:
            errors.append(f"Variable {variable_id} range conversion failed: {exc}")

        for condition_name, condition_expression in (
            ("invalid_range", variable.get("invalid_range")),
            ("valid_domain", variable.get("valid_domain")),
        ):
            for condition in iter_conditions(condition_expression):
                unit_id = condition.get("unit")
                if unit_id is None:
                    continue
                unit = unit_index.get(str(unit_id))
                if unit is None:
                    errors.append(
                        f"Variable {variable_id} {condition_name} uses unknown unit {unit_id}"
                    )
                elif unit.get("dimension") != dimension:
                    errors.append(
                        f"Variable {variable_id} {condition_name} unit dimension mismatch"
                    )

        can_assume = variable.get("can_be_assumed") is True
        if can_assume and "default_assumption" not in variable:
            errors.append(f"Variable {variable_id} can_be_assumed but has no default_assumption")
        if "default_assumption" in variable:
            assumption = variable["default_assumption"]
            unit_id = str(assumption.get("unit", ""))
            unit = unit_index.get(unit_id)
            if not can_assume:
                errors.append(f"Variable {variable_id} has default_assumption but cannot be assumed")
            if unit is None:
                errors.append(f"Variable {variable_id} default_assumption uses unknown unit {unit_id}")
            elif unit.get("dimension") != dimension:
                errors.append(f"Variable {variable_id} default_assumption unit dimension mismatch")

        if variable.get("is_constant") is True:
            if "constant_value_si" not in variable:
                errors.append(f"Constant variable {variable_id} has no constant_value_si")
            if variable.get("can_be_user_input") is not False:
                errors.append(f"Constant variable {variable_id} must not allow user input")

    for formula in data.formulas:
        formula_id = str(formula.get("formula_id", ""))
        required_inputs = [str(value) for value in formula.get("required_inputs", [])]
        required_set = set(required_inputs)
        output = str(formula.get("output", ""))
        model_group = str(formula.get("model_group", ""))
        model_name = str(formula.get("model_name", ""))

        for variable_id in required_inputs:
            if variable_id not in variable_index:
                errors.append(f"Formula {formula_id} references unknown input {variable_id}")
        if output not in variable_index:
            errors.append(f"Formula {formula_id} references unknown output {output}")

        model = model_index.get(model_name)
        if model_group not in group_index:
            errors.append(f"Formula {formula_id} references unknown model_group {model_group}")
        if model is None:
            errors.append(f"Formula {formula_id} references unknown model_name {model_name}")
        elif model.get("model_group") != model_group:
            errors.append(f"Formula {formula_id} model_name is registered under another group")

        for reference in formula.get("source_reference", []):
            source_id = str(reference.get("source_id", ""))
            if source_id not in source_index:
                errors.append(f"Formula {formula_id} references unknown source {source_id}")

        allowed_assumptions = [
            str(value) for value in formula.get("allowed_assumption_inputs", [])
        ]
        if not set(allowed_assumptions).issubset(required_set):
            errors.append(f"Formula {formula_id} allowed_assumption_inputs is not a subset of inputs")
        for variable_id in allowed_assumptions:
            variable = variable_index.get(variable_id)
            if variable is not None and variable.get("can_be_assumed") is not True:
                errors.append(f"Formula {formula_id} allows an assumption for non-assumable {variable_id}")

        expression_names, expression_errors = validate_expression(
            str(formula.get("calculation_expression", ""))
        )
        for expression_error in expression_errors:
            errors.append(f"Formula {formula_id} {expression_error}")
        unknown_expression_names = sorted(expression_names - required_set)
        if unknown_expression_names:
            errors.append(
                f"Formula {formula_id} expression uses undeclared identifiers: "
                + ", ".join(unknown_expression_names)
            )

        for condition in iter_conditions(
            formula.get("applicability_conditions", {}).get("machine", {})
        ):
            condition_variable = condition.get("variable")
            if condition_variable is not None and str(condition_variable) not in required_set:
                errors.append(
                    f"Formula {formula_id} applicability condition references non-input "
                    f"{condition_variable}"
                )
            if condition_variable is not None and condition.get("unit") is not None:
                variable = variable_index.get(str(condition_variable))
                unit = unit_index.get(str(condition["unit"]))
                if variable is not None and unit is not None and unit.get("dimension") != variable.get("dimension"):
                    errors.append(f"Formula {formula_id} applicability condition unit mismatch")

        constraints = formula.get("formula_constraints", {})
        if set(constraints.keys()) != {"all"}:
            errors.append(f"Formula {formula_id} formula_constraints must use explicit all only")
        for condition in iter_conditions(constraints):
            condition_variable = condition.get("variable")
            if condition_variable is not None and str(condition_variable) not in required_set:
                errors.append(
                    f"Formula {formula_id} constraint references non-input {condition_variable}"
                )
            if condition_variable is not None and condition.get("unit") is not None:
                variable = variable_index.get(str(condition_variable))
                unit = unit_index.get(str(condition["unit"]))
                if variable is not None and unit is not None and unit.get("dimension") != variable.get("dimension"):
                    errors.append(f"Formula {formula_id} constraint unit mismatch for {condition_variable}")

        unit_mode = formula.get("expression_unit_mode")
        substitution_units = formula.get("substitution_units")
        native_output_unit = formula.get("native_output_unit")
        if unit_mode == "source_native":
            if not isinstance(substitution_units, dict):
                errors.append(f"Source-native formula {formula_id} lacks substitution_units")
            else:
                substitution_keys = set(map(str, substitution_units.keys()))
                if substitution_keys != required_set:
                    errors.append(
                        f"Source-native formula {formula_id} substitution_units must cover exactly required_inputs"
                    )
                for variable_id, unit_id_value in substitution_units.items():
                    variable = variable_index.get(str(variable_id))
                    unit = unit_index.get(str(unit_id_value))
                    if unit is None:
                        errors.append(
                            f"Formula {formula_id} references unknown substitution unit {unit_id_value}"
                        )
                    elif variable is not None and unit.get("dimension") != variable.get("dimension"):
                        errors.append(
                            f"Formula {formula_id} substitution unit dimension mismatch for {variable_id}"
                        )
            if not isinstance(native_output_unit, str) or native_output_unit not in unit_index:
                errors.append(f"Source-native formula {formula_id} lacks a valid native_output_unit")
            elif output in variable_index and unit_index[native_output_unit].get("dimension") != variable_index[output].get("dimension"):
                errors.append(f"Formula {formula_id} native_output_unit dimension mismatch")
        elif unit_mode == "si_consistent":
            if substitution_units is not None or native_output_unit is not None:
                errors.append(f"SI-consistent formula {formula_id} must not declare source-native units")

    for recommendation in data.recommendations:
        recommendation_id = str(recommendation.get("recommendation_id", ""))
        output = str(recommendation.get("output", ""))
        model_group = str(recommendation.get("model_group", ""))
        model_name = str(recommendation.get("recommended_model_name", ""))
        formula_id = str(recommendation.get("applicability_reference", {}).get("formula_id", ""))

        if output not in variable_index:
            errors.append(f"Recommendation {recommendation_id} references unknown output {output}")
        if model_group not in group_index:
            errors.append(f"Recommendation {recommendation_id} references unknown model_group")
        model = model_index.get(model_name)
        if model is None:
            errors.append(f"Recommendation {recommendation_id} references unknown model {model_name}")
        elif model.get("model_group") != model_group:
            errors.append(f"Recommendation {recommendation_id} model/group mismatch")
        formula = formula_index.get(formula_id)
        if formula is None:
            errors.append(f"Recommendation {recommendation_id} references unknown formula {formula_id}")
        else:
            if formula.get("output") != output:
                errors.append(f"Recommendation {recommendation_id} formula/output mismatch")
            if formula.get("model_name") != model_name:
                errors.append(f"Recommendation {recommendation_id} formula/model mismatch")
            if formula.get("model_group") != model_group:
                errors.append(f"Recommendation {recommendation_id} formula/group mismatch")
        alternatives = recommendation.get("fallback_behavior", {}).get("alternative_models", [])
        for alternative in alternatives:
            if alternative not in model_index:
                errors.append(
                    f"Recommendation {recommendation_id} references unknown alternative model {alternative}"
                )
            elif model_index[alternative].get("model_group") != model_group:
                errors.append(
                    f"Recommendation {recommendation_id} alternative model/group mismatch"
                )

    standard_gravity = unit_index.get("standard_gravity")
    gravity = variable_index.get("gravity")
    if standard_gravity is None:
        errors.append("Missing standard_gravity unit")
    if gravity is None:
        errors.append("Missing gravity variable")
    if standard_gravity is not None:
        conversion = standard_gravity.get("si_conversion", {})
        if conversion != {"type": "constant_reference", "variable_id": "gravity"}:
            errors.append("standard_gravity must reference the gravity constant")
    if gravity is not None:
        if gravity.get("is_constant") is not True:
            errors.append("gravity must be a constant variable")
        value = gravity.get("constant_value_si")
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            errors.append("gravity.constant_value_si must be numeric")
        elif not math.isclose(float(value), 9.80665, rel_tol=0.0, abs_tol=1e-12):
            errors.append("gravity.constant_value_si must be 9.80665 for v0.1")

    # Project-stage warnings intentionally remain non-blocking.
    f008 = formula_index.get("F008_ideal_power_acceleration_si", {})
    limitations_f008 = " ".join(f008.get("known_limitations", []))
    if "10 mph" in limitations_f008 and "deferred" in limitations_f008.lower():
        warnings.append(
            "F008 low-speed warning/applicability policy remains deferred to Stage 5; "
            "the course anchor is 10 mph."
        )
    warnings.append(
        "Engineering reasonableness ranges are initial and require Stage 5 calibration."
    )
    f005 = formula_index.get("F005_mass_factor_from_total_gear_ratio", {})
    if f005.get("formula_type") == "empirical":
        warnings.append(
            "F005 is an empirical mass-factor approximation with no source error bound."
        )

    return {
        "status": "pass" if not errors else "fail",
        "error_count": len(errors),
        "errors": errors,
        "warnings": warnings,
        "checks": [
            "Required catalog files and version alignment",
            "Unique IDs across each registry",
            "Variable, unit, model, source, formula, and recommendation references",
            "Unit dimension and canonical-SI consistency",
            "Default-unit, allowed-unit, range, assumption, and constant consistency",
            "Source-native substitution-unit coverage",
            "Restricted calculation-expression syntax and identifiers",
            "Formula-constraint input membership and explicit-all semantics",
            "Recommendation model/formula/output consistency",
            "Gravity and standard_gravity single-source consistency",
        ],
    }


def validate_graph(data: CatalogData) -> dict[str, Any]:
    errors: list[str] = []
    adjacency: dict[str, set[str]] = defaultdict(set)
    indegree: dict[str, int] = defaultdict(int)
    predecessors: dict[str, set[str]] = defaultdict(set)

    variable_nodes = {f"var:{v['variable_id']}" for v in data.variables}
    formula_nodes = {f"formula:{f['formula_id']}" for f in data.formulas}
    nodes = variable_nodes | formula_nodes

    def add_edge(source: str, target: str) -> None:
        if target not in adjacency[source]:
            adjacency[source].add(target)
            predecessors[target].add(source)
            indegree[target] += 1
            indegree.setdefault(source, indegree.get(source, 0))

    for formula in data.formulas:
        formula_node = f"formula:{formula['formula_id']}"
        for variable_id in formula.get("required_inputs", []):
            add_edge(f"var:{variable_id}", formula_node)
        add_edge(formula_node, f"var:{formula['output']}")

    queue = deque(sorted(node for node in nodes if indegree.get(node, 0) == 0))
    topo_order: list[str] = []
    while queue:
        node = queue.popleft()
        topo_order.append(node)
        for target in sorted(adjacency.get(node, ())):
            indegree[target] -= 1
            if indegree[target] == 0:
                queue.append(target)

    is_dag = len(topo_order) == len(nodes)
    maximum_formula_depth = 0
    if not is_dag:
        cyclic_nodes = sorted(nodes - set(topo_order))
        errors.append("Dependency graph contains a cycle involving: " + ", ".join(cyclic_nodes))
    else:
        formula_depth: dict[str, int] = {}
        for node in topo_order:
            predecessor_depth = max(
                (formula_depth.get(parent, 0) for parent in predecessors.get(node, ())),
                default=0,
            )
            formula_depth[node] = predecessor_depth + (1 if node.startswith("formula:") else 0)
            if node.startswith("formula:"):
                maximum_formula_depth = max(maximum_formula_depth, formula_depth[node])

    configured_limit = data.engine_config.get("max_reverse_formula_depth")
    if isinstance(configured_limit, int) and maximum_formula_depth > configured_limit:
        errors.append(
            f"Maximum formula depth {maximum_formula_depth} exceeds configured reverse limit {configured_limit}"
        )

    acceleration_models = sorted(
        {
            str(formula["model_name"])
            for formula in data.formulas
            if formula.get("output") == "longitudinal_acceleration"
        }
    )
    expected_acceleration_models = {
        "engine_limited_acceleration",
        "ideal_constant_power_acceleration",
    }
    if set(acceleration_models) != expected_acceleration_models:
        errors.append(
            "longitudinal_acceleration model set differs from the confirmed v0.1 model set"
        )

    return {
        "status": "pass" if not errors else "fail",
        "error_count": len(errors),
        "errors": errors,
        "is_dag": is_dag,
        "maximum_formula_depth": maximum_formula_depth,
        "configured_reverse_depth_limit": configured_limit,
        "acceleration_models": acceleration_models,
        "notes": [
            "F007 and F008 remain separate model-qualified results.",
            "R001 is a recommendation record and not a numerical formula.",
            "The dependency graph is derived from required_inputs and output; "
            "ASCII diagrams are non-authoritative.",
        ],
        "dependency_nodes": len(nodes),
        "dependency_edges": sum(len(targets) for targets in adjacency.values()),
    }


def build_report(
    data: CatalogData,
    schema_validation: dict[str, Any],
    cross_file_validation: dict[str, Any],
    graph_validation: dict[str, Any],
) -> dict[str, Any]:
    blocking_failure = any(
        section["status"] != "pass"
        for section in (schema_validation, cross_file_validation, graph_validation)
    )
    warnings = list(cross_file_validation.pop("warnings", []))
    overall_status = "fail" if blocking_failure else ("pass_with_warnings" if warnings else "pass")

    return {
        "schema_version": str(data.catalog["schema_version"]),
        "data_version": str(data.catalog["data_version"]),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "validator": {
            "path": "tools/validate_catalog.py",
            "version": VALIDATOR_VERSION,
            "python": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
            "json_schema_draft": "2020-12",
        },
        "overall_status": overall_status,
        "counts": {
            "variables": len(data.variables),
            "formulas": len(data.formulas),
            "model_groups": len(data.model_groups),
            "models": len(data.models),
            "recommendations": len(data.recommendations),
            "sources": len(data.sources),
            "units": len(data.units),
            "dependency_nodes": graph_validation["dependency_nodes"],
            "dependency_edges": graph_validation["dependency_edges"],
            "maximum_formula_depth": graph_validation["maximum_formula_depth"],
        },
        "schema_validation": schema_validation,
        "cross_file_validation": cross_file_validation,
        "graph_validation": {
            key: value
            for key, value in graph_validation.items()
            if key not in {"dependency_nodes", "dependency_edges"}
        },
        "warnings": warnings,
        "microfixes_absorbed": [
            "catalog.meta.json has an explicit versioned file-index structure.",
            "formula_constraints uses explicit all only.",
            "known_limitations and notes remain optional formula fields.",
            "valid_domain accepts either a single condition object or an explicit all/any group.",
        ],
    }


def print_summary(report: Mapping[str, Any], output_path: Path | None) -> None:
    counts = report["counts"]
    print(f"Validation status: {report['overall_status']}")
    print(
        "Catalog counts: "
        f"{counts['variables']} variables, {counts['formulas']} formulas, "
        f"{counts['models']} models, {counts['units']} units"
    )
    print(
        "Dependency graph: "
        f"{counts['dependency_nodes']} nodes, {counts['dependency_edges']} edges, "
        f"maximum formula depth {counts['maximum_formula_depth']}"
    )
    for section_name in ("schema_validation", "cross_file_validation", "graph_validation"):
        section = report[section_name]
        error_count = section.get("error_count")
        if error_count is None and section_name == "schema_validation":
            error_count = len(section.get("schema_meta_errors", [])) + sum(
                file_result.get("error_count", 0) for file_result in section.get("files", [])
            )
        print(f"{section_name}: {section['status']} ({error_count or 0} errors)")
    if report.get("warnings"):
        print(f"Warnings: {len(report['warnings'])}")
        for warning in report["warnings"]:
            print(f"  - {warning}")
    if output_path is not None:
        print(f"Report written to: {output_path}")


def main() -> int:
    args = parse_args()
    root = args.root.resolve()
    output_path = args.output or DEFAULT_REPORT_PATH
    if not output_path.is_absolute():
        output_path = (root / output_path).resolve()

    try:
        output_path.relative_to(root)
    except ValueError:
        print("Output path must remain inside the repository root.", file=sys.stderr)
        return 2

    try:
        data = load_catalog_data(root)
        registry, schemas, schema_meta_errors = build_schema_registry(root)
        schema_validation = validate_schemas(
            data, registry, schemas, schema_meta_errors, output_path
        )
        cross_file_validation = validate_cross_file(data, output_path)
        graph_validation = validate_graph(data)
        report = build_report(
            data, schema_validation, cross_file_validation, graph_validation
        )
    except ValidationFailure as exc:
        print(f"Validation setup failed: {exc}", file=sys.stderr)
        return 2
    except Exception as exc:  # Keep the CLI failure explicit rather than hiding a traceback.
        print(f"Validator failed unexpectedly: {exc}", file=sys.stderr)
        return 2

    if not args.no_write:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", encoding="utf-8", newline="\n") as handle:
            json.dump(report, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        written_path: Path | None = output_path
    else:
        written_path = None

    print_summary(report, written_path)
    return 0 if report["overall_status"] != "fail" else 1


if __name__ == "__main__":
    raise SystemExit(main())
