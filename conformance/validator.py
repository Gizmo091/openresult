#!/usr/bin/env python3
"""A second validator, so the diagnostic half of the suite travels too.

The suite has two halves. What a consumer derives — rankings — has been checked
from three languages since `runner.py` and `runner.php` existed. What a
validator reports has only ever been checked by the one that produced the cases,
in the language the reference implementation is written in. Seventy-five of the
suite's cases state a diagnostic, and until this file none of them had been
judged twice.

This produces `(code, path)` pairs from the specification's text, without
reading the reference implementation. Where it disagrees with a case, one of
them is wrong and the disagreement is the point.

    python3 conformance/validator.py document.json
"""

import json
import re
import sys
from pathlib import Path

SUITE = Path(__file__).resolve().parent
sys.path.insert(0, str(SUITE.parent / "docs" / "examples"))

from minimal_reader import (  # noqa: E402
    DEFAULT_EXCLUDED,
    KNOWN_KINDS,
    as_list,
    direction_of,
    measures_by_id,
    rank,
    sortable,
    status_of,
    ties_of,
)

IDENTIFIER = re.compile(r"^[A-Za-z0-9_-]+$")
TIMESTAMP = re.compile(r"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2}))?$")
VERSION = re.compile(r"^\d+\.\d+$")
LANG = re.compile(r"^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$")
SPDX = re.compile(r"^[A-Za-z0-9.+()-]+(?: (?:AND|OR|WITH) [A-Za-z0-9.+()-]+)*$")

DOCUMENT_STATUSES = {"draft", "provisional", "official", "amended"}
RESULT_STATUSES = {"finished", "bye", "notClassified", "inProgress", "dnf", "dns", "dsq",
                   "outOfTime", "withdrawn"}
PARTICIPANT_TYPES = {"person", "team", "machine", "product", "model", "organization", "other"}
EVENT_TYPES = {"heat", "match", "round", "stage", "session", "final", "overall", "other"}
ATTRIBUTE_TYPES = {"text", "number", "date", "url", "country", "boolean"}
ASSET_TYPES = {"image", "video", "audio", "document", "other"}
TIE_RULES = {"standard", "dense", "strict", "resolved"}
NAMES_NOTHING = {"n", "#", "no"}
SUPPORTED_MAJOR = 1


class Report:
    def __init__(self):
        self.errors = []
        self.warnings = []

    def error(self, code, path):
        self.errors.append({"code": code, "path": path})

    def warn(self, code, path):
        self.warnings.append({"code": code, "path": path})

    @property
    def valid(self):
        return not self.errors


def is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def validate(document):
    """Every diagnostic the specification defines, from its text."""
    report = Report()

    # §4.2.1 — the version gate runs first and stops there. A document whose
    # version cannot be read is not an OpenResult document, and answering with
    # thirty schema errors would bury the one that matters.
    declared = document.get("openresult")
    if not isinstance(declared, str) or not VERSION.match(declared):
        report.error("OR-401", "/openresult")
        return report
    if int(declared.split(".")[0]) != SUPPORTED_MAJOR:
        report.error("OR-402", "/openresult")
        return report

    _structure(document, report)
    _measures(document, report)
    _attributes(document, report)
    _participants(document, report)
    _events(document, report)
    _results(document, report)
    _entity_attributes(document, report)
    _rankings(document, report)
    _categories(document, report)
    _published_positions(document, report)
    _resources(document, report)
    _quality(document, report)
    return report


def _structure(document, report):
    for member in ("title", "participants", "results"):          # §4.1.1
        if member not in document:
            report.error("OR-101", "/")
    if document.get("title") == "":                               # §4.1.1
        report.error("OR-102", "/title")
    if "id" in document and not IDENTIFIER.match(str(document["id"])):   # §4.3.1
        report.error("OR-104", "/id")
    if "status" in document and document["status"] not in DOCUMENT_STATUSES:  # §4.4.1
        report.error("OR-103", "/status")
    version = document.get("version")
    if version is not None and (not isinstance(version, int) or version < 0):  # §4.4.2
        report.error("OR-102", "/version")
    if "lang" in document and not LANG.match(str(document["lang"])):     # §4.5.1
        report.error("OR-102", "/lang")
    for member in ("generatedAt",):                               # §4.6.1
        if member in document and not TIMESTAMP.match(str(document[member])):
            report.error("OR-106", f"/{member}")
    # §10.2.4 — a member neither defined here nor prefixed `x-`.
    known = {"openresult", "id", "version", "status", "title", "description", "lang", "generatedAt",
             "occurredAt", "source", "measures", "attributeDefinitions", "attributes",
             "participants", "events", "results", "rankings", "categories", "links", "assets",
             "presentation"}
    for member in document:
        if member not in known and not member.startswith("x-"):
            report.error("OR-105", f"/{member}")


