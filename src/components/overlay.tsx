"use client";

import { useShellVariant } from "@/components/shell-variant";

/**
 * Desktop: right-side slide-in drawer. Mobile: bottom sheet. Same content,
 * genuinely different chrome per shell (R2/general mobile requirement) —
 * not a CSS resize of one panel.
 */
export function ResponsiveOverlay({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const variant = useShellVariant();

  if (variant === "mobile") {
    return (
      <>
        <div className={`m-scrim${open ? " open" : ""}`} onClick={onClose} />
        <div className={`m-sheet${open ? " open" : ""}`} style={{ maxHeight: "88vh" }}>
          <div className="m-sheet-handle" />
          {open ? children : null}
        </div>
      </>
    );
  }

  return (
    <>
      <div className={`scrim${open ? " open" : ""}`} onClick={onClose} />
      <div className={`drawer${open ? " open" : ""}`}>{open ? children : null}</div>
    </>
  );
}
