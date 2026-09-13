"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Square viewport shown to the operator while adjusting. The circular guide
// drawn over it previews how the photo will read as the round list avatar,
// but the captured region stays square so the same file also fills the
// rectangular photo-frame in the detail drawer without letterboxing.
const VIEWPORT = 260;
const OUTPUT = 480;
const MAX_ZOOM = 3;

type Offset = { x: number; y: number };

/**
 * Pan/zoom photo cropper shown right after a file is picked, for both the
 * Licensing and Self-Exclusion photo uploads. Pure canvas + CSS transforms —
 * no cropping library — since all it needs is a drag-to-pan viewport, a zoom
 * slider, and a canvas draw on confirm.
 */
export function PhotoAdjuster({
  file,
  onCancel,
  onConfirm,
}: {
  file: File;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
}) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    // The object URL is the external resource this effect connects to; the
    // state below just holds its current value for the <img src>. Under
    // StrictMode's dev double-invoke (setup/cleanup/setup) this creates and
    // revokes a first URL, then creates and stores a second — the img always
    // ends up pointed at a live URL, whereas lazily creating it once in
    // useState would have the double-invoked cleanup revoke the only copy.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setImgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const baseScale = natural ? Math.max(VIEWPORT / natural.w, VIEWPORT / natural.h) : 1;
  const scale = baseScale * zoom;
  const dispW = natural ? natural.w * scale : 0;
  const dispH = natural ? natural.h * scale : 0;

  // Keeps the image covering the full viewport at all times — the operator
  // can pan within the overflow, but never past the edge into empty space.
  const clamp = useCallback((x: number, y: number, w: number, h: number) => {
    const minX = Math.min(0, VIEWPORT - w);
    const minY = Math.min(0, VIEWPORT - h);
    return { x: Math.max(minX, Math.min(0, x)), y: Math.max(minY, Math.min(0, y)) };
  }, []);

  const onImgLoad = () => {
    const el = imgRef.current;
    if (!el) return;
    const w = el.naturalWidth;
    const h = el.naturalHeight;
    setNatural({ w, h });
    const bScale = Math.max(VIEWPORT / w, VIEWPORT / h);
    setOffset({ x: (VIEWPORT - w * bScale) / 2, y: (VIEWPORT - h * bScale) / 2 });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: offset.x, origY: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset(clamp(dragRef.current.origX + dx, dragRef.current.origY + dy, dispW, dispH));
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const handleZoom = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = Number(e.target.value);
    if (natural) {
      // Re-anchor on the viewport center so zooming doesn't yank the framed
      // face off to one side.
      const oldScale = baseScale * zoom;
      const newScale = baseScale * newZoom;
      const ratio = newScale / oldScale;
      const cx = VIEWPORT / 2 - offset.x;
      const cy = VIEWPORT / 2 - offset.y;
      const nextX = VIEWPORT / 2 - cx * ratio;
      const nextY = VIEWPORT / 2 - cy * ratio;
      setOffset(clamp(nextX, nextY, natural.w * newScale, natural.h * newScale));
    }
    setZoom(newZoom);
  };

  const confirm = () => {
    const el = imgRef.current;
    if (!el || !natural) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const sx = -offset.x / scale;
    const sy = -offset.y / scale;
    const sSize = VIEWPORT / scale;
    ctx.drawImage(el, sx, sy, sSize, sSize, 0, 0, OUTPUT, OUTPUT);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const cropped = new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
        onConfirm(cropped);
      },
      "image/jpeg",
      0.9,
    );
  };

  return (
    <div className="photo-adjuster-backdrop" onClick={onCancel}>
      <div className="photo-adjuster-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-eyebrow">Photo Adjustment</div>
        <div className="drawer-title" style={{ fontSize: 18, marginBottom: 8 }}>Center the Face</div>
        <div className="field-label" style={{ marginBottom: 12, textTransform: "none", letterSpacing: 0 }}>
          Drag to reposition and use the slider to zoom — center the face inside the circle before saving.
        </div>
        <div
          className="photo-adjuster-viewport"
          style={{ width: VIEWPORT, height: VIEWPORT }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {imgUrl && (
            // Plain <img>: this is a local blob URL being drawn to canvas,
            // not a next/image remote-pattern candidate.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={imgUrl}
              alt=""
              draggable={false}
              onLoad={onImgLoad}
              className="photo-adjuster-img"
              style={{ left: offset.x, top: offset.y, width: dispW || undefined, height: dispH || undefined }}
            />
          )}
          <div className="photo-adjuster-guide" />
        </div>
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={handleZoom}
          className="photo-adjuster-zoom"
          disabled={!natural}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button className="btn btn-primary" onClick={confirm} disabled={!natural}>
            Save Photo
          </button>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
