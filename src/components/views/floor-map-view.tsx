"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useShellVariant } from "@/components/shell-variant";
import { useToast } from "@/components/toast";
import { ResponsiveOverlay } from "@/components/overlay";
import { ActionSheet } from "@/components/action-sheet";
import { MachineDrawerContent } from "@/components/machine-drawer-content";
import { downloadImportTemplate, exportRowsToExcel, readWorkbookRows } from "@/lib/excel-client";
import { getMachinesForExportAction, importMachinesAction } from "@/lib/actions/import-export";
import {
  addBankAction,
  changeBankCapacityAction,
  commitBankMoveAction,
  growMapWidthAction,
  growZoneHeightAction,
  moveMachineSlotAction,
  setBankAreaAction,
} from "@/lib/actions/floor";
import type { FloorArea, FloorBank, FloorSeat } from "@/lib/data/floor";

const BANK_W = 292;
const AREA_DOT: Record<string, string> = { main: "dot-main", highlimit: "dot-highlimit", other: "dot-other" };

type ChangeLogEntry = { id: string; changeType: string; bankName: string; areaLabel: string; notes: string; ts: string };

export function FloorMapView({
  areas: initialAreas,
  banks: initialBanks,
  mapWidth: initialMapWidth,
  changeLog,
}: {
  areas: FloorArea[];
  banks: FloorBank[];
  mapWidth: number;
  mapHeight: number;
  changeLog: ChangeLogEntry[];
}) {
  const variant = useShellVariant();
  const router = useRouter();
  const showToast = useToast();

  // Reset local editable copies during render when fresh server data arrives
  // (after router.refresh()) — React's documented pattern for adjusting
  // state from props, instead of setState-in-effect.
  const [syncedFrom, setSyncedFrom] = useState({ areas: initialAreas, banks: initialBanks, mapWidth: initialMapWidth });
  const [areaList, setAreaList] = useState(initialAreas);
  const [banks, setBanks] = useState(initialBanks);
  const [mapWidth, setMapWidth] = useState(initialMapWidth);
  if (
    syncedFrom.areas !== initialAreas ||
    syncedFrom.banks !== initialBanks ||
    syncedFrom.mapWidth !== initialMapWidth
  ) {
    setSyncedFrom({ areas: initialAreas, banks: initialBanks, mapWidth: initialMapWidth });
    setAreaList(initialAreas);
    setBanks(initialBanks);
    setMapWidth(initialMapWidth);
  }
  const mapHeight = areaList.reduce((h, a) => Math.max(h, a.y + a.h), 0);

  const [editMode, setEditMode] = useState(false);
  const [addingBank, setAddingBank] = useState(false);
  const [zoom, setZoom] = useState(0.85);
  const [panX, setPanX] = useState(20);
  const [panY, setPanY] = useState(10);
  const [fullscreen, setFullscreen] = useState(false);
  const [tapSource, setTapSource] = useState<{ bankId: string; seat: number } | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef({ x: panX, y: panY });
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = { x: panX, y: panY }; }, [panX, panY]);

  const bankDragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const panDragRef = useRef<{ startX: number; startY: number; origPanX: number; origPanY: number } | null>(null);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  const dragSourceRef = useRef<{ bankId: string; seat: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newBankName = useRef<HTMLInputElement>(null);
  const newBankCap = useRef<HTMLInputElement>(null);
  const newBankArea = useRef<HTMLSelectElement>(null);

  function ensureCanvasFitsLocal(x: number, y: number) {
    setMapWidth((w) => (x + BANK_W + 160 > w ? x + BANK_W + 400 : w));
    setAreaList((list) => {
      const h = list.reduce((acc, a) => Math.max(acc, a.y + a.h), 0);
      if (y + 220 > h) {
        const idx = list.length - 1;
        const grown = [...list];
        grown[idx] = { ...grown[idx], h: grown[idx].h + ((y + 300) - h) };
        return grown;
      }
      return list;
    });
  }

  function getPoint(e: MouseEvent | TouchEvent) {
    if ("touches" in e && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if ("changedTouches" in e && e.changedTouches.length) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
  }

  function setZoomAt(newZoom: number, clientX?: number, clientY?: number) {
    const clamped = Math.max(0.4, Math.min(2.2, newZoom));
    const viewport = viewportRef.current;
    if (!viewport) { setZoom(clamped); return; }
    const rect = viewport.getBoundingClientRect();
    const cx = clientX != null ? clientX - rect.left : rect.width / 2;
    const cy = clientY != null ? clientY - rect.top : rect.height / 2;
    const canvasX = (cx - panRef.current.x) / zoomRef.current;
    const canvasY = (cy - panRef.current.y) / zoomRef.current;
    setPanX(cx - canvasX * clamped);
    setPanY(cy - canvasY * clamped);
    setZoom(clamped);
  }

  // ---- Document-level mouse handlers (bank drag + pan) ----
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (bankDragRef.current) {
        const d = bankDragRef.current;
        const dx = (e.clientX - d.startX) / zoomRef.current;
        const dy = (e.clientY - d.startY) / zoomRef.current;
        const nx = Math.max(0, d.origX + dx);
        const ny = Math.max(0, d.origY + dy);
        setBanks((bs) => bs.map((b) => (b.id === d.id ? { ...b, x: nx, y: ny } : b)));
        ensureCanvasFitsLocal(nx, ny);
        return;
      }
      if (panDragRef.current) {
        const d = panDragRef.current;
        setPanX(d.origPanX + (e.clientX - d.startX));
        setPanY(d.origPanY + (e.clientY - d.startY));
      }
    }
    async function onUp() {
      if (bankDragRef.current) {
        const d = bankDragRef.current;
        bankDragRef.current = null;
        await commitDrag(d);
        return;
      }
      panDragRef.current = null;
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banks]);

  async function commitDrag(d: { id: string; origX: number; origY: number }) {
    setBanks((current) => {
      const bank = current.find((b) => b.id === d.id);
      if (bank) {
        const moved = Math.abs(bank.x - d.origX) > 2 || Math.abs(bank.y - d.origY) > 2;
        if (moved) {
          commitBankMoveAction(d.id, Math.round(bank.x), Math.round(bank.y))
            .then(() => { showToast("Floor layout updated"); router.refresh(); })
            .catch(() => showToast("Could not update floor layout"));
        }
      }
      return current;
    });
  }

  // ---- Touch handling on viewport (pan, pinch-zoom, bank drag) ----
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault();
        panDragRef.current = null;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchRef.current = { dist: Math.hypot(dx, dy), zoom: zoomRef.current };
        return;
      }
      const target = e.target as HTMLElement;
      if (target.closest(".bank") || target.closest(".machine") || target.closest(".empty-slot")) return;
      const p = getPoint(e);
      panDragRef.current = { startX: p.x, startY: p.y, origPanX: panRef.current.x, origPanY: panRef.current.y };
    }
    function onTouchMove(e: TouchEvent) {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const scale = dist / pinchRef.current.dist;
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        setZoomAt(pinchRef.current.zoom * scale, midX, midY);
        return;
      }
      if (bankDragRef.current) {
        e.preventDefault();
        const d = bankDragRef.current;
        const p = getPoint(e);
        const dx = (p.x - d.startX) / zoomRef.current;
        const dy = (p.y - d.startY) / zoomRef.current;
        const nx = Math.max(0, d.origX + dx);
        const ny = Math.max(0, d.origY + dy);
        setBanks((bs) => bs.map((b) => (b.id === d.id ? { ...b, x: nx, y: ny } : b)));
        ensureCanvasFitsLocal(nx, ny);
        return;
      }
      if (panDragRef.current) {
        e.preventDefault();
        const p = getPoint(e);
        const d = panDragRef.current;
        setPanX(d.origPanX + (p.x - d.startX));
        setPanY(d.origPanY + (p.y - d.startY));
      }
    }
    async function onTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) pinchRef.current = null;
      if (bankDragRef.current) {
        const d = bankDragRef.current;
        bankDragRef.current = null;
        await commitDrag(d);
        return;
      }
      panDragRef.current = null;
    }
    viewport.addEventListener("touchstart", onTouchStart, { passive: false });
    viewport.addEventListener("touchmove", onTouchMove, { passive: false });
    viewport.addEventListener("touchend", onTouchEnd);
    viewport.addEventListener("touchcancel", onTouchEnd);

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      setZoomAt(zoomRef.current + delta, e.clientX, e.clientY);
    }
    viewport.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      viewport.removeEventListener("touchstart", onTouchStart);
      viewport.removeEventListener("touchmove", onTouchMove);
      viewport.removeEventListener("touchend", onTouchEnd);
      viewport.removeEventListener("touchcancel", onTouchEnd);
      viewport.removeEventListener("wheel", onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banks]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && fullscreen) setFullscreen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const onBankHandleDown = (e: React.MouseEvent | React.TouchEvent, bankId: string) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    const bank = banks.find((b) => b.id === bankId);
    if (!bank) return;
    const p = "touches" in e ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
    bankDragRef.current = { id: bankId, startX: p.x, startY: p.y, origX: bank.x, origY: bank.y };
  };

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(".bank") || target.closest(".machine") || target.closest(".empty-slot")) return;
    panDragRef.current = { startX: e.clientX, startY: e.clientY, origPanX: panRef.current.x, origPanY: panRef.current.y };
  };

  async function moveMachine(srcBankId: string, srcSeat: number, destBankId: string, destSeat: number) {
    if (srcBankId === destBankId && srcSeat === destSeat) return;
    const srcBank = banks.find((b) => b.id === srcBankId);
    const destBank = banks.find((b) => b.id === destBankId);
    if (!srcBank || !destBank) return;
    const moving = srcBank.seats[srcSeat];
    const occupying = destBank.seats[destSeat];

    setBanks((bs) =>
      bs.map((b) => {
        if (b.id === srcBankId) {
          const seats = [...b.seats];
          seats[srcSeat] = b.id === destBankId ? seats[srcSeat] : occupying;
          return { ...b, seats };
        }
        return b;
      }).map((b) => {
        if (b.id === destBankId) {
          const seats = [...b.seats];
          seats[destSeat] = moving;
          return { ...b, seats };
        }
        return b;
      }),
    );

    try {
      await moveMachineSlotAction(srcBankId, srcSeat, destBankId, destSeat);
      showToast("Floor layout updated");
    } catch {
      showToast("Could not move machine");
    }
    router.refresh();
  }

  const onSlotTap = (bankId: string, seat: number, occupied: boolean) => {
    if (!editMode) return;
    if (!tapSource) {
      if (!occupied) return;
      setTapSource({ bankId, seat });
      return;
    }
    if (tapSource.bankId === bankId && tapSource.seat === seat) {
      setTapSource(null);
      return;
    }
    moveMachine(tapSource.bankId, tapSource.seat, bankId, seat);
    setTapSource(null);
  };

  const toggleEditMode = () => { setEditMode((v) => !v); setAddingBank(false); setTapSource(null); };

  const setBankArea = async (bankId: string, areaKey: string) => {
    setBanks((bs) => bs.map((b) => (b.id === bankId ? { ...b, areaId: areaList.find((a) => a.key === areaKey)?.id ?? b.areaId } : b)));
    try {
      await setBankAreaAction(bankId, areaKey);
      showToast("Floor layout updated");
    } catch { showToast("Could not update floor layout"); }
    router.refresh();
  };

  const changeCapacity = async (bankId: string, delta: number) => {
    try {
      await changeBankCapacityAction(bankId, delta);
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not change capacity");
    }
  };

  const addBank = async () => {
    const name = newBankName.current?.value.trim() || `New Bank ${banks.length + 1}`;
    const cap = parseInt(newBankCap.current?.value || "4", 10) || 4;
    const areaKey = newBankArea.current?.value || areaList[0].key;
    try {
      await addBankAction(name, areaKey, cap);
      setAddingBank(false);
      router.refresh();
    } catch { showToast("Could not add bank"); }
  };

  const growWidth = async () => {
    try { await growMapWidthAction(); showToast("Map width expanded"); router.refresh(); }
    catch { showToast("Could not expand map"); }
  };
  const growZone = async (areaKey: string) => {
    const area = areaList.find((a) => a.key === areaKey);
    try { await growZoneHeightAction(areaKey); showToast(`${area?.label ?? "Area"} expanded`); router.refresh(); }
    catch { showToast("Could not expand area"); }
  };

  const doExport = async () => {
    const rows = await getMachinesForExportAction();
    const ok = exportRowsToExcel(rows, "machine-records");
    showToast(ok ? `Exported ${rows.length} machine record${rows.length === 1 ? "" : "s"} to Excel` : "No machines to export");
  };
  const triggerImport = () => fileInputRef.current?.click();
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
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
    } catch { showToast("Could not read that file — make sure it matches the template format"); }
  };

  const zoomReset = () => { setZoom(0.85); setPanX(20); setPanY(10); };

  const mapActions = [
    { icon: fullscreen ? "✕" : "⛶", label: fullscreen ? "Exit Full Screen" : "Full Screen", onClick: () => setFullscreen((v) => !v) },
    { icon: "↺", label: "Reset View", onClick: zoomReset },
    { icon: "↔", label: "Expand Width", onClick: growWidth },
    { icon: "↕", label: "Expand Map", onClick: () => growZone(areaList[areaList.length - 1].key) },
    { icon: "📄", label: "Download Template", onClick: downloadImportTemplate },
    { icon: "⭱", label: "Import from Excel", onClick: triggerImport },
    { icon: "⭳", label: "Export to Excel", onClick: doExport },
  ];

  const viewportClass = variant === "mobile"
    ? `m-map-viewport${fullscreen ? " fullscreen" : ""}`
    : `map-viewport${fullscreen ? " fullscreen" : ""}`;

  return (
    <div className={fullscreen && variant === "mobile" ? "" : undefined}>
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleImportFile} />

      {variant === "desktop" && (
        <div className="view-head">
          <div>
            <div className="view-title">Interactive Floor Map</div>
            <div className="view-sub">
              {editMode
                ? "Drag a bank by its grip handle to move it — between areas or within one. Drag machines between seats to reassign them."
                : "Click any machine to open its full record. Scroll to zoom, drag the background to pan."}
            </div>
          </div>
          <div className="view-actions">
            <button className="btn" onClick={downloadImportTemplate}>📄 Template</button>
            <button className="btn" onClick={triggerImport}>⭱ Import from Excel</button>
            <button className="btn" onClick={doExport}>⭳ Export to Excel</button>
            <button className={`btn${editMode ? " btn-active" : ""}`} onClick={toggleEditMode}>
              {editMode ? "✓ Done Editing" : "✎ Edit Layout"}
            </button>
          </div>
        </div>
      )}

      <div className={variant === "mobile" ? "m-map-legend" : "map-toolbar"}>
        <div className="map-legend">
          {areaList.map((a) => (
            <span className="map-legend-item" key={a.key}>
              <span className={`map-legend-dot ${AREA_DOT[a.key] ?? ""}`} />{a.label}
            </span>
          ))}
        </div>
        {variant === "desktop" && (
          <div className="zoom-controls">
            <button className="btn btn-small" onClick={growWidth}>↔ Expand Width</button>
            <button className="btn btn-small" onClick={() => growZone(areaList[areaList.length - 1].key)}>↕ Expand Map</button>
            <span className="toolbar-divider" />
            <button className="btn btn-small" onClick={() => setZoomAt(zoom - 0.15)}>−</button>
            <span className="mono zoom-label">{Math.round(zoom * 100)}%</span>
            <button className="btn btn-small" onClick={() => setZoomAt(zoom + 0.15)}>+</button>
            <button className="btn btn-small" onClick={zoomReset}>Reset View</button>
            <button className="btn btn-small" onClick={() => setFullscreen((v) => !v)}>{fullscreen ? "✕ Exit Full Screen" : "⛶ Full Screen"}</button>
          </div>
        )}
      </div>

      {variant === "desktop" && <div className={`map-fullscreen-backdrop${fullscreen ? " open" : ""}`} onClick={() => setFullscreen(false)} />}

      <div className={variant === "mobile" ? "m-map-wrap" : undefined}>
        <div ref={viewportRef} className={viewportClass} onMouseDown={onCanvasMouseDown}>
          <div
            className="map-canvas"
            style={{ width: mapWidth, height: mapHeight, transform: `translate(${panX}px,${panY}px) scale(${zoom})` }}
          >
            {areaList.map((a) => (
              <div key={a.key} className="map-zone" style={{ top: a.y, height: a.h }}>
                <div className="map-zone-label">
                  {a.label}
                  <button className="zone-expand-btn" onClick={() => growZone(a.key)} title="Expand this area">+ Expand Area</button>
                </div>
              </div>
            ))}

            {banks.map((bank) => (
              <BankView
                key={bank.id}
                bank={bank}
                areaLabel={areaList.find((a) => a.id === bank.areaId)?.label ?? ""}
                areas={areaList}
                editMode={editMode}
                tapSource={tapSource}
                onHandleDown={onBankHandleDown}
                onAreaChange={setBankArea}
                onCapacity={changeCapacity}
                onSlotClick={(seat, occupied) => {
                  if (editMode) onSlotTap(bank.id, seat, occupied);
                  else if (occupied) setSelectedMachine(bank.seats[seat]!.serial);
                }}
                onDragStart={(seat) => { dragSourceRef.current = { bankId: bank.id, seat }; }}
                onDrop={(seat) => {
                  if (dragSourceRef.current) moveMachine(dragSourceRef.current.bankId, dragSourceRef.current.seat, bank.id, seat);
                  dragSourceRef.current = null;
                }}
              />
            ))}
          </div>
        </div>

        {variant === "mobile" && (
          <>
            <div className="m-fab-cluster">
              <button className="m-fab" onClick={() => setZoomAt(zoom + 0.15)}>+</button>
              <div className="m-fab-zoom-label mono">{Math.round(zoom * 100)}%</div>
              <button className="m-fab" onClick={() => setZoomAt(zoom - 0.15)}>−</button>
            </div>
            <button className={`m-fab-edit${editMode ? " active" : ""}`} onClick={toggleEditMode}>{editMode ? "✓" : "✎"}</button>
            <button className="m-fab-more" onClick={() => setSheetOpen(true)}>⋯</button>
            {tapSource && <div className="m-tap-hint">Machine selected — tap a seat to move it</div>}
          </>
        )}
      </div>

      {editMode && (
        <div className={variant === "mobile" ? "m-map-below" : undefined}>
          {addingBank ? (
            <div className="add-bank-form">
              <input type="text" ref={newBankName} placeholder="Bank name, e.g. Bank 122 — West Wing" />
              <input type="number" ref={newBankCap} placeholder="Capacity" defaultValue={4} min={1} max={12} />
              <select className="bank-area-select mono" ref={newBankArea}>
                {areaList.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select>
              <button className="btn btn-primary" onClick={addBank}>Add</button>
              <button className="btn" onClick={() => setAddingBank(false)}>Cancel</button>
            </div>
          ) : (
            <button className="btn" style={{ marginTop: 14 }} onClick={() => setAddingBank(true)}>+ Add Bank</button>
          )}

          {changeLog.length > 0 && (
            <div className="map-log">
              <div className="section-label" style={{ borderTop: "none", marginTop: 18, paddingTop: 0 }}>
                Recent Map Changes
                <span className="map-log-hint">Synced to Floor Map Planning log</span>
              </div>
              {changeLog.slice(0, 6).map((c) => (
                <div className="map-log-row" key={c.id}>
                  <span className="map-log-type">{c.changeType}</span>
                  <span className="map-log-bank">{c.bankName}</span>
                  <span className="map-log-area">{c.areaLabel}</span>
                  <span className="map-log-notes">{c.notes}</span>
                  <span className="map-log-date mono">{c.ts}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ActionSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Floor Map Actions" actions={mapActions} />

      <ResponsiveOverlay open={!!selectedMachine} onClose={() => setSelectedMachine(null)}>
        {selectedMachine && (
          <MachineDrawerContent serial={selectedMachine} onClose={() => setSelectedMachine(null)} onChanged={() => router.refresh()} />
        )}
      </ResponsiveOverlay>
    </div>
  );
}

const STATUS_CLASS: Record<string, string> = { VERIFIED: "status-verified", FLAGGED: "status-flagged", PENDING: "status-pending" };

function BankView({
  bank,
  areaLabel,
  areas,
  editMode,
  tapSource,
  onHandleDown,
  onAreaChange,
  onCapacity,
  onSlotClick,
  onDragStart,
  onDrop,
}: {
  bank: FloorBank;
  areaLabel: string;
  areas: FloorArea[];
  editMode: boolean;
  tapSource: { bankId: string; seat: number } | null;
  onHandleDown: (e: React.MouseEvent | React.TouchEvent, bankId: string) => void;
  onAreaChange: (bankId: string, areaKey: string) => void;
  onCapacity: (bankId: string, delta: number) => void;
  onSlotClick: (seat: number, occupied: boolean) => void;
  onDragStart: (seat: number) => void;
  onDrop: (seat: number) => void;
}) {
  const occupiedCount = bank.seats.filter((s) => s).length;
  return (
    <div className={`bank${editMode ? " edit-mode" : ""}`} style={{ left: bank.x, top: bank.y, width: BANK_W }}>
      <div className="bank-head">
        <div className="bank-name-row">
          {editMode && (
            <div
              className="bank-drag-handle"
              title="Drag to move bank"
              onMouseDown={(e) => onHandleDown(e, bank.id)}
              onTouchStart={(e) => onHandleDown(e, bank.id)}
            >
              ⠿
            </div>
          )}
          <div>
            <div className="bank-name">{bank.name}</div>
            {editMode ? (
              <select
                className="bank-area-select mono"
                defaultValue={areas.find((a) => a.id === bank.areaId)?.key}
                onChange={(e) => onAreaChange(bank.id, e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {areas.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select>
            ) : (
              <div className="map-zone-chip">{areaLabel}</div>
            )}
          </div>
        </div>
        <div className="bank-meta">
          {editMode ? (
            <>
              <span>Capacity</span>
              <div className="capacity-stepper">
                <button onClick={() => onCapacity(bank.id, -1)}>−</button>
                <span className="mono">{bank.capacity}</span>
                <button onClick={() => onCapacity(bank.id, 1)}>+</button>
              </div>
            </>
          ) : (
            <span>Occupied {occupiedCount}/{bank.capacity}</span>
          )}
        </div>
      </div>
      <div className="machines-row">
        {bank.seats.map((seat, i) => (
          <SlotView
            key={i}
            seat={seat}
            selected={!!tapSource && tapSource.bankId === bank.id && tapSource.seat === i}
            editMode={editMode}
            onClick={() => onSlotClick(i, !!seat)}
            onDragStart={() => onDragStart(i)}
            onDrop={() => onDrop(i)}
          />
        ))}
      </div>
    </div>
  );
}

function SlotView({
  seat,
  selected,
  editMode,
  onClick,
  onDragStart,
  onDrop,
}: {
  seat: FloorSeat;
  selected: boolean;
  editMode: boolean;
  onClick: () => void;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  if (seat) {
    return (
      <div
        className={`machine${editMode ? " draggable-tile" : ""}${selected ? " slot-selected" : ""}${dragOver ? " slot-dragover" : ""}`}
        draggable={editMode}
        onDragStart={editMode ? onDragStart : undefined}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); onDrop(); }}
        onClick={onClick}
      >
        <div className="m-id">{seat.serial.replace("EGD-", "")}</div>
        <div className={`m-status ${STATUS_CLASS[seat.complianceStatus]}`} />
      </div>
    );
  }
  return (
    <div
      className={`empty-slot${selected ? " slot-selected" : ""}${dragOver ? " slot-dragover" : ""}`}
      onClick={editMode ? onClick : undefined}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); onDrop(); }}
    >
      {editMode ? (selected ? "tap dest" : "tap / drop") : ""}
    </div>
  );
}
