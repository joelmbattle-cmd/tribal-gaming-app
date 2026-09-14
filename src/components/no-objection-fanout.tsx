"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ResponsiveOverlay } from "@/components/overlay";
import { useToast } from "@/components/toast";
import { lockedReason, type DocumentSlot } from "@/lib/document-slots";
import { attachNoObjectionLetterAction } from "@/lib/actions/people";

type Candidate = {
  id: string;
  name: string;
  archived: boolean;
  documents: { slot: DocumentSlot | null }[];
};

/**
 * One physical No-Objection/objection letter often covers many licensees.
 * This lets an operator search active profiles still missing that slot,
 * select every one the letter applies to, and upload it a single time —
 * the same file is then attached to each selected profile's slot. Profiles
 * that haven't reached Notice of Results yet show as locked and can't be
 * selected, mirroring the single-profile upload gate.
 */
export function NoObjectionFanout({
  open,
  onClose,
  people,
}: {
  open: boolean;
  onClose: () => void;
  people: Candidate[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const showToast = useToast();

  const rows = useMemo(() => {
    return people
      .filter((p) => !p.archived)
      .map((p) => ({
        person: p,
        alreadyHasLetter: p.documents.some((d) => d.slot === "NO_OBJECTION_LETTER"),
        blocked: lockedReason("NO_OBJECTION_LETTER", p.documents),
      }))
      .filter((r) => !r.alreadyHasLetter)
      .filter((r) => r.person.name.toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => a.person.name.localeCompare(b.person.name));
  }, [people, query]);

  const eligibleSelectedIds = [...selected].filter((id) => {
    const row = rows.find((r) => r.person.id === id);
    return row && !row.blocked;
  });

  const toggle = (id: string, blocked: boolean) => {
    if (blocked) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const reset = () => {
    setQuery("");
    setSelected(new Set());
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const pickFile = () => {
    if (eligibleSelectedIds.length === 0) {
      showToast("Select at least one eligible profile first");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const ids = eligibleSelectedIds;
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("file", file);
        const { attached, skipped } = await attachNoObjectionLetterAction(ids, formData);
        showToast(
          skipped > 0
            ? `Attached to ${attached} profile${attached === 1 ? "" : "s"} — ${skipped} skipped (no longer eligible)`
            : `Attached to ${attached} profile${attached === 1 ? "" : "s"}`,
        );
        reset();
        router.refresh();
      } catch {
        showToast("Failed to attach the letter");
      }
    });
  };

  return (
    <ResponsiveOverlay open={open} onClose={handleClose}>
      <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={handleFile} />
      <div className="drawer-head">
        <div>
          <div className="drawer-eyebrow">No-Objection Letter</div>
          <div className="drawer-title">Send to Multiple Profiles</div>
        </div>
        <button className="drawer-close" onClick={handleClose}>✕</button>
      </div>
      <div className="drawer-body">
        <div className="field-label" style={{ marginBottom: 12, textTransform: "none", letterSpacing: 0, fontSize: 12.5 }}>
          One letter often covers several licensees. Select every profile it applies to, then upload it once —
          it&rsquo;s attached to each selected profile&rsquo;s No-Objection slot. A profile must have Notice of
          Results on file first.
        </div>
        <input
          type="text"
          placeholder="Search profiles…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="field-input"
          style={{ marginBottom: 12 }}
        />
        <div className="fanout-list">
          {rows.length === 0 && (
            <div className="field-label" style={{ padding: 12 }}>
              No active profiles are waiting on a No-Objection letter.
            </div>
          )}
          {rows.map(({ person, blocked }) => (
            <label key={person.id} className={`fanout-row${blocked ? " fanout-row-locked" : ""}`}>
              <input
                type="checkbox"
                checked={selected.has(person.id)}
                disabled={!!blocked || pending}
                onChange={() => toggle(person.id, !!blocked)}
              />
              <span className="fanout-name">{person.name}</span>
              {blocked && <span className="fanout-reason">🔒 {blocked}</span>}
            </label>
          ))}
        </div>
        <button className="btn btn-primary" disabled={pending} onClick={pickFile} style={{ marginTop: 16 }}>
          Upload Letter for {eligibleSelectedIds.length} Selected
        </button>
      </div>
    </ResponsiveOverlay>
  );
}
