// Endpoints REST do painel de atendimento.

import type { Express } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  waContacts,
  waConversations,
  waMessages,
  waTags,
  waConversationTags,
  users,
} from "../../drizzle/schema";
import { sendText } from "./connection";
import { waEvents } from "./events";

async function auth(req: any, res: any, adminOnly = false) {
  const { sdk } = await import("../_core/sdk");
  let user: any = null;
  try { user = await sdk.authenticateRequest(req); } catch {}
  const ok = user && (user.role === "admin" || (!adminOnly && user.role === "user"));
  if (!ok) { res.status(401).json({ error: "não autorizado" }); return null; }
  return user;
}

export function registerWaRoutes(app: Express) {
  // Lista de conversas (com nome do contato, prévia e não lidas)
  app.get("/api/wa/conversations", async (req, res) => {
    if (!(await auth(req, res))) return;
    const db = await getDb();
    if (!db) return res.json([]);
    const status = (req.query.status as string) || "all";
    const rows = await db
      .select({
        id: waConversations.id,
        status: waConversations.status,
        unreadCount: waConversations.unreadCount,
        lastMessageAt: waConversations.lastMessageAt,
        assignedAgentId: waConversations.assignedAgentId,
        contactId: waContacts.id,
        name: waContacts.name,
        waNumber: waContacts.waNumber,
        lastMessage: sql<string>`(select content from wa_messages m where m.conversationId = ${waConversations.id} order by m.id desc limit 1)`,
        lastFromMe: sql<number>`(select fromMe from wa_messages m where m.conversationId = ${waConversations.id} order by m.id desc limit 1)`,
      })
      .from(waConversations)
      .innerJoin(waContacts, eq(waConversations.contactId, waContacts.id))
      .where(status !== "all" ? eq(waConversations.status, status as any) : (undefined as any))
      .orderBy(desc(waConversations.lastMessageAt))
      .limit(300);
    res.json(rows);
  });

  // Histórico de uma conversa
  app.get("/api/wa/conversations/:id/messages", async (req, res) => {
    if (!(await auth(req, res))) return;
    const db = await getDb();
    if (!db) return res.json([]);
    const id = parseInt(req.params.id);
    const rows = await db
      .select()
      .from(waMessages)
      .where(eq(waMessages.conversationId, id))
      .orderBy(desc(waMessages.id))
      .limit(200);
    res.json(rows.reverse());
  });

  // Enviar mensagem (agente → contato)
  app.post("/api/wa/conversations/:id/send", async (req, res) => {
    const user = await auth(req, res);
    if (!user) return;
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "sem banco" });
    const id = parseInt(req.params.id);
    const text = (req.body?.text || "").toString().trim();
    if (!text) return res.status(400).json({ error: "mensagem vazia" });

    const conv = (await db.select().from(waConversations).where(eq(waConversations.id, id)).limit(1))[0];
    if (!conv) return res.status(404).json({ error: "conversa não encontrada" });
    const contact = (await db.select().from(waContacts).where(eq(waContacts.id, conv.contactId)).limit(1))[0];
    if (!contact) return res.status(404).json({ error: "contato não encontrado" });

    try {
      const sent = await sendText(contact.waNumber, text);
      const waId = (sent as any)?.key?.id || null;
      await db.insert(waMessages).values({
        conversationId: id,
        senderType: "agent",
        fromMe: true,
        content: text,
        messageType: "text",
        waMessageId: waId,
        status: "sent",
        agentId: user.id,
      });
      await db
        .update(waConversations)
        .set({ lastMessageAt: new Date(), status: conv.status === "closed" ? "open" : conv.status })
        .where(eq(waConversations.id, id));
      waEvents.emit("wa", {
        kind: "message",
        conversationId: id,
        contactId: contact.id,
        number: contact.waNumber,
        fromMe: true,
        text,
        type: "text",
      });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(502).json({ error: e?.message || "falha ao enviar" });
    }
  });

  // Marcar como lida (zera não lidas)
  app.post("/api/wa/conversations/:id/read", async (req, res) => {
    if (!(await auth(req, res))) return;
    const db = await getDb();
    if (!db) return res.json({ ok: true });
    await db.update(waConversations).set({ unreadCount: 0 }).where(eq(waConversations.id, parseInt(req.params.id)));
    res.json({ ok: true });
  });

  // Atribuir a um agente
  app.post("/api/wa/conversations/:id/assign", async (req, res) => {
    if (!(await auth(req, res))) return;
    const db = await getDb();
    if (!db) return res.json({ ok: true });
    const id = parseInt(req.params.id);
    const agentId = req.body?.agentId ? parseInt(req.body.agentId) : null;
    await db.update(waConversations).set({ assignedAgentId: agentId }).where(eq(waConversations.id, id));
    waEvents.emit("wa", { kind: "conversation", conversationId: id, action: "assigned" });
    res.json({ ok: true });
  });

  // Mudar status (open/pending/closed)
  app.post("/api/wa/conversations/:id/status", async (req, res) => {
    if (!(await auth(req, res))) return;
    const db = await getDb();
    if (!db) return res.json({ ok: true });
    const id = parseInt(req.params.id);
    const st = req.body?.status;
    if (!["open", "pending", "closed"].includes(st)) return res.status(400).json({ error: "status inválido" });
    await db.update(waConversations).set({ status: st }).where(eq(waConversations.id, id));
    waEvents.emit("wa", { kind: "conversation", conversationId: id, action: st });
    res.json({ ok: true });
  });

  // Etiquetas
  app.get("/api/wa/tags", async (req, res) => {
    if (!(await auth(req, res))) return;
    const db = await getDb();
    if (!db) return res.json([]);
    res.json(await db.select().from(waTags));
  });
  app.post("/api/wa/tags", async (req, res) => {
    if (!(await auth(req, res, true))) return;
    const db = await getDb();
    if (!db) return res.status(500).json({});
    const name = (req.body?.name || "").toString().trim();
    const color = (req.body?.color || "#3E9AA6").toString();
    if (!name) return res.status(400).json({ error: "nome vazio" });
    await db.insert(waTags).values({ name, color });
    res.json({ ok: true });
  });
  app.get("/api/wa/conversations/:id/tags", async (req, res) => {
    if (!(await auth(req, res))) return;
    const db = await getDb();
    if (!db) return res.json([]);
    const id = parseInt(req.params.id);
    const rows = await db
      .select({ id: waTags.id, name: waTags.name, color: waTags.color })
      .from(waConversationTags)
      .innerJoin(waTags, eq(waConversationTags.tagId, waTags.id))
      .where(eq(waConversationTags.conversationId, id));
    res.json(rows);
  });
  app.post("/api/wa/conversations/:id/tags", async (req, res) => {
    if (!(await auth(req, res))) return;
    const db = await getDb();
    if (!db) return res.json({ ok: true });
    const id = parseInt(req.params.id);
    const tagId = parseInt(req.body?.tagId);
    const remove = !!req.body?.remove;
    if (remove) {
      await db
        .delete(waConversationTags)
        .where(sql`${waConversationTags.conversationId} = ${id} and ${waConversationTags.tagId} = ${tagId}`);
    } else {
      await db.insert(waConversationTags).values({ conversationId: id, tagId });
    }
    res.json({ ok: true });
  });

  // Agentes para atribuição (reusa a tabela users)
  app.get("/api/wa/agents", async (req, res) => {
    if (!(await auth(req, res))) return;
    const db = await getDb();
    if (!db) return res.json([]);
    const rows = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(sql`${users.role} in ('admin','user')`);
    res.json(rows);
  });
}
