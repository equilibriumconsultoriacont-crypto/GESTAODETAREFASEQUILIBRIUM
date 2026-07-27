// Recebe mensagens do Baileys e grava no banco (contato → conversa → mensagem),
// depois emite um evento para o painel atualizar em tempo real.

import type { WASocket } from "baileys";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import { waContacts, waConversations, waMessages, clients } from "../../drizzle/schema";
import { waEvents } from "./events";

function extractContent(message: any): { type: string; text: string } {
  const m = message || {};
  if (m.conversation) return { type: "text", text: m.conversation };
  if (m.extendedTextMessage) return { type: "text", text: m.extendedTextMessage.text || "" };
  if (m.imageMessage) return { type: "image", text: m.imageMessage.caption || "" };
  if (m.videoMessage) return { type: "video", text: m.videoMessage.caption || "" };
  if (m.audioMessage) return { type: "audio", text: "" };
  if (m.documentMessage) return { type: "document", text: m.documentMessage.fileName || "" };
  if (m.stickerMessage) return { type: "sticker", text: "" };
  if (m.locationMessage) return { type: "location", text: "" };
  return { type: "other", text: "" };
}

export async function handleIncomingMessages(_sock: WASocket, ev: any) {
  if (ev.type !== "notify") return;
  const db = await getDb();
  if (!db) return;

  for (const msg of ev.messages) {
    try {
    if (!msg.message) continue;
    const rawJid: string = msg.key?.remoteJid || "";
    // ignora grupos, status e transmissões
    if (rawJid.endsWith("@g.us") || rawJid.endsWith("@broadcast") || rawJid === "status@broadcast") continue;
    // v7: quando remoteJid é LID, remoteJidAlt traz o telefone (e vice-versa).
    const altJid: string = (msg.key as any)?.remoteJidAlt || "";

    const fromMe = !!msg.key?.fromMe;
    const digits = (j: string) => j.replace(/@(s\.whatsapp\.net|lid|c\.us)$/, "").replace(/:\d+$/, "");
    let phoneJid = rawJid.endsWith("@s.whatsapp.net") ? rawJid : (altJid.endsWith("@s.whatsapp.net") ? altJid : "");
    const lidJid = rawJid.endsWith("@lid") ? rawJid : (altJid.endsWith("@lid") ? altJid : "");
    // Se só temos o LID, tenta descobrir o telefone pelo mapeamento interno do Baileys (best-effort)
    if (!phoneJid && lidJid) {
      try {
        const pn = await (_sock as any)?.signalRepository?.lidMapping?.getPNForLID?.(lidJid);
        if (typeof pn === "string" && pn.endsWith("@s.whatsapp.net")) phoneJid = pn;
      } catch { /* mapeamento indisponível — segue com o LID */ }
    }
    const canonicalJid = phoneJid || rawJid; // preferimos o telefone
    const number = digits(phoneJid || rawJid);
    const lidVal = lidJid ? digits(lidJid) : null;
    const { type, text } = extractContent(msg.message);

    // Dedupe: o envio pelo painel já grava a mensagem; o Baileys ecoa ela como
    // fromMe. Se o waMessageId já existe, não grava de novo. (Também cobre mensagens
    // enviadas por outro aparelho, que chegam só pelo eco.)
    const waId = msg.key?.id || null;
    if (waId) {
      const dup = (
        await db.select({ id: waMessages.id }).from(waMessages).where(eq(waMessages.waMessageId, waId)).limit(1)
      )[0];
      if (dup) continue;
    }

    // contato: casa por telefone OU por LID (inclusive contatos antigos criados com o LID
    // no campo waNumber) — assim mensagens que chegam ora pelo telefone, ora pelo LID, caem
    // sempre no MESMO contato.
    const matchConds: any[] = [eq(waContacts.waNumber, number)];
    if (lidVal) { matchConds.push(eq(waContacts.waNumber, lidVal)); matchConds.push(eq(waContacts.lid, lidVal)); }
    let contact = (
      await db.select().from(waContacts).where(or(...matchConds)).limit(1)
    )[0];
    // O pushName só serve para nomear o contato quando a mensagem é DELE. Numa mensagem
    // nossa (fromMe), o pushName é o NOSSO nome — nunca usamos para batizar o contato.
    const incomingName = !fromMe && msg.pushName ? msg.pushName : null;
    if (!contact) {
      await db.insert(waContacts).values({ waNumber: number, lid: lidVal, jid: canonicalJid, name: incomingName });
      contact = (await db.select().from(waContacts).where(or(...matchConds)).limit(1))[0];
    } else {
      // completa dados que faltam (LID, jid de telefone, nome) sem trocar o waNumber
      const patch: any = {};
      if (lidVal && !contact.lid) patch.lid = lidVal;
      if (phoneJid && contact.jid !== canonicalJid) patch.jid = canonicalJid;
      else if (!contact.jid) patch.jid = canonicalJid;
      if (incomingName && !contact.name) patch.name = incomingName;
      if (Object.keys(patch).length) {
        await db.update(waContacts).set(patch).where(eq(waContacts.id, contact.id));
        Object.assign(contact, patch);
      }
    }
    if (!contact) continue;

    // Vínculo automático com a empresa: se temos telefone real e o contato ainda não está
    // vinculado, procura um cliente cadastrado com o mesmo telefone (compara os últimos 8
    // dígitos, para ignorar diferenças de DDI/DDD/9º dígito) e vincula.
    if (!contact.clientId && phoneJid && number && number.length >= 8) {
      try {
        const cli = (
          await db.select({ id: clients.id }).from(clients).where(
            sql`${clients.active} = 1 and ${clients.phone} is not null and ${clients.phone} <> '' and right(regexp_replace(${clients.phone}, '[^0-9]', ''), 8) = right(${number}, 8)`
          ).limit(1)
        )[0];
        if (cli?.id) {
          await db.update(waContacts).set({ clientId: cli.id }).where(eq(waContacts.id, contact.id));
          contact.clientId = cli.id;
        }
      } catch { /* best-effort */ }
    }

    // conversa em andamento (fila ou em atendimento); se a última foi concluída/desconsiderada, abre nova
    let conv = (
      await db
        .select()
        .from(waConversations)
        .where(and(eq(waConversations.contactId, contact.id), sql`${waConversations.status} in ('queue','active','open','pending')`))
        .orderBy(desc(waConversations.lastMessageAt))
        .limit(1)
    )[0];
    if (!conv) {
      await db.insert(waConversations).values({ contactId: contact.id, status: "queue", queuedAt: new Date() });
      conv = (
        await db
          .select()
          .from(waConversations)
          .where(eq(waConversations.contactId, contact.id))
          .orderBy(desc(waConversations.id))
          .limit(1)
      )[0];
    }
    if (!conv) continue;

    // mensagem
    await db.insert(waMessages).values({
      conversationId: conv.id,
      senderType: fromMe ? "agent" : "contact",
      fromMe,
      content: text,
      messageType: type as any,
      waMessageId: msg.key?.id || null,
      status: fromMe ? "sent" : "received",
    });

    // baixa mídia recebida (imagem/vídeo/áudio/documento) em 2º plano e guarda como data URL
    if (!fromMe && msg.key?.id && ["image", "video", "audio", "document", "sticker"].includes(type)) {
      downloadAndStoreMedia(_sock, msg, msg.key.id, conv.id).catch(() => {});
    }

    // atualiza a conversa
    await db
      .update(waConversations)
      .set({
        lastMessageAt: new Date(),
        unreadCount: fromMe ? 0 : conv.unreadCount + 1,
      })
      .where(eq(waConversations.id, conv.id));

    waEvents.emit("wa", {
      kind: "message",
      conversationId: conv.id,
      contactId: contact.id,
      number,
      fromMe,
      text,
      type,
    });

    // Push para o aparelho (funciona com o app fechado) — só para mensagens do cliente
    if (!fromMe) {
      const nome = contact.name || (number.length > 13 ? "Novo contato" : `+${number}`);
      // total de não lidas → o ícone do app mostra o número certo (não só "1")
      let badge = 1;
      try {
        badge = Number((await db.select({ t: sql<number>`coalesce(sum(unreadCount),0)` }).from(waConversations))[0]?.t || 1) || 1;
      } catch {}
      import("./push")
        .then(({ sendPushToAll }) => sendPushToAll({ title: nome, body: text || "Nova mensagem", url: "/whatsapp", badge }))
        .catch(() => {});
    }
    } catch (e: any) {
      console.error("[WA] falha ao processar uma mensagem recebida (segue para a próxima):", e?.message);
    }
  }
}

