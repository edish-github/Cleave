export const site = {
  name: "Cleave",
  tagline: "Large pull requests, reviewed as small proven steps.",
  description:
    "Cleave turns an oversized pull request into a stack of small ones. Every layer passes your tests on its own, and the stack matches the original change byte for byte.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  githubUrl: process.env.NEXT_PUBLIC_GITHUB_URL || null,
};

export const routes = {
  home: "/",
  login: "/login",
  signup: "/signup",
  bobDocs: "/docs/bob",
  proof: (stackId: string) => `/proof/${stackId}`,
  app: "/app",
  newSplit: (repoId?: string, pr?: number) =>
    repoId ? `/app/new?repo=${repoId}${pr ? `&pr=${pr}` : ""}` : "/app/new",
  stacks: "/app/stacks",
  stack: (id: string) => `/app/stacks/${id}`,
  layers: (id: string) => `/app/stacks/${id}/layers`,
  layer: (id: string, index: number) => `/app/stacks/${id}/layers/${index}`,
  verification: (id: string) => `/app/stacks/${id}/verification`,
  activity: (id: string) => `/app/stacks/${id}/activity`,
  publish: (id: string) => `/app/stacks/${id}/publish`,
  published: (id: string) => `/app/stacks/${id}/published`,
  repositories: "/app/repositories",
  repository: (id: string) => `/app/repositories/${id}`,
  settings: "/app/settings",
  settingsGithub: "/app/settings/github",
  settingsAppearance: "/app/settings/appearance",
  settingsRunners: "/app/settings/runners",
} as const;
