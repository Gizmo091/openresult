# Examples

Nineteen documents. Eleven cover deliberately unlike domains — if one format serves a motocross
meeting, a CPU benchmark and a photo contest, the model is doing its job. Eight isolate an edge
case each.

Every file validates against [the schema](../schema/openresult-1.0.schema.json) on each change,
and **none of the eleven domain examples uses an extension**: a reference domain that needed one
would reveal a gap in the format. That is checked automatically too.

## Domains

| Example                                                                | What it shows                                                                                                                                                                                               |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`running/`](./running/crest-trail-21k.openresult.json)                | Scratch and category standings from a single result set. A tie on finish time. Categories partition participants without duplicating results.                                                               |
| [`motocross/`](./motocross/regional-round-3.openresult.json)           | Two races feeding an overall standing through `parent`. A real two-level tie-break: points, then points in the final race. Amended document (`status: "amended"`, `version: 2`) after a stewards' decision. |
| [`football/`](./football/matchday-14.openresult.json)                  | Head-to-head as an event holding **two** results, one per team. A league table as a separate overall event, ordered on points, then goal difference, then goals for.                                        |
| [`karting/`](./karting/sprint-cup-final.openresult.json)               | Qualifying and final as separate events. A time penalty already applied by the producer — the format carries the resulting figure, never the rule. `ties: "strict"`, where a dead heat would be an error.   |
| [`motorsport/`](./motorsport/coastal-endurance-4h.openresult.json)     | Endurance classification on laps first, then elapsed time. `outOfTime` as a status distinct from retiring. Class standings over the same results.                                                           |
| [`cpu-benchmark/`](./cpu-benchmark/render-suite-2026.openresult.json)  | Participants of type `machine`. Two competing rankings over one result set — speed and efficiency — which is what derived ranking makes free.                                                               |
| [`ai-benchmark/`](./ai-benchmark/reasoning-eval-2026.openresult.json)  | Participants of type `model`. A suite not run is an **absent** measure, not a zero. Four rankings, including one restricted to open-weights models.                                                         |
| [`sales-ranking/`](./sales-ranking/q1-partner-league.openresult.json)  | Monetary measures, participants of type `organization`. An exact tie on revenue broken by retention. A partner still mid-period carries `inProgress`.                                                       |
| [`esport/`](./esport/spring-split-playoffs.openresult.json)            | Teams as participants **composed of participants** via `members`. Group stage plus bracket. A withdrawal mid-competition.                                                                                   |
| [`hackathon/`](./hackathon/civic-data-jam.openresult.json)             | Multi-criteria jury scoring with a weighted total. The weighting is described for the reader and never encoded — the format carries figures, not formulas.                                                  |
| [`photo-contest/`](./photo-contest/wildlife-open-2026.openresult.json) | Public vote plus jury score. Two entries share second place. Images attached as `assets`, which never affect interpretation.                                                                                |

## Edge cases

| Example                                                                                                                                               | What it isolates                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [`ties-standard`](./edge-cases/ties-standard.openresult.json)                                                                                         | Shared rank consumes the next: 1, 2, 2, 4.                                                                                                   |
| [`ties-dense`](./edge-cases/ties-dense.openresult.json)                                                                                               | Identical data, `ties: "dense"`: 1, 2, 2, 3. Same results, different ranks — which is why the rule belongs in the document.                  |
| [`no-ranking-declared`](./edge-cases/no-ranking-declared.openresult.json)                                                                             | No `rankings` and no `rank`. A consumer must still order it, using the implicit ranking.                                                     |
| [`missing-values-and-statuses`](./edge-cases/missing-values-and-statuses.openresult.json)                                                             | Zero versus absent. All non-rankable statuses at once, each appearing without a rank rather than being dropped.                              |
| [`extensions-and-unknown-values`](./edge-cases/extensions-and-unknown-values.openresult.json)                                                         | `x-` extensions at every level, plus enumeration values a 1.0 consumer does not know. All ignored without error, none affecting the ranking. |
| [`lifecycle-provisional`](./edge-cases/lifecycle-provisional.openresult.json) → [`lifecycle-amended`](./edge-cases/lifecycle-amended.openresult.json) | Same `id`, `version` 1 then 2. The second supersedes the first after a protest is upheld. Both stay valid.                                   |
| [`announced-no-results`](./edge-cases/announced-no-results.openresult.json)                                                                           | An empty `results` array. Entry list and rules published ahead of the event.                                                                 |

## Conventions

- File extension `.openresult.json`.
- Names, teams and organisations are invented. Figures are plausible for their domain but do not
  describe real events.
- Every document is in English, with `lang` declared.

## Validating them

```bash
pnpm check examples     # schema conformance, plus the no-extension rule for domain examples
```
