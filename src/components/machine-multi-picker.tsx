"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MachineOption } from "@/lib/data/machines";

const MAX_RESULTS = 50;

// Searchable multi-select for linking Machine Records to a shipment by
// serial — same typeahead shape as BankCombobox, but accumulates a list of
// chosen ids instead of replacing a single value.
export function MachineMultiPicker({
  machines,
  selectedIds,
  onChange,
  disabled,
}: {
  machines: MachineOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedMachines = selectedIds
    .map((id) => machines.find((m) => m.id === id))
    .filter((m): m is MachineOption => !!m);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = machines.filter((m) => !selectedSet.has(m.id));
    const matched = !q
      ? base
      : base.filter(
          (m) =>
            m.serial.toLowerCase().includes(q) ||
            m.model.toLowerCase().includes(q) ||
            m.manufacturer.toLowerCase().includes(q),
        );
    return matched.slice(0, MAX_RESULTS);
  }, [machines, query, selectedSet]);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  const add = (id: string) => {
    onChange([...selectedIds, id]);
    setQuery("");
    setHighlight(0);
  };

  const remove = (id: string) => {
    onChange(selectedIds.filter((existing) => existing !== id));
  };

  return (
    <div className="combobox" ref={rootRef}>
      <input
        type="text"
        className="field-input combobox-input"
        placeholder="Search machines by serial, model, or manufacturer…"
        value={query}
        onFocus={() => {
          setOpen(true);
          setHighlight(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, filtered.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const opt = filtered[highlight];
            if (opt) add(opt.id);
          } else if (e.key === "Escape") {
            setOpen(false);
            setQuery("");
          }
        }}
        disabled={disabled}
      />
      {open && (
        <div className="combobox-menu">
          {filtered.map((m, i) => (
            <button
              type="button"
              key={m.id}
              className={`combobox-option${i === highlight ? " active" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(m.id)}
            >
              <span>{m.serial}{m.archived ? " (Archived)" : ""}</span>
              <span className="combobox-option-sub">{m.manufacturer} — {m.model}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="combobox-empty">
              {query.trim() ? `No machines match "${query}"` : "No more machines to add"}
            </div>
          )}
        </div>
      )}
      {selectedMachines.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {selectedMachines.map((m) => (
            <div className="doc-row" key={m.id}>
              <span className="doc-icon">▤</span>
              <span className="doc-name">{m.serial} — {m.manufacturer} {m.model}{m.archived ? " (Archived)" : ""}</span>
              <button
                type="button"
                className="doc-delete-btn"
                onClick={() => remove(m.id)}
                disabled={disabled}
                title="Remove machine"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
