// Web Push — envia notificação ao aparelho mesmo com o app fechado.
// As chaves VAPID são geradas uma vez e guardadas no banco (sem depender de env var).

import webpush from "web-push";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { waConfig, waPushSubs } from "../../drizzle/schema";

let configured = false;
let publicKey = "";

async function ensureVapid(): Promise<string> {
  if (configured) return publicKey;
  const db = await getDb();
  if (!db) return "";
  let pub = (await db.select().from(waConfig).where(eq(waConfig.k, "vapid_public")).limit(1))[0]?.v || "";
  let priv = (await db.select().from(waConfig).where(eq(waConfig.k, "vapid_private")).limit(1))[0]?.v || "";
  if (!pub || !priv) {
    const keys = webpush.generateVAPIDKeys();
    pub = keys.publicKey; priv = keys.privateKey;
    await db.insert(waConfig).values({ k: "vapid_public", v: pub }).onDuplicateKeyUpdate({ set: { v: pub } });
    await db.insert(waConfig).values({ k: "vapid_private", v: priv }).onDuplicateKeyUpdate({ set: { v: priv } });
  }
  try {
    webpush.setVapidDetails("mailto:equilibriumconsultoria.cont@gmail.com", pub, priv);
    publicKey = pub;
    configured = true;
  } catch { /* chaves inválidas — não configura */ }
  return publicKey;
}

export async function getPublicKey(): Promise<string> {
  return ensureVapid();
}

export async function saveSubscription(sub: any): Promise<void> {
  const db = await getDb();
  if (!db || !sub?.endpoint) return;
  const p256dh = sub.keys?.p256dh || null;
  const auth = sub.keys?.auth || null;
  await db.insert(waPushSubs).values({ endpoint: sub.endpoint, p256dh, auth })
    .onDuplicateKeyUpdate({ set: { p256dh, auth } });
}

export async function sendPushToAll(payload: { title: string; body: string; url?: string; badge?: number }): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await ensureVapid();
  if (!configured) return;
  const subs = await db.select().from(waPushSubs);
  const data = JSON.stringify(payload);
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh || "", auth: s.auth || "" } } as any,
        data,
      );
    } catch (e: any) {
      const code = e?.statusCode;
      if (code === 404 || code === 410) {
        try { await db.delete(waPushSubs).where(eq(waPushSubs.endpoint, s.endpoint)); } catch {}
      }
    }
  }));
}
