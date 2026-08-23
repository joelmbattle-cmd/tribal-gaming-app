import { uploadDocument } from "@/lib/blob";

/**
 * Ceiling on a photo stored inline in Postgres, measured on the encoded data
 * URL rather than the raw bytes because that is what actually lands in the
 * column and ships in every page payload.
 *
 * Clients downscale before sending (see src/lib/image-client.ts), which puts a
 * typical photo far under this. The cap is the backstop for anything that
 * arrives unshrunk — a caller with scripting disabled, or an image format the
 * browser cannot decode to a canvas.
 */
export const MAX_INLINE_PHOTO_BYTES = 700_000;

/**
 * Where a stored photo ended up. `inline` distinguishes the two success paths
 * so the UI can tell an operator that a photo is held in the database rather
 * than in object storage — the same information, but it changes what they
 * should expect on backup and export.
 */
export type PhotoOutcome =
  | { status: "stored"; url: string; inline: boolean }
  | { status: "empty" }
  | { status: "too-large" }
  | { status: "failed" };

/**
 * Persist a photo and return something an <img src> can render.
 *
 * Blob storage is preferred and used whenever BLOB_READ_WRITE_TOKEN is set. It
 * is not set on this deployment, and requiring it would mean the feature does
 * not work at all — including in local development, where there is no token by
 * design. So when object storage is unavailable the image is inlined as a data
 * URL in the existing photoUrl column.
 *
 * The fallback is deliberately the lesser path: it costs database size and page
 * weight, and it is bounded by MAX_INLINE_PHOTO_BYTES for that reason. Nothing
 * needs to change to leave it behind — attach a Blob store and the next upload
 * takes the object-storage branch on its own.
 */
export async function storePhoto(
  file: File | null | undefined,
  pathPrefix: string,
): Promise<PhotoOutcome> {
  if (!file || file.size === 0) return { status: "empty" };

  const upload = await uploadDocument(file, pathPrefix);
  if (upload.status === "uploaded") {
    return { status: "stored", url: upload.url, inline: false };
  }
  if (upload.status === "failed") {
    // Storage was configured and genuinely errored. Falling back to an inline
    // copy here would paper over a broken store, so surface it instead.
    return { status: "failed" };
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const mediaType = file.type || "image/jpeg";
    const dataUrl = `data:${mediaType};base64,${bytes.toString("base64")}`;
    if (dataUrl.length > MAX_INLINE_PHOTO_BYTES) return { status: "too-large" };
    return { status: "stored", url: dataUrl, inline: true };
  } catch (err) {
    console.error(`[photo] inline encode failed for ${pathPrefix}`, err);
    return { status: "failed" };
  }
}
