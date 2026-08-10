#!/usr/bin/env python3
"""A complete OpenResult 1.0 reader, in one file with no dependencies.

Written from the specification alone, in a language the reference implementation
is not written in. If this needs information that is not in
`specification/openresult-v1.md`, the specification has a gap.

    python3 minimal_reader.py results.openresult.json [ranking-id]
    python3 minimal_reader.py --json results.openresult.json [ranking-id]

Implements the *ranking* conformance level (spec §11.5.3): reads a document,
exposes its semantics, and derives standings exactly as §8.5 prescribes.
"""

import json
import sys
from decimal import Decimal, ROUND_HALF_UP, localcontext

SUPPORTED_MAJOR = 1

# Statuses excluded from ranking unless a ranking says otherwise (spec §8.4.2).
DEFAULT_EXCLUDED = {"notClassified", "inProgress", "dnf", "dns", "dsq", "outOfTime", "withdrawn"}
# `bye` ranks like `finished`: a score without a contest still counts (§7.2.5).
KNOWN_STATUSES = DEFAULT_EXCLUDED | {"finished", "bye"}
KNOWN_DIRECTIONS = {"lower", "higher", "none"}
KNOWN_TIES = {"standard", "dense", "strict", "resolved"}
KNOWN_KINDS = {
    "duration", "distance", "mass", "points", "score", "percentage",
    "count", "money", "rate", "text", "boolean",
}


class UnsupportedVersion(Exception):
    """The document declares a major version this reader cannot interpret."""


def read(path):
    """Load a document, refusing a major version we cannot interpret (§11.4.1)."""
    with open(path, encoding="utf-8") as handle:
        document = json.load(handle)

    declared = document.get("openresult")
    if not isinstance(declared, str) or "." not in declared:
        raise ValueError('Not an OpenResult document: "openresult" is missing or malformed.')

    major = int(declared.split(".")[0])
    if major != SUPPORTED_MAJOR:
        raise UnsupportedVersion(
            f"This document declares OpenResult {declared}; this reader supports "
            f"{SUPPORTED_MAJOR}.x. A different major version may mean different things "
            f"by the same members, so it is not guessed at."
        )
    return document


# Unknown enumeration values fold onto their documented fallback (§11.3.1).
# This is what makes adding a value in a later minor version non-breaking.
def status_of(result):
    status = result.get("status", "finished")
    return status if status in KNOWN_STATUSES else "finished"


def direction_of(measure):
    direction = measure.get("betterWhen", "none")
    return direction if direction in KNOWN_DIRECTIONS else "none"


def ties_of(ranking):
    ties = ranking.get("ties", "standard")
    return ties if ties in KNOWN_TIES else "standard"


def measures_by_id(document):
    return {m["id"]: m for m in document.get("measures", [])}


def sortable(measure):
    """Whether a measure may decide an order (§8.2.2). A consumer meets a
    forbidden one whether or not producers obey: §5.1.6 folds an unknown
    direction onto `none`, so every direction a later 1.x adds arrives here."""
    if measure is None or direction_of(measure) == "none":
        return False
    return measure.get("kind") not in ("text", "boolean")


def implicit_ranking(document):
    """With no ranking declared, the first measure §8.2.2 permits in one (§8.6.1)."""
    for measure in document.get("measures", []):
        if sortable(measure):
            return {
                "id": measure["id"],
                "label": measure["label"],
                "sortBy": [measure["id"]],
                "ties": "standard",
            }
    return None


def resolve_ranking(document, ranking_id=None):
    declared = document.get("rankings", [])
    if ranking_id is not None:
        for ranking in declared:
            if ranking["id"] == ranking_id:
                return ranking
        implicit = implicit_ranking(document) if not declared else None
        return implicit if implicit and implicit["id"] == ranking_id else None
    return declared[0] if declared else implicit_ranking(document)


def as_list(value):
    """§8.1.1 and §8.1.2 both accept one identifier or several."""
    return value if isinstance(value, list) else [value]


def in_scope(document, ranking, result):
    """Step 1 — selection (§8.5.1). The scoped events only, never their descendants."""
    scope = ranking.get("scope")
    if scope is None:
        return True

    if "event" in scope:
        # One event or several (§8.1.1). Listing them is how a standing spanning
        # several events avoids copying results; descendants are still excluded.
        if result.get("event") not in as_list(scope["event"]):
            return False

    if "category" in scope:
        # One category or several (§8.1.2). Several is a union: belonging to any
        # of them is enough.
        wanted = as_list(scope["category"])
        members = {
            participant
            for category in document.get("categories", [])
            if category["id"] in wanted
            for participant in category.get("participants", [])
        }
        if result["participant"] not in members:
            return False

    return True


