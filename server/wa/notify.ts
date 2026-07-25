// Aviso automático pelo WhatsApp quando uma guia é enviada por e-mail.
// Envia uma MENSAGEM de aviso (não o PDF, para reduzir risco de bloqueio) e registra
// no painel de atendimento.

import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { waContacts, waConversations, waMessages } from "../../drizzle/schema";
import { getWAStatus, sendToJid, jidFromNumber } from "./connection";
import { waEvents } from "./events";

function normalizeBR(phone: string): string {
  const d = (phone || "").replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) return d;
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d;
}

export async function notifyGuiaSent(opts: {
  clientId: number; phone: string; name: string; taskType: string; competencia: string;
}): Promise<{ ok: boolean; reason?: string }> {
  if (getWAStatus().status !== "open") return { ok: false, reason: "whatsapp desconectado" };
  const number = normalizeBR(opts.phone);
  if (!number || number.length < 12) return { ok: false, reason: "telefone inválido" };

  const firstName = (opts.name || "").split(" ")[0];
  const msg =
    `Olá${firstName ? `, ${firstName}` : ""}! 👋\n\n` +
    `Sua guia de *${opts.taskType}* (competência ${opts.competencia}) foi enviada para o seu e-mail. ✅\n\n` +
    `Qualquer dúvida, é só chamar por aqui.\n_Equilíbrio Consultoria Contábil_`;

  try {
    const sent = await sendToJid(jidFromNumber(number), msg);
    const waId = (sent as any)?.key?.id || null;

    const db = await getDb();
    if (db) {
      let contact = (await db.select().from(waContacts).where(eq(waContacts.waNumber, number)).limit(1))[0];
      if (!contact) {
        await db.insert(waContacts).values({ waNumber: number, jid: jidFromNumber(number), name: opts.name || null, clientId: opts.clientId });
        contact = (await db.select().from(waContacts).where(eq(waContacts.waNumber, number)).limit(1))[0];
      } else if (!contact.clientId) {
        await db.update(waContacts).set({ clientId: opts.clientId }).where(eq(waContacts.id, contact.id));
      }
      if (contact) {
        // reaproveita a conversa mais recente (qualquer estado); senão cria concluída
        let conv = (await db.select().from(waConversations).where(eq(waConversations.contactId, contact.id)).orderBy(desc(waConversations.id)).limit(1))[0];
        if (!conv) {
          await db.insert(waConversations).values({ contactId: contact.id, status: "concluded", concludedAt: new Date(), lastMessageAt: new Date() });
          conv = (await db.select().from(waConversations).where(eq(waConversations.contactId, contact.id)).orderBy(desc(waConversations.id)).limit(1))[0];
        }
        if (conv) {
          await db.insert(waMessages).values({
            conversationId: conv.id, senderType: "agent", fromMe: true, content: msg,
            messageType: "text", waMessageId: waId, status: "sent",
          });
          await db.update(waConversations).set({ lastMessageAt: new Date() }).where(eq(waConversations.id, conv.id));
          waEvents.emit("wa", { kind: "message", conversationId: conv.id, contactId: contact.id, number, fromMe: true, text: msg, type: "text" });
        }
      }
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message };
  }
}
