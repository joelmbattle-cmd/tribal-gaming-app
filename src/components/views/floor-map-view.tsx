"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useShellVariant } from "@/components/shell-variant";
import { useToast } from "@/components/toast";
import { ResponsiveOverlay } from "@/components/overlay";
import { ActionSheet } from "@/components/action-sheet";
import { MachineDrawerContent } from "@/components/machine-drawer-content";
import { downloadImportTemplate, exportRowsToExcel, readWorkbookRows } from "@/lib/excel-client";
import { getMachinesForExportAction, importMachinesAction } from "@/lib/actions/import-export";
import {
  addBankAtAction,
  changeBankCapacityAction,
  commitBankMoveAction,
  growMapWidthAction,
  growZoneHeightAction,
  moveMachineSlotAction,
  renameAreaAction,
  setBankAreaAction,
  shrinkZoneHeightAction,
} from "@/lib/actions/floor";
import { FloorSetupDialog } from "@/components/floor-setup-dialog";
import { resizeBankAction } from "@/lib/actions/floor-plan";
import { MANUAL_MIN_H, MANUAL_MIN_W, MAX_BANK_H, MAX_BANK_W } from "@/lib/floor-plan/types";
import type { BankOption, FloorArea, FloorBank, FloorPlanView, FloorSeat } from "@/lib/data/floor";

const BANK_W = 292;
const AREA_DOT: Record<string, string> = { main: "dot-main", highlimit: "dot-highlimit", other: "dot-other" };
const HIGHLIGHT_MS = 2600;
const LONG_PRESS_MS = 550;

type ChangeLogEntry = { id: string; changeType: string; bankName: string; areaLabel: string; notes: string; ts: string };

