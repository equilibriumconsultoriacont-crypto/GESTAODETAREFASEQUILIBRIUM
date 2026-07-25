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
  clients,
} from "../../drizzle/schema";
import { sendText, sendToJid } from "./connection";
import { waEvents } from "./events";

function normalizeBR(phone: string): string {
  let d = (phone || "").replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) return d;
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d;
}

async function auth(req: any, res: any, adminOnly = false) {
  const { sdk } = await import("../_core/sdk");
  let user: any = null;
  try { user = await sdk.authenticateRequest(req); } catch {}
  const ok = user && (user.role === "admin" || (!adminOnly && user.role === "user"));
  if (!ok) { res.status(401).json({ error: "não autorizado" }); return null; }
  return user;
}

export function registerWaRoutes(app: Express) {
  // Quem sou eu (id, nome, papel) — o painel usa para saber as ações e a visibilidade
  app.get("/api/wa/me", async (req, res) => {
    const user = await auth(req, res);
    if (!user) return;
    res.json({
      id: user.id,
      name: user.name || (user.email ? user.email.split("@")[0] : "Atendente"),
      role: user.role,
    });
  });

  // Lista de conversas com VISIBILIDADE por papel:
  // - admin vê tudo; funcionário vê a fila (de todos) + só os atendimentos DELE
  app.get("/api/wa/conversations", async (req, res) => {
    const user = await auth(req, res);
    if (!user) return;
    const db = await getDb();
    if (!db) return res.json([]);
    const isAdmin = user.role === "admin";
    const filter = (req.query.filter as string) || "queue";

    let where: any;
    if (filter === "queue") {
      where = eq(waConversations.status, "queue");
    } else if (filter === "mine") {
      where = and(eq(waConversations.status, "active"), eq(waConversations.assignedAgentId, user.id));
    } else if (filter === "active") {
      where = isAdmin
        ? eq(waConversations.status, "active")
        : and(eq(waConversations.status, "active"), eq(waConversations.assignedAgentId, user.id));
    } else if (filter === "concluded") {
      where = isAdmin
        ? eq(waConversations.status, "concluded")
        : and(eq(waConversations.status, "concluded"), eq(waConversations.assignedAgentId, user.id));
    } else {
      // "all": admin vê fila + em atendimento; funcionário vê fila + os seus
      where = isAdmin
        ? sql`${waConversations.status} in ('queue','active')`
        : sql`${waConversations.status} = 'queue' or ${waConversations.assignedAgentId} = ${user.id}`;
    }

    const rows = await db
      .select({
        id: waConversations.id,
        status: waConversations.status,
        unreadCount: waConversations.unreadCount,
        lastMessageAt: waConversations.lastMessageAt,
        assignedAgentId: waConversations.assignedAgentId,
        assignedAgentName: sql<string | null>`(select coalesce(nullif(name,''), substring_index(email,'@',1)) from users where id = ${waConversations.assignedAgentId})`,
        contactId: waContacts.id,
        name: waContacts.name,
        waNumber: waContacts.waNumber,
        lastMessage: sql<string>`(select content from wa_messages m where m.conversationId = ${waConversations.id} order by m.id desc limit 1)`,
        lastFromMe: sql<number>`(select fromMe from wa_messages m where m.conversationId = ${waConversations.id} order by m.id desc limit 1)`,
      })
      .from(waConversations)
      .innerJoin(waContacts, eq(waConversations.contactId, waContacts.id))
      .where(where)
      .orderBy(desc(waConversations.lastMessageAt))
      .limit(300);
    res.json(rows);
  });

  // Total de não lidas (para o badge do card no Hub)
  app.get("/api/wa/unread", async (req, res) => {
    if (!(await auth(req, res))) return;
    const db = await getDb();
    if (!db) return res.json({ count: 0 });
    const r = await db.select({ total: sql<number>`coalesce(sum(unreadCount),0)` }).from(waConversations);
    res.json({ count: Number(r[0]?.total || 0) });
  });

  // Histórico de uma conversa
  app.get("/api/wa/conversations/:id/messages", async (req, res) => {
    if (!(await auth(req, res))) return;
    const db = await getDb();
    if (!db) return res.json([]);
    const id = parseInt(req.params.id);
    const rows = await db
      .select({
        id: waMessages.id,
        conversationId: waMessages.conversationId,
        senderType: waMessages.senderType,
        fromMe: waMessages.fromMe,
        content: waMessages.content,
        messageType: waMessages.messageType,
        mediaUrl: waMessages.mediaUrl,
        waMessageId: waMessages.waMessageId,
        status: waMessages.status,
        agentId: waMessages.agentId,
        createdAt: waMessages.createdAt,
        agentName: sql<string | null>`(select coalesce(nullif(name, ''), substring_index(email, '@', 1)) from users where id = ${waMessages.agentId})`,
        agentRole: sql<string | null>`(select role from users where id = ${waMessages.agentId})`,
      })
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
      // Nome do atendente vai no topo da mensagem que o cliente recebe (estilo Onvio)
      const agent = (await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, user.id)).limit(1))[0];
      const label = agent?.name || agent?.email?.split("@")[0] || "Atendente";
      const outgoing = `*${label}*\n${text}`;
      const target = contact.jid || (contact.waNumber.includes("@") ? contact.waNumber : contact.waNumber + "@s.whatsapp.net");
      const sent = await sendToJid(target, outgoing);
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
      // Responder puxa a conversa para o atendente: vira "em atendimento" e, se não
      // tinha dono, passa a ser de quem respondeu.
      const claim = conv.status === "queue" || !conv.assignedAgentId;
      await db
        .update(waConversations)
        .set({ lastMessageAt: new Date(), status: "active", ...(claim ? { assignedAgentId: user.id } : {}) })
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

  // Atender: puxa a conversa para si (admin pode atribuir a outro via agentId)
  app.post("/api/wa/conversations/:id/assign", async (req, res) => {
    const user = await auth(req, res);
    if (!user) return;
    const db = await getDb();
    if (!db) return res.json({ ok: true });
    const id = parseInt(req.params.id);
    const agentId = user.role === "admin" && req.body?.agentId ? parseInt(req.body.agentId) : user.id;
    await db.update(waConversations).set({ assignedAgentId: agentId, status: "active", concludedAt: null }).where(eq(waConversations.id, id));
    waEvents.emit("wa", { kind: "conversation", conversationId: id, action: "assigned" });
    res.json({ ok: true });
  });

  // Concluir atendimento
  app.post("/api/wa/conversations/:id/conclude", async (req, res) => {
    const user = await auth(req, res);
    if (!user) return;
    const db = await getDb();
    if (!db) return res.json({ ok: true });
    const id = parseInt(req.params.id);
    await db.update(waConversations).set({ status: "concluded", concludedAt: new Date() }).where(eq(waConversations.id, id));
    waEvents.emit("wa", { kind: "conversation", conversationId: id, action: "concluded" });
    res.json({ ok: true });
  });

  // Desconsiderar (tira da fila sem atender)
  app.post("/api/wa/conversations/:id/dismiss", async (req, res) => {
    const user = await auth(req, res);
    if (!user) return;
    const db = await getDb();
    if (!db) return res.json({ ok: true });
    const id = parseInt(req.params.id);
    await db.update(waConversations).set({ status: "dismissed" }).where(eq(waConversations.id, id));
    waEvents.emit("wa", { kind: "conversation", conversationId: id, action: "dismissed" });
    res.json({ ok: true });
  });

  // Devolver para a fila
  app.post("/api/wa/conversations/:id/reopen", async (req, res) => {
    const user = await auth(req, res);
    if (!user) return;
    const db = await getDb();
    if (!db) return res.json({ ok: true });
    const id = parseInt(req.params.id);
    await db.update(waConversations).set({ status: "queue", assignedAgentId: null, concludedAt: null }).where(eq(waConversations.id, id));
    waEvents.emit("wa", { kind: "conversation", conversationId: id, action: "reopened" });
    res.json({ ok: true });
  });

  // Transferir para outro atendente com um comentário interno (não vai para o cliente)
  app.post("/api/wa/conversations/:id/transfer", async (req, res) => {
    const user = await auth(req, res);
    if (!user) return;
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "sem banco" });
    const id = parseInt(req.params.id);
    const toId = parseInt(req.body?.agentId);
    const note = (req.body?.note || "").toString().trim();
    if (!toId) return res.status(400).json({ error: "selecione o atendente" });
    const nameOf = async (uid: number) =>
      (await db.select({ n: sql<string>`coalesce(nullif(name,''), substring_index(email,'@',1))` }).from(users).where(eq(users.id, uid)).limit(1))[0]?.n || "atendente";
    const fromName = await nameOf(user.id);
    const toName = await nameOf(toId);
    await db.update(waConversations).set({ assignedAgentId: toId, status: "active", concludedAt: null }).where(eq(waConversations.id, id));
    await db.insert(waMessages).values({
      conversationId: id,
      senderType: "system",
      fromMe: false,
      content: `🔁 ${fromName} → ${toName}${note ? `\n${note}` : ""}`,
      messageType: "other",
      status: "received",
      agentId: user.id,
    });
    waEvents.emit("wa", { kind: "message", conversationId: id, contactId: 0, number: "", fromMe: false, text: "", type: "system" });
    waEvents.emit("wa", { kind: "conversation", conversationId: id, action: "transferred" });
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

  // Contatos salvos (com o cliente vinculado, se houver)
  app.get("/api/wa/contacts", async (req, res) => {
    if (!(await auth(req, res))) return;
    const db = await getDb();
    if (!db) return res.json([]);
    const rows = await db
      .select({
        id: waContacts.id, waNumber: waContacts.waNumber, name: waContacts.name,
        jid: waContacts.jid, clientId: waContacts.clientId,
        clientName: sql<string | null>`(select name from clients where id = ${waContacts.clientId})`,
      })
      .from(waContacts)
      .orderBy(waContacts.name)
      .limit(500);
    res.json(rows);
  });

  // Clientes cadastrados com telefone (para iniciar conversa)
  app.get("/api/wa/clients", async (req, res) => {
    if (!(await auth(req, res))) return;
    const db = await getDb();
    if (!db) return res.json([]);
    const rows = await db
      .select({ id: clients.id, name: clients.name, phone: clients.phone })
      .from(clients)
      .where(sql`${clients.phone} is not null and ${clients.phone} != '' and ${clients.active} = 1`)
      .orderBy(clients.name)
      .limit(1000);
    res.json(rows);
  });

  // Iniciar conversa (por número novo ou por cliente cadastrado)
  app.post("/api/wa/start-conversation", async (req, res) => {
    const user = await auth(req, res);
    if (!user) return;
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "sem banco" });
    let name: string | null = req.body?.name || null;
    const clientId = req.body?.clientId ? parseInt(req.body.clientId) : null;
    let number = "";
    if (clientId) {
      const c = (await db.select().from(clients).where(eq(clients.id, clientId)).limit(1))[0];
      if (!c?.phone) return res.status(400).json({ error: "cliente sem telefone cadastrado" });
      number = normalizeBR(c.phone);
      name = name || c.name;
    } else {
      number = normalizeBR(req.body?.number || "");
    }
    if (!number || number.length < 12) return res.status(400).json({ error: "número inválido" });
    let contact = (await db.select().from(waContacts).where(eq(waContacts.waNumber, number)).limit(1))[0];
    if (!contact) {
      await db.insert(waContacts).values({ waNumber: number, jid: `${number}@s.whatsapp.net`, name, clientId });
      contact = (await db.select().from(waContacts).where(eq(waContacts.waNumber, number)).limit(1))[0];
    } else if (clientId && !contact.clientId) {
      await db.update(waContacts).set({ clientId }).where(eq(waContacts.id, contact.id));
    }
    if (!contact) return res.status(500).json({ error: "falha ao criar contato" });
    let conv = (await db.select().from(waConversations).where(and(eq(waConversations.contactId, contact.id), sql`${waConversations.status} in ('queue','active')`)).orderBy(desc(waConversations.lastMessageAt)).limit(1))[0];
    if (!conv) {
      await db.insert(waConversations).values({ contactId: contact.id, status: "active", assignedAgentId: user.id });
      conv = (await db.select().from(waConversations).where(eq(waConversations.contactId, contact.id)).orderBy(desc(waConversations.id)).limit(1))[0];
    }
    res.json({ conversationId: conv?.id });
  });

  // Vincular um contato a um cliente cadastrado
  app.post("/api/wa/contacts/:id/link", async (req, res) => {
    if (!(await auth(req, res))) return;
    const db = await getDb();
    if (!db) return res.json({ ok: true });
    const id = parseInt(req.params.id);
    const clientId = req.body?.clientId ? parseInt(req.body.clientId) : null;
    await db.update(waContacts).set({ clientId }).where(eq(waContacts.id, id));
    res.json({ ok: true });
  });
}
