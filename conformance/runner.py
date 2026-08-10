#!/usr/bin/env python3
"""Run the conformance suite from a second language.

The suite calls itself language-agnostic. Until this existed, one runner had
ever read it — the TypeScript one, written by the same people as the cases — so
the claim was a design intention rather than a fact. This is the test of it: a
runner in another language, written against `conformance/README.md` and the
manifest, driving the minimal reader in `docs/examples/`.

    python3 conformance/runner.py            # every case it can judge
    python3 conformance/runner.py --verbose  # and why it skipped the others

**What this judges.** Two implementations written from the specification rather
than from the reference: `minimal_reader.py` derives the standings and
`validator.py` produces the diagnostics. So every expectation a case states —
validity, error codes and their locations, warnings, derived rankings — is
judged a second time, in a second language, by code that has never read the
first.
"""

import json
import sys
from pathlib import Path

SUITE = Path(__file__).resolve().parent
sys.path.insert(0, str(SUITE.parent / "docs" / "examples"))

from minimal_reader import format_duration, fixed, rank, read  # noqa: E402
from validator import validate  # noqa: E402


class Outcome:
    """What happened to one case."""

    def __init__(self, case, checked=0, failures=None, skipped=None):
        self.case = case
        self.checked = checked
        self.failures = failures or []
        self.skipped = skipped

    @property
    def passed(self):
        return self.skipped is None and not self.failures


def run_case(case):
    """Compare this implementation's rankings against what the case states."""
    directory = SUITE / case["path"]
    expected = json.loads((directory / "expected.json").read_text(encoding="utf-8"))

    failures = []
    checked = 0

    # The diagnostics first, on the raw JSON: a document whose version cannot be
    # read is one the reader refuses and the validator must still report on.
    raw = json.loads((directory / "document.json").read_text(encoding="utf-8"))
    report = validate(raw)
    if expected.get("valid") is True and not report.valid:
        failures.append(
            "expected the document to validate; got "
            + ", ".join(f"{e['code']} {e['path']}" for e in report.errors)
        )
    if expected.get("valid") is False and report.valid:
        failures.append("expected the document to be rejected, but it validated")

    reported = {(e["code"], e["path"]) for e in report.errors}
    for wanted in expected.get("errors") or []:
        checked += 1
        if (wanted["code"], wanted["path"]) not in reported:
            failures.append(
                f"expected error {wanted['code']} {wanted['path']}; got "
                + (", ".join(f"{c} {p}" for c, p in sorted(reported)) or "none")
            )

    warned = {w["code"] for w in report.warnings}
    for code in expected.get("warnings") or []:
        checked += 1
        if code not in warned:
            failures.append(
                f"expected warning {code}; got " + (", ".join(sorted(warned)) or "none")
            )

    # §5.1.5 and §5.2.5 — the figure a consumer prints, and only the figure: no
    # unit, no scale, a `.` for the decimal separator wherever it runs.
    TIME_UNITS = {"s": 1, "ms": 0.001, "min": 60, "h": 3600}
    for wanted in expected.get("display") or []:
        checked += 1
        measure = next((m for m in raw.get("measures") or []
                        if m["id"] == wanted["measure"]), None)
        value = ((raw["results"][wanted["result"]].get("values") or {})
                 .get(wanted["measure"]))
        if measure is None or not isinstance(value, (int, float)) or isinstance(value, bool):
            failures.append(f"display: /results/{wanted['result']} carries no number "
                            f"for \"{wanted['measure']}\"")
            continue
        unit = measure.get("unit")
        precision = measure.get("precision")
        if measure.get("kind") == "duration" and unit in TIME_UNITS:
            got = format_duration(value * TIME_UNITS[unit], precision or 0)
        elif precision is None:
            got = f"{value:g}"
        else:
            got = fixed(value, precision)
        if got != wanted["rendered"]:
            failures.append(f"display: {value} as \"{wanted['measure']}\" renders "
                            f"\"{got}\", expected \"{wanted['rendered']}\"")

    if expected.get("rankings"):
        try:
            document = read(str(directory / "document.json"))
        except Exception as error:  # noqa: BLE001 — deliberately unreadable
            return Outcome(case, checked=checked,
                           failures=[*failures, f"could not read the document: {error}"])

    for ranking_id, wanted in (expected.get("rankings") or {}).items():
        # `result` is carried only where the participant alone does not identify
        # the row (§8.5.7), so it is compared only where the case states it.
        identifies = any("result" in row for row in wanted)
        derived = [
            {"participant": result["participant"], "rank": position,
             **({"result": raw["results"].index(result)} if identifies else {})}
            for result, position in rank(document, ranking_id)
        ]
        # Sequence comparison, not set: the order is what verifies sort stability.
        if derived != wanted:
            failures.append(
                f'ranking "{ranking_id}": expected {json.dumps(wanted)}, got {json.dumps(derived)}'
            )

    return Outcome(case, checked=checked + len(expected.get("rankings") or {}),
                   failures=failures)


def main():
    verbose = "--verbose" in sys.argv
    manifest = json.loads((SUITE / "manifest.json").read_text(encoding="utf-8"))

    outcomes = []
    for case in manifest["cases"]:
        if case.get("deprecated") is not None:
            outcomes.append(Outcome(case, skipped=f"deprecated: {case['deprecated']}"))
            continue
        # This implementation claims the ranking level, which includes reading.
        if case["level"] == "rewriting":
            outcomes.append(Outcome(case, skipped='level "rewriting" not claimed'))
            continue
        outcomes.append(run_case(case))

    failed = [o for o in outcomes if o.failures]
    skipped = [o for o in outcomes if o.skipped is not None]
    passed = [o for o in outcomes if o.passed]
    rankings = sum(o.checked for o in outcomes)

    for outcome in failed:
        print(f"  ✗ {outcome.case['id']}  {outcome.case['rule']}")
        for failure in outcome.failures:
            print(f"      {failure}")

    if verbose:
        for outcome in skipped:
            print(f"  – {outcome.case['id']}: {outcome.skipped}")

    print(
        f"\n{len(passed)}/{len(passed) + len(failed)} cases passed, "
        f"{rankings} expectations checked, {len(skipped)} skipped"
        + (f", {len(failed)} FAILED" if failed else "")
    )
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
