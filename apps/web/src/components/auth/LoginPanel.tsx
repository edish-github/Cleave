import { devSignInAction, gitHubSignInAction, sampleSignInAction } from "@/server/actions/auth";
import { GitHubMark } from "@/components/ui/GitHubMark";
import { inputClasses } from "@/components/ui/Input";
import { SubmitButton } from "./SubmitButton";

const errors: Record<string, string> = {
  github: "GitHub sign-in isn't set up on this deployment yet.",
  OAuthCallbackError: "GitHub didn't complete the sign-in. Try again.",
  AccessDenied: "GitHub sign-in was cancelled.",
  Configuration: "Sign-in is misconfigured on this deployment.",
};

export function LoginPanel({
  next,
  github,
  dev,
  error,
}: {
  next: string;
  github: boolean;
  dev: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-6">
      {error ? (
        <p role="alert" className="rounded-xl border border-warn-line bg-warn-soft px-3.5 py-2.5 text-[13px] text-warn">
          {errors[error] ?? "Sign-in didn't complete. Try again."}
        </p>
      ) : null}

      <form action={gitHubSignInAction}>
        <input type="hidden" name="next" value={next} />
        <SubmitButton size="lg" className="w-full" icon={<GitHubMark />} disabled={!github}>
          Continue with GitHub
        </SubmitButton>
        <p className="mt-2 text-center text-[12px] text-ink-3">
          {github
            ? "Cleave reads the pull requests you choose and opens stacked ones. It never pushes to your default branch."
            : "GitHub sign-in isn't set up on this deployment yet."}
        </p>
      </form>

      <div className="flex items-center gap-3 text-[12px] text-ink-3" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>

      <form action={sampleSignInAction}>
        <input type="hidden" name="next" value={next} />
        <SubmitButton variant="secondary" size="lg" className="w-full">
          Explore the sample workspace
        </SubmitButton>
        <p className="mt-2 text-center text-[12px] text-ink-3">
          Labelled sample data. No account and no GitHub access needed.
        </p>
      </form>

      {dev ? (
        <form action={devSignInAction} className="space-y-2 rounded-2xl border border-dashed border-line p-4">
          <input type="hidden" name="next" value={next} />
          <label htmlFor="dev-login" className="block text-[12px] font-medium text-ink-2">
            Development sign-in (local only)
          </label>
          <div className="flex gap-2">
            <input id="dev-login" name="login" defaultValue="edish-github" className={inputClasses} />
            <SubmitButton variant="secondary">Sign in</SubmitButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}
