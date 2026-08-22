"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Rosette } from "@/components/rosette";
import { SignOutButton } from "@/components/sign-out-button";
import { useShellVariant } from "@/components/shell-variant";
import type { NavItem } from "@/lib/nav-items";

const TAB_LIMIT = 4;

export function AppShell({
  navItems,
  railNote,
  roleLabel,
  userName,
  children,
}: {
  navItems: NavItem[];
  railNote: string;
  roleLabel: string;
  userName: string;
  children: React.ReactNode;
}) {
  const variant = useShellVariant();
  return variant === "mobile" ? (
    <MobileShell navItems={navItems} railNote={railNote} roleLabel={roleLabel} userName={userName}>
      {children}
    </MobileShell>
  ) : (
    <DesktopShell navItems={navItems} railNote={railNote} roleLabel={roleLabel} userName={userName}>
      {children}
    </DesktopShell>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function DesktopShell({
  navItems,
  railNote,
  roleLabel,
  userName,
  children,
}: {
  navItems: NavItem[];
  railNote: string;
  roleLabel: string;
  userName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <Rosette size={34} />
          <div className="brand-text">
            <div className="name">Tribal Gaming Compliance &amp; Licensing Platform</div>
            <div className="sub">System of Record · V1</div>
          </div>
        </div>
        <div className="role-switch">
          <span className="signed-in-as">
            Signed in as <strong>{userName}</strong> · {roleLabel}
          </span>
          <SignOutButton />
        </div>
      </header>
      <div className="layout">
        <nav className="rail">
          <div className="rail-section-label">{roleLabel}</div>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={`rail-item${isActive(pathname, item.href) ? " active" : ""}`}>
              <span className="dot" />
              {item.label}
            </Link>
          ))}
          <div className="rail-note">{railNote}</div>
        </nav>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

function MobileShell({
  navItems,
  railNote,
  roleLabel,
  userName,
  children,
}: {
  navItems: NavItem[];
  railNote: string;
  roleLabel: string;
  userName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const shown = navItems.slice(0, TAB_LIMIT);
  const overflow = navItems.slice(TAB_LIMIT);
  const overflowActive = overflow.some((i) => isActive(pathname, i.href));
  const active = navItems.find((i) => isActive(pathname, i.href));

  return (
    <div className="app-shell">
      <header className="m-header">
        <div className="m-role-pill">
          <span className="m-role-dot" />
          <span>{roleLabel}</span>
        </div>
        <div className="m-header-title">{active?.label ?? ""}</div>
        <button className="m-icon-btn" onClick={() => setMoreOpen(true)} aria-label="Sections">
          ☰
        </button>
      </header>

      <main className="m-content">{children}</main>

      <nav className="m-tabbar">
        {shown.map((item) => (
          <Link key={item.href} href={item.href} className={`m-tab${isActive(pathname, item.href) ? " active" : ""}`}>
            <span className="m-tab-icon">{item.icon}</span>
            <span className="m-tab-label">{item.label}</span>
          </Link>
        ))}
        {overflow.length ? (
          <button className={`m-tab${overflowActive ? " active" : ""}`} onClick={() => setMoreOpen(true)}>
            <span className="m-tab-icon">⋯</span>
            <span className="m-tab-label">More</span>
          </button>
        ) : null}
      </nav>

      <div className={`m-scrim${moreOpen ? " open" : ""}`} onClick={() => setMoreOpen(false)} />
      <div className={`m-sheet${moreOpen ? " open" : ""}`}>
        <div className="m-sheet-handle" />
        <div className="m-sheet-title">All Sections</div>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`m-sheet-row${isActive(pathname, item.href) ? " active" : ""}`}
            onClick={() => setMoreOpen(false)}
          >
            <span className="m-sheet-row-icon">{item.icon}</span>
            <div className="m-sheet-row-title" style={{ flex: 1 }}>
              {item.label}
            </div>
          </Link>
        ))}
        <div className="m-sheet-note">{railNote}</div>
        <div className="m-sheet-divider" />
        <div style={{ padding: "4px" }}>
          Signed in as <strong>{userName}</strong>
        </div>
        <div className="m-sheet-row" style={{ padding: "8px 4px" }}>
          <SignOutButton className="btn" />
        </div>
        <div className="m-sheet-safe-pad" />
      </div>
    </div>
  );
}
