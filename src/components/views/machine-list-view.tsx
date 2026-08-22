"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useShellVariant } from "@/components/shell-variant";
import { useToast } from "@/components/toast";
import { ResponsiveOverlay } from "@/components/overlay";
import { ActionSheet } from "@/components/action-sheet";
import { MachineDrawerContent } from "@/components/machine-drawer-content";
import { downloadImportTemplate, exportRowsToExcel, readWorkbookRows } from "@/lib/excel-client";
import { getMachinesForExportAction, importMachinesAction } from "@/lib/actions/import-export";
import type { MachineListItem } from "@/lib/data/machines";

const STATUS_LABEL: Record<string, string> = { VERIFIED: "Verified", FLAGGED: "Flagged", PENDING: "Pending" };
const STATUS_CHIP: Record<string, string> = { VERIFIED: "chip-cleared", FLAGGED: "chip-flagged", PENDING: "chip-investigation" };

export function MachineListView({ machines }: { machines: MachineListItem[] }) {
  const variant = useShellVariant();
  const [selected, setSelected] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const showToast = useToast();
  const router = useRouter();

  const doExport = () => {
    startTransition(async () => {
      const rows = await getMachinesForExportAction();
      const ok = exportRowsToExcel(rows, "machine-records");
      showToast(ok ? `Exported ${rows.length} machine record${rows.length === 1 ? "" : "s"} to Excel` : "No machines to export");
    });
  };

  const triggerImport = () => fileInput.current?.click();

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    startTransition(async () => {
      try {
        const rows = await readWorkbookRows(file);
        const result = await importMachinesAction(rows);
        const parts: string[] = [];
        if (result.created) parts.push(`${result.created} added`);
        if (result.updated) parts.push(`${result.updated} updated`);
        if (result.banksCreated) parts.push(`${result.banksCreated} new bank${result.banksCreated === 1 ? "" : "s"}`);
        if (result.skipped) parts.push(`${result.skipped} skipped`);
        showToast(parts.length ? `Import complete — ${parts.join(", ")}` : "No valid rows found in that file");
        router.refresh();
      } catch {
        showToast("Could not read that file — make sure it matches the template format");
      }
    });
  };

  const actions = [
    { icon: "📄", label: "Download Template", onClick: downloadImportTemplate },
    { icon: "⭱", label: "Import from Excel", onClick: triggerImport },
    { icon: "⭳", label: "Export to Excel", onClick: doExport },
  ];

  return (
    <div>
      <input ref={fileInput} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleImportFile} />

      <div className="view-head">
        <div>
          <div className="view-title">Machine Master Records</div>
          <div className="view-sub">{machines.length} EGDs across the floor. Click a record to review documents and audit history.</div>
        </div>
        {variant === "desktop" ? (
          <div className="view-actions">
            <button className="btn" onClick={downloadImportTemplate}>📄 Template</button>
            <button className="btn" onClick={triggerImport}>⭱ Import from Excel</button>
            <button className="btn" onClick={doExport}>⭳ Export to Excel</button>
          </div>
        ) : (
          <button className="m-icon-btn" onClick={() => setSheetOpen(true)} aria-label="Actions">⋯</button>
        )}
      </div>

      <div className="profiles">
        {machines.map((m) => (
          <button key={m.id} className="profile-row" onClick={() => setSelected(m.serial)}>
            <div className="avatar mono">{m.manufacturer[0]}</div>
            <div>
              <div className="p-name">{m.model} — {m.theme}</div>
              <div className="p-id">{m.serial}</div>
            </div>
            <div className="p-id p-bank">{m.bankName}</div>
            <div><span className={`chip ${STATUS_CHIP[m.complianceStatus]}`}>{STATUS_LABEL[m.complianceStatus]}</span></div>
            <div className="chevron">›</div>
          </button>
        ))}
      </div>

      <ActionSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Machine Records Actions" actions={actions} />

      <ResponsiveOverlay open={!!selected} onClose={() => setSelected(null)}>
        {selected && <MachineDrawerContent serial={selected} onClose={() => setSelected(null)} onChanged={() => router.refresh()} />}
      </ResponsiveOverlay>
    </div>
  );
}
