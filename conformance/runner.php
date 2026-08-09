#!/usr/bin/env php
<?php
/**
 * Run the conformance suite from a third language.
 *
 * The Python runner showed the suite reads from a second language. This is the
 * question that one could not answer: whether it reads from a language nobody
 * involved was thinking about. PHP is also where results are actually
 * published — federations, timing companies, club sites — so it is the language
 * a first outside implementer is most likely to arrive in.
 *
 *     php conformance/runner.php
 *     php conformance/runner.php --verbose
 *
 * The reader below implements the *ranking* level (spec §11.5.3): it reads a
 * document, folds unknown enumeration values onto their documented fallbacks,
 * and derives standings exactly as §8.5 prescribes. It is not a validator, so
 * it judges the cases that state a ranking and says so about the rest, rather
 * than reporting a pass it did not earn.
 */
declare(strict_types=1);

// ---------------------------------------------------------------------------
// Unknown enumeration values fold onto their documented fallback (§11.3.1).
// This is what lets a 1.0 reader survive a 1.1 document.
// ---------------------------------------------------------------------------

const DEFAULT_EXCLUDED = ['notClassified', 'inProgress', 'dnf', 'dns', 'dsq', 'outOfTime', 'withdrawn'];
const KNOWN_STATUSES = [...DEFAULT_EXCLUDED, 'finished', 'bye'];

function statusOf(array $result): string {
    $status = $result['status'] ?? 'finished';
    return in_array($status, KNOWN_STATUSES, true) ? $status : 'finished';
}

function directionOf(?array $measure): string {
    $direction = $measure['betterWhen'] ?? 'none';
    return in_array($direction, ['lower', 'higher', 'none'], true) ? $direction : 'none';
}

function tiesOf(array $ranking): string {
    $ties = $ranking['ties'] ?? 'standard';
    return in_array($ties, ['standard', 'dense', 'strict', 'resolved'], true) ? $ties : 'standard';
}

function measureById(array $document, string $id): ?array {
    foreach ($document['measures'] ?? [] as $measure) {
        if ($measure['id'] === $id) return $measure;
    }
    return null;
}

/** One identifier or several — §8.1.1 and §8.1.2 both accept either. */
function asList(mixed $value): array {
    return is_array($value) ? $value : [$value];
}

// ---------------------------------------------------------------------------
// Derivation — spec §8.5, step by step.
// ---------------------------------------------------------------------------

/** With no ranking declared, the first measure that has a direction (§8.6.1). */
function implicitRanking(array $document): ?array {
    foreach ($document['measures'] ?? [] as $measure) {
        if (directionOf($measure) !== 'none') {
            return ['id' => $measure['id'], 'label' => $measure['label'],
                    'sortBy' => [$measure['id']], 'ties' => 'standard'];
        }
    }
    return null;
}

function resolveRanking(array $document, ?string $rankingId): ?array {
    $declared = $document['rankings'] ?? [];
    if ($rankingId !== null) {
        foreach ($declared as $ranking) {
            if ($ranking['id'] === $rankingId) return $ranking;
        }
        $implicit = $declared === [] ? implicitRanking($document) : null;
        return ($implicit !== null && $implicit['id'] === $rankingId) ? $implicit : null;
    }
    return $declared[0] ?? implicitRanking($document);
}

/** Step 1 — selection (§8.5.1). The scoped events only, never their descendants. */
function inScope(array $document, array $ranking, array $result): bool {
    $scope = $ranking['scope'] ?? null;
    if ($scope === null) return true;

    if (array_key_exists('event', $scope)) {
        if (!in_array($result['event'] ?? null, asList($scope['event']), true)) return false;
    }

    if (array_key_exists('category', $scope)) {
        $wanted = asList($scope['category']);
        $members = [];
        foreach ($document['categories'] ?? [] as $category) {
            if (!in_array($category['id'], $wanted, true)) continue;
            foreach ($category['participants'] ?? [] as $participant) $members[] = $participant;
        }
        if (!in_array($result['participant'], $members, true)) return false;
    }

    return true;
}

/**
 * Whether a result carries a value this measure can be ordered by (§8.5.2).
 *
 * The type is checked against the measure's declared kind, never against the
 * other value being compared: deciding pairwise is not transitive, and the same
 * results in a different order would land in different tie groups.
 */
function carriesUsableValue(array $document, array $result, string $measureId): bool {
    $value = $result['values'][$measureId] ?? null;
    if ($value === null) return false;
    $kind = measureById($document, $measureId)['kind'] ?? null;
    if ($kind === 'text') return is_string($value);
    if ($kind === 'boolean') return is_bool($value);
    // Everything else is a number (§5.2.1). `is_numeric` would accept "12", and
    // a string is not a number here however it reads.
    return (is_int($value) || is_float($value)) && !is_bool($value);
}

/** The comparison key. Direction comes from the measure, never the ranking (§8.2.3). */
function sortKey(array $document, array $ranking, array $result): array {
    $parts = [];
    foreach ($ranking['sortBy'] as $measureId) {
        $measure = measureById($document, $measureId);
        $direction = directionOf($measure);
        if ($direction === 'none') continue;
        $value = $result['values'][$measureId] ?? null;
        $parts[] = $direction === 'higher' ? -$value : $value;
    }
    return $parts;
}

function compareKeys(array $a, array $b): int {
    foreach ($a as $i => $left) {
        $right = $b[$i] ?? null;
        if ($left != $right) return $left < $right ? -1 : 1;
    }
    return 0;
}

