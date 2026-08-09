#!/usr/bin/env python3
"""Run the conformance suite from a second language.

The suite calls itself language-agnostic. Until this existed, one runner had
ever read it — the TypeScript one, written by the same people as the cases — so
the claim was a design intention rather than a fact. This is the test of it: a
runner in another language, written against `conformance/README.md` and the
manifest, driving the minimal reader in `docs/examples/`.

    python3 conformance/runner.py            # every case it can judge
    python3 conformance/runner.py --verbose  # and why it skipped the others

**What this can judge, and what it cannot.** The minimal reader implements the
*ranking* level (spec §11.5.3): it reads a document and derives standings. It is
not a validator, so it cannot answer whether a document is conforming, and it
says so rather than guessing — a runner that reported "no errors found" from an
implementation that looks for none would turn every invalid case into a pass,
which is the failure mode `conformance-manifest` exists to prevent.

So each case is judged on the expectations this implementation can actually
check: derived rankings, wherever the case states them. That covers both valid
and invalid cases, because §11.3.1 requires a consumer to read a non-conforming
document rather than refuse it, and a case that states rankings alongside its
errors is stating exactly that.
"""

import json
import sys
from pathlib import Path

SUITE = Path(__file__).resolve().parent
sys.path.insert(0, str(SUITE.parent / "docs" / "examples"))

from minimal_reader import rank, read  # noqa: E402


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

    rankings = expected.get("rankings")
    if rankings is None:
        # Validity and diagnostics only. A reader has nothing to say about
        # those, and saying nothing is the honest answer.
        return Outcome(case, skipped="states no ranking; this implementation does not validate")

    try:
        document = read(str(directory / "document.json"))
    except Exception as error:  # noqa: BLE001 — the case may be deliberately unreadable
        return Outcome(case, failures=[f"could not read the document: {error}"])

    failures = []
    for ranking_id, wanted in rankings.items():
        derived = [
            {"participant": result["participant"], "rank": position}
            for result, position in rank(document, ranking_id)
        ]
        # Sequence comparison, not set: the order is what verifies sort stability.
        if derived != wanted:
            failures.append(
                f'ranking "{ranking_id}": expected {json.dumps(wanted)}, got {json.dumps(derived)}'
            )

    return Outcome(case, checked=len(rankings), failures=failures)


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
        f"{rankings} rankings compared, {len(skipped)} skipped"
        + (f", {len(failed)} FAILED" if failed else "")
    )
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
