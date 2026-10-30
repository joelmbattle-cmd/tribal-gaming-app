"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ConfirmOptions = {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

/**
 * Shared confirmation modal for destructive / hard-to-undo actions.
 * Centered card over the existing `.scrim`; Escape or scrim click cancels.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmOptions & {
  open: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onCancel]);

  if (!open || typeof document === "undefined") return null;

  // Portal to <body>: drawers use transform, which would trap position:fixed.
  return createPortal(
    <>
      <div className="scrim open" style={{ zIndex: 200 }} onClick={() => !pending && onCancel()} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="confirm-dialog"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 201,
          width: "min(420px, calc(100vw - 32px))",
          background: "var(--panel)",
          border: "1px solid var(--hairline-strong)",
          borderRadius: 10,
          padding: 20,
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
        }}
      >
        <div id="confirm-dialog-title" className="drawer-title" style={{ marginBottom: 8 }}>{title}</div>
        {description && <div className="field-label" style={{ marginBottom: 16, lineHeight: 1.5 }}>{description}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn" disabled={pending} onClick={onCancel}>{cancelLabel}</button>
          <button
            ref={confirmRef}
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

/**
 * One dialog instance per view: `confirm(options, action)` opens the dialog;
 * the action runs only when the user confirms. Render `dialog` once.
 */
export function useConfirm(pending = false) {
  const [state, setState] = useState<(ConfirmOptions & { action: () => void }) | null>(null);
  const cancel = useCallback(() => setState(null), []);
  const confirm = useCallback((options: ConfirmOptions, action: () => void) => {
    setState({ ...options, action });
  }, []);
  const dialog = (
    <ConfirmDialog
      open={!!state}
      title={state?.title ?? ""}
      description={state?.description}
      confirmLabel={state?.confirmLabel}
      cancelLabel={state?.cancelLabel}
      danger={state?.danger}
      pending={pending}
      onCancel={cancel}
      onConfirm={() => {
        const action = state?.action;
        setState(null);
        action?.();
      }}
    />
  );
  return { confirm, dialog };
}
