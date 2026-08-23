"use client";

/**
 * Longest edge kept when downscaling. An identification photo is displayed at
 * roughly 300px, so 1024 leaves room to zoom without carrying a 12-megapixel
 * original around.
 */
const MAX_EDGE = 1024;
const JPEG_QUALITY = 0.82;

/**
 * Shrink a photo in the browser before it is handed to a server action.
 *
 * This is required, not an optimisation: server actions cap their request body
 * at 1MB by default, and a photo straight from a phone camera is several times
 * that. Without this step the upload fails before any server code runs, no
 * matter where the file was going to be stored.
 *
 * Anything that is not a decodable image is returned untouched, as is the
 * original when re-encoding would make it larger — a small, already-optimised
 * file should not be inflated by a round-trip through JPEG.
 */
export async function preparePhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, {
      type: "image/jpeg",
    });
  } catch {
    // Undecodable format, or a browser without createImageBitmap. Send the
    // original and let the server decide — an oversized file is reported
    // honestly rather than silently dropped here.
    return file;
  }
}