export function FloorMapView({
  areas: initialAreas,
  banks: initialBanks,
  plans,
  bankOptions,
  mapWidth: initialMapWidth,
  changeLog,
}: {
  areas: FloorArea[];
  banks: FloorBank[];
  plans: FloorPlanView[];
  bankOptions: BankOption[];
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
  const [placingBank, setPlacingBank] = useState(false);
  const [bankPopover, setBankPopover] = useState<{ canvasX: number; canvasY: number; screenX: number; screenY: number; areaLabel: string } | null>(null);
  const [zoom, setZoom] = useState(0.85);
  const [panX, setPanX] = useState(20);
  const [panY, setPanY] = useState(10);
  const [fullscreen, setFullscreen] = useState(false);
  const [tapSource, setTapSource] = useState<{ bankId: string; seat: number } | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mapQuery, setMapQuery] = useState("");
  const [mapSearchOpen, setMapSearchOpen] = useState(false);
  const [highlightBankId, setHighlightBankId] = useState<string | null>(null);
  const [highlightSerial, setHighlightSerial] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef({ x: panX, y: panY });
  const editModeRef = useRef(editMode);
  const placingBankRef = useRef(placingBank);
  // Lets the document-level pan/drag effects below read the current area
  // list without depending on it — see the [] deps note on those effects.
  const areaListRef = useRef(areaList);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = { x: panX, y: panY }; }, [panX, panY]);
  useEffect(() => { editModeRef.current = editMode; }, [editMode]);
  useEffect(() => { placingBankRef.current = placingBank; }, [placingBank]);
  useEffect(() => { areaListRef.current = areaList; }, [areaList]);

  const bankDragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  // Manual per-bank resize (edit mode). w/h track the latest size so the commit
  // on release reads the ref rather than side-effecting inside a state updater.
  const bankResizeRef = useRef<{ id: string; startX: number; startY: number; origW: number; origH: number; w: number; h: number } | null>(null);
  // Set by the Floor Setup dialog after an import; consumed once the refreshed plans arrive.
  const pendingFocusRef = useRef<string | null>(null);
  const panDragRef = useRef<{ startX: number; startY: number; origPanX: number; origPanY: number } | null>(null);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  const dragSourceRef = useRef<{ bankId: string; seat: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const popoverNameRef = useRef<HTMLInputElement>(null);
  const popoverCapRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressPointRef = useRef<{ x: number; y: number } | null>(null);
  const mapSearchRef = useRef<HTMLDivElement>(null);

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

  function screenToCanvas(clientX: number, clientY: number) {
    const viewport = viewportRef.current;
    if (!viewport) return { x: 0, y: 0 };
    const rect = viewport.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panRef.current.x) / zoomRef.current,
      y: (clientY - rect.top - panRef.current.y) / zoomRef.current,
    };
  }

  function areaLabelForY(y: number) {
    // Reads via ref (not the areaList closure) so this stays correct when
    // called from the document-level touch effect below, which registers
    // its listeners once rather than re-subscribing on every area change.
    const list = areaListRef.current;
    for (const a of list) {
      if (y >= a.y && y < a.y + a.h) return a.label;
    }
    return y < list[0].y ? list[0].label : list[list.length - 1].label;
  }

  function openBankPopoverAt(clientX: number, clientY: number) {
    const { x, y } = screenToCanvas(clientX, clientY);
    // The 220px reserve was tuned against the popover's own height on
    // desktop, which has no fixed bottom chrome to clear. On mobile it also
    // needs to clear the tab bar + safe-area-bottom inset below the map (and
    // land above the FAB row) so a bank placed near the bottom of the
    // screen doesn't render its "Place Bank"/"Cancel" buttons underneath
    // the tab bar, unreachable.
    const bottomReserve = variant === "mobile" ? 350 : 220;
    const screenX = Math.min(clientX, window.innerWidth - 280);
    const screenY = Math.max(10, Math.min(clientY, window.innerHeight - bottomReserve));
    setBankPopover({ canvasX: x, canvasY: y, screenX, screenY, areaLabel: areaLabelForY(y) });
  }

  const confirmBankPlacement = async () => {
    if (!bankPopover) return;
    const name = popoverNameRef.current?.value.trim() || `New Bank ${banks.length + 1}`;
    const cap = parseInt(popoverCapRef.current?.value || "4", 10) || 4;
    const { canvasX, canvasY } = bankPopover;
    setBankPopover(null);
    try {
      await addBankAtAction(name, canvasX, canvasY, cap);
      showToast("Bank placed on the floor map");
      router.refresh();
    } catch { showToast("Could not add bank"); }
  };

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
      if (bankResizeRef.current) {
        resizeTo(e.clientX, e.clientY);
        return;
      }
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
      if (bankResizeRef.current) {
        commitResize();
        return;
      }
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
    // Registered once: every closure above only ever reads state via a ref
    // or a functional setState update, never the `banks` value directly, so
    // there's nothing here that goes stale by not re-subscribing on every
    // bank change. Depending on [banks] previously meant these listeners
    // were torn down and re-added on every single pointermove while
    // dragging a bank (each drag step calls setBanks) — pure churn that
    // hurt drag responsiveness for no correctness benefit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resizeTo(clientX: number, clientY: number) {
    const r = bankResizeRef.current;
    if (!r) return;
    const w = Math.round(Math.min(MAX_BANK_W, Math.max(MANUAL_MIN_W, r.origW + (clientX - r.startX) / zoomRef.current)));
    const h = Math.round(Math.min(MAX_BANK_H, Math.max(MANUAL_MIN_H, r.origH + (clientY - r.startY) / zoomRef.current)));
    r.w = w;
    r.h = h;
    setBanks((bs) => bs.map((b) => (b.id === r.id ? { ...b, w, h } : b)));
  }

  function commitResize() {
    const r = bankResizeRef.current;
    bankResizeRef.current = null;
    if (!r || (r.w === r.origW && r.h === r.origH)) return;
    resizeBankAction(r.id, r.w, r.h)
      .then(() => { showToast("Bank resized"); router.refresh(); })
      .catch(() => { showToast("Could not resize bank"); router.refresh(); });
  }

  const onBankResizeDown = (e: React.MouseEvent | React.TouchEvent, bankId: string) => {
    if (!editMode) return;
    // React's touchstart is passive; the handle's `touch-action: none` already
    // stops the browser panning/scrolling, so only mouse needs preventDefault.
    if (!("touches" in e)) e.preventDefault();
    e.stopPropagation();
    const bank = banks.find((b) => b.id === bankId);
    if (!bank) return;
    const el = (e.currentTarget as HTMLElement).closest(".bank") as HTMLElement | null;
    const origW = bank.w ?? BANK_W;
    // Default-size banks have no stored height; start from what's rendered.
    const origH = bank.h ?? Math.round(el?.offsetHeight ?? MANUAL_MIN_H);
    const p = "touches" in e ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
    bankResizeRef.current = { id: bankId, startX: p.x, startY: p.y, origW, origH, w: origW, h: origH };
  };

  const resetBankSize = async (bankId: string) => {
    try {
      await resizeBankAction(bankId, null, null);
      showToast("Bank size reset");
    } catch { showToast("Could not reset bank size"); }
    router.refresh();
  };

  function fitToPlan(plan: FloorPlanView) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const z = Math.max(0.4, Math.min(1, (rect.width - 40) / (plan.width + 80), (rect.height - 40) / (plan.height + 80)));
    setZoom(z);
    setPanX(rect.width / 2 - (plan.originX + plan.width / 2) * z);
    setPanY(rect.height / 2 - (plan.originY + plan.height / 2) * z);
  }

  // After an import, bring the new floor into view once the refreshed plans land.
  useEffect(() => {
    const areaKey = pendingFocusRef.current;
    if (!areaKey) return;
    const plan = plans.find((pl) => pl.areaKey === areaKey);
    if (!plan) return;
    pendingFocusRef.current = null;
    const id = window.setTimeout(() => fitToPlan(plan), 0);
    return () => window.clearTimeout(id);
    // fitToPlan only reads refs and calls setters, so it isn't a dependency.
  }, [plans]);

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
      if (target.closest(".bank") || target.closest(".machine") || target.closest(".empty-slot") || target.closest(".bank-popover")) return;
      const p = getPoint(e);
      if (placingBankRef.current) {
        openBankPopoverAt(p.x, p.y);
        setPlacingBank(false);
        return;
      }
      panDragRef.current = { startX: p.x, startY: p.y, origPanX: panRef.current.x, origPanY: panRef.current.y };
      if (editModeRef.current) {
        longPressPointRef.current = p;
        longPressTimerRef.current = window.setTimeout(() => {
          panDragRef.current = null;
          longPressTimerRef.current = null;
          openBankPopoverAt(p.x, p.y);
        }, LONG_PRESS_MS);
      }
    }
    function onTouchMove(e: TouchEvent) {
      if (longPressTimerRef.current && longPressPointRef.current) {
        const p = getPoint(e);
        if (Math.hypot(p.x - longPressPointRef.current.x, p.y - longPressPointRef.current.y) > 10) {
          window.clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }
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
      if (bankResizeRef.current) {
        e.preventDefault();
        const p = getPoint(e);
        resizeTo(p.x, p.y);
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
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      if (e.touches.length < 2) pinchRef.current = null;
      if (bankResizeRef.current) {
        commitResize();
        return;
      }
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
    // Same reasoning as the mouse effect above: registered once. Pinch and
    // pan already read zoom/pan via refs; the one closure that used to read
    // area state directly (areaLabelForY, for the long-press bank-placement
    // popover) now reads areaListRef too, so nothing here needs banks or
    // areaList as a dependency. This was the effect actually responsible
    // for touch drag/pinch feeling choppy — every bank-drag pointermove
    // was tearing down and re-adding the touchmove listener mid-gesture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (bankPopover) { setBankPopover(null); return; }
      if (placingBank) { setPlacingBank(false); return; }
      if (fullscreen) setFullscreen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen, bankPopover, placingBank]);

  useEffect(() => {
    if (!bankPopover) return;
    function onDocDown(e: MouseEvent) {
      const el = document.querySelector(".bank-popover");
      if (el && !el.contains(e.target as Node)) setBankPopover(null);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [bankPopover]);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (mapSearchRef.current && !mapSearchRef.current.contains(e.target as Node)) setMapSearchOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

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
    if (target.closest(".bank") || target.closest(".machine") || target.closest(".empty-slot") || target.closest(".bank-popover")) return;
    if (placingBank) {
      openBankPopoverAt(e.clientX, e.clientY);
      setPlacingBank(false);
      return;
    }
    panDragRef.current = { startX: e.clientX, startY: e.clientY, origPanX: panRef.current.x, origPanY: panRef.current.y };
  };

  const onCanvasContextMenu = (e: React.MouseEvent) => {
    if (!editMode) return;
    const target = e.target as HTMLElement;
    if (target.closest(".bank") || target.closest(".machine") || target.closest(".empty-slot")) return;
    e.preventDefault();
    setPlacingBank(false);
    openBankPopoverAt(e.clientX, e.clientY);
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

  const toggleEditMode = () => { setEditMode((v) => !v); setPlacingBank(false); setBankPopover(null); setTapSource(null); };

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

  const growWidth = async () => {
    try { await growMapWidthAction(); showToast("Map width expanded"); router.refresh(); }
    catch { showToast("Could not expand map"); }
  };
  const growZone = async (areaKey: string) => {
    const area = areaList.find((a) => a.key === areaKey);
    try { await growZoneHeightAction(areaKey); showToast(`${area?.label ?? "Area"} expanded`); router.refresh(); }
    catch { showToast("Could not expand area"); }
  };
  const shrinkZone = async (areaKey: string) => {
    const area = areaList.find((a) => a.key === areaKey);
    try { await shrinkZoneHeightAction(areaKey); showToast(`${area?.label ?? "Area"} shrunk`); router.refresh(); }
    catch (err) { showToast(err instanceof Error ? err.message : "Could not shrink area"); }
  };

  const renameArea = async (areaKey: string, label: string) => {
    const trimmed = label.trim();
    const current = areaList.find((a) => a.key === areaKey);
    if (!trimmed || !current || trimmed === current.label) return;
    setAreaList((list) => list.map((a) => (a.key === areaKey ? { ...a, label: trimmed } : a)));
    try {
      await renameAreaAction(areaKey, trimmed);
      showToast("Area renamed");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not rename area");
    }
    router.refresh();
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

  type SearchHit = { key: string; label: string; sub: string; bankId: string; machineSerial?: string };
  const searchIndex: SearchHit[] = useMemo(() => {
    const hits: SearchHit[] = [];
    for (const b of banks) {
      const areaLabel = areaList.find((a) => a.id === b.areaId)?.label ?? "";
      hits.push({ key: `bank:${b.id}`, label: b.name, sub: `Bank — ${areaLabel}`, bankId: b.id });
      for (const seat of b.seats) {
        if (seat) hits.push({ key: `machine:${seat.id}`, label: seat.serial, sub: `${seat.model} — ${b.name}`, bankId: b.id, machineSerial: seat.serial });
      }
    }
    return hits;
  }, [banks, areaList]);

  const searchResults = useMemo(() => {
    const q = mapQuery.trim().toLowerCase();
    if (!q) return [];
    return searchIndex.filter((h) => h.label.toLowerCase().includes(q) || h.sub.toLowerCase().includes(q)).slice(0, 30);
  }, [searchIndex, mapQuery]);

  const focusOnHit = (hit: SearchHit) => {
    const bank = banks.find((b) => b.id === hit.bankId);
    const viewport = viewportRef.current;
    if (!bank || !viewport) return;
    const rect = viewport.getBoundingClientRect();
    const targetZoom = Math.max(zoomRef.current, 1);
    const cx = bank.x + BANK_W / 2;
    const cy = bank.y + 90;
    setZoom(targetZoom);
    setPanX(rect.width / 2 - cx * targetZoom);
    setPanY(rect.height / 2 - cy * targetZoom);
    setHighlightBankId(bank.id);
    setHighlightSerial(hit.machineSerial ?? null);
    setMapSearchOpen(false);
    setMapQuery("");
    window.setTimeout(() => { setHighlightBankId(null); setHighlightSerial(null); }, HIGHLIGHT_MS);
  };

  const mapActions = [
    { icon: fullscreen ? "✕" : "⛶", label: fullscreen ? "Exit Full Screen" : "Full Screen", onClick: () => setFullscreen((v) => !v) },
    { icon: "↺", label: "Reset View", onClick: zoomReset },
    { icon: "↔", label: "Expand Width", onClick: growWidth },
    { icon: "↕", label: "Expand Map", onClick: () => growZone(areaList[areaList.length - 1].key) },
    { icon: "🗺", label: "Floor Setup (CAD + Excel)", onClick: () => setSetupOpen(true) },
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
      {setupOpen && (
        <FloorSetupDialog
          plans={plans}
          bankOptions={bankOptions}
          onClose={() => setSetupOpen(false)}
          onPlanApplied={(areaKey) => { pendingFocusRef.current = areaKey; router.refresh(); }}
          onMachinesImported={() => router.refresh()}
        />
      )}

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
            <button className="btn" onClick={() => setSetupOpen(true)}>🗺 Floor Setup</button>
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
          {areaList.filter((a) => !plans.some((pl) => pl.areaKey === a.key)).map((a) => (
            <span className="map-legend-item" key={a.key}>
              <span className={`map-legend-dot ${AREA_DOT[a.key] ?? ""}`} />{a.label}
            </span>
          ))}
          {plans.map((pl) => (
            <button key={pl.id} type="button" className="map-plan-chip" onClick={() => fitToPlan(pl)} title="Jump to this imported floor plan">
              ⌖ {pl.name}
            </button>
          ))}
        </div>
        <div className="combobox map-search" ref={mapSearchRef}>
          <input
            type="text"
            className="search-input map-search-input"
            placeholder="Find a bank or machine…"
            value={mapQuery}
            onChange={(e) => { setMapQuery(e.target.value); setMapSearchOpen(true); }}
            onFocus={() => setMapSearchOpen(true)}
            onKeyDown={(e) => { if (e.key === "Escape") { setMapSearchOpen(false); setMapQuery(""); } }}
          />
          {mapSearchOpen && mapQuery.trim() && (
            <div className="combobox-menu">
              {searchResults.length === 0 && <div className="combobox-empty">No bank or machine matches &ldquo;{mapQuery}&rdquo;</div>}
              {searchResults.map((hit) => (
                <button type="button" key={hit.key} className="combobox-option" onMouseDown={(e) => e.preventDefault()} onClick={() => focusOnHit(hit)}>
                  <span>{hit.label}</span>
                  <span className="combobox-option-sub">{hit.sub}</span>
                </button>
              ))}
            </div>
          )}
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
        <div
          ref={viewportRef}
          className={`${viewportClass}${placingBank ? " placing-bank" : ""}`}
          onMouseDown={onCanvasMouseDown}
          onContextMenu={onCanvasContextMenu}
        >
          <div
            className="map-canvas"
            style={{ width: mapWidth, height: mapHeight, transform: `translate(${panX}px,${panY}px) scale(${zoom})` }}
          >
            <div className="map-extent-tag mono">Floor extent — {mapWidth} × {mapHeight}px</div>
            {areaList.map((a) => (
              <div key={a.key} className="map-zone" style={{ top: a.y, height: a.h }}>
                <div className="map-zone-label">
                  {editMode ? (
                    <input
                      key={a.label}
                      className="zone-label-input mono"
                      defaultValue={a.label}
                      onBlur={(e) => renameArea(a.key, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") { (e.target as HTMLInputElement).value = a.label; (e.target as HTMLInputElement).blur(); }
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                  ) : (
                    a.label
                  )}
                  <button className="zone-expand-btn" onClick={() => growZone(a.key)} title="Expand this area">+ Expand Area</button>
                  <button className="zone-expand-btn" onClick={() => shrinkZone(a.key)} title="Shrink this area">− Shrink Area</button>
                </div>
              </div>
            ))}

            {plans.map((pl) => <PlanOutline key={pl.id} plan={pl} />)}

            {banks.map((bank) => (
              <BankView
                key={bank.id}
                bank={bank}
                areaLabel={areaList.find((a) => a.id === bank.areaId)?.label ?? ""}
                areas={areaList}
                editMode={editMode}
                tapSource={tapSource}
                highlighted={bank.id === highlightBankId}
                highlightSerial={bank.id === highlightBankId ? highlightSerial : null}
                onHandleDown={onBankHandleDown}
                onResizeDown={onBankResizeDown}
                onResetSize={resetBankSize}
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

          {bankPopover && (
            <div className="bank-popover" style={{ left: bankPopover.screenX, top: bankPopover.screenY }} onMouseDown={(e) => e.stopPropagation()}>
              <div className="bank-popover-head">
                Place Bank <span className="map-zone-chip">{bankPopover.areaLabel}</span>
              </div>
              <input ref={popoverNameRef} type="text" placeholder="Bank name, e.g. Bank 122 — West Wing" autoFocus />
              <input ref={popoverCapRef} type="number" min={1} max={12} defaultValue={4} placeholder="Capacity" />
              <div className="bank-popover-actions">
                <button className="btn btn-primary btn-small" onClick={confirmBankPlacement}>Place Bank</button>
                <button className="btn btn-small" onClick={() => setBankPopover(null)}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        {variant === "mobile" && (
          <>
            <div className="m-fab-cluster">
              <button className="m-fab" onClick={() => setZoomAt(zoom + 0.15)}>+</button>
              <div className="m-fab-zoom-label mono">{Math.round(zoom * 100)}%</div>
              <button className="m-fab" onClick={() => setZoomAt(zoom - 0.15)}>−</button>
            </div>
            <button className={`m-fab-edit${editMode ? " active" : ""}`} onClick={toggleEditMode}>{editMode ? "✓" : "✎"}</button>
            {editMode && (
              <button className={`m-fab-add${placingBank ? " active" : ""}`} onClick={() => setPlacingBank((v) => !v)}>
                {placingBank ? "✕" : "+"}
              </button>
            )}
            <button className="m-fab-more" onClick={() => setSheetOpen(true)}>⋯</button>
            {tapSource && <div className="m-tap-hint">Machine selected — tap a seat to move it</div>}
            {placingBank && <div className="m-tap-hint">Tap anywhere on the map to place the new bank</div>}
          </>
        )}
      </div>

      {editMode && (
        <div className={variant === "mobile" ? "m-map-below" : undefined}>
          <div className="map-hint" style={{ marginTop: 14 }}>
            <button className={`btn${placingBank ? " btn-active" : ""}`} onClick={() => setPlacingBank((v) => !v)}>
              {placingBank ? "✕ Cancel Placement" : "+ Add Bank"}
            </button>
            <span className="map-hint-text">
              {placingBank
                ? "Click anywhere on the map to place the new bank there."
                : "Or right-click (long-press on touch) anywhere on the map to place a bank on the spot."}
            </span>
          </div>

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

function PlanOutline({ plan }: { plan: FloorPlanView }) {
  // Even-odd so courtyards / cut-outs in the outline render as holes.
  const d = plan.outline.map((ring) => `M${ring.map((p) => `${p[0]},${p[1]}`).join("L")}Z`).join("");
  return (
    <svg
      className="plan-outline"
      style={{ left: plan.originX, top: plan.originY, width: plan.width, height: plan.height }}
      viewBox={`0 0 ${plan.width} ${plan.height}`}
      aria-label={`Floor outline — ${plan.name}`}
    >
      <path d={d} fillRule="evenodd" className="plan-outline-shape" />
    </svg>
  );
}

function BankView({
  bank,
  areaLabel,
  areas,
  editMode,
  tapSource,
  highlighted,
  highlightSerial,
  onHandleDown,
  onResizeDown,
  onResetSize,
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
  highlighted: boolean;
  highlightSerial: string | null;
  onHandleDown: (e: React.MouseEvent | React.TouchEvent, bankId: string) => void;
  onResizeDown: (e: React.MouseEvent | React.TouchEvent, bankId: string) => void;
  onResetSize: (bankId: string) => void;
  onAreaChange: (bankId: string, areaKey: string) => void;
  onCapacity: (bankId: string, delta: number) => void;
  onSlotClick: (seat: number, occupied: boolean) => void;
  onDragStart: (seat: number) => void;
  onDrop: (seat: number) => void;
}) {
  const occupiedCount = bank.seats.filter((s) => s).length;
  return (
    <div
      className={`bank${editMode ? " edit-mode" : ""}${highlighted ? " bank-highlight" : ""}${bank.footprint ? " bank-cad" : ""}`}
      style={{ left: bank.x, top: bank.y, width: bank.w ?? BANK_W, ...(bank.h ? { minHeight: bank.h } : {}) }}
    >
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
      {editMode && bank.w != null && (
        <div className="bank-size-row mono">
          <span>{bank.w} × {bank.h}px</span>
          <button type="button" className="bank-size-reset" onClick={() => onResetSize(bank.id)}>↺ Reset size</button>
        </div>
      )}
      <div className="machines-row">
        {bank.seats.map((seat, i) => (
          <SlotView
            key={i}
            seat={seat}
            selected={!!tapSource && tapSource.bankId === bank.id && tapSource.seat === i}
            editMode={editMode}
            highlighted={!!seat && seat.serial === highlightSerial}
            onClick={() => onSlotClick(i, !!seat)}
            onDragStart={() => onDragStart(i)}
            onDrop={() => onDrop(i)}
          />
        ))}
      </div>
      {bank.footprint && (
        // Exact CAD footprint, drawn over the card so true shape/position stays
        // visible even when the card is larger than the footprint.
        <svg className="bank-footprint" viewBox={`0 0 ${bank.w ?? BANK_W} ${bank.h ?? 0}`} style={{ width: bank.w ?? BANK_W, height: bank.h ?? 0 }}>
          <polygon points={bank.footprint.map((p) => `${p[0]},${p[1]}`).join(" ")} />
        </svg>
      )}
      {editMode && (
        <div
          className="bank-resize-handle"
          title="Drag to resize this bank"
          onMouseDown={(e) => onResizeDown(e, bank.id)}
          onTouchStart={(e) => onResizeDown(e, bank.id)}
        />
      )}
    </div>
  );
}

function SlotView({
  seat,
  selected,
  editMode,
  highlighted,
  onClick,
  onDragStart,
  onDrop,
}: {
  seat: FloorSeat;
  selected: boolean;
  editMode: boolean;
  highlighted: boolean;
  onClick: () => void;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  if (seat) {
    return (
      <div
        className={`machine${editMode ? " draggable-tile" : ""}${selected ? " slot-selected" : ""}${dragOver ? " slot-dragover" : ""}${highlighted ? " machine-highlight" : ""}`}
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