def carries_usable_value(document, result, measure_id):
    """Whether a result carries a value this measure can be ordered by (§8.5.2).

    The type is checked against the measure's declared kind, never against the
    other value being compared. Deciding pairwise — a number and a string cannot
    be compared, so call them equal — is not transitive, and the same results in
    a different declaration order then land in different tie groups. Two
    consumers would disagree, which §8.5.6 forbids."""
    value = result.get("values", {}).get(measure_id)
    if value is None:
        return False
    kind = measures_by_id(document).get(measure_id, {}).get("kind")
    # A kind this version does not know implies no type (§5.1.6, §8.5.2). §5.1.6
    # folds it onto `text` for display, and inferring a string from that fold
    # would make every value of a kind a later 1.x adds unrankable.
    if kind not in KNOWN_KINDS:
        return True
    if kind == "text":
        return isinstance(value, str)
    if kind == "boolean":
        return isinstance(value, bool)
    # Everything else is a number (§5.2.1). `bool` is a subclass of `int` in
    # Python, so it has to be excluded explicitly or True would rank as 1.
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def sorting_measures(document, ranking):
    """The sortBy entries that may actually decide an order (§8.2.2).

    Dropped here, before the partition, and not merely skipped while comparing:
    §8.5.2 asks for a value for *every* measure in sortBy, so one only ignored
    during comparison would still leave every result unranked for want of a
    figure the ranking never uses."""
    catalogue = measures_by_id(document)
    return [m for m in ranking["sortBy"] if sortable(catalogue.get(m))]


def sort_key(document, ranking):
    """Build the comparison key. Direction comes from the measure, never the
    ranking (§8.2.3): one source of truth means no contradiction to arbitrate."""
    catalogue = measures_by_id(document)

    def key(result):
        parts = []
        for measure_id in sorting_measures(document, ranking):
            direction = direction_of(catalogue.get(measure_id))
            value = result.get("values", {}).get(measure_id)
            parts.append(-value if direction == "higher" else value)
        return parts

    return key


def settle_by_published_ranks(group, ranking_id):
    """Order a tied group by the positions the producer published (§8.3.4).

    All of the group or none of it: a rule that separated one pair and left
    another tied would not be transitive, and the standings would then depend on
    the sorting algorithm — the divergence §8.5.6 forbids."""
    if len(group) < 2:
        return None
    positions = [result.get("ranks", {}).get(ranking_id) for result in group]
    if any(position is None for position in positions):
        return None
    if len(set(positions)) != len(positions):
        return None
    return sorted(group, key=lambda result: result["ranks"][ranking_id])


def rank(document, ranking_id=None):
    """Derive the standings (§8.5). Returns (result, rank) pairs; rank is None
    for the unranked, which are kept rather than dropped (§7.2.4)."""
    ranking = resolve_ranking(document, ranking_id)
    if ranking is None:
        return [(result, None) for result in document.get("results", [])]

    excluded = set(ranking.get("excludeStatuses", DEFAULT_EXCLUDED))
    selected = [r for r in document.get("results", []) if in_scope(document, ranking, r)]

    # Step 2 — partition (§8.5.2). A result missing a sorting measure — or
    # carrying something its kind does not admit — cannot be placed, so it is
    # unranked rather than treated as zero.
    rankable, unranked = [], []
    for result in selected:
        has_values = all(
            carries_usable_value(document, result, m)
            for m in sorting_measures(document, ranking)
        )
        (rankable if status_of(result) not in excluded and has_values else unranked).append(result)

    # Step 3 — sort (§8.5.3). Python's sort is stable, which is what preserves
    # declaration order among results that compare equal.
    key = sort_key(document, ranking)
    ordered = sorted(rankable, key=key)

    # Step 4 — assign (§8.5.4).
    ties, placed, group_number = ties_of(ranking), [], 0
    index = 0
    while index < len(ordered):
        group_number += 1
        end = index + 1
        while end < len(ordered) and key(ordered[end]) == key(ordered[index]):
            end += 1

        group = ordered[index:end]
        settled = settle_by_published_ranks(group, ranking["id"]) if ties == "resolved" else None
        if settled is not None:
            placed.extend((result, index + offset + 1) for offset, result in enumerate(settled))
            group_number += len(settled) - 1
            index = end
            continue

        assigned = group_number if ties == "dense" else index + 1
        placed.extend((result, assigned) for result in group)
        index = end

    # Step 5 — the unranked follow, in declaration order (§8.5.5).
    return placed + [(result, None) for result in unranked]


TIME_UNITS = {"s": 1, "ms": 0.001, "min": 60, "h": 3600}


# The most decimals either reader shows. §5.1.5 sets no ceiling and neither does
# the schema, so a document may declare a hundred and one; JavaScript's formatter
# throws past this point, and a reader that refused to show results because the
# producer over-specified how to show them would be failing at its one job.
MOST_DECIMALS = 100


