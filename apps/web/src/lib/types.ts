/**
 * Domain models shared by every page and by the data services.
 * These mirror the backend contract in /schemas (atom, graph, plan, report, event).
 * When the backend lands, generate these from the JSON Schemas instead of editing by hand.
 */

export type StackStatus = "analyzing" | "verified" | "review" | "published";
export type LayerStatus = "pass" | "fail";
export type CheckState = "pass" | "attention";
export type Visibility = "public" | "private";

export interface Session {
  name: string;
  email: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  githubLogin: string | null;
  initials: string;
}

export interface RepoConfig {
  workingDirectory: string;
  setupCommand: string;
  checkCommand: string;
  maxLayerLines: number;
  bobcoinCap: number;
}

export interface Repository {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  /** GitHub URL. Null while GitHub isn't connected (sample workspace). */
  url: string | null;
  language: string;
  framework: string;
  defaultBranch: string;
  connection: "connected" | "sample";
  lastSyncedAt: string;
  config: RepoConfig;
}

export interface RepositorySummary extends Repository {
  openPullRequests: number;
  stackCount: number;
  lastStackAt: string | null;
}

export interface PullRequest {
  repoId: string;
  number: number;
  title: string;
  author: string;
  branch: string;
  base: string;
  additions: number;
  deletions: number;
  filesChanged: number;
  /** Top-level areas of the codebase this change touches (models, services, api…). */
  areas: string[];
  openedAt: string;
  /** Stack produced for this PR, if Cleave has analyzed it. */
  stackId: string | null;
  /** True when the PR is small enough to review in one pass (below maxLayerLines). */
  belowThreshold: boolean;
  /** False when the sample workspace has no analysis for this PR. */
  analyzable: boolean;
}

export type AtomKind = "hunk" | "new-file" | "deleted-file";

export interface Atom {
  /** Content hash of the hunk, as produced by `cleave atomize`. */
  id: string;
  layerIndex: number;
  file: string;
  summary: string;
  kind: AtomKind;
  additions: number;
  deletions: number;
  isTest: boolean;
  /** Verbatim patch text. May be an excerpt when `patchTruncated` is true. */
  patch: string | null;
  patchTruncated: boolean;
}

export type DependencyKind = "import" | "call" | "model" | "fixture" | "runtime";

export interface Dependency {
  id: string;
  /** The atom that needs the other one. */
  fromAtomId: string;
  /** The atom it needs. Must sit in the same or an earlier layer. */
  toAtomId: string;
  symbol: string;
  kind: DependencyKind;
  /** True when static analysis missed it and verification found it. */
  discoveredByVerification: boolean;
}

export interface Layer {
  index: number;
  name: string;
  rationale: string;
  status: LayerStatus;
  atomIds: string[];
  additions: number;
  deletions: number;
  files: string[];
  testFiles: number;
  /** Dependencies whose `fromAtom` lives in this layer. */
  dependencyCount: number;
  branch: string;
  testsPassed: number;
  testsFailed: number;
  durationMs: number;
  /** Set when this layer went green only after a repair. */
  repairedInRound: number | null;
  prNumber: number | null;
}

export type CheckId = "coverage" | "order" | "fidelity" | "shippability" | "partition";

export interface VerificationCheck {
  id: CheckId;
  label: string;
  description: string;
  state: CheckState;
  /** Short value shown on the right, e.g. "37 / 37". */
  value: string;
  /** One line of evidence, e.g. the two tree hashes. */
  evidence: string;
}

export interface LayerRoundResult {
  layerIndex: number;
  status: LayerStatus;
  testsPassed: number;
  testsFailed: number;
  durationMs: number;
  failure: { test: string; message: string } | null;
}

export interface VerificationRound {
  round: number;
  planVersion: number;
  results: LayerRoundResult[];
}

export interface Repair {
  round: number;
  atomId: string;
  fromLayer: number;
  toLayer: number;
  reason: string;
}

export interface ReviewResolution {
  id: "merge";
  label: string;
  description: string;
}

export interface VerificationIssue {
  title: string;
  summary: string;
  layerIndex: number;
  test: string;
  expected: string;
  found: string;
  log: string;
  attempts: number;
  explanation: string;
  resolution: ReviewResolution;
}

export interface VerificationResult {
  state: "verified" | "review";
  command: string;
  headTree: string;
  topTree: string;
  foreignLines: number;
  checks: VerificationCheck[];
  rounds: VerificationRound[];
  repairs: Repair[];
  issue: VerificationIssue | null;
}

export interface BobRunStats {
  surface: "Bob IDE" | "bob run";
  mode: string;
  bobcoins: number;
  tokens: number;
  toolCalls: number;
  mcpCalls: number;
  subagents: number;
  durationSec: number;
  hookAllowed: number;
  hookBlocked: number;
}

export type ActivitySource = "engine" | "bob" | "hook" | "github" | "you";
export type ActivityTone = "neutral" | "ok" | "attention" | "accent";

export interface ActivityField {
  label: string;
  value: string;
}

export interface ActivityEvent {
  id: string;
  stackId: string;
  title: string;
  detail: string;
  at: string;
  source: ActivitySource;
  tone: ActivityTone;
  /** Tool or command behind the event, e.g. `cleave_move_atoms`. */
  tool: string | null;
  fields: ActivityField[];
  code: string | null;
}

export interface AnalysisStage {
  id: string;
  label: string;
  detail: string;
  startMs: number;
  endMs: number;
}

export interface AnalysisState {
  startedAt: string;
  durationMs: number;
  stages: AnalysisStage[];
}

export interface Stack {
  id: string;
  repoId: string;
  repoName: string;
  repoFullName: string;
  repoUrl: string | null;
  prNumber: number;
  title: string;
  branch: string;
  base: string;
  status: StackStatus;
  visibility: Visibility;
  additions: number;
  deletions: number;
  filesChanged: number;
  layers: Layer[];
  atoms: Atom[];
  dependencies: Dependency[];
  verification: VerificationResult;
  bob: BobRunStats;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  analysis: AnalysisState | null;
}

export interface StackSummary {
  id: string;
  repoId: string;
  repoName: string;
  prNumber: number;
  title: string;
  status: StackStatus;
  layerCount: number;
  atomCount: number;
  dependencyCount: number;
  additions: number;
  deletions: number;
  updatedAt: string;
}

export interface SearchItem {
  id: string;
  group: "Stacks" | "Repositories" | "Go to";
  label: string;
  hint: string;
  href: string;
}

export type ThemePreference = "light" | "dark" | "system";