def _measures(document, report):
    seen = set()
    for index, measure in enumerate(document.get("measures") or []):
        at = f"/measures/{index}"
        if "id" not in measure or "label" not in measure or "kind" not in measure:   # §4.1.1
            report.error("OR-101", at)
            continue
        if not IDENTIFIER.match(str(measure["id"])):                                 # §5.4.1
            report.error("OR-104", f"{at}/id")
        if measure["id"] in seen:                                                    # §5.1.1
            report.error("OR-202", f"{at}/id")
        seen.add(measure["id"])
        if measure["kind"] not in KNOWN_KINDS:                                       # §5.1.2
            report.error("OR-103", f"{at}/kind")
        if measure.get("betterWhen") not in (None, "lower", "higher", "none"):       # §5.1.4
            report.error("OR-103", f"{at}/betterWhen")
        if measure["kind"] not in ("text", "boolean") and "unit" not in measure:     # §5.1.3
            report.error("OR-107", at)
        precision = measure.get("precision")
        if precision is not None and (not isinstance(precision, int) or precision < 0):  # §5.1.5
            report.error("OR-102", f"{at}/precision")
        low, high = measure.get("min"), measure.get("max")
        if is_number(low) and is_number(high) and low > high:                        # §5.1.8
            report.error("OR-109", f"{at}/min")
        if measure["kind"] == "count" and str(measure.get("unit", "")).lower() in NAMES_NOTHING:
            report.error("OR-111", f"{at}/unit")                                     # §5.2.6


def _attributes(document, report):
    for index, attribute in enumerate(document.get("attributeDefinitions") or []):
        at = f"/attributeDefinitions/{index}"
        if "id" not in attribute or "label" not in attribute:
            report.error("OR-101", at)
            continue
        if not IDENTIFIER.match(str(attribute["id"])):
            report.error("OR-104", f"{at}/id")
        if attribute.get("type") not in ATTRIBUTE_TYPES:                             # §5.3.1
            report.error("OR-103", f"{at}/type")
        elif "unit" in attribute and attribute["type"] != "number":                  # §5.3.7
            report.error("OR-110", f"{at}/type")


def _participants(document, report):
    seen = set()
    ids = {p.get("id") for p in document.get("participants") or []}
    for index, participant in enumerate(document.get("participants") or []):
        at = f"/participants/{index}"
        if "id" not in participant or "name" not in participant:                     # §6.1.4
            report.error("OR-101", at)
            continue
        if not IDENTIFIER.match(str(participant["id"])):
            report.error("OR-104", f"{at}/id")
        if participant["id"] in seen:                                                # §5.4.2
            report.error("OR-202", f"{at}/id")
        seen.add(participant["id"])
        if "type" in participant and participant["type"] not in PARTICIPANT_TYPES:   # §6.1.1
            report.error("OR-103", f"{at}/type")
        for m, member in enumerate(participant.get("members") or []):                # §6.1.2
            if member not in ids:
                report.error("OR-201", f"{at}/members/{m}")


def _events(document, report):
    events = document.get("events") or []
    ids = {e.get("id") for e in events}
    seen = set()
    for index, event in enumerate(events):
        at = f"/events/{index}"
        if "id" not in event or "name" not in event:
            report.error("OR-101", at)
            continue
        if event["id"] in seen:
            report.error("OR-202", f"{at}/id")
        seen.add(event["id"])
        if "type" in event and event["type"] not in EVENT_TYPES:                     # §6.2.1
            report.error("OR-103", f"{at}/type")
        parent = event.get("parent")
        if parent is not None:                                                       # §6.2.2
            if parent not in ids:
                report.error("OR-201", f"{at}/parent")
            elif _cycles(events, event["id"]):
                report.error("OR-204", f"{at}/parent")


def _cycles(nodes, start, key="parent"):
    by_id = {n.get("id"): n for n in nodes}
    seen, current = set(), start
    while current is not None and current not in seen:
        seen.add(current)
        current = (by_id.get(current) or {}).get(key)
    return current is not None


