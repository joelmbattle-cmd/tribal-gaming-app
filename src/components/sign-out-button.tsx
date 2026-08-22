import { signOutAction } from "@/lib/actions/auth";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOutAction}>
      <button type="submit" className={className ?? "btn btn-small"}>
        Sign Out
      </button>
    </form>
  );
}
