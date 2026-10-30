"use client";

import { useCallback, useEffect, useState } from "react";
import { SOURCE_FIELDS } from "@/lib/machine-source-fields";

// Per-browser (localStorage) preference for which Machine fields are shown in
// the machine detail/edit drawer. Hidden fields keep their data: the edit form
// still submits their current values via hidden inputs.

export const CORE_FIELDS = [
  { key: "manufacturer", label: "Manufacturer" },
  { key: "model", label: "Model" },
  { key: "theme", label: "Game Theme" },
  { key: "parSheet", label: "PAR Sheet" },
  { key: "sealNumber", label: "Seal Number" },
  { key: "lifecycleStatus", label: "Lifecycle Status" },
  { key: "highlightFlag", label: "Highlight / Flag" },
] as const;

const keys = (from: string, to?: string) => {
  const a = SOURCE_FIELDS.findIndex((f) => f.key === from);
  const b = to ? SOURCE_FIELDS.findIndex((f) => f.key === to) : SOURCE_FIELDS.length;
  return SOURCE_FIELDS.slice(a, b).map((f) => ({ key: f.key as string, label: f.label as string }));
};

export const FIELD_GROUPS: { name: string; fields: { key: string; label: string }[] }[] = [
  { name: "Core", fields: CORE_FIELDS.map((f) => ({ ...f })) },
  { name: "Source Data", fields: keys("holdPercent", "typeId") },
  { name: "VALIDATION software", fields: keys("typeId", "cabinetType") },
  { name: "Phase 1b", fields: keys("cabinetType") },
];

const STORAGE_KEY = "machine-hidden-fields-v1";
const EVENT = "machine-hidden-fields-change";

function read(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export function useHiddenMachineFields() {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const sync = () => setHidden(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const update = useCallback((next: Set<string>) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    window.dispatchEvent(new Event(EVENT));
  }, []);
  const toggle = (key: string) => {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    update(next);
  };
  const setGroup = (groupKeys: string[], show: boolean) => {
    const next = new Set(hidden);
    groupKeys.forEach((k) => (show ? next.delete(k) : next.add(k)));
    update(next);
  };
  return { hidden, isShown: (k: string) => !hidden.has(k), toggle, setGroup, reset: () => update(new Set()) };
}

export function MachineFieldsMenu() {
  const { hidden, isShown, toggle, setGroup, reset } = useHiddenMachineFields();
  return (
    <details className="field-menu" style={{ position: "relative" }}>
      <summary className="btn btn-small" style={{ listStyle: "none", cursor: "pointer" }}>
        Fields{hidden.size ? ` (${hidden.size} hidden)` : ""} ▾
      </summary>
      <div
        className="field-menu-panel"
        style={{ position: "absolute", right: 0, zIndex: 50, background: "var(--parchment, #fff)", color: "var(--ink, #111)", border: "1px solid currentColor", padding: 10, width: 260, maxHeight: 420, overflowY: "auto", fontSize: 12.5 }}
      >
        {FIELD_GROUPS.map((g) => {
          const gk = g.fields.map((f) => f.key);
          const allShown = gk.every(isShown);
          return (
            <div key={g.name} style={{ marginBottom: 10 }}>
              <label style={{ fontWeight: 600, display: "flex", gap: 6 }}>
                <input type="checkbox" checked={allShown} onChange={() => setGroup(gk, !allShown)} />
                {g.name}
              </label>
              {g.fields.map((f) => (
                <label key={f.key} style={{ display: "flex", gap: 6, paddingLeft: 18 }}>
                  <input type="checkbox" checked={isShown(f.key)} onChange={() => toggle(f.key)} />
                  {f.label}
                </label>
              ))}
            </div>
          );
        })}
        <button type="button" className="btn btn-small" onClick={reset}>Show all</button>
      </div>
    </details>
  );
}