def _results(document, report):
    participants = {p.get("id") for p in document.get("participants") or []}
    events = {e.get("id") for e in document.get("events") or []}
    measures = measures_by_id(document)
    attributes = {a.get("id") for a in document.get("attributeDefinitions") or []}
    rankings = {r.get("id") for r in document.get("rankings") or []}
    pairs = set()

    for index, result in enumerate(document.get("results") or []):
        at = f"/results/{index}"
        if "participant" not in result:
            report.error("OR-101", at)
            continue
        if result["participant"] not in participants:                                # §7.1.1
            report.error("OR-201", f"{at}/participant")
        if events and result.get("event") is None:                                   # §7.1.2
            report.error("OR-201", at)
        elif result.get("event") is not None and result["event"] not in events:
            report.error("OR-203", at)
        pair = (result["participant"], result.get("event"))
        if pair in pairs:                                                            # §7.1.3
            report.error("OR-203", at)
        pairs.add(pair)
        if "status" in result and result["status"] not in RESULT_STATUSES:           # §7.2.1
            report.error("OR-103", f"{at}/status")

        for key, value in (result.get("values") or {}).items():
            if key not in measures:                                                  # §7.3.1
                report.error("OR-205", f"{at}/values/{key}")
                continue
            if value is None:                                                        # §7.3.2
                report.error("OR-108", f"{at}/values/{key}")
                continue
            kind = measures[key].get("kind")
            if kind in KNOWN_KINDS and not _typed(kind, value):                      # §5.2.1
                report.error("OR-102", f"{at}/values/{key}")

        _attribute_values(result.get("attributes"), attributes, document, at, report)
        for a, asset in enumerate(result.get("assets") or []):                       # §9.3.5
            if asset.get("type") not in ASSET_TYPES:
                report.error("OR-103", f"{at}/assets/{a}/type")

        for key in (result.get("ranks") or {}):
            if not IDENTIFIER.match(str(key)):
                report.error("OR-104", f"{at}/ranks")
            elif key not in rankings:                                                # §7.5.4
                report.error("OR-201", f"{at}/ranks/{key}")


def _typed(kind, value):
    if kind == "text":
        return isinstance(value, str)
    if kind == "boolean":
        return isinstance(value, bool)
    return is_number(value)


def _attribute_values(values, declared, document, at, report):
    definitions = {a["id"]: a for a in document.get("attributeDefinitions") or [] if "id" in a}
    for key, value in (values or {}).items():
        if key not in declared:                                                      # §5.3.2
            report.error("OR-206", f"{at}/attributes/{key}")
            continue
        kind = definitions[key].get("type")
        if kind == "number" and not is_number(value):                                # §5.3.4
            report.error("OR-102", f"{at}/attributes/{key}")
        elif kind == "boolean" and not isinstance(value, bool):
            report.error("OR-102", f"{at}/attributes/{key}")
        elif kind == "date" and not (isinstance(value, str) and TIMESTAMP.match(value)):
            report.error("OR-102", f"{at}/attributes/{key}")
        elif kind == "country" and not (isinstance(value, str) and re.match(r"^[A-Z]{2}$", value)):
            report.error("OR-102", f"{at}/attributes/{key}")
        elif kind in ("text", "url") and not isinstance(value, str):
            report.error("OR-102", f"{at}/attributes/{key}")


def _entity_attributes(document, report):
    """Attribute values on every entity that carries them (§5.3.2, §5.3.4)."""
    declared = {a.get("id") for a in document.get("attributeDefinitions") or []}
    _attribute_values(document.get("attributes"), declared, document, "", report)
    for collection in ("participants", "events", "categories"):
        for index, holder in enumerate(document.get(collection) or []):
            _attribute_values(holder.get("attributes"), declared, document,
                              f"/{collection}/{index}", report)