/**
 * Order a tied group by the positions the producer published (§8.3.4).
 *
 * All of the group or none of it: a rule that separated one pair and left
 * another tied would not be transitive, and the standings would then depend on
 * the sorting algorithm — the divergence §8.5.6 forbids.
 */
function settleByPublishedRanks(array $group, string $rankingId): ?array {
    if (count($group) < 2) return null;
    $positions = [];
    foreach ($group as $result) {
        $position = $result['ranks'][$rankingId] ?? null;
        if ($position === null) return null;
        $positions[] = $position;
    }
    if (count(array_unique($positions)) !== count($positions)) return null;
    usort($group, fn($a, $b) => $a['ranks'][$rankingId] <=> $b['ranks'][$rankingId]);
    return $group;
}

/** Derive the standings (§8.5). Returns [result, rank]; rank is null for the unranked. */
function rank(array $document, ?string $rankingId = null): array {
    $ranking = resolveRanking($document, $rankingId);
    if ($ranking === null) {
        return array_map(fn($r) => [$r, null], $document['results'] ?? []);
    }

    $excluded = $ranking['excludeStatuses'] ?? DEFAULT_EXCLUDED;
    $selected = array_values(array_filter(
        $document['results'] ?? [],
        fn($r) => inScope($document, $ranking, $r),
    ));

    // Step 2 — partition (§8.5.2).
    $rankable = [];
    $unranked = [];
    foreach ($selected as $result) {
        $hasValues = true;
        foreach ($ranking['sortBy'] as $measureId) {
            if (!carriesUsableValue($document, $result, $measureId)) { $hasValues = false; break; }
        }
        if (!in_array(statusOf($result), $excluded, true) && $hasValues) $rankable[] = $result;
        else $unranked[] = $result;
    }

    // Step 3 — sort (§8.5.3). PHP's sort has been stable since 8.0, which is
    // what preserves declaration order among results comparing equal. On an
    // older runtime this step would silently reorder ties.
    $ordered = $rankable;
    usort($ordered, fn($a, $b) => compareKeys(
        sortKey($document, $ranking, $a),
        sortKey($document, $ranking, $b),
    ));

    // Step 4 — assign (§8.5.4).
    $ties = tiesOf($ranking);
    $placed = [];
    $groupNumber = 0;
    $index = 0;
    while ($index < count($ordered)) {
        $groupNumber++;
        $end = $index + 1;
        $key = sortKey($document, $ranking, $ordered[$index]);
        while ($end < count($ordered)
            && compareKeys(sortKey($document, $ranking, $ordered[$end]), $key) === 0) {
            $end++;
        }

        $group = array_slice($ordered, $index, $end - $index);
        $settled = $ties === 'resolved' ? settleByPublishedRanks($group, $ranking['id']) : null;
        if ($settled !== null) {
            foreach ($settled as $offset => $result) $placed[] = [$result, $index + $offset + 1];
            $groupNumber += count($settled) - 1;
            $index = $end;
            continue;
        }

        $assigned = $ties === 'dense' ? $groupNumber : $index + 1;
        foreach ($group as $result) $placed[] = [$result, $assigned];
        $index = $end;
    }

    // Step 5 — the unranked follow, in declaration order (§8.5.5).
    foreach ($unranked as $result) $placed[] = [$result, null];
    return $placed;
}

// ---------------------------------------------------------------------------
// The runner.
// ---------------------------------------------------------------------------

$suite = __DIR__;
$verbose = in_array('--verbose', $argv, true);
$manifest = json_decode(file_get_contents("$suite/manifest.json"), true, 512, JSON_THROW_ON_ERROR);

$passed = $failed = $skipped = $comparisons = 0;
$skips = [];

foreach ($manifest['cases'] as $case) {
    if (($case['deprecated'] ?? null) !== null) {
        $skipped++; $skips[] = "{$case['id']}: deprecated"; continue;
    }
    if ($case['level'] === 'rewriting') {
        $skipped++; $skips[] = "{$case['id']}: level \"rewriting\" not claimed"; continue;
    }

    $directory = "$suite/{$case['path']}";
    $expected = json_decode(file_get_contents("$directory/expected.json"), true, 512, JSON_THROW_ON_ERROR);
    if (!isset($expected['rankings'])) {
        $skipped++;
        $skips[] = "{$case['id']}: states no ranking; this implementation does not validate";
        continue;
    }

    $document = json_decode(file_get_contents("$directory/document.json"), true, 512, JSON_THROW_ON_ERROR);
    $failures = [];
    foreach ($expected['rankings'] as $rankingId => $wanted) {
        $derived = array_map(
            fn($entry) => ['participant' => $entry[0]['participant'], 'rank' => $entry[1]],
            rank($document, (string) $rankingId),
        );
        $comparisons++;
        if (json_encode($derived) !== json_encode($wanted)) {
            $failures[] = sprintf(
                'ranking "%s": expected %s, got %s',
                $rankingId, json_encode($wanted), json_encode($derived),
            );
        }
    }

    if ($failures === []) { $passed++; continue; }
    $failed++;
    echo "  ✗ {$case['id']}  {$case['rule']}\n";
    foreach ($failures as $failure) echo "      $failure\n";
}

if ($verbose) foreach ($skips as $skip) echo "  – $skip\n";

printf(
    "\n%d/%d cases passed, %d rankings compared, %d skipped%s\n",
    $passed, $passed + $failed, $comparisons, $skipped, $failed > 0 ? ", $failed FAILED" : '',
);
exit($failed > 0 ? 1 : 0);
