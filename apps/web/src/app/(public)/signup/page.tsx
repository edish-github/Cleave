import { redirect } from "next/navigation";

/** Accounts come from GitHub, so signing up and logging in are the same step. */
export default function SignupPage() {
  redirect("/login");
}
