"use client";

import { useMemo, useState } from "react";
import { ResponsiveOverlay } from "@/components/overlay";
import { useToast } from "@/components/toast";
import type { DocumentSlot } from "@/lib/document-slots";
import { licensingStatusLabel, type LicensingApplicationStatus } from "@/lib/licensing-status";
import { buildNigcPacket, type NigcPacketEntry, type PacketFormType } from "@/lib/licensing-forms";
import { openHtmlPreview } from "@/lib/print-preview";

type Candidate = {
  id: string;
  name: string;
  archived: boolean;
  documents: { slot: DocumentSlot | null }[];
  position?: string | null;
  ssn?: string | null;
  dateOfBirth?: string | null;
  licenseType?: string | null;
  licenseNumber?: string | null;
  licenseIssueDate?: string | null;
  licenseExpirationDate?: string | null;
  applicationStatus?: LicensingApplicationStatus | null;
  suitabilityDetermination?: string | null;
  keyFindings?: string | null;
};

const PACKET_FORM_LABEL: Record<PacketFormType, string> = {
  NOTICE_OF_RESULTS: "NOR",
  ISSUANCE: "Issuance",
};

/**
 * Bulk NIGC submission: select any active licensee who has Notice of
 * Results and/or Issuance of License complete, then generate one combined
 * packet containing just those two letter types — reusing the exact same
 * templates as the single-profile "Generate Forms" action (see
 * licensing-forms.ts) so the packet's letters are byte-identical to what a
 * per-profile generate would produce. No-Objection is deliberately excluded
 * (that's a separate per-profile send/confirm step against the NIGC
 * receipt slot) and nothing is written back to any profile — this is a
 * read-only compilation of documents already on file.
 */
export function NigcPacketBuilder({
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
  const showToast = useToast();

  const rows = useMemo(() => {
    return people
      .filter((p) => !p.archived)
      .map((p) => {
        const hasNotice = p.documents.some((d) => d.slot === "NOTICE_OF_RESULTS");
        const hasIssuance = p.documents.some((d) => d.slot === "LICENSE_ISSUANCE");
        return { person: p, hasNotice, hasIssuance, eligible: hasNotice || hasIssuance };
      })
      .filter((r) => r.eligible)
      .filter((r) => r.person.name.toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => a.person.name.localeCompare(b.person.name));
  }, [people, query]);

  const selectedRows = rows.filter((r) => selected.has(r.person.id));

  const toggle = (id: string) => {
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

  const generate = () => {
    if (selectedRows.length === 0) {
      showToast("Select at least one eligible profile first");
      return;
    }

    const entries: NigcPacketEntry[] = [];
    for (const { person, hasNotice, hasIssuance } of selectedRows) {
      const formPerson = {
        id: person.id,
        name: person.name,
        position: person.position ?? null,
        ssn: person.ssn ?? null,
        dateOfBirth: person.dateOfBirth ?? null,
        licenseType: person.licenseType ?? null,
        licenseNumber: person.licenseNumber ?? null,
        licenseIssueDate: person.licenseIssueDate ?? null,
        licenseExpirationDate: person.licenseExpirationDate ?? null,
        suitabilityDeterminationLabel: person.suitabilityDetermination || "—",
        applicationStatusLabel: licensingStatusLabel(person.applicationStatus),
        keyFindings: person.keyFindings ?? null,
      };
      // Both letters when a profile has completed both — order NOR before
      // Issuance within each licensee, matching the natural results-chain order.
      if (hasNotice) entries.push({ formType: "NOTICE_OF_RESULTS", person: formPerson });
      if (hasIssuance) entries.push({ formType: "ISSUANCE", person: formPerson });
    }

    openHtmlPreview(buildNigcPacket(entries));
    showToast(`Packet generated — ${entries.length} document${entries.length === 1 ? "" : "s"} for ${selectedRows.length} licensee${selectedRows.length === 1 ? "" : "s"}`);
    handleClose();
  };

  return (
    <ResponsiveOverlay open={open} onClose={handleClose}>
      <div className="drawer-head">
        <div>
          <div className="drawer-eyebrow">NIGC Submission</div>
          <div className="drawer-title">Generate Batch Packet</div>
        </div>
        <button className="drawer-close" onClick={handleClose}>✕</button>
      </div>
      <div className="drawer-body">
        <div className="field-label" style={{ marginBottom: 12, textTransform: "none", letterSpacing: 0, fontSize: 12.5 }}>
          Select every licensee whose Notice of Results and/or Issuance of License letters belong in this
          submission. The packet includes only those two document types — No-Objection letters are sent and
          confirmed per profile instead.
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
              No active profiles have Notice of Results or Issuance of License on file yet.
            </div>
          )}
          {rows.map(({ person, hasNotice, hasIssuance }) => (
            <label key={person.id} className="fanout-row">
              <input type="checkbox" checked={selected.has(person.id)} onChange={() => toggle(person.id)} />
              <span className="fanout-name">{person.name}</span>
              <span className="fanout-reason" style={{ color: "var(--parchment-dim)" }}>
                {[hasNotice && PACKET_FORM_LABEL.NOTICE_OF_RESULTS, hasIssuance && PACKET_FORM_LABEL.ISSUANCE].filter(Boolean).join(" + ")}
              </span>
            </label>
          ))}
        </div>
        <button className="btn btn-primary" onClick={generate} style={{ marginTop: 16 }}>
          Generate Packet for {selectedRows.length} Selected
        </button>
      </div>
    </ResponsiveOverlay>
  );
}
