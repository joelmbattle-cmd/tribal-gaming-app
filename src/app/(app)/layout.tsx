import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { ShellVariantProvider } from "@/components/shell-variant";
import { ToastProvider } from "@/components/toast";
import { NAV_ITEMS, RAIL_NOTE, ROLE_LABEL } from "@/lib/nav-items";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { role, name } = session.user;

  return (
    <ShellVariantProvider>
      <ToastProvider>
        <AppShell
          navItems={NAV_ITEMS[role]}
          railNote={RAIL_NOTE[role]}
          roleLabel={ROLE_LABEL[role]}
          userName={name ?? "User"}
        >
          {children}
        </AppShell>
      </ToastProvider>
    </ShellVariantProvider>
  );
}
