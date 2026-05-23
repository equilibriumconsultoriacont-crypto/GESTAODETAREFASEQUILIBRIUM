/**
 * Storage adapter — suporta Forge/Manus (original) e Railway (fallback base64 no banco)
 * No Railway sem BUILT_IN_FORGE_API_URL, os arquivos ficam como data URLs no fileUrl
 */

import { randomUUID } from "crypto";
import { ENV } from "./_core/env";

function getForgeConfig(): { forgeUrl: string; forgeKey: string } | null {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) return null;
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const forge = getForgeConfig();

  // ── Forge/Manus storage (production with Manus) ──
  if (forge) {
    const key = appendHashSuffix(normalizeKey(relKey));
    const presignUrl = new URL("v1/storage/presign/put", forge.forgeUrl + "/");
    presignUrl.searchParams.set("path", key);

    const presignResp = await fetch(presignUrl, {
      headers: { Authorization: `Bearer ${forge.forgeKey}` },
    });

    if (!presignResp.ok) {
      const msg = await presignResp.text().catch(() => presignResp.statusText);
      throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
    }

    const { url: s3Url } = (await presignResp.json()) as { url: string };
    if (!s3Url) throw new Error("Forge returned empty presign URL");

    const blob = typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });

    const uploadResp = await fetch(s3Url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: blob,
    });

    if (!uploadResp.ok) {
      throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
    }

    return { key, url: `/manus-storage/${key}` };
  }

  // ── Railway fallback: store as base64 data URL ──
  // Files are stored as data URLs — suitable for PDFs up to ~5MB
  const key = appendHashSuffix(normalizeKey(relKey));
  const base64 = Buffer.isBuffer(data) ? data.toString("base64") : Buffer.from(data as any).toString("base64");
  const dataUrl = `data:${contentType};base64,${base64}`;

  return { key, url: dataUrl };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const forge = getForgeConfig();
  if (forge) return { key, url: `/manus-storage/${key}` };
  return { key, url: "" };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const forge = getForgeConfig();
  if (!forge) {
    // No Forge — the file URL stored in DB is already the data URL
    return "";
  }

  const key = normalizeKey(relKey);
  const getUrl = new URL("v1/storage/presign/get", forge.forgeUrl + "/");
  getUrl.searchParams.set("path", key);

  const resp = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${forge.forgeKey}` },
  });

  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }

  const { url } = (await resp.json()) as { url: string };
  return url;
}

export async function storageDelete(relKey: string): Promise<void> {
  const forge = getForgeConfig();
  if (!forge) return; // No-op for data URL storage

  const key = normalizeKey(relKey);
  const deleteUrl = new URL("v1/storage/delete", forge.forgeUrl + "/");
  deleteUrl.searchParams.set("path", key);

  const resp = await fetch(deleteUrl, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${forge.forgeKey}` },
  });

  if (!resp.ok && resp.status !== 404) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage delete failed (${resp.status}): ${msg}`);
  }
}

/**
 * Retorna buffer do arquivo para anexar em emails.
 * Suporta tanto data URLs (Railway) quanto URLs presignadas (Forge/Manus).
 */
export async function storageGetBuffer(fileKey: string, fileUrl: string): Promise<Buffer | null> {
  // Se fileUrl é data URL (Railway fallback)
  if (fileUrl.startsWith("data:")) {
    const base64 = fileUrl.split(",")[1];
    if (!base64) return null;
    return Buffer.from(base64, "base64");
  }

  // Forge/Manus: buscar via presigned URL
  const forge = getForgeConfig();
  if (!forge) return null;

  try {
    const getUrl = new URL("v1/storage/presign/get", forge.forgeUrl + "/");
    getUrl.searchParams.set("path", fileKey);

    const presignResp = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${forge.forgeKey}` },
    });

    if (!presignResp.ok) return null;

    const { url: signedUrl } = (await presignResp.json()) as { url: string };
    const fileResp = await fetch(signedUrl);
    if (!fileResp.ok) return null;

    return Buffer.from(await fileResp.arrayBuffer());
  } catch {
    return null;
  }
}
