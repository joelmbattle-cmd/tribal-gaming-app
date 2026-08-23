import { put } from "@vercel/blob";

/**
 * Outcome of an attempted upload. Callers need all three cases: a record is
 * still worth creating when storage is unavailable, but the UI must not claim
 * a file was stored when it wasn't.
 *
 * - `uploaded` — the file is in blob storage at `url`.
 * - `skipped`  — nothing to store, or no BLOB_READ_WRITE_TOKEN configured. In
 *                local dev this is the normal path: the record still gets a
 *                name and date, just no downloadable file.
 * - `failed`   — storage is configured but the upload genuinely errored.
 */
export type UploadOutcome =
  | { status: "uploaded"; url: string }
  | { status: "skipped" }
  | { status: "failed" };

export async function uploadDocument(
  file: File | null | undefined,
  pathPrefix: string,
): Promise<UploadOutcome> {
  if (!file || file.size === 0) return { status: "skipped" };
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { status: "skipped" };

  try {
    const blob = await put(`${pathPrefix}/${Date.now()}-${file.name}`, file, {
      access: "public",
      addRandomSuffix: true,
    });
    return { status: "uploaded", url: blob.url };
  } catch (err) {
    // Logged server-side only — the provider's error text can embed store and
    // token identifiers, which must not reach the browser.
    console.error(`[blob] upload failed for ${pathPrefix}`, err);
    return { status: "failed" };
  }
}
