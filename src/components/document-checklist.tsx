"use client";

import { useRef } from "react";
import { DOCUMENT_SLOTS, lockedReason, type DocumentSlot } from "@/lib/document-slots";

export type ChecklistDocument = {
  id: string;
  name: string;
  date: string | null;
  slot: DocumentSlot | null;
  blobUrl: string | null;
};

/** The fixed 11-slot Licensing document checklist for one profile. */
export function DocumentChecklist({
  documents,
  archived,
  pending,
  onUpload,
  onReplace,
  onRemove,
}: {
  documents: ChecklistDocument[];
  archived: boolean;
  pending: boolean;
  onUpload: (slot: DocumentSlot, file: File) => void;
  onReplace: (documentId: string, file: File) => void;
  onRemove: (documentId: string) => void;
}) {
  return (
    <div className="doc-checklist">
      {DOCUMENT_SLOTS.map((def) => (
        <DocumentSlotCard
          key={def.key}
          label={def.label}
          critical={!!def.critical}
          docs={documents.filter((d) => d.slot === def.key)}
          locked={archived ? null : lockedReason(def.key, documents)}
          archived={archived}
          pending={pending}
          onUpload={(file) => onUpload(def.key, file)}
          onReplace={onReplace}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

/**
 * One slot's card: empty placeholder, or a checkmark plus its file(s) once
 * ≥1 is attached, with add/replace/remove controls. Exported so the
 * dedicated Background Check box (rendered outside the 11-slot grid, see
 * ProfileListView) can reuse the exact same upload/replace/remove UI.
 */
export function DocumentSlotCard({
  label,
  critical,
  docs,
  locked,
  archived,
  pending,
  onUpload,
  onReplace,
  onRemove,
  extra,
}: {
  label: string;
  critical: boolean;
  docs: ChecklistDocument[];
  locked: string | null;
  archived: boolean;
  pending: boolean;
  onUpload: (file: File) => void;
  onReplace: (documentId: string, file: File) => void;
  onRemove: (documentId: string) => void;
  /** Extra content rendered at the bottom of the card, e.g. a stubbed vendor-order button. */
  extra?: React.ReactNode;
}) {
  const addInputRef = useRef<HTMLInputElement>(null);
  const complete = docs.length > 0;

  const handleAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onUpload(file);
  };

  return (
    <div className={`doc-slot${complete ? " doc-slot-complete" : ""}${locked ? " doc-slot-locked" : ""}`}>
      <input ref={addInputRef} type="file" style={{ display: "none" }} onChange={handleAdd} />
      <div className="doc-slot-header">
        <span className="doc-slot-label">{label}</span>
        {critical && <span className="doc-slot-critical-badge">Critical</span>}
        {complete && <span className="doc-slot-check" title="Complete">✓</span>}
      </div>

      {docs.length === 0 ? (
        <div className="doc-slot-empty">{locked ? `🔒 ${locked}` : "No file on file"}</div>
      ) : (
        <div className="doc-slot-files">
          {docs.map((d) => (
            <DocumentFileRow key={d.id} doc={d} pending={pending} archived={archived} onReplace={onReplace} onRemove={onRemove} />
          ))}
        </div>
      )}

      {!archived && !locked && (
        <button
          className="btn doc-slot-upload-btn"
          disabled={pending}
          onClick={() => addInputRef.current?.click()}
        >
          {complete ? "+ Add Another" : "+ Upload"}
        </button>
      )}
      {!archived && locked && docs.length > 0 && (
        <div className="doc-slot-locked-note">🔒 {locked} — additional files blocked until resolved</div>
      )}
      {extra}
    </div>
  );
}

function DocumentFileRow({
  doc,
  pending,
  archived,
  onReplace,
  onRemove,
}: {
  doc: ChecklistDocument;
  pending: boolean;
  archived: boolean;
  onReplace: (documentId: string, file: File) => void;
  onRemove: (documentId: string) => void;
}) {
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const handleReplace = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onReplace(doc.id, file);
  };

  return (
    <div className="doc-row">
      <input ref={replaceInputRef} type="file" style={{ display: "none" }} onChange={handleReplace} />
      <span className="doc-icon">▤</span>
      <span className="doc-name">
        {doc.blobUrl ? (
          <a href={doc.blobUrl} target="_blank" rel="noopener noreferrer">
            {doc.name}
          </a>
        ) : (
          doc.name
        )}
      </span>
      <span className="doc-meta">{doc.date ?? "pending"}</span>
      {!archived && (
        <>
          <button
            className="doc-replace-btn"
            onClick={() => replaceInputRef.current?.click()}
            disabled={pending}
            title="Replace file"
          >
            ⟳
          </button>
          <button className="doc-delete-btn" onClick={() => onRemove(doc.id)} disabled={pending} title="Remove file">
            ✕
          </button>
        </>
      )}
    </div>
  );
}
