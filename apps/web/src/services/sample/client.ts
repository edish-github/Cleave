import "server-only";
import { cache } from "react";
import type {
  ActivityEvent,
  PullRequest,
  Repository,
  RepositorySummary,
  SearchItem,
  Session,
  Stack,
  StackSummary,
  User,
} from "@/lib/types";
import type { CleaveClient } from "../types";
import { buildStack, summarize, areaOf, type BuiltStack } from "./build";
import { pullRequestSpecs, repositorySpecs, type RepositorySpec } from "./data/repositories";
import { stackSpecs } from "./data/stacks";
import {
  clearSession,
  readSession,
  readState,
  updateState,
  writeSession,
  type SampleState,
} from "./state";

/**
 * Sample workspace implementation of CleaveClient.
 *
 * Reads are deterministic functions of the dataset in ./data plus the visitor's
 * cookie state. A short, configurable delay makes loading states visible and
 * keeps the UI honest about the latency a real backend will have.
 */

const READ_DELAY_MS = Number(process.env.SAMPLE_LATENCY_MS ?? 280);
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const MINUTE = 60_000;

const loadWorkspace = cache(async () => {
  const state = await readState();
  const now = Date.now();
  await pause(READ_DELAY_MS);
  const built = new Map<string, BuiltStack>();
  for (const spec of stackSpecs) {
    const result = buildStack(spec, state, now);
    if (result) built.set(spec.id, result);
  }
  return { state, now, built };
});

function toRepository(spec: RepositorySpec, now: number): Repository {
  return {
    id: spec.id,
    owner: spec.owner,
    name: spec.name,
    fullName: `${spec.owner}/${spec.name}`,
    url: null,
    language: spec.language,
    framework: spec.framework,
    defaultBranch: spec.defaultBranch,
    connection: "sample",
    lastSyncedAt: new Date(now - spec.syncedMinutesAgo * MINUTE).toISOString(),
    config: spec.config,
  };
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0]?.[0], parts[parts.length - 1]?.[0]] : [parts[0]?.[0], parts[0]?.[1]];
  return letters.filter(Boolean).join("").toUpperCase() || "C";
}

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "there";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase() + p.slice(1))
    .join(" ");
}

const byUpdated = (a: StackSummary, b: StackSummary) =>
  new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

const listStacks = cache(async (): Promise<StackSummary[]> => {
  const { built } = await loadWorkspace();
  return [...built.values()].map((b) => summarize(b.stack)).sort(byUpdated);
});

const getStack = cache(async (stackId: string): Promise<Stack | null> => {
  const { built } = await loadWorkspace();
  return built.get(stackId)?.stack ?? null;
});