def fixed(value, precision):
    """Round away from zero at a half, as §5.1.5 requires.

    Python rounds a half to the nearest even digit and JavaScript rounds it up,
    so `8.5` to no decimals is 8 in one and 9 in the other. Both conventions are
    defensible; a published time being a second apart between two consumers is
    not.

    `repr` first, because the rounding applies to the decimal the document
    wrote rather than to the double it became: 2.675 is stored as 2.67499…, and
    a producer who typed 2.675 is looking for 2.68."""
    places = min(max(int(precision), 0), MOST_DECIMALS)
    # The default context carries 28 significant digits and raises past it, so a
    # hundred decimal places would trade one crash for another.
    with localcontext() as context:
        context.prec = MOST_DECIMALS * 2
        quantum = Decimal(1).scaleb(-places)
        return f"{Decimal(repr(value)).quantize(quantum, rounding=ROUND_HALF_UP):f}"


def format_duration(seconds, precision):
    """Hours, minutes and seconds, leading zero components dropped (§5.2.5)."""
    negative = seconds < 0
    seconds = abs(seconds)
    hours, rest = divmod(seconds, 3600)
    minutes, secs = divmod(rest, 60)

    body = fixed(secs, precision)
    if hours >= 1:
        text = f"{int(hours)}:{int(minutes):02d}:{body.zfill(precision + 3 if precision else 2)}"
    elif minutes >= 1:
        text = f"{int(minutes)}:{body.zfill(precision + 3 if precision else 2)}"
    else:
        text = body
    return f"-{text}" if negative else text


def format_value(value, measure):
    """Apply the declared precision and unit. Display only: sorting always uses
    the raw value (§5.1.5)."""
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return str(value)

    precision = measure.get("precision")
    unit = measure.get("unit")

    if measure.get("kind") == "duration" and unit in TIME_UNITS:
        return format_duration(value * TIME_UNITS[unit], precision or 0)

    # `:g` rather than `str()`: JSON has one number type and Python has two, so
    # `str(91.0)` is "91.0" where a JavaScript consumer shows "91". With no
    # declared precision the format says nothing about decimals, and the two
    # readers would then disagree on every whole number.
    text = fixed(value, precision) if precision is not None else f"{value:g}"

    # A bounded score reads against its maximum (§5.2.7): 27 is excellent out of
    # 30 and poor out of 100.
    # Excluded where the scale would say something false (§5.2.7): a maximum of
    # one reads "1.0/1.0", and where lower is better a race win out of a fleet
    # of twenty-one reads "1.0/21.0".
    maximum = measure.get("max")
    if (
        maximum not in (None, 1)
        and direction_of(measure) == "higher"
        and measure.get("kind") in ("score", "points")
    ):
        top = fixed(maximum, precision) if precision is not None else f"{maximum:g}"
        return f"{text}/{top}"

    return f"{text} {unit}" if unit else text


def main():
    args = sys.argv[1:]
    as_json = "--json" in args
    if as_json:
        args.remove("--json")
    if not args:
        print(__doc__)
        return 2

    try:
        document = read(args[0])
    except UnsupportedVersion as error:
        print(error, file=sys.stderr)
        return 3

    ranking_id = args[1] if len(args) > 1 else None
    catalogue = measures_by_id(document)
    ranking = resolve_ranking(document, ranking_id)

    # Machine-readable standings, so another implementation can be compared
    # against this one case by case.
    if as_json:
        # Formatted values travel too: two implementations agreeing on the order
        # and disagreeing on what they print is still a divergence, and it went
        # unnoticed until a reader concluded from the specification that a
        # duration could not be shown as 2:12.88 (§5.2.5).
        print(json.dumps([
            {
                "participant": result["participant"],
                "rank": position,
                # What the specification normalises: durations (§5.2.5) and
                # bounded scores (§5.2.7). Everything else follows the locale.
                "display": {
                    measure_id: format_value(value, catalogue[measure_id])
                    for measure_id, value in sorted((result.get("values") or {}).items())
                    if measure_id in catalogue
                    and (
                        (
                            catalogue[measure_id].get("kind") == "duration"
                            and catalogue[measure_id].get("unit") in TIME_UNITS
                        )
                        or (
                            catalogue[measure_id].get("max") is not None
                            and catalogue[measure_id].get("kind") in ("score", "points")
                        )
                    )
                },
            }
            for result, position in rank(document, ranking_id)
        ]))
        return 0

    print(document["title"])
    if ranking:
        print(f"{ranking['label']} — by {', '.join(ranking['sortBy'])}, ties: {ties_of(ranking)}")
    print()

    names = {p["id"]: p["name"] for p in document["participants"]}
    for result, position in rank(document, ranking_id):
        figures = " ".join(
            format_value(result["values"][m], catalogue[m])
            for m in (ranking["sortBy"] if ranking else [])
            if m in result.get("values", {}) and m in catalogue
        )
        marker = str(position) if position is not None else "—"
        detail = figures if position is not None else status_of(result)
        print(f"{marker:>3}  {names.get(result['participant'], result['participant']):<24} {detail}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
