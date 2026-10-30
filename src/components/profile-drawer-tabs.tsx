"use client";

export type ProfileDrawerTab = "overview" | "documents" | "background" | "forms" | "history";

const TABS: { key: ProfileDrawerTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "documents", label: "Documents" },
  { key: "background", label: "Background" },
  { key: "forms", label: "Forms" },
  { key: "history", label: "History" },
];

/** Tab bar for the licensing profile drawer; lives inside the sticky case header. */
export function ProfileDrawerTabs({
  active,
  onChange,
  historyCount,
}: {
  active: ProfileDrawerTab;
  onChange: (tab: ProfileDrawerTab) => void;
  historyCount?: number;
}) {
  return (
    <div className="drawer-tabs" role="tablist" aria-label="Profile sections">
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          id={`profile-tabbtn-${t.key}`}
          aria-selected={active === t.key}
          aria-controls={`profile-tab-${t.key}`}
          className={`folder-tab drawer-tab${active === t.key ? " folder-tab-active" : ""}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.key === "history" && historyCount ? <span className="folder-tab-count"> {historyCount}</span> : null}
        </button>
      ))}
    </div>
  );
}
