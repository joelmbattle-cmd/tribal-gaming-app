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
import { createMachineAction } from "@/lib/actions/machines";
import type { MachineListItem } from "@/lib/data/machines";

const STATUS_LABEL: Record<string, string> = { VERIFIED: "Verified", FLAGGED: "Flagged", PENDING: "Pending" };
const STATUS_CHIP: Record<string, string> = { VERIFIED: "chip-cleared", FLAGGED: "chip-flagged", PENDING: "chip-investigation" };

export function MachineListView({ machines }: { machines: MachineListItem[] }) {
  const variant = useShellVariant();
  const [selected, setSelected] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [serial, setSerial] = useState("");
  const [assetNumber, setAssetNumber] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [theme, setTheme] = useState("");
  const [parSheet, setParSheet] = useState("");
  const [sealNumber, setSealNumber] = useState("");
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const showToast = useToast();
  const router = useRouter();

  const filteredMachines = machines.filter((m) => {
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    return (
      m.serial.toLowerCase().includes(query) ||
      m.assetNumber.toLowerCase().includes(query) ||
      m.sealNumber.toLowerCase().includes(query) ||
      m.bankName.toLowerCase().includes(query) ||
      m.areaLabel.toLowerCase().includes(query)
    );
  });

  const doExport = () => {
    startTransition(async () => {
      const rows = await getMachinesForExportAction();
      const ok = exportRowsToExcel(rows, "machine-records");
      showToast(ok ? `Exported ${rows.length} machine record${rows.length === 1 ? "" : "s"} to Excel` : "No machines to export");
    });
  };

  const resetCreateForm = () => {
    setSerial("");
    setAssetNumber("");
    setManufacturer("");
    setModel("");
    setTheme("");
    setParSheet("");
    setSealNumber("");
  };

  const createMachine = () => {
    if (!serial.trim() || !assetNumber.trim() || !manufacturer.trim() || !model.trim() || !theme.trim() || !parSheet.trim()) {
      showToast("Serial, asset number, manufacturer, model, game theme, and PAR sheet are required");
      return;
    }
    startTransition(async () => {
      try {
        await createMachineAction({
          serial: serial.trim(),
          assetNumber: assetNumber.trim(),
          manufacturer: manufacturer.trim(),
          model: model.trim(),
          theme: theme.trim(),
          parSheet: parSheet.trim(),
          sealNumber: sealNumber.trim(),
        });
        resetCreateForm();
        setShowCreateForm(false);
        showToast("Machine added — now on the floor map");
        router.refresh();
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Could not add machine");
      }
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
    { icon: "+", label: "New Machine", onClick: () => setShowCreateForm(true) },
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
            <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>+ New Machine</button>
            <button className="btn" onClick={downloadImportTemplate}>📄 Template</button>
            <button className="btn" onClick={triggerImport}>⭱ Import from Excel</button>
            <button className="btn" onClick={doExport}>⭳ Export to Excel</button>
          </div>
        ) : (
          <button className="m-icon-btn" onClick={() => setSheetOpen(true)} aria-label="Actions">⋯</button>
        )}
      </div>

      <div className="search-box">
        <input
          type="text"
          placeholder="Search by serial, asset, seal, bank, or area..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="profiles">
        {filteredMachines.length > 0 ? (
          filteredMachines.map((m) => (
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
          ))
        ) : (
          <div className="empty-state">
            <div className="empty-text">No machines match &ldquo;{search}&rdquo;</div>
            <div className="empty-sub">Try searching by serial number, asset number, seal number, bank, or area.</div>
          </div>
        )}
      </div>

      <ActionSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Machine Records Actions" actions={actions} />

      <ResponsiveOverlay open={!!selected} onClose={() => setSelected(null)}>
        {selected && <MachineDrawerContent serial={selected} onClose={() => setSelected(null)} onChanged={() => router.refresh()} />}
      </ResponsiveOverlay>

      <ResponsiveOverlay open={showCreateForm} onClose={() => setShowCreateForm(false)}>
        <div className="drawer-head">
          <div>
            <div className="drawer-eyebrow">New Machine Record</div>
            <div className="drawer-title">Add Machine</div>
          </div>
          <button className="drawer-close" onClick={() => setShowCreateForm(false)}>✕</button>
        </div>
        <div className="drawer-body">
          <div className="field-label" style={{ marginBottom: 4 }}>
            Placed on the Interactive Floor Map in the Unassigned bank — move it to a real bank there once seated.
          </div>
          <div className="section-label" style={{ borderTop: "none", marginTop: 0 }}>Machine Master Fields</div>
          <div className="field-grid">
            <div>
              <label className="field-label">Serial Number</label>
              <input
                type="text"
                placeholder="Required — e.g. EGD-10412"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
            <div>
              <label className="field-label">Asset Number</label>
              <input
                type="text"
                placeholder="Required"
                value={assetNumber}
                onChange={(e) => setAssetNumber(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
            <div>
              <label className="field-label">Manufacturer</label>
              <input
                type="text"
                placeholder="Required"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
            <div>
              <label className="field-label">Model</label>
              <input
                type="text"
                placeholder="Required"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
            <div>
              <label className="field-label">Game Theme</label>
              <input
                type="text"
                placeholder="Required"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
            <div>
              <label className="field-label">PAR Sheet</label>
              <input
                type="text"
                placeholder="Required"
                value={parSheet}
                onChange={(e) => setParSheet(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
            <div>
              <label className="field-label">Seal Number</label>
              <input
                type="text"
                placeholder="Optional — e.g. SL-77291"
                value={sealNumber}
                onChange={(e) => setSealNumber(e.target.value)}
                className="field-input"
                disabled={pending}
              />
            </div>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 8, flexDirection: "column" }}>
            <button className="btn btn-primary" disabled={pending} onClick={createMachine}>
              Add Machine
            </button>
            <button className="btn" disabled={pending} onClick={() => setShowCreateForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      </ResponsiveOverlay>
    </div>
  );
}