def _rankings(document, report):
    measures = measures_by_id(document)
    events = {e.get("id") for e in document.get("events") or []}
    categories = {c.get("id") for c in document.get("categories") or []}
    seen = set()

    for index, ranking in enumerate(document.get("rankings") or []):
        at = f"/rankings/{index}"
        if "id" not in ranking or "label" not in ranking or "sortBy" not in ranking:  # §6.1.5
            report.error("OR-101", at)
            continue
        if ranking["id"] in seen:
            report.error("OR-202", f"{at}/id")
        seen.add(ranking["id"])
        if ranking.get("ties") is not None and ranking["ties"] not in TIE_RULES:      # §8.3.2
            report.error("OR-103", f"{at}/ties")

        resolved = ties_of(ranking) == "resolved"
        if not ranking["sortBy"] and not (resolved and ranking.get("ties") == "resolved"):
            report.error("OR-304", f"{at}/sortBy")                                   # §8.2.1

        for m, measure_id in enumerate(ranking["sortBy"]):
            if measure_id not in measures:                                           # §8.2.1
                report.error("OR-201", f"{at}/sortBy/{m}")
            elif direction_of(measures[measure_id]) == "none":                        # §8.2.2
                report.error("OR-301", f"{at}/sortBy/{m}")
            elif measures[measure_id].get("kind") in ("text", "boolean"):             # §8.2.2
                report.error("OR-305", f"{at}/sortBy/{m}")

        scope = ranking.get("scope") or {}
        for event in as_list(scope.get("event", [])) if "event" in scope else []:
            if event not in events:
                report.error("OR-201", f"{at}/scope/event")
        for category in as_list(scope.get("category", [])) if "category" in scope else []:
            if category not in categories:
                report.error("OR-201", f"{at}/scope/category")


def _published_positions(document, report):
    """A position in a ranking the result does not belong to (§7.5.3).

    Two ways it happens and both are a contradiction: the ranking's scope never
    selected the result, or the partition left it unranked — a competitor who
    retired carrying a position in a standing that excludes retirements.
    """
    for ranking in document.get("rankings") or []:
        if "id" not in ranking or "sortBy" not in ranking:
            continue
        placed = {id(result) for result, position in rank(document, ranking["id"])
                  if position is not None}
        for index, result in enumerate(document.get("results") or []):
            if (result.get("ranks") or {}).get(ranking["id"]) is None:
                continue
            if id(result) not in placed:
                report.error("OR-303", f"/results/{index}/ranks/{ranking['id']}")


def _categories(document, report):
    categories = document.get("categories") or []
    ids = {c.get("id") for c in categories}
    participants = {p.get("id") for p in document.get("participants") or []}
    for index, category in enumerate(categories):
        at = f"/categories/{index}"
        if "id" not in category or "label" not in category:                          # §9.1.1
            report.error("OR-101", at)
            continue
        parent = category.get("parent")
        if parent is not None:                                                       # §9.1.2
            if parent not in ids:
                report.error("OR-201", f"{at}/parent")
            elif _cycles(categories, category["id"]):
                report.error("OR-204", f"{at}/parent")
        for p, member in enumerate(category.get("participants") or []):
            if member not in participants:
                report.error("OR-201", f"{at}/participants/{p}")


def _resources(document, report):
    source = document.get("source")
    if source is not None and "name" not in source:                                  # §9.2.1
        report.error("OR-101", "/source")
    for collection, kinds in (("links", None), ("assets", ASSET_TYPES)):
        for index, entry in enumerate(document.get(collection) or []):
            at = f"/{collection}/{index}"
            if "href" not in entry:                                                  # §9.3.1
                report.error("OR-101", at)
                continue
            if not re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", str(entry["href"])):        # §9.3.2
                report.error("OR-102", f"{at}/href")
            if kinds is not None and entry.get("type") not in kinds:                  # §9.3.5
                report.error("OR-103", f"{at}/type")


def _quality(document, report):
    """The warnings. A document carrying them is conforming and questionable."""
    results = document.get("results") or []
    used_measures = {k for r in results for k in (r.get("values") or {})}
    used_attributes = {k for r in results for k in (r.get("attributes") or {})}
    for holder in (document.get("participants") or []) + (document.get("events") or []) + \
                  (document.get("categories") or []):
        used_attributes |= set(holder.get("attributes") or {})
    used_attributes |= set(document.get("attributes") or {})

    for index, measure in enumerate(document.get("measures") or []):
        if measure.get("id") not in used_measures:                                   # §5.1.7
            report.warn("OR-901", f"/measures/{index}")
        low, high = measure.get("min"), measure.get("max")
        if is_number(low) and is_number(high) and low > high:
            continue
        for r, result in enumerate(results):
            value = (result.get("values") or {}).get(measure.get("id"))
            if not is_number(value):
                continue
            if (is_number(low) and value < low) or (is_number(high) and value > high):
                report.warn("OR-909", f"/results/{r}/values/{measure['id']}")        # §5.1.8

    for index, attribute in enumerate(document.get("attributeDefinitions") or []):
        if attribute.get("id") not in used_attributes:                               # §5.3.6
            report.warn("OR-905", f"/attributeDefinitions/{index}")

    if document.get("lang") is None and _carries_prose(document):                    # §4.5.1
        report.warn("OR-903", "")

    licence = (document.get("source") or {}).get("license")
    if licence is not None and not SPDX.match(str(licence)):                         # §9.2.2
        report.warn("OR-912", "/source/license")

    _ranking_quality(document, report)
    _participant_quality(document, report)
    _event_quality(document, report)
    _announced_field(document, report)
    _category_quality(document, report)


