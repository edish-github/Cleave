import "server-only";
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import { databaseConfigured, db, schema } from "./db/client";

declare module "next-auth" {
  interface Session {
    user: { id: string; login: string } & DefaultSession["user"];
    /** GitHub OAuth token. Server-side use only; never pass the session to client components. */
    accessToken?: string;
  }
}

export const githubConfigured = Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);

/**
 * Local-only sign-in for testing the live workspace without an OAuth app.
 * Needs CLEAVE_DEV_LOGIN=1 and a non-production build; it can never be on in a deployment.
 */
export const devLoginEnabled = process.env.CLEAVE_DEV_LOGIN === "1" && process.env.NODE_ENV !== "production";

/** The live workspace needs a database and a way to sign in. Otherwise only the sample workspace exists. */
export const liveEnabled = databaseConfigured && (githubConfigured || devLoginEnabled);

async function upsertUser(input: { githubId: number; login: string; name?: string | null; email?: string | null; avatarUrl?: string | null }) {
  const [row] = await db()
    .insert(schema.users)
    .values(input)
    .onConflictDoUpdate({
      target: schema.users.githubId,
      set: { login: input.login, name: input.name ?? null, email: input.email ?? null, avatarUrl: input.avatarUrl ?? null },
    })
    .returning();
  if (!row) throw new Error("Couldn't store the user");
  return row;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    ...(githubConfigured ? [GitHub({ authorization: { params: { scope: "read:user user:email repo" } } })] : []),
    ...(devLoginEnabled
      ? [
          Credentials({
            id: "dev",
            name: "Development",
            credentials: { login: { label: "GitHub login" } },
            async authorize(credentials) {
              const login = String(credentials?.login ?? "").trim();
              if (!/^[A-Za-z0-9-]{1,39}$/.test(login)) return null;
              const githubId = 9_000_000_000 + [...login].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 1_000_000_000, 7);
              const user = await upsertUser({ githubId, login, name: login });
              return { id: user.id, name: user.name, email: user.email };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, account, profile, user }) {
      if (account?.provider === "github" && profile) {
        const row = await upsertUser({
          githubId: Number(profile.id),
          login: String(profile.login),
          name: (profile.name as string | null) ?? null,
          email: (profile.email as string | null) ?? null,
          avatarUrl: (profile.avatar_url as string | null) ?? null,
        });
        token.uid = row.id;
        token.login = row.login;
        token.accessToken = account.access_token;
      } else if (account?.provider === "dev" && user?.id) {
        token.uid = user.id;
        token.login = user.name ?? "dev";
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = String(token.uid ?? "");
      session.user.login = String(token.login ?? "");
      if (typeof token.accessToken === "string") session.accessToken = token.accessToken;
      return session;
    },
  },
});

/** The signed-in live user, or null (signed out, sample workspace, or live mode not configured). */
export async function liveSession() {
  if (!liveEnabled) return null;
  const session = await auth();
  return session?.user?.id ? session : null;
}
