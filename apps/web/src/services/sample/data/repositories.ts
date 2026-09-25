import type { RepoConfig } from "@/lib/types";

export interface RepositorySpec {
  id: string;
  owner: string;
  name: string;
  language: string;
  framework: string;
  defaultBranch: string;
  syncedMinutesAgo: number;
  config: RepoConfig;
}

export interface PullRequestSpec {
  repoId: string;
  number: number;
  title: string;
  author: string;
  branch: string;
  openedMinutesAgo: number;
  /** Stack spec id. For on-demand PRs the stack exists only after analysis. */
  stackSpecId: string | null;
  /** Only for PRs with no stack spec (e.g. small dependency bumps). */
  stats?: { additions: number; deletions: number; filesChanged: number; areas: string[] };
}

export const repositorySpecs: RepositorySpec[] = [
  {
    id: "galaxium-travels",
    owner: "galaxium",
    name: "galaxium-travels",
    language: "Python",
    framework: "FastAPI",
    defaultBranch: "main",
    syncedMinutesAgo: 12,
    config: {
      workingDirectory: "booking_system_backend",
      setupCommand: "pip install -r requirements.txt",
      checkCommand: "pytest -q",
      maxLayerLines: 400,
      bobcoinCap: 3,
    },
  },
  {
    id: "orbit-pricing",
    owner: "orbit-labs",
    name: "orbit-pricing",
    language: "Python",
    framework: "Pricing library",
    defaultBranch: "main",
    syncedMinutesAgo: 34,
    config: {
      workingDirectory: ".",
      setupCommand: "pip install -e '.[test]'",
      checkCommand: "pytest -q",
      maxLayerLines: 400,
      bobcoinCap: 3,
    },
  },
  {
    id: "ledger-sync",
    owner: "orbit-labs",
    name: "ledger-sync",
    language: "Python",
    framework: "Celery",
    defaultBranch: "main",
    syncedMinutesAgo: 95,
    config: {
      workingDirectory: ".",
      setupCommand: "pip install -r requirements-dev.txt",
      checkCommand: "pytest -q",
      maxLayerLines: 400,
      bobcoinCap: 3,
    },
  },
];

export const pullRequestSpecs: PullRequestSpec[] = [
  {
    repoId: "galaxium-travels",
    number: 190,
    title: "Bump FastAPI to 0.115.6",
    author: "dependabot",
    branch: "deps/fastapi-0.115.6",
    openedMinutesAgo: 55,
    stackSpecId: null,
    stats: { additions: 36, deletions: 22, filesChanged: 3, areas: ["deps", "api"] },
  },
  {
    repoId: "galaxium-travels",
    number: 188,
    title: "Waitlist for sold-out flights",
    author: "sofia-r",
    branch: "feature/waitlist",
    openedMinutesAgo: 190,
    stackSpecId: "galaxium-travels-188",
  },
  {
    repoId: "galaxium-travels",
    number: 184,
    title: "Add cancellations & refunds",
    author: "arjun-m",
    branch: "feature/cancellations",
    openedMinutesAgo: 260,
    stackSpecId: "galaxium-travels-184",
  },
  {
    repoId: "orbit-pricing",
    number: 61,
    title: "Cache currency conversion rates",
    author: "leo-k",
    branch: "perf/rate-cache",
    openedMinutesAgo: 22,
    stackSpecId: "orbit-pricing-61",
  },
  {
    repoId: "orbit-pricing",
    number: 57,
    title: "Move fare math to Decimal",
    author: "leo-k",
    branch: "refactor/decimal-fares",
    openedMinutesAgo: 300,
    stackSpecId: "orbit-pricing-57",
  },
  {
    repoId: "ledger-sync",
    number: 41,
    title: "Batch reconciliation job",
    author: "hana-t",
    branch: "feature/batch-reconcile",
    openedMinutesAgo: 7400,
    stackSpecId: "ledger-sync-41",
  },
];