// ── Download de mídia recebida (best-effort) ──────────────────────────────────
function extractMime(m: any): string | null {
  const c = m?.imageMessage || m?.videoMessage || m?.audioMessage || m?.documentMessage || m?.stickerMessage;
  return c?.mimetype || null;
}

const silentLogger: any = {
  level: "silent", child: () => silentLogger,
  error: () => {}, warn: () => {}, info: () => {}, debug: () => {}, trace: () => {}, fatal: () => {},
};

async function downloadAndStoreMedia(sock: any, msg: any, waId: string, convId: number) {
  try {
    const baileys: any = await import("baileys");
    const download = baileys.downloadMediaMessage;
    if (typeof download !== "function") return;
    const buffer: Buffer = await download(
      msg, "buffer", {},
      { logger: silentLogger, reuploadRequest: sock?.updateMediaMessage },
    );
    if (!buffer || !buffer.length || buffer.length > 15 * 1024 * 1024) return; // ~15MB
    const mime = extractMime(msg.message) || "application/octet-stream";
    const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
    const db = await getDb();
    if (db) {
      await db.update(waMessages).set({ mediaUrl: dataUrl }).where(eq(waMessages.waMessageId, waId));
      waEvents.emit("wa", { kind: "message", conversationId: convId, contactId: 0, number: "", fromMe: false, text: "", type: "media-ready" });
    }
  } catch { /* best-effort: se falhar, fica só o placeholder */ }
}
