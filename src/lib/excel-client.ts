import * as XLSX from "xlsx";

const IMPORT_HEADERS = [
  "Serial Number", "Asset Number", "Area", "Bank", "Seat", "Manufacturer", "Model",
  "Game Theme", "PAR Sheet", "Seal Number", "Compliance Status", "Software Status", "Status Since",
];

export function downloadImportTemplate() {
  const example = {
    "Serial Number": "EGD-99001", "Asset Number": "A-9001", Area: "Main Floor", Bank: "Bank 104 — Main Floor North",
    Seat: "", Manufacturer: "IGT", Model: "Peak S30", "Game Theme": "Wolf Run Gold", "PAR Sheet": "PAR-8842-B",
    "Seal Number": "SL-99001", "Compliance Status": "Pending", "Software Status": "Needs Update", "Status Since": "2026-08-21",
  };
  const wsMachines = XLSX.utils.json_to_sheet([example], { header: IMPORT_HEADERS });
  wsMachines["!cols"] = IMPORT_HEADERS.map((h) => ({ wch: Math.max(h.length + 2, 16) }));

  const legendRows = [
    ["Column", "Required?", "Notes"],
    ["Serial Number", "Yes", "Unique machine ID (e.g. EGD-10412). If this Serial Number already exists on the floor, the row updates that machine's record instead of creating a duplicate."],
    ["Asset Number", "No", "Internal asset tag."],
    ["Area", "No — defaults to Main Floor", "One of: Main Floor, High Limit, Other. Not case-sensitive."],
    ["Bank", "Yes", 'Bank name, e.g. "Bank 104 — Main Floor North". If no bank with this exact name exists yet, it is created automatically in the Area given above.'],
    ["Seat", "No", "Seat number within the bank (1, 2, 3…). If left blank, already occupied, or invalid, the next open seat is used automatically. Bank capacity expands automatically if every seat is already full."],
    ["Manufacturer", "No", ""],
    ["Model", "No", ""],
    ["Game Theme", "No", ""],
    ["PAR Sheet", "No", ""],
    ["Seal Number", "No", ""],
    ["Compliance Status", "No — defaults to Pending", "One of: Verified, Flagged, Pending."],
    ["Software Status", "No", "Free text, e.g. Compliant, Needs Update, Conditionally Revoked, Revoked."],
    ["Status Since", "No", "Date the current status began, e.g. 2026-08-21."],
    ["", "", ""],
    ["How import works", "", "Existing machines are matched by Serial Number and updated in place. New Serial Numbers are added as new machines. New Bank names are created automatically and placed on the map in the specified Area — capacity grows automatically as needed. Nothing is deleted by an import."],
  ];
  const wsLegend = XLSX.utils.aoa_to_sheet(legendRows);
  wsLegend["!cols"] = [{ wch: 20 }, { wch: 26 }, { wch: 90 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsMachines, "Machines");
  XLSX.utils.book_append_sheet(wb, wsLegend, "Legend");
  XLSX.writeFile(wb, "machine-import-template.xlsx");
}

export function exportRowsToExcel(rows: Record<string, unknown>[], filenamePrefix: string) {
  if (!rows.length) return false;
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Object.keys(rows[0]).map((k) => ({ wch: Math.max(k.length + 2, 14) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Machine Records");
  XLSX.writeFile(wb, `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  return true;
}

export function readWorkbookRows(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheetName = wb.SheetNames.includes("Machines") ? "Machines" : wb.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" }) as Record<string, unknown>[];
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsArrayBuffer(file);
  });
}