export const sampleClient: CleaveClient = {
  source: "sample",

  session: {
    async get() {
      return readSession();
    },
    async signIn({ email }) {
      await pause(600);
      const session: Session = { name: nameFromEmail(email), email };
      await writeSession(session);
      return session;
    },
    async signInWithGitHub() {
      await pause(400);
      const session: Session = { name: "Sample User", email: "sample@cleave.dev" };
      await writeSession(session);
      return session;
    },
    async signUp({ name, email }) {
      await pause(700);
      const session: Session = { name: name.trim(), email };
      await writeSession(session);
      await updateState((s) => {
        s.profileName = name.trim();
      });
      return session;
    },
    async signOut() {
      await clearSession();
    },
  },

  user: {
    get: cache(async (): Promise<User> => {
      const [session, state] = await Promise.all([readSession(), readState()]);
      const name = state.profileName ?? session?.name ?? "Sample User";
      const email = session?.email ?? "sample@cleave.dev";
      return { id: "usr_sample", name, email, githubLogin: null, initials: initialsOf(name) };
    }),
    async updateProfile({ name }) {
      await pause(500);
      const state = await updateState((s) => {
        s.profileName = name.trim();
      });
      const session = await readSession();
      const finalName = state.profileName ?? name;
      return {
        id: "usr_sample",
        name: finalName,
        email: session?.email ?? "sample@cleave.dev",
        githubLogin: null,
        initials: initialsOf(finalName),
      };
    },
  },

  repositories: {
    list: cache(async (): Promise<RepositorySummary[]> => {
      const { built, now } = await loadWorkspace();
      return repositorySpecs.map((spec) => {
        const stacks = [...built.values()].filter((b) => b.stack.repoId === spec.id);
        const last = stacks
          .map((b) => new Date(b.stack.updatedAt).getTime())
          .sort((a, b) => b - a)[0];
        return {
          ...toRepository(spec, now),
          openPullRequests: pullRequestSpecs.filter((p) => p.repoId === spec.id).length,
          stackCount: stacks.length,
          lastStackAt: last ? new Date(last).toISOString() : null,
        };
      });
    }),

    get: cache(async (repoId: string): Promise<Repository | null> => {
      const { now } = await loadWorkspace();
      const spec = repositorySpecs.find((r) => r.id === repoId);
      return spec ? toRepository(spec, now) : null;
    }),

    async pullRequestAreas(repoId, prNumber) {
      const prs = await sampleClient.repositories.pullRequests(repoId);
      return prs.find((p) => p.number === prNumber)?.areas ?? [];
    },

    async available() {
      return [];
    },

    async connect() {
      throw new Error("Connecting repositories needs a GitHub account. Sign in with GitHub to connect one.");
    },

    pullRequests: cache(async (repoId: string): Promise<PullRequest[]> => {
      const { built, now } = await loadWorkspace();
      const repo = repositorySpecs.find((r) => r.id === repoId);
      if (!repo) return [];
      return pullRequestSpecs
        .filter((p) => p.repoId === repoId)
        .map((p) => {
          const spec = p.stackSpecId ? stackSpecs.find((s) => s.id === p.stackSpecId) : undefined;
          const existing = p.stackSpecId ? built.get(p.stackSpecId) : undefined;
          const atoms = spec?.layers.flatMap((l) => l.atoms) ?? [];
          const stats = p.stats ?? {
            additions: atoms.reduce((s, a) => s + a.add, 0),
            deletions: atoms.reduce((s, a) => s + (a.del ?? 0), 0),
            filesChanged: new Set(atoms.map((a) => a.file)).size,
            areas: [...new Set(atoms.map((a) => areaOf(a.file)))],
          };
          const size = stats.additions + stats.deletions;
          return {
            repoId,
            number: p.number,
            title: p.title,
            author: p.author,
            branch: p.branch,
            base: repo.defaultBranch,
            additions: stats.additions,
            deletions: stats.deletions,
            filesChanged: stats.filesChanged,
            areas: stats.areas,
            openedAt: new Date(now - p.openedMinutesAgo * MINUTE).toISOString(),
            stackId: existing ? existing.stack.id : null,
            belowThreshold: size < repo.config.maxLayerLines,
            analyzable: Boolean(spec),
          };
        })
        .sort((a, b) => b.number - a.number);
    }),
  },

  stacks: {
    async ciStatus() {
      // No GitHub in the sample workspace: published pull requests there are illustrative.
      return {};
    },
    list: listStacks,
    get: getStack,

    async getPublic(stackId) {
      const stack = await getStack(stackId);
      if (!stack || stack.visibility !== "public" || stack.status === "analyzing") return null;
      return stack;
    },

    async layer(stackId, layerIndex) {
      const stack = await getStack(stackId);
      const layer = stack?.layers.find((l) => l.index === layerIndex);
      return stack && layer ? { stack, layer } : null;
    },

    async forRepository(repoId) {
      const all = await listStacks();
      return all.filter((s) => s.repoId === repoId);
    },

    async start({ repoId, prNumber }) {
      const pr = pullRequestSpecs.find((p) => p.repoId === repoId && p.number === prNumber);
      if (!pr?.stackSpecId) throw new Error("This pull request can't be analyzed in the sample workspace.");
      const stackId = pr.stackSpecId;
      await pause(700);
      await updateState((s: SampleState) => {
        s.runs[stackId] = Date.now();
        delete s.published[stackId];
        delete s.resolved[stackId];
      });
      return { stackId };
    },

    async publish(stackId) {
      const stack = await getStack(stackId);
      if (!stack) throw new Error("Stack not found.");
      if (stack.status !== "verified") throw new Error("Only verified stacks can be published.");
      await pause(2400);
      await updateState((s) => {
        s.published[stackId] = Date.now();
      });
      return { stackId };
    },

    async resolveReview(stackId) {
      const stack = await getStack(stackId);
      if (!stack?.verification.issue) throw new Error("This stack has nothing to review.");
      await pause(1800);
      await updateState((s) => {
        s.resolved[stackId] = Date.now();
      });
      return { stackId };
    },

    async setVisibility(stackId, visibility) {
      await pause(250);
      await updateState((s) => {
        s.visibility[stackId] = visibility;
      });
    },
  },

  activity: {
    forStack: cache(async (stackId: string): Promise<ActivityEvent[]> => {
      const { built } = await loadWorkspace();
      return built.get(stackId)?.activity ?? [];
    }),
    recent: cache(async (limit: number): Promise<ActivityEvent[]> => {
      const { built } = await loadWorkspace();
      return [...built.values()]
        .flatMap((b) => b.activity)
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .slice(0, limit);
    }),
  },

  search: {
    index: cache(async (): Promise<SearchItem[]> => {
      const { built } = await loadWorkspace();
      const stacks: SearchItem[] = [...built.values()].map(({ stack }) => ({
        id: `stack-${stack.id}`,
        group: "Stacks",
        label: stack.title,
        hint: `${stack.repoName} · #${stack.prNumber}`,
        href: `/app/stacks/${stack.id}`,
      }));
      const repos: SearchItem[] = repositorySpecs.map((r) => ({
        id: `repo-${r.id}`,
        group: "Repositories",
        label: r.name,
        hint: `${r.owner}/${r.name}`,
        href: `/app/repositories/${r.id}`,
      }));
      const pages: SearchItem[] = [
        { id: "go-overview", group: "Go to", label: "Overview", hint: "Home", href: "/app" },
        { id: "go-new", group: "Go to", label: "New split", hint: "Analyze a pull request", href: "/app/new" },
        { id: "go-stacks", group: "Go to", label: "Stacks", hint: "All stacks", href: "/app/stacks" },
        { id: "go-repos", group: "Go to", label: "Repositories", hint: "Connected repositories", href: "/app/repositories" },
        { id: "go-settings", group: "Go to", label: "Settings", hint: "Profile, GitHub, appearance", href: "/app/settings" },
        { id: "go-bob", group: "Go to", label: "Bob IDE setup", hint: "Install the Cleave mode", href: "/docs/bob" },
      ];
      return [...pages, ...stacks, ...repos];
    }),
  },
};
