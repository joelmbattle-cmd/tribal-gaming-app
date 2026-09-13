export const BANK_W = 292;
export const EDGE_GROW = 500;
export const MAX_BANK_CAPACITY = 12;
export const MIN_AREA_HEIGHT = 160;

// Mirrors the .bank / .machines-row CSS box model (bank padding, header row,
// 60px seats with 10px gaps, 3 seats per BANK_W-wide row) so the server can
// estimate a bank's rendered height without measuring the DOM.
const BANK_SEATS_PER_ROW = 3;
const BANK_HEIGHT_BASE = 70;
const BANK_ROW_H = 70;

export function estimateBankHeight(capacity: number) {
  const rows = Math.max(1, Math.ceil(capacity / BANK_SEATS_PER_ROW));
  return BANK_HEIGHT_BASE + rows * BANK_ROW_H;
}