def _carries_prose(document):
    if document.get("description"):
        return True
    return any(r.get("notes") for r in document.get("results") or [])


def _participant_quality(document, report):
    holds = {r.get("participant") for r in document.get("results") or []}
    in_team = {m for p in document.get("participants") or [] for m in (p.get("members") or [])}
    if not document.get("results"):
        return                                                                        # §6.1.7
    for index, participant in enumerate(document.get("participants") or []):
        if participant.get("id") not in holds and participant.get("id") not in in_team:
            report.warn("OR-910", f"/participants/{index}")


def _announced_field(document, report):
    """A result from someone the event did not announce (§6.2.4)."""
    fields = {e["id"]: set(e["participants"]) for e in document.get("events") or []
              if e.get("id") and e.get("participants")}
    for index, result in enumerate(document.get("results") or []):
        field = fields.get(result.get("event"))
        if field is not None and result.get("participant") not in field:
            report.warn("OR-904", f"/results/{index}")


def _category_quality(document, report):
    """A category none of whose participants holds a result (§9.1.1)."""
    holders = {r.get("participant") for r in document.get("results") or []}
    for index, category in enumerate(document.get("categories") or []):
        members = set(category.get("participants") or [])
        if not (members & holders):
            report.warn("OR-907", f"/categories/{index}")


def _event_quality(document, report):
    with_results = {r.get("event") for r in document.get("results") or []}
    for index, event in enumerate(document.get("events") or []):
        if event.get("id") in with_results:
            continue
        children = [e for e in document.get("events") or [] if e.get("parent") == event.get("id")]
        if children:                                                                  # §6.2.4
            report.warn("OR-906", f"/events/{index}")


def _ranking_quality(document, report):
    for index, ranking in enumerate(document.get("rankings") or []):
        at = f"/rankings/{index}"
        if "id" not in ranking or "sortBy" not in ranking:
            continue
        entries = rank(document, ranking["id"])
        excluded = set(ranking.get("excludeStatuses", DEFAULT_EXCLUDED))
        catalogue = measures_by_id(document)
        sorting = [m for m in ranking["sortBy"] if sortable(catalogue.get(m))]

        if not entries:                                                               # §8.1.4
            report.warn("OR-906", at)
            continue

        if ties_of(ranking) == "resolved" and not ranking["sortBy"]:                  # §8.3.5
            without = [e for e, _ in entries
                       if status_of(e) not in excluded
                       and (e.get("ranks") or {}).get(ranking["id"]) is None]
            if without:
                report.warn("OR-911", at)

        if ties_of(ranking) == "strict":                                              # §8.3.3
            positions = [p for _, p in entries if p is not None]
            if len(positions) != len(set(positions)):
                report.error("OR-302", f"{at}/ties")

        # A published rank that disagrees with the derived one (§3.3.2).
        for result, position in entries:
            published = (result.get("ranks") or {}).get(ranking["id"])
            if published is not None and position is not None and published != position:
                if ties_of(ranking) != "resolved":
                    report.warn("OR-902", f"/results/{document['results'].index(result)}"
                                          f"/ranks/{ranking['id']}")

        partial = [e for e, p in entries
                   if p is None and status_of(e) not in excluded
                   and 0 < sum(1 for m in sorting if (e.get("values") or {}).get(m) is not None)
                   < len(sorting)]
        if partial:                                                                   # §8.5.2
            report.warn("OR-908", at)

        # A standing gathering its own sub-events (§8.1.2).
        if (ranking.get("scope") or {}).get("event") is None:
            seen_events = {e.get("event") for e, _ in entries}
            none_carried = [e for e, p in entries
                            if p is None and not any((e.get("values") or {}).get(m) is not None
                                                     for m in sorting)]
            if len(seen_events) > 1 and none_carried:
                report.warn("OR-913", at)


def main():
    document = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    report = validate(document)
    print(json.dumps({"valid": report.valid, "errors": report.errors,
                      "warnings": report.warnings}, indent=1))
    return 0 if report.valid else 1


if __name__ == "__main__":
    sys.exit(main())
