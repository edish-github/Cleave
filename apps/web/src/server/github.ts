import "server-only";
import { cache } from "react";

/**
 * GitHub REST calls made with the signed-in user's OAuth token (scope: read:user, repo).
 * The token never leaves the server. Every call is per request; nothing is cached across users.
 */

const API = "https://api.github.com";

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function gh<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "cleave-web",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new GitHubError(body?.message ?? `GitHub returned ${response.status}`, response.status);
  }
  return (await response.json()) as T;
}

export interface GhRepo {
  id: number;
  full_name: string;
  name: string;
  owner: { login: string };
  default_branch: string;
  language: string | null;
  private: boolean;
  pushed_at: string | null;
  permissions?: { push?: boolean };
}

export interface GhPull {
  number: number;
  title: string;
  html_url: string;
  draft?: boolean;
  created_at: string;
  user: { login: string } | null;
  head: { ref: string; sha: string };
  base: { ref: string };
  additions?: number;
  deletions?: number;
  changed_files?: number;
}

export type CiState = "success" | "failure" | "pending" | "none";

/** Repositories the user can push to, most recently pushed first. */
export const listUserRepos = cache(async (token: string): Promise<GhRepo[]> => {
  const repos = await gh<GhRepo[]>(token, "/user/repos?sort=pushed&per_page=100&affiliation=owner,collaborator,organization_member");
  return repos.filter((r) => r.permissions?.push !== false);
});

export const getRepo = cache(async (token: string, fullName: string): Promise<GhRepo> => gh<GhRepo>(token, `/repos/${fullName}`));

/** Open pull requests with their size. Sizes need one call per PR, so the list is capped. */
export const listOpenPulls = cache(async (token: string, fullName: string, limit = 20): Promise<GhPull[]> => {
  const pulls = await gh<GhPull[]>(token, `/repos/${fullName}/pulls?state=open&sort=updated&direction=desc&per_page=${limit}`);
  return Promise.all(pulls.map((p) => gh<GhPull>(token, `/repos/${fullName}/pulls/${p.number}`).catch(() => p)));
});

export const countOpenPulls = cache(async (token: string, fullName: string): Promise<number> => {
  const pulls = await gh<unknown[]>(token, `/repos/${fullName}/pulls?state=open&per_page=100`);
  return pulls.length;
});

/** Top-level areas a pull request touches (first path segment of each file). */
export const pullAreas = cache(async (token: string, fullName: string, number: number): Promise<string[]> => {
  const files = await gh<{ filename: string }[]>(token, `/repos/${fullName}/pulls/${number}/files?per_page=100`);
  const areas = files.map((f) => {
    const parts = f.filename.split("/");
    return parts.length > 2 ? parts[1]! : parts.length === 2 ? parts[0]! : parts[0]!.replace(/\.\w+$/, "");
  });
  return [...new Set(areas)].slice(0, 12);
});

/** Combined CI state for a branch or sha: check runs plus legacy commit statuses. */
export const ciState = cache(async (token: string, fullName: string, ref: string): Promise<CiState> => {
  const encoded = encodeURIComponent(ref);
  const [runs, status] = await Promise.all([
    gh<{ check_runs: { status: string; conclusion: string | null }[] }>(token, `/repos/${fullName}/commits/${encoded}/check-runs?per_page=100`),
    gh<{ state: string; total_count: number }>(token, `/repos/${fullName}/commits/${encoded}/status`),
  ]);
  const states: CiState[] = runs.check_runs.map((r) =>
    r.status !== "completed"
      ? "pending"
      : ["success", "neutral", "skipped"].includes(r.conclusion ?? "")
        ? "success"
        : "failure",
  );
  if (status.total_count > 0) states.push(status.state === "success" ? "success" : status.state === "pending" ? "pending" : "failure");
  if (!states.length) return "none";
  if (states.includes("failure")) return "failure";
  if (states.includes("pending")) return "pending";
  return "success";
});
