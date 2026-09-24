"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useToast } from "@/components/toast";
import { applyFloorPlanAction } from "@/lib/actions/floor-plan";
import { importMachinesAction } from "@/lib/actions/import-export";
import { extractPlan, guessLayers, layoutPlan, parseDxfScene } from "@/lib/floor-plan/dxf";
import type { DxfScene } from "@/lib/floor-plan/dxf";
import { ASSIGN_CREATE, ASSIGN_SKIP, buildBankMatcher } from "@/lib/floor-plan/bank-match";
import { IMPORT_FIELDS, applyMapping, guessMapping } from "@/lib/floor-plan/excel-columns";
import type { ColumnMapping, ImportFieldKey } from "@/lib/floor-plan/excel-columns";
import { DEFAULT_PLAN_WIDTH, MAX_PLAN_BANKS } from "@/lib/floor-plan/types";
import type { BankOption, FloorPlanView } from "@/lib/data/floor";

const IMPORT_CHUNK = 250;
const MAX_DXF_BYTES = 60 * 1024 * 1024;
const MAX_XLSX_BYTES = 25 * 1024 * 1024;

type Step = "cad" | "excel";
type ExcelSheet = { headers: string[]; rows: Record<string, unknown>[] };

export function FloorSetupDialog({
  plans,
  bankOptions,
  onClose,
  onPlanApplied,
  onMachinesImported,
}: {
  plans: FloorPlanView[];
  bankOptions: BankOption[];
  onClose: () => void;
  onPlanApplied: (areaKey: string) => void;
  onMachinesImported: () => void;
}) {
  const [step, setStep] = useState<Step>("cad");
  const [busy, setBusy] = useState<string | null>(null);
  // Outcome of the last floor-plan create/update, shown on both tabs so it
  // survives the auto-advance to the Excel step.
  const [planNote, setPlanNote] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  return (
    <div className="setup-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="setup-dialog" role="dialog" aria-modal="true" aria-label="Floor setup">
        <div className="setup-head">
          <div>
            <div className="setup-title">Floor Setup</div>
            <div className="setup-sub">
              Build your floor from an AutoCAD drawing, then load your slot list. Everything here is added alongside the
              existing floor — nothing already on the map is moved, replaced or deleted.
            </div>
          </div>
          <button className="btn btn-small" onClick={onClose} disabled={!!busy}>✕ Close</button>
        </div>

        <div className="setup-tabs" role="tablist">
          <button role="tab" aria-selected={step === "cad"} className={`setup-tab${step === "cad" ? " active" : ""}`} onClick={() => setStep("cad")}>
            1 · Floor plan (DXF)
          </button>
          <button role="tab" aria-selected={step === "excel"} className={`setup-tab${step === "excel" ? " active" : ""}`} onClick={() => setStep("excel")}>
            2 · Machines (Excel)
          </button>
        </div>

        <div className="setup-body">
          {planNote && <div className="setup-msg setup-msg-ok" role="status">✓ {planNote}</div>}
          {/* Both steps stay mounted so a parsed drawing / mapping survives tab switches. */}
          <div className="setup-pane" hidden={step !== "cad"}>
            <CadStep
              plans={plans}
              busy={busy}
              setBusy={setBusy}
              onApplied={(areaKey, note) => { setPlanNote(note); onPlanApplied(areaKey); setStep("excel"); }}
              onNewFile={() => setPlanNote(null)}
            />
          </div>
          <div className="setup-pane" hidden={step !== "excel"}>
            <ExcelStep bankOptions={bankOptions} busy={busy} setBusy={setBusy} onImported={onMachinesImported} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — DXF
// ---------------------------------------------------------------------------

function CadStep({
  plans,
  busy,
  setBusy,
  onApplied,
  onNewFile,
}: {
  plans: FloorPlanView[];
  busy: string | null;
  setBusy: (v: string | null) => void;
  onApplied: (areaKey: string, note: string) => void;
  onNewFile: () => void;
}) {
  const showToast = useToast();
  const [fileName, setFileName] = useState("");
  const [scene, setScene] = useState<DxfScene | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outlineLayers, setOutlineLayers] = useState<string[]>([]);
  const [bankLayers, setBankLayers] = useState<string[]>([]);
  const [planName, setPlanName] = useState("");
  const [width, setWidth] = useState(DEFAULT_PLAN_WIDTH);
  const [targetPlanId, setTargetPlanId] = useState("");
  const [applied, setApplied] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setApplied(null);
    setScene(null);
    onNewFile();
    if (/\.dwg$/i.test(file.name)) {
      setError("DWG is AutoCAD's proprietary binary format, which can't be read reliably in the browser. In AutoCAD choose SAVEAS → “AutoCAD DXF” (2013 or later) and upload that file.");
      return;
    }
    if (!/\.dxf$/i.test(file.name)) {
      setError("Please choose a .dxf file.");
      return;
    }
    if (file.size > MAX_DXF_BYTES) {
      setError("That DXF is over 60 MB. Purge unused blocks/layers in AutoCAD (PURGE) or export just the gaming floor.");
      return;
    }
    setBusy("Reading drawing…");
    await new Promise((r) => setTimeout(r, 30)); // let the busy state paint before the synchronous parse
    try {
      const parsed = parseDxfScene(await file.text());
      const guess = guessLayers(parsed);
      setScene(parsed);
      setFileName(file.name);
      setPlanName(file.name.replace(/\.dxf$/i, "").replace(/[_-]+/g, " ").trim() || "Imported floor");
      setOutlineLayers(guess.outlineLayers);
      setBankLayers(guess.bankLayers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that DXF.");
    } finally {
      setBusy(null);
    }
  }

  const result = useMemo(() => {
    if (!scene) return null;
    if (!bankLayers.length) return { ok: false, error: "Pick the layer(s) that hold the bank footprints." } as const;
    try {
      const extracted = extractPlan(scene, { outlineLayers, bankLayers });
      const laid = layoutPlan(extracted, width);
      return { ok: true, extracted, laid } as const;
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Could not build a floor from those layers." } as const;
    }
  }, [scene, outlineLayers, bankLayers, width]);

  const ready = result?.ok ? result : null;
  const warnings = [...(scene?.warnings ?? []), ...(ready ? [...ready.extracted.warnings, ...ready.laid.warnings] : [])];
  const target = plans.find((p) => p.id === targetPlanId) ?? null;

  const toggle = (list: string[], set: (v: string[]) => void, name: string) =>
    set(list.includes(name) ? list.filter((n) => n !== name) : [...list, name]);

  async function apply() {
    if (!ready || !scene) return;
    setBusy("Creating floor…");
    try {
      const res = await applyFloorPlanAction({
        ...ready.laid.plan,
        name: planName.trim() || "Imported floor",
        sourceFile: fileName,
        units: scene.units,
        targetPlanId: targetPlanId || undefined,
      });
      const bits = [`${res.created} bank${res.created === 1 ? "" : "s"} added`];
      if (res.updated) bits.push(`${res.updated} repositioned`);
      if (res.missing) bits.push(`${res.missing} not in drawing (left as-is)`);
      if (res.renamed.length) bits.push(`${res.renamed.length} renamed to avoid duplicate names`);
      const name = planName.trim() || "Imported floor";
      const note = `Floor plan “${name}” ${targetPlanId ? "updated" : "created"} — ${bits.join(", ")}. Now load your slot list.`;
      setApplied(note);
      showToast(`Floor plan ${targetPlanId ? "updated" : "created"} — ${bits[0]}`);
      onApplied(res.areaKey, note);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the floor plan.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="setup-step">
      <p className="setup-help">
        Upload a <b>DXF</b> export of your gaming floor. We read the floor outline and one closed shape per bank, keep their true
        proportions, and place every bank at its drawn position. DWG files: use <span className="mono">SAVEAS → AutoCAD DXF</span> first.
      </p>

      <label className="setup-file">
        <input type="file" accept=".dxf" onChange={onFile} disabled={!!busy} />
        <span className="btn">{scene ? "Choose a different DXF…" : "Choose DXF file…"}</span>
        {fileName && <span className="mono setup-filename">{fileName}</span>}
      </label>

      {error && <div className="setup-msg setup-msg-error" role="alert">{error}</div>}
      {busy && <div className="setup-msg">{busy}</div>}

      {scene && (
        <>
          <div className="setup-grid">
            <fieldset className="setup-fieldset">
              <legend>Floor outline layer(s)</legend>
              <LayerList layers={scene.layers} selected={outlineLayers} onToggle={(n) => toggle(outlineLayers, setOutlineLayers, n)} />
              <div className="setup-note">Optional. Without one, the floor is the bounding box of the banks.</div>
            </fieldset>
            <fieldset className="setup-fieldset">
              <legend>Bank footprint layer(s)</legend>
              <LayerList layers={scene.layers} selected={bankLayers} onToggle={(n) => toggle(bankLayers, setBankLayers, n)} />
              <div className="setup-note">One closed shape per bank. Text inside a shape becomes its name.</div>
            </fieldset>
          </div>

          <div className="setup-row">
            <label className="setup-field">
              <span>Floor name</span>
              <input type="text" value={planName} maxLength={80} onChange={(e) => setPlanName(e.target.value)} />
            </label>
            <label className="setup-field">
              <span>Plan width (px)</span>
              <input type="number" min={800} max={12000} step={100} value={width} onChange={(e) => setWidth(Math.min(12000, Math.max(800, Number(e.target.value) || DEFAULT_PLAN_WIDTH)))} />
            </label>
            <label className="setup-field">
              <span>Apply as</span>
              <select value={targetPlanId} onChange={(e) => setTargetPlanId(e.target.value)}>
                <option value="">New floor plan (alongside existing)</option>
                {plans.map((p) => <option key={p.id} value={p.id}>Update “{p.name}” (repositions its banks)</option>)}
              </select>
            </label>
          </div>

          {result && !result.ok && <div className="setup-msg setup-msg-error">{result.error}</div>}

          {ready && (
            <>
              <PlanPreview plan={ready.laid.plan} />
              <div className="setup-stats mono">
                {ready.laid.plan.banks.length} bank{ready.laid.plan.banks.length === 1 ? "" : "s"} · {ready.laid.plan.width} × {ready.laid.plan.height}px
                {scene.units ? ` · drawing in ${scene.units}` : ""}
                {ready.laid.plan.banks.length > MAX_PLAN_BANKS ? ` · over the ${MAX_PLAN_BANKS}-bank limit` : ""}
              </div>
              {warnings.length > 0 && (
                <ul className="setup-warnings">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              )}
              {target && (
                <div className="setup-note">
                  Updating matches banks by their drawing handle/label and repositions them — sizes you changed by hand on those banks are overwritten.
                  Machines, capacities and names are kept; banks missing from the drawing are left alone.
                </div>
              )}
              <div className="setup-actions">
                <button className="btn btn-primary" onClick={apply} disabled={!!busy || !!applied || ready.laid.plan.banks.length > MAX_PLAN_BANKS}>
                  {applied ? "✓ Created" : targetPlanId ? "Update floor plan" : "Create floor plan"}
                </button>
                {applied && <span className="setup-note">Choose a different DXF to import another floor, or continue to step 2.</span>}
              </div>
            </>
          )}
        </>
      )}

    </div>
  );
}

function LayerList({ layers, selected, onToggle }: { layers: DxfScene["layers"]; selected: string[]; onToggle: (name: string) => void }) {
  const usable = layers.filter((l) => l.rings > 0);
  if (!usable.length) return <div className="setup-note">No closed shapes found on any layer.</div>;
  return (
    <div className="setup-layers">
      {usable.map((l) => (
        <label key={l.name} className="setup-check">
          <input type="checkbox" checked={selected.includes(l.name)} onChange={() => onToggle(l.name)} />
          <span className="mono">{l.name}</span>
          <span className="setup-count">{l.rings} shape{l.rings === 1 ? "" : "s"}</span>
        </label>
      ))}
    </div>
  );
}

function PlanPreview({ plan }: { plan: { width: number; height: number; outline: [number, number][][]; banks: { label: string; x: number; y: number; w: number; h: number; footprint: [number, number][] }[] } }) {
  const outline = plan.outline.map((r) => `M${r.map((p) => `${p[0]},${p[1]}`).join("L")}Z`).join("");
  const fs = Math.max(10, plan.width / 110);
  return (
    <svg className="setup-preview" viewBox={`0 0 ${plan.width} ${plan.height}`} role="img" aria-label="Preview of the imported floor">
      <path d={outline} fillRule="evenodd" className="plan-outline-shape" />
      {plan.banks.map((b, i) => (
        <g key={i} transform={`translate(${b.x} ${b.y})`}>
          <polygon points={b.footprint.map((p) => `${p[0]},${p[1]}`).join(" ")} className="setup-preview-bank" />
          <text x={b.w / 2} y={b.h / 2} fontSize={fs} textAnchor="middle" dominantBaseline="middle" className="setup-preview-label">{b.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Excel
// ---------------------------------------------------------------------------

function ExcelStep({
  bankOptions,
  busy,
  setBusy,
  onImported,
}: {
  bankOptions: BankOption[];
  busy: string | null;
  setBusy: (v: string | null) => void;
  onImported: () => void;
}) {
  const showToast = useToast();
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<Record<string, ExcelSheet> | null>(null);
  const [sheetName, setSheetName] = useState("");
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const sheet = sheets && sheetName ? sheets[sheetName] : null;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setSummary(null);
    setSheets(null);
    if (file.size > MAX_XLSX_BYTES) {
      setError("That file is over 25 MB — split the slot list into several files.");
      return;
    }
    setBusy("Reading spreadsheet…");
    await new Promise((r) => setTimeout(r, 30));
    try {
      const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array", cellDates: true });
      const out: Record<string, ExcelSheet> = {};
      for (const name of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], { defval: "" });
        if (!rows.length) continue;
        const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((h) => !h.startsWith("__EMPTY"));
        out[name] = { headers, rows };
      }
      const names = Object.keys(out);
      if (!names.length) throw new Error("No rows found. The first row of a sheet must be column headings.");
      const first = names.includes("Machines") ? "Machines" : names[0];
      setSheets(out);
      setSheetName(first);
      setMapping(guessMapping(out[first].headers));
      setAssignments({});
      setFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that spreadsheet.");
    } finally {
      setBusy(null);
    }
  }

  function chooseSheet(name: string) {
    if (!sheets) return;
    setSheetName(name);
    setMapping(guessMapping(sheets[name].headers));
    setAssignments({});
  }

  const missingRequired = mapping ? IMPORT_FIELDS.filter((f) => f.required && !mapping[f.key]).map((f) => f.key) : [];

  // Bank-text → match preview (same matcher the server uses).
  const bankReport = useMemo(() => {
    if (!sheet || !mapping || !mapping.Bank) return null;
    const matcher = buildBankMatcher(bankOptions.map((b) => ({ id: b.id, name: b.name, tagMatch: b.tagMatch })));
    const counts = new Map<string, number>();
    let blank = 0;
    for (const row of sheet.rows) {
      const text = String(row[mapping.Bank] ?? "").trim();
      if (!text) blank++;
      else counts.set(text, (counts.get(text) ?? 0) + 1);
    }
    const nameOf = new Map(bankOptions.map((b) => [b.id, b.name]));
    const matched: { text: string; rows: number; bank: string; how: string }[] = [];
    const unmatched: { text: string; rows: number }[] = [];
    for (const [text, rows] of counts) {
      const hit = matcher(text);
      if (hit) matched.push({ text, rows, bank: nameOf.get(hit.id) ?? hit.id, how: hit.how });
      else unmatched.push({ text, rows });
    }
    unmatched.sort((a, b) => b.rows - a.rows || a.text.localeCompare(b.text));
    return { matched, unmatched, blank };
  }, [sheet, mapping, bankOptions]);

  const choiceFor = (text: string) => assignments[text] ?? ASSIGN_SKIP;
  const skippedRows = bankReport
    ? bankReport.unmatched.filter((u) => choiceFor(u.text) === ASSIGN_SKIP).reduce((n, u) => n + u.rows, 0) + bankReport.blank
    : 0;
  const totalRows = sheet?.rows.length ?? 0;
  const importable = totalRows - skippedRows;

  const orderedBanks = useMemo(
    () => [...bankOptions].sort((a, b) => Number(b.tagMatch) - Number(a.tagMatch) || a.name.localeCompare(b.name, undefined, { numeric: true })),
    [bankOptions],
  );

  async function runImport() {
    if (!sheet || !mapping || missingRequired.length || !bankReport) return;
    const rows = applyMapping(sheet.rows, mapping);
    const totals = { created: 0, updated: 0, banksCreated: 0, skipped: 0 };
    try {
      for (let i = 0; i < rows.length; i += IMPORT_CHUNK) {
        setBusy(`Importing machines… ${Math.min(i + IMPORT_CHUNK, rows.length)} / ${rows.length}`);
        const res = await importMachinesAction(rows.slice(i, i + IMPORT_CHUNK), {
          fuzzyBankMatch: true,
          growToSeat: true,
          unmatchedBanks: "skip",
          bankAssignments: assignments,
          chunkLabel: `Floor setup, rows ${i + 1}–${Math.min(i + IMPORT_CHUNK, rows.length)}`,
        });
        totals.created += res.created;
        totals.updated += res.updated;
        totals.banksCreated += res.banksCreated;
        totals.skipped += res.skipped;
      }
      const parts = [`${totals.created} added`, `${totals.updated} updated`];
      if (totals.banksCreated) parts.push(`${totals.banksCreated} new bank${totals.banksCreated === 1 ? "" : "s"}`);
      if (totals.skipped) parts.push(`${totals.skipped} skipped`);
      setSummary(parts.join(", "));
      showToast(`Machines imported — ${parts.join(", ")}`);
      onImported();
    } catch (err) {
      setError(
        `${err instanceof Error ? err.message : "Import failed."} Rows already processed were saved — re-running is safe (machines match by serial number).`,
      );
      onImported();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="setup-step">
      <p className="setup-help">
        Upload your slot list (.xlsx / .xls). Confirm which column is which, and any <b>Bank</b> value that doesn&apos;t match a bank
        on the map can be assigned by hand. Machines are matched by <b>serial number</b> — re-importing updates instead of duplicating.
      </p>

      <label className="setup-file">
        <input type="file" accept=".xlsx,.xls" onChange={onFile} disabled={!!busy} />
        <span className="btn">{sheet ? "Choose a different file…" : "Choose Excel file…"}</span>
        {fileName && <span className="mono setup-filename">{fileName}</span>}
      </label>

      {error && <div className="setup-msg setup-msg-error" role="alert">{error}</div>}
      {busy && <div className="setup-msg">{busy}</div>}

      {sheet && mapping && (
        <>
          {sheets && Object.keys(sheets).length > 1 && (
            <label className="setup-field">
              <span>Sheet</span>
              <select value={sheetName} onChange={(e) => chooseSheet(e.target.value)}>
                {Object.keys(sheets).map((n) => <option key={n} value={n}>{n} ({sheets[n].rows.length} rows)</option>)}
              </select>
            </label>
          )}

          <div className="setup-section-title">Column mapping <span className="setup-count">{totalRows} rows</span></div>
          <div className="setup-table-wrap">
            <table className="setup-table">
              <thead><tr><th>Machine field</th><th>Your column</th><th>First row</th></tr></thead>
              <tbody>
                {IMPORT_FIELDS.map((f) => {
                  const src = mapping[f.key];
                  const sample = src ? String(sheet.rows[0]?.[src] instanceof Date ? (sheet.rows[0][src] as Date).toISOString().slice(0, 10) : (sheet.rows[0]?.[src] ?? "")) : "";
                  return (
                    <tr key={f.key} className={f.required && !src ? "setup-row-missing" : undefined}>
                      <td>{f.key}{f.required && <span className="setup-req" title="Required"> *</span>}</td>
                      <td>
                        <select
                          value={src}
                          aria-label={`Column for ${f.key}`}
                          onChange={(e) => setMapping({ ...mapping, [f.key as ImportFieldKey]: e.target.value })}
                        >
                          <option value="">— not in this file —</option>
                          {sheet.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </td>
                      <td className="mono setup-sample">{sample}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {missingRequired.length > 0 && <div className="setup-msg setup-msg-error">Map the required column{missingRequired.length > 1 ? "s" : ""}: {missingRequired.join(", ")}.</div>}

          {bankReport && (
            <>
              <div className="setup-section-title">
                Bank matching
                <span className="setup-count">{bankReport.matched.length} matched · {bankReport.unmatched.length} unmatched</span>
              </div>

              {bankReport.unmatched.length > 0 && (
                <>
                  <div className="setup-note">
                    These Bank values don&apos;t match any bank on the map. Assign each to a bank, create it as a new bank, or skip its rows.
                  </div>
                  <div className="setup-bulk">
                    <button className="btn btn-small" onClick={() => setAssignments(Object.fromEntries(bankReport.unmatched.map((u) => [u.text, ASSIGN_CREATE])))}>Create all as new banks</button>
                    <button className="btn btn-small" onClick={() => setAssignments({})}>Skip all</button>
                  </div>
                  <div className="setup-table-wrap">
                    <table className="setup-table">
                      <thead><tr><th>Bank in Excel</th><th>Rows</th><th>Place on</th></tr></thead>
                      <tbody>
                        {bankReport.unmatched.slice(0, 200).map((u) => (
                          <tr key={u.text}>
                            <td className="mono">{u.text}</td>
                            <td>{u.rows}</td>
                            <td>
                              <select value={choiceFor(u.text)} aria-label={`Assignment for ${u.text}`} onChange={(e) => setAssignments({ ...assignments, [u.text]: e.target.value })}>
                                <option value={ASSIGN_SKIP}>Skip these rows</option>
                                <option value={ASSIGN_CREATE}>Create as a new bank (Main Floor)</option>
                                {orderedBanks.map((b) => <option key={b.id} value={b.id}>{b.name}{b.tagMatch ? "" : " (existing)"}</option>)}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {bankReport.unmatched.length > 200 && <div className="setup-note">Showing the 200 largest of {bankReport.unmatched.length}; the rest are skipped.</div>}
                </>
              )}

              {bankReport.matched.some((m) => m.how === "tag") && (
                <details className="setup-details">
                  <summary>{bankReport.matched.filter((m) => m.how === "tag").length} matched by bank number — review</summary>
                  <ul className="setup-warnings setup-matches">
                    {bankReport.matched.filter((m) => m.how === "tag").map((m) => (
                      <li key={m.text}><span className="mono">{m.text}</span> → {m.bank} <span className="setup-count">{m.rows} rows</span></li>
                    ))}
                  </ul>
                </details>
              )}
              {bankReport.blank > 0 && <div className="setup-note">{bankReport.blank} row(s) have no Bank value and will be skipped.</div>}
            </>
          )}

          <div className="setup-actions">
            <button className="btn btn-primary" onClick={runImport} disabled={!!busy || missingRequired.length > 0 || importable <= 0}>
              Import {importable > 0 ? importable : 0} machine row{importable === 1 ? "" : "s"}
            </button>
            {skippedRows > 0 && <span className="setup-note">{skippedRows} row(s) will be skipped.</span>}
          </div>
        </>
      )}

      {summary && <div className="setup-msg setup-msg-ok">Import complete — {summary}.</div>}
    </div>
  );
}
