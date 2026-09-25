import type { AtomKind, BobRunStats, DependencyKind, Visibility } from "@/lib/types";

/**
 * Compact authoring format for the sample workspace.
 * `build.ts` expands a StackSpec into the full `Stack` model the UI reads,
 * deriving ids, totals, layer statistics, checks and the activity timeline,
 * so every page shows the same numbers.
 */

export interface AtomSpec {
  key: string;
  file: string;
  summary: string;
  add: number;
  del?: number;
  kind?: AtomKind;
  patch?: string;
  /** True when `patch` is an excerpt of a longer hunk. */
  excerpt?: boolean;
}

export interface LayerSpec {
  name: string;
  rationale: string;
  atoms: AtomSpec[];
  /** Tests passing at this prefix in the final round. */
  tests: number;
  durationMs: number;
}

export interface DependencySpec {
  from: string;
  to: string;
  symbol: string;
  kind: DependencyKind;
  discovered?: boolean;
}

export interface RoundFailureSpec {
  layer: number;
  test: string;
  message: string;
  failed: number;
}

export interface RoundSpec {
  /** Layer count in the plan this round verified. */
  layers: number;
  failures?: RoundFailureSpec[];
}

export interface RepairSpec {
  afterRound: number;
  atom: string;
  from: number;
  to: number;
  reason: string;
}

export interface IssueSpec {
  title: string;
  summary: string;
  layer: number;
  test: string;
  expected: string;
  found: string;
  log: string;
  explanation: string;
  /** Layers to merge when the reviewer accepts the resolution. */
  merge: { into: number; from: number; name: string; rationale: string };
}

export interface StackSpec {
  id: string;
  repoId: string;
  prNumber: number;
  title: string;
  branch: string;
  base: string;
  status: "verified" | "review" | "published";
  visibility: Visibility;
  command: string;
  headTree: string;
  /** Minutes before "now" the original run started. Ignored for stacks created on demand. */
  runStartedMinutesAgo: number;
  publishedMinutesAgo?: number;
  /** First PR number GitHub would assign when this stack is published. */
  prStart: number;
  /** Final plan, after any repairs. */
  layers: LayerSpec[];
  dependencies: DependencySpec[];
  rounds: RoundSpec[];
  repairs: RepairSpec[];
  issue?: IssueSpec;
  bob: BobRunStats;
  /** Only present for pull requests that exist in the workspace but have not been analyzed yet. */
  onDemand?: boolean;
}
