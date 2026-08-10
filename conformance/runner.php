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
const KNOWN_KINDS = ['duration', 'distance', 'mass', 'points', 'score', 'percentage',
                     'count', 'money', 'rate', 'text', 'boolean'];

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

/** Whether a measure may decide an order (§8.2.2). */
function sortable(?array $measure): bool {
    if ($measure === null || directionOf($measure) === 'none') return false;
    return !in_array($measure['kind'] ?? null, ['text', 'boolean'], true);
}

/** The sortBy entries that may actually decide an order — dropped before the
 *  partition, not merely skipped while comparing (§8.2.2, §8.5.2). */
function sortingMeasures(array $document, array $ranking): array {
    return array_values(array_filter(
        $ranking['sortBy'],
        fn($id) => sortable(measureById($document, $id)),
    ));
}

/** With no ranking declared, the first measure §8.2.2 permits in one (§8.6.1). */
function implicitRanking(array $document): ?array {
    foreach ($document['measures'] ?? [] as $measure) {
        if (sortable($measure)) {
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
    // A kind this version does not know needs a number (§8.5.2): accepting any
    // type admits values §8.5.3 has no rule for ordering.
    if (!in_array($kind, KNOWN_KINDS, true)) {
        return (is_int($value) || is_float($value)) && !is_bool($value);
    }
    if ($kind === 'text') return is_string($value);
    if ($kind === 'boolean') return is_bool($value);
    // Everything else is a number (§5.2.1). `is_numeric` would accept "12", and
    // a string is not a number here however it reads.
    return (is_int($value) || is_float($value)) && !is_bool($value);
}

/** The comparison key. Direction comes from the measure, never the ranking (§8.2.3). */
function sortKey(array $document, array $ranking, array $result): array {
    $parts = [];
    foreach (sortingMeasures($document, $ranking) as $measureId) {
        $direction = directionOf(measureById($document, $measureId));
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
        // Anything that is not a positive integer is no published position (§7.5.1).
        $position = $result['ranks'][$rankingId] ?? null;
        if (!is_int($position) || $position < 1) return null;
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
        foreach (sortingMeasures($document, $ranking) as $measureId) {
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
// Display — spec §5.1.5 and §5.2.5. The figure a consumer prints, and only the
// figure: no unit, no scale, a `.` for the decimal separator wherever it runs.
//
// PHP is the one of the three languages here where the obvious call is already
// right. `number_format` rounds half away from zero, and PHP's pre-rounding
// gives 2.675 → 2.68 rather than the 2.67 the stored double would justify —
// which is §5.1.5's hardest sentence, and the one JavaScript's `toFixed` and
// Rust's `{:.2}` both get wrong by default.
// ---------------------------------------------------------------------------

const TIME_UNITS = ['s' => 1, 'ms' => 0.001, 'min' => 60, 'h' => 3600];

function formatDuration(float $seconds, int $precision): string {
    $negative = $seconds < 0;
    $seconds = abs($seconds);
    $hours = (int) floor($seconds / 3600);
    $minutes = (int) floor(fmod($seconds, 3600) / 60);
    $body = number_format(fmod($seconds, 60), $precision, '.', '');

    $width = $precision > 0 ? $precision + 3 : 2;
    if ($hours >= 1) {
        $text = sprintf('%d:%02d:%s', $hours, $minutes, str_pad($body, $width, '0', STR_PAD_LEFT));
    } elseif ($minutes >= 1) {
        $text = sprintf('%d:%s', $minutes, str_pad($body, $width, '0', STR_PAD_LEFT));
    } else {
        $text = $body;
    }
    return $negative ? "-$text" : $text;
}

function formatNumber(int|float $value, array $measure): string {
    $unit = $measure['unit'] ?? null;
    $precision = $measure['precision'] ?? null;
    if (($measure['kind'] ?? null) === 'duration' && isset(TIME_UNITS[$unit])) {
        return formatDuration($value * TIME_UNITS[$unit], $precision ?? 0);
    }
    // No declared precision says nothing about decimals, so the number is shown
    // as written — and PHP prints a whole float as "12", which is what a JSON
    // consumer with one number type shows.
    return $precision === null ? (string) $value : number_format($value, $precision, '.', '');
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

    foreach ($expected['display'] ?? [] as $wanted) {
        $measure = measureById($document, $wanted['measure']);
        $value = $document['results'][$wanted['result']]['values'][$wanted['measure']] ?? null;
        $comparisons++;
        if ($measure === null || !is_int($value) && !is_float($value)) {
            $failures[] = "display: /results/{$wanted['result']} carries no number for "
                        . "\"{$wanted['measure']}\"";
            continue;
        }
        $got = formatNumber($value, $measure);
        if ($got !== $wanted['rendered']) {
            $failures[] = sprintf('display: %s as "%s" renders "%s", expected "%s"',
                                  $value, $wanted['measure'], $got, $wanted['rendered']);
        }
    }
    foreach ($expected['rankings'] as $rankingId => $wanted) {
        // `result` is carried only where the participant alone does not identify
        // the row (§8.5.7), so it is compared only where the case states it.
        $identifies = (bool) array_filter($wanted, fn($row) => array_key_exists('result', $row));
        $derived = array_map(
            fn($entry) => $identifies
                ? ['participant' => $entry[0]['participant'], 'rank' => $entry[1],
                   'result' => array_search($entry[0], $document['results'], true)]
                : ['participant' => $entry[0]['participant'], 'rank' => $entry[1]],
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
