"use client";

export type SheetAction = { icon: string; label: string; onClick: () => void; disabled?: boolean };

/** Mobile-only bottom sheet listing actions — desktop renders these inline as buttons instead. */
export function ActionSheet({
  open,
  onClose,
  title,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  actions: SheetAction[];
}) {
  return (
    <>
      <div className={`m-scrim${open ? " open" : ""}`} onClick={onClose} />
      <div className={`m-sheet${open ? " open" : ""}`}>
        <div className="m-sheet-handle" />
        <div className="m-sheet-title">{title}</div>
        {actions.map((a, i) => (
          <button
            key={i}
            className="m-sheet-row"
            disabled={a.disabled}
            onClick={() => {
              onClose();
              a.onClick();
            }}
          >
            <span className="m-sheet-row-icon">{a.icon}</span>
            <div className="m-sheet-row-title" style={{ flex: 1 }}>
              {a.label}
            </div>
          </button>
        ))}
        <div className="m-sheet-safe-pad" />
      </div>
    </>
  );
}
