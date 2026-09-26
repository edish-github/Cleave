import type {
  ActivityEvent,
  AvailableRepository,
  CiState,
  Layer,
  PullRequest,
  Repository,
  RepositorySummary,
  RunJob,
  RunJobSummary,
  RunnerInfo,
  SearchItem,
  Session,
  Stack,
  StackSummary,
  User,
  Visibility,
} from "@/lib/types";

/**
 * The contract every data source implements.
 *
 * Pages and server actions only ever talk to `api` (see ./index.ts), which is an
 * implementation of this interface. Today that is the sample workspace
 * (./sample). The backend client will implement the same interface, so swapping
 * sources never touches UI code.
 */
export interface CleaveClient {
  /** Identifies the data source so the UI can label the sample workspace honestly. */
  readonly source: "sample" | "api";

  session: {
    get(): Promise<Session | null>;
    signIn(input: { email: string; password: string }): Promise<Session>;
    signInWithGitHub(): Promise<Session>;
    signUp(input: { name: string; email: string; password: string }): Promise<Session>;
    signOut(): Promise<void>;
  };

  user: {
    get(): Promise<User>;
    updateProfile(input: { name: string }): Promise<User>;
  };

  repositories: {
    list(): Promise<RepositorySummary[]>;
    get(repoId: string): Promise<Repository | null>;
    pullRequests(repoId: string): Promise<PullRequest[]>;
    /** Top-level areas a pull request touches. */
    pullRequestAreas(repoId: string, prNumber: number): Promise<string[]>;
    /** GitHub repositories the user could connect. Empty when GitHub isn't linked. */
    available(): Promise<AvailableRepository[]>;
    connect(fullName: string): Promise<{ repoId: string }>;
  };

  stacks: {
    list(): Promise<StackSummary[]>;
    get(stackId: string): Promise<Stack | null>;
    /** Public proof data. Returns null unless the stack is public. */
    getPublic(stackId: string): Promise<Stack | null>;
    layer(stackId: string, layerIndex: number): Promise<{ stack: Stack; layer: Layer } | null>;
    forRepository(repoId: string): Promise<StackSummary[]>;
    /** Starts an analysis run for a pull request and returns the stack it belongs to. */
    start(input: { repoId: string; prNumber: number }): Promise<{ stackId: string }>;
    publish(stackId: string): Promise<{ stackId: string }>;
    resolveReview(stackId: string, resolutionId: "merge"): Promise<{ stackId: string }>;
    setVisibility(stackId: string, visibility: Visibility): Promise<void>;
    /** CI state of each published layer's pull request, keyed by layer index. */
    ciStatus(stackId: string): Promise<Record<number, CiState>>;
  };

  /** Splits started from the browser and executed by the user's runner (`cleave runner`). */
  runs: {
    /** Queue a split of an open pull request. Returns the run id the runner will use. */
    start(input: { repoId: string; prNumber: number }): Promise<{ runId: string }>;
    get(runId: string): Promise<RunJob | null>;
    recent(limit: number): Promise<RunJobSummary[]>;
    cancel(runId: string): Promise<void>;
    /** The user's runner tokens, with whether each was seen in the last two minutes. */
    runners(): Promise<RunnerInfo[]>;
  };

  activity: {
    forStack(stackId: string): Promise<ActivityEvent[]>;
    recent(limit: number): Promise<ActivityEvent[]>;
  };

  search: {
    index(): Promise<SearchItem[]>;
  };
}
