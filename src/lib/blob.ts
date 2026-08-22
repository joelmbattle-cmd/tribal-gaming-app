import { put } from "@vercel/blob";

/**
 * Uploads a document to Vercel Blob when a token is configured. In local
 * dev (no BLOB_READ_WRITE_TOKEN) this degrades gracefully to metadata-only
 * attachment, same as the prototype — the record still gets a doc row with
 * a name and date, just no downloadable file.
 */
export async function uploadDocument(file: File, pathPrefix: string): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const blob = await put(`${pathPrefix}/${Date.now()}-${file.name}`, file, {
    access: "public",
    addRandomSuffix: true,
  });
  return blob.url;
}
