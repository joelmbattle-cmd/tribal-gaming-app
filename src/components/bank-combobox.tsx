"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BankOption } from "@/lib/data/floor";

export const NEW_BANK_VALUE = "__new__";
const MAX_RESULTS = 50;

// Typeahead replacement for a plain <select> of banks — a flat list becomes
// unusable once a floor has hundreds or thousands of banks, so this filters
// client-side as the user types instead of rendering every option.
export function BankCombobox({
  banks,
  value,
  onChange,
  disabled,
  placeholder = "Search banks by name or area…",
}: {
  banks: BankOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const selectedBank = banks.find((b) => b.id === value);
  const displayValue =
    value === NEW_BANK_VALUE
      ? "+ Create New Bank…"
      : !value
      ? "— Unassigned —"
      : selectedBank
      ? `${selectedBank.name} (${selectedBank.occupied}/${selectedBank.capacity}) — ${selectedBank.areaLabel}`
      : "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = !q
      ? banks
      : banks.filter((b) => b.name.toLowerCase().includes(q) || b.areaLabel.toLowerCase().includes(q));
    return base.slice(0, MAX_RESULTS);
  }, [banks, query]);

  const options = useMemo(
    () => [
      { value: "", label: "— Unassigned —", sub: undefined as string | undefined },
      { value: NEW_BANK_VALUE, label: "+ Create New Bank…", sub: undefined as string | undefined },
      ...filtered.map((b) => ({ value: b.id, label: b.name, sub: `${b.occupied}/${b.capacity} — ${b.areaLabel}` })),
    ],
    [filtered],
  );

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

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="combobox" ref={rootRef}>
      <input
        type="text"
        className="field-input combobox-input"
        placeholder={placeholder}
        value={open ? query : displayValue}
        onFocus={() => {
          setOpen(true);
          setQuery("");
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
            setHighlight((h) => Math.min(h + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const opt = options[highlight];
            if (opt) select(opt.value);
          } else if (e.key === "Escape") {
            setOpen(false);
            setQuery("");
          }
        }}
        disabled={disabled}
      />
      {open && (
        <div className="combobox-menu">
          {options.map((opt, i) => (
            <button
              type="button"
              key={opt.value || "unassigned"}
              className={`combobox-option${i === highlight ? " active" : ""}${opt.value === value ? " selected" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(opt.value)}
            >
              <span>{opt.label}</span>
              {opt.sub && <span className="combobox-option-sub">{opt.sub}</span>}
            </button>
          ))}
          {filtered.length === 0 && query.trim() && <div className="combobox-empty">No banks match &ldquo;{query}&rdquo;</div>}
        </div>
      )}
    </div>
  );
}
