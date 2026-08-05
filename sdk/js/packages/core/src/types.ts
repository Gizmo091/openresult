/**
 * The OpenResult 1.0 document model.
 *
 * These types mirror `specification/openresult-v1.md`, which is normative. The
 * unions below list the values the specification defines; a document may carry
 * others, and the runtime folds them onto the documented fallback rather than
 * rejecting them (spec §11.3.1). Types describe what is known, not what is
 * permitted.
 */

export type MeasureKind =
  | 'duration'
  | 'distance'
  | 'points'
  | 'score'
  | 'percentage'
  | 'count'
  | 'money'
  | 'rate'
  | 'text'
  | 'boolean';

export type BetterWhen = 'lower' | 'higher' | 'none';

export type AttributeType = 'text' | 'number' | 'date' | 'url' | 'country' | 'boolean';

export type ParticipantType =
  'person' | 'team' | 'machine' | 'product' | 'model' | 'organization' | 'other';

export type EventType =
  'heat' | 'match' | 'round' | 'stage' | 'session' | 'final' | 'overall' | 'other';

/** Participation status. Only `finished` is rankable (spec §7.2.1). */
export type ResultStatus =
  'finished' | 'inProgress' | 'dnf' | 'dns' | 'dsq' | 'outOfTime' | 'withdrawn';

export type TieHandling = 'standard' | 'dense' | 'strict';

export type DocumentStatus = 'draft' | 'provisional' | 'official' | 'amended';

/** A measured value. `null` is not permitted: omit an unavailable measure (spec §7.3.2). */
export type MeasureValue = number | string | boolean;

export type AttributeValue = string | number | boolean;

/** Extensions are `x-` prefixed and carried through untouched (spec §10.2). */
export interface Extensible {
  [extension: `x-${string}`]: unknown;
}

export interface TimeRange extends Extensible {
  start?: string;
  end?: string;
}

export interface Measure extends Extensible {
  id: string;
  label: string;
  kind: MeasureKind;
  unit?: string;
  precision?: number;
  betterWhen: BetterWhen;
  description?: string;
}

export interface AttributeDefinition extends Extensible {
  id: string;
  label: string;
  type: AttributeType;
  description?: string;
}

export interface Link extends Extensible {
  rel?: string;
  href: string;
  label?: string;
}

export interface Asset extends Extensible {
  type?: 'image' | 'video' | 'audio' | 'document' | 'other';
  href: string;
  label?: string;
}

export interface Participant extends Extensible {
  id: string;
  name: string;
  shortName?: string;
  type?: ParticipantType;
  members?: string[];
  attributes?: Record<string, AttributeValue>;
  links?: Link[];
  assets?: Asset[];
}

export interface ResultEvent extends Extensible {
  id: string;
  name: string;
  type?: EventType;
  parent?: string;
  occurredAt?: TimeRange;
  participants?: string[];
  attributes?: Record<string, AttributeValue>;
  links?: Link[];
  assets?: Asset[];
}

export interface Result extends Extensible {
  participant: string;
  event?: string;
  status?: ResultStatus;
  /** Optional and informative: the ranking is derived (spec §3.3). */
  rank?: number;
  values?: Record<string, MeasureValue>;
  attributes?: Record<string, AttributeValue>;
  notes?: string;
  links?: Link[];
  assets?: Asset[];
}

export interface RankingScope extends Extensible {
  event?: string;
  category?: string;
}

export interface Ranking extends Extensible {
  id: string;
  label: string;
  scope?: RankingScope;
  /** Measure ids by decreasing priority. Direction comes from the measure (spec §8.2.3). */
  sortBy: string[];
  ties?: TieHandling;
  excludeStatuses?: ResultStatus[];
}

export interface Category extends Extensible {
  id: string;
  label: string;
  participants?: string[];
  parent?: string;
}

export interface Source extends Extensible {
  name: string;
  system?: string;
  url?: string;
  license?: string;
  contact?: string;
}

/** Display hints. Non-normative: a consumer may ignore this entirely (spec §10.1). */
export interface Presentation extends Extensible {
  defaultView?: string;
  measureOrder?: string[];
  attributeOrder?: string[];
  highlight?: string[];
}

export interface ResultDocument extends Extensible {
  openresult: string;
  id?: string;
  version?: number;
  status?: DocumentStatus;
  title: string;
  description?: string;
  lang?: string;
  generatedAt?: string;
  occurredAt?: TimeRange;
  source?: Source;
  measures?: Measure[];
  attributes?: AttributeDefinition[];
  participants: Participant[];
  events?: ResultEvent[];
  results: Result[];
  rankings?: Ranking[];
  categories?: Category[];
  links?: Link[];
  assets?: Asset[];
  presentation?: Presentation;
}

/** One entry of a derived ranking. `rank` is null for unranked results (spec §8.5.5). */
export interface RankedEntry {
  rank: number | null;
  participant: Participant;
  result: Result;
  values: Record<string, MeasureValue>;
  /** Participant ids sharing this rank. Empty when the entry stands alone. */
  tiedWith: string[];
}

export interface RankingSummary {
  id: string;
  label: string;
  /** True when the ranking is not declared in the document but implied (spec §8.6). */
  implicit: boolean;
  sortBy: string[];
  ties: TieHandling;
}
