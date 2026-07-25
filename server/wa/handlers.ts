// Recebe mensagens do Baileys e grava no banco (contato → conversa → mensagem),
// depois emite um evento para o painel atualizar em tempo real.

import type { WASocket } from "baileys";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { waContacts, waConversations, waMessages } from "../../drizzle/schema";
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
    const jid: string = msg.key?.remoteJid || "";
    // ignora grupos, status e transmissões
    if (jid.endsWith("@g.us") || jid.endsWith("@broadcast") || jid === "status@broadcast") continue;

    const fromMe = !!msg.key?.fromMe;
    const number = jid.replace(/@(s\.whatsapp\.net|lid|c\.us)$/, "");
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

    // contato (cria se novo)
    let contact = (
      await db.select().from(waContacts).where(eq(waContacts.waNumber, number)).limit(1)
    )[0];
    if (!contact) {
      await db.insert(waContacts).values({ waNumber: number, jid, name: msg.pushName || null });
      contact = (
        await db.select().from(waContacts).where(eq(waContacts.waNumber, number)).limit(1)
      )[0];
    } else if ((msg.pushName && !contact.name) || !contact.jid) {
      await db.update(waContacts).set({
        ...(msg.pushName && !contact.name ? { name: msg.pushName } : {}),
        ...(!contact.jid ? { jid } : {}),
      }).where(eq(waContacts.id, contact.id));
      if (!contact.jid) contact.jid = jid;
    }
    if (!contact) continue;

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
      await db.insert(waConversations).values({ contactId: contact.id, status: "queue" });
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
      import("./push")
        .then(({ sendPushToAll }) => sendPushToAll({ title: nome, body: text || "Nova mensagem", url: "/whatsapp" }))
        .catch(() => {});
    }
    } catch (e: any) {
      console.error("[WA] falha ao processar uma mensagem recebida (segue para a próxima):", e?.message);
    }
  }
}
