import { LogOut } from "lucide-react";
import { signOutAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/Button";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="secondary" size="sm" icon={<LogOut className="size-3.5" />}>
        Sign out
      </Button>
    </form>
  );
}
