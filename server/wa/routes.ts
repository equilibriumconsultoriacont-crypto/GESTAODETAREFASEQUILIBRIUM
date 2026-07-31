// Endpoints REST do painel de atendimento.

import type { Express } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  waContacts,
  waConversations,
  waMessages,
  waTags,
  waConversationTags,
  users,
  clients,
  waScheduledMessages,
} from "../../drizzle/schema";
import { sendText, sendToJid } from "./connection";
import { waEvents } from "./events";

// Converte áudio (webm do navegador, mp4 do iOS, etc.) para ogg/opus, o formato que o WhatsApp
// aceita em nota de voz. Tenta reempacotar (rápido, sem perda, quando já é opus) e cai para
// reencodar com libopus se necessário. Usa o binário do ffmpeg-static (não depende do sistema).
async function convertAudioToOgg(input: Buffer): Promise<Buffer> {
  const ffmpegPath = ((await import("ffmpeg-static")).default as unknown as string) || "ffmpeg";
  const { spawn } = await import("child_process");
  const run = (args: string[]) =>
    new Promise<Buffer>((resolve, reject) => {
      const proc = spawn(ffmpegPath, args, { stdio: ["pipe", "pipe", "ignore"] });
      const chunks: Buffer[] = [];
      proc.stdout.on("data", (d: Buffer) => chunks.push(d));
      proc.on("error", reject);
      proc.on("close", (code) => (code === 0 && chunks.length ? resolve(Buffer.concat(chunks)) : reject(new Error("ffmpeg saiu com código " + code))));
      proc.stdin.on("error", () => {});
      proc.stdin.write(input);
      proc.stdin.end();
    });
  try {
    return await run(["-i", "pipe:0", "-c:a", "copy", "-f", "ogg", "pipe:1"]);
  } catch {
    return await run(["-i", "pipe:0", "-c:a", "libopus", "-b:a", "64k", "-f", "ogg", "pipe:1"]);
  }
}

function normalizeBR(phone: string): string {
  let d = (phone || "").replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) return d;
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d;
}

// Nome do atendente (nome do login ou prefixo do email)
async function nameOf(db: any, uid: number): Promise<string> {
  return (
    await db.select({ n: sql<string>`coalesce(nullif(name,''), substring_index(email,'@',1))` }).from(users).where(eq(users.id, uid)).limit(1)
  )[0]?.n || "atendente";
}

// Data/hora no fuso de São Paulo, formato "às HH:MM de DD/MM/AAAA"
function nowBR(): string {
  try {
    const parts: any = {};
    for (const p of new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date())) parts[p.type] = p.value;
    return `às ${parts.hour}:${parts.minute} de ${parts.day}/${parts.month}/${parts.year}`;
  } catch { return ""; }
}

// Registra uma nota interna (mensagem de sistema) — nunca é enviada ao cliente
async function sysMsg(db: any, convId: number, content: string, agentId: number | null) {
  await db.insert(waMessages).values({
    conversationId: convId, senderType: "system", fromMe: false, content,
    messageType: "other", status: "received", agentId,
  });
  waEvents.emit("wa", { kind: "message", conversationId: convId, contactId: 0, number: "", fromMe: false, text: "", type: "system" });
}

async function convJid(db: any, convId: number): Promise<{ jid: string | null; conv: any; contact: any }> {
  const conv = (await db.select().from(waConversations).where(eq(waConversations.id, convId)).limit(1))[0];
  if (!conv) return { jid: null, conv: null, contact: null };
  const contact = (await db.select().from(waContacts).where(eq(waContacts.id, conv.contactId)).limit(1))[0];
  if (!contact) return { jid: null, conv, contact: null };
  const jid = contact.jid || (contact.waNumber.includes("@") ? contact.waNumber : contact.waNumber + "@s.whatsapp.net");
  return { jid, conv, contact };
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
  // Porteiro de segurança: garante que toda rota /api/wa responda em até 20s. Se um
  // endpoint travar (estourar erro sem responder), isto devolve um 500 legível em vez de
  // deixar a requisição pendurada. (A proteção global de unhandledRejection evita o crash;
  // isto evita o travamento.) Não afeta o WebSocket, que é tratado à parte.
  app.use("/api/wa", (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) res.status(500).json({ error: "tempo esgotado no servidor" });
    }, 20000);
    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));
    next();
  });

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
    try {
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
        lid: waContacts.lid,
        clientId: waContacts.clientId,
        clientName: sql<string | null>`(select name from clients c where c.id = ${waContacts.clientId})`,
        clientPhone: sql<string | null>`(select phone from clients c where c.id = ${waContacts.clientId})`,
        lastMessage: sql<string>`(select content from wa_messages m where m.conversationId = ${waConversations.id} order by m.id desc limit 1)`,
        lastFromMe: sql<number>`(select fromMe from wa_messages m where m.conversationId = ${waConversations.id} order by m.id desc limit 1)`,
      })
      .from(waConversations)
      .innerJoin(waContacts, eq(waConversations.contactId, waContacts.id))
      .where(where)
      .orderBy(desc(waConversations.lastMessageAt))
      .limit(300);
    res.json(rows);
    } catch (e: any) {
      console.error("[WA] conversations:", e?.message);
      if (!res.headersSent) res.status(500).json({ error: e?.message || "falha ao listar conversas" });
    }
  });

  // Total de não lidas (para o badge do card no Hub)
  app.get("/api/wa/unread", async (req, res) => {
    if (!(await auth(req, res))) return;
    const db = await getDb();
    if (!db) return res.json({ count: 0 });
    const r = await db.select({ total: sql<number>`coalesce(sum(unreadCount),0)` }).from(waConversations);
    res.json({ count: Number(r[0]?.total || 0) });
  });

  // Serve a mídia recebida (imagem/documento/áudio) guardada como data URL
  app.get("/api/wa/media/:msgId", async (req, res) => {
    if (!(await auth(req, res))) return;
    const db = await getDb();
    if (!db) return res.status(500).end();
    const msgId = parseInt(req.params.msgId);
    const m = (await db.select({ mediaUrl: waMessages.mediaUrl }).from(waMessages).where(eq(waMessages.id, msgId)).limit(1))[0];
    // Regex tolerante a mime com parâmetros (ex.: "audio/ogg; codecs=opus" das notas de voz).
    // O separador real ";base64," só aparece uma vez (base64 não tem ';'), então o não-guloso é seguro.
    const match = /^data:(.+?);base64,(.*)$/s.exec(m?.mediaUrl || "");
    if (!match) return res.status(404).json({ error: "mídia ainda não disponível" });
    res.setHeader("Content-Type", match[1]);
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.send(Buffer.from(match[2], "base64"));
  });

  // Cria uma TAREFA AVULSA (não recorrente, não repete no próximo mês) a partir de um pedido
  // do cliente pelo WhatsApp — ex.: cliente pede uma declaração de faturamento.
  app.post("/api/wa/conversations/:id/create-task", async (req, res) => {
    const user = await auth(req, res);
    if (!user) return;
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "sem banco" });
    const id = parseInt(req.params.id);
    const title = (req.body?.title || "").toString().trim();
    const taskType = (req.body?.taskType || "OUTROS").toString();
    const competencia = (req.body?.competencia || "").toString().trim();
    const dueDateStr = (req.body?.dueDate || "").toString().trim();
    const description = (req.body?.description || "").toString().trim();
    if (!title) return res.status(400).json({ error: "informe um título para a tarefa" });
    if (!/^\d{2}\/\d{4}$/.test(competencia)) return res.status(400).json({ error: "competência inválida (use MM/AAAA)" });
    const dueDate = dueDateStr ? new Date(dueDateStr) : null;
    if (!dueDate || isNaN(dueDate.getTime())) return res.status(400).json({ error: "vencimento inválido" });

    try {
      const conv = (await db.select().from(waConversations).where(eq(waConversations.id, id)).limit(1))[0];
      if (!conv) return res.status(404).json({ error: "conversa não encontrada" });
      const contact = (await db.select().from(waContacts).where(eq(waContacts.id, conv.contactId)).limit(1))[0];
      if (!contact?.clientId) {
        return res.status(400).json({ error: "vincule este contato a uma empresa antes de criar a tarefa" });
      }
      const { createTask } = await import("../db");
      const taskId = await createTask({
        clientId: contact.clientId,
        recurringTaskId: null, // avulsa: não é gerada de novo nos próximos meses
        title,
        description: description || null,
        taskType: taskType as any,
        competencia,
        dueDate,
        status: "PENDENTE" as any,
        sendToClient: true,
      } as any);
      const who = (await db.select({ n: sql<string>`coalesce(nullif(name,''), substring_index(email,'@',1))` }).from(users).where(eq(users.id, user.id)).limit(1))[0]?.n || "atendente";
      await sysMsg(db, id, `📋 Tarefa criada por ${who}: "${title}" (venc. ${dueDate.toLocaleDateString("pt-BR")}) ${nowBR()}`, user.id);
      res.json({ ok: true, taskId });
    } catch (e: any) {
      console.error("[WA] create-task:", e?.message);
      if (!res.headersSent) res.status(500).json({ error: e?.message || "falha ao criar tarefa" });
    }
  });
  // Agenda uma mensagem para ser enviada depois (ex.: escrever agora, mandar amanhã de manhã)
  app.post("/api/wa/conversations/:id/schedule", async (req, res) => {
    const user = await auth(req, res);
    if (!user) return;
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "sem banco" });
    const id = parseInt(req.params.id);
    const content = (req.body?.text || "").toString().trim();
    const sendAtStr = (req.body?.sendAt || "").toString().trim();
    if (!content) return res.status(400).json({ error: "mensagem vazia" });
    const sendAt = sendAtStr ? new Date(sendAtStr) : null;
    if (!sendAt || isNaN(sendAt.getTime())) return res.status(400).json({ error: "data/hora inválida" });
    if (sendAt.getTime() <= Date.now()) return res.status(400).json({ error: "escolha uma data/hora no futuro" });
    try {
      const conv = (await db.select({ id: waConversations.id }).from(waConversations).where(eq(waConversations.id, id)).limit(1))[0];
      if (!conv) return res.status(404).json({ error: "conversa não encontrada" });
      const result = await db.insert(waScheduledMessages).values({ conversationId: id, agentId: user.id, content, sendAt, status: "pending" });
      const who = (await db.select({ n: sql<string>`coalesce(nullif(name,''), substring_index(email,'@',1))` }).from(users).where(eq(users.id, user.id)).limit(1))[0]?.n || "atendente";
      await sysMsg(db, id, `🕒 Mensagem agendada por ${who} para ${sendAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, user.id);
      res.json({ ok: true, id: (result as any)[0]?.insertId });
    } catch (e: any) {
      console.error("[WA] schedule:", e?.message);
      if (!res.headersSent) res.status(500).json({ error: e?.message || "falha ao agendar" });
    }
  });

  // Lista mensagens agendadas (pendentes) de uma conversa
  app.get("/api/wa/conversations/:id/scheduled", async (req, res) => {
    if (!(await auth(req, res))) return;
    const db = await getDb();
    if (!db) return res.json([]);
    const id = parseInt(req.params.id);
    const rows = await db
      .select()
      .from(waScheduledMessages)
      .where(and(eq(waScheduledMessages.conversationId, id), eq(waScheduledMessages.status, "pending")))
      .orderBy(waScheduledMessages.sendAt);
    res.json(rows);
  });

  // Cancela uma mensagem agendada (antes de ser enviada)
  app.post("/api/wa/scheduled/:id/cancel", async (req, res) => {
    const user = await auth(req, res);
    if (!user) return;
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "sem banco" });
    const id = parseInt(req.params.id);
    const row = (await db.select().from(waScheduledMessages).where(eq(waScheduledMessages.id, id)).limit(1))[0];
    if (!row || row.status !== "pending") return res.status(400).json({ error: "não é possível cancelar" });
    await db.update(waScheduledMessages).set({ status: "cancelled" }).where(eq(waScheduledMessages.id, id));
    await sysMsg(db, row.conversationId, `🕒 Mensagem agendada cancelada`, user.id);
    res.json({ ok: true });
  });


  // Relatórios / métricas do atendimento (SÓ administrador)
  app.get("/api/wa/reports", async (req, res) => {
    const user = await auth(req, res);
    if (!user) return;
    if (user.role !== "admin") return res.status(403).json({ error: "apenas administradores" });
    const db = await getDb();
    if (!db) return res.json({});
    try {
      const period = (req.query.period as string) || "7d";
      const nowMs = Date.now();
      let since: Date;
      if (period === "today") {
        const sp = new Date(nowMs - 3 * 3600 * 1000); sp.setUTCHours(0, 0, 0, 0);
        since = new Date(sp.getTime() + 3 * 3600 * 1000); // meia-noite de hoje (fuso SP) em UTC
      } else if (period === "30d") since = new Date(nowMs - 30 * 24 * 3600 * 1000);
      else since = new Date(nowMs - 7 * 24 * 3600 * 1000);

      // Situação AGORA (independente do período)
      const agora = (await db.select({
        fila: sql<number>`coalesce(sum(case when ${waConversations.status}='queue' then 1 else 0 end),0)`,
        ativo: sql<number>`coalesce(sum(case when ${waConversations.status}='active' then 1 else 0 end),0)`,
        esperaMaisAntigo: sql<number>`coalesce(max(case when ${waConversations.status}='queue' then timestampdiff(second, coalesce(${waConversations.queuedAt}, ${waConversations.createdAt}), now()) end),0)`,
      }).from(waConversations))[0];

      // No PERÍODO
      const periodo = (await db.select({
        novas: sql<number>`coalesce(sum(case when ${waConversations.createdAt} >= ${since} then 1 else 0 end),0)`,
        concluidas: sql<number>`coalesce(sum(case when ${waConversations.status}='concluded' and ${waConversations.concludedAt} >= ${since} then 1 else 0 end),0)`,
        esperaMedia: sql<number>`coalesce(round(avg(case when ${waConversations.assignedAt} is not null and ${waConversations.queuedAt} is not null and ${waConversations.assignedAt} >= ${since} then timestampdiff(second, ${waConversations.queuedAt}, ${waConversations.assignedAt}) end)),0)`,
        duracaoMedia: sql<number>`coalesce(round(avg(case when ${waConversations.status}='concluded' and ${waConversations.concludedAt} is not null and ${waConversations.assignedAt} is not null and ${waConversations.concludedAt} >= ${since} then timestampdiff(second, ${waConversations.assignedAt}, ${waConversations.concludedAt}) end)),0)`,
      }).from(waConversations))[0];

      // Mensagens no período
      const mensagens = (await db.select({
        recebidas: sql<number>`coalesce(sum(case when ${waMessages.senderType}='contact' then 1 else 0 end),0)`,
        enviadas: sql<number>`coalesce(sum(case when ${waMessages.senderType}='agent' then 1 else 0 end),0)`,
      }).from(waMessages).where(sql`${waMessages.createdAt} >= ${since}`))[0];

      // Por atendente (no período)
      const atendentes = await db.select({
        id: waConversations.assignedAgentId,
        nome: sql<string>`(select coalesce(nullif(name,''), substring_index(email,'@',1)) from users where id = ${waConversations.assignedAgentId})`,
        concluidas: sql<number>`coalesce(sum(case when ${waConversations.status}='concluded' and ${waConversations.concludedAt} >= ${since} then 1 else 0 end),0)`,
        ativas: sql<number>`coalesce(sum(case when ${waConversations.status}='active' then 1 else 0 end),0)`,
        duracaoMedia: sql<number>`coalesce(round(avg(case when ${waConversations.status}='concluded' and ${waConversations.concludedAt} is not null and ${waConversations.assignedAt} is not null and ${waConversations.concludedAt} >= ${since} then timestampdiff(second, ${waConversations.assignedAt}, ${waConversations.concludedAt}) end)),0)`,
      }).from(waConversations).where(sql`${waConversations.assignedAgentId} is not null`).groupBy(waConversations.assignedAgentId);

      // Volume por dia (últimos 14 dias) para o gráfico
      const diario = await db.select({
        dia: sql<string>`date_format(${waConversations.createdAt}, '%d/%m')`,
        total: sql<number>`count(*)`,
      }).from(waConversations).where(sql`${waConversations.createdAt} >= ${new Date(nowMs - 14 * 24 * 3600 * 1000)}`).groupBy(sql`date(${waConversations.createdAt})`).orderBy(sql`date(${waConversations.createdAt})`);

      res.json({ period, agora, periodo, mensagens, atendentes: atendentes.filter((a) => a.id), diario });
    } catch (e: any) {
      console.error("[WA] reports:", e?.message);
      if (!res.headersSent) res.status(500).json({ error: e?.message || "falha ao gerar relatório" });
    }
  });

  // Histórico de uma conversa
  app.get("/api/wa/conversations/:id/messages", async (req, res) => {
    if (!(await auth(req, res))) return;
    const db = await getDb();
    if (!db) return res.json([]);
    const id = parseInt(req.params.id);
    // Mostra o HISTÓRICO COMPLETO do contato (todas as conversas dele), não só a conversa
    // atual — assim, quando uma conversa é concluída e o cliente escreve de novo (abrindo
    // uma nova conversa para fins de fila/metricas), o atendente continua vendo as mensagens
    // anteriores em vez de parecer que é a primeira mensagem.
    const conv = (await db.select({ contactId: waConversations.contactId }).from(waConversations).where(eq(waConversations.id, id)).limit(1))[0];
    if (!conv) return res.json([]);
    const rows = await db
      .select({
        id: waMessages.id,
        conversationId: waMessages.conversationId,
        senderType: waMessages.senderType,
        fromMe: waMessages.fromMe,
        content: waMessages.content,
        messageType: waMessages.messageType,
        replyTo: waMessages.replyTo,
        waMessageId: waMessages.waMessageId,
        status: waMessages.status,
        agentId: waMessages.agentId,
        createdAt: waMessages.createdAt,
        // JOIN único em users (antes eram 2 subconsultas POR mensagem = centenas de queries)
        agentName: sql<string | null>`coalesce(nullif(${users.name}, ''), substring_index(${users.email}, '@', 1))`,
        agentRole: users.role,
      })
      .from(waMessages)
      .innerJoin(waConversations, eq(waMessages.conversationId, waConversations.id))
      .leftJoin(users, eq(users.id, waMessages.agentId))
      .where(eq(waConversations.contactId, conv.contactId))
      .orderBy(desc(waMessages.id))
      .limit(150);
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
      // Responder citando uma mensagem (opcional): monta o objeto que o WhatsApp usa na citação
      let quotedMsg: any = undefined;
      const quotedId = (req.body?.quotedId || "").toString().trim();
      const quotedText = (req.body?.quotedText || "").toString().slice(0, 500);
      if (quotedId) {
        const q = (await db.select({ fromMe: waMessages.fromMe }).from(waMessages).where(eq(waMessages.waMessageId, quotedId)).limit(1))[0];
        quotedMsg = { key: { remoteJid: target, id: quotedId, fromMe: !!q?.fromMe }, message: { conversation: quotedText || " " } };
      }
      const sent = await sendToJid(target, outgoing, quotedMsg);
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
        replyTo: quotedId ? (quotedText || null) : null,
      });
      // Responder puxa a conversa para o atendente: vira "em atendimento" e, se não
      // tinha dono, passa a ser de quem respondeu.
      const claim = conv.status === "queue" || !conv.assignedAgentId;
      await db
        .update(waConversations)
        .set({ lastMessageAt: new Date(), status: "active", ...(claim ? { assignedAgentId: user.id, assignedAt: new Date() } : {}) })
        .where(eq(waConversations.id, id));
      if (claim) await sysMsg(db, id, `🟢 Atendimento iniciado por ${await nameOf(db, user.id)} ${nowBR()}`, user.id);
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

  // Enviar mídia (imagem, documento, áudio) — recebe base64
  app.post("/api/wa/conversations/:id/send-media", async (req, res) => {
    const user = await auth(req, res);
    if (!user) return;
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "sem banco" });
    const id = parseInt(req.params.id);
    const { type, dataBase64, mimetype, fileName, caption } = req.body || {};
    if (!dataBase64) return res.status(400).json({ error: "arquivo vazio" });
    const { jid, conv, contact } = await convJid(db, id);
    if (!jid || !conv || !contact) return res.status(404).json({ error: "conversa não encontrada" });
    try {
      let buffer = Buffer.from(String(dataBase64).split(",").pop() || "", "base64");
      let outMime = mimetype as string | undefined;
      // Chrome grava áudio em webm, que o WhatsApp NÃO aceita. Converte para ogg/opus antes de
      // enviar (o codec já costuma ser opus, então é só reempacotar — rápido e sem perda).
      if ((type || "") === "audio") {
        try {
          buffer = await convertAudioToOgg(buffer);
          outMime = "audio/ogg; codecs=opus";
        } catch (e: any) {
          console.warn("[WA] conversão de áudio falhou, enviando original:", e?.message);
        }
      }
      const { sendMedia } = await import("./connection");
      const sent = await sendMedia(jid, { type: type || "document", data: buffer, mimetype: outMime, fileName, caption });
      const waId = (sent as any)?.key?.id || null;
      // Guarda o arquivo enviado (data URL) para reproduzir/visualizar depois no painel.
      // Para áudio, guarda o OGG convertido (que o navegador toca), não o webm original.
      const mediaDataUrl = (type || "") === "audio"
        ? `data:audio/ogg; codecs=opus;base64,${buffer.toString("base64")}`
        : (typeof dataBase64 === "string" && dataBase64.startsWith("data:")
            ? dataBase64
            : (mimetype ? `data:${mimetype};base64,${String(dataBase64).split(",").pop() || ""}` : null));
      await db.insert(waMessages).values({
        conversationId: id, senderType: "agent", fromMe: true,
        content: caption || fileName || null, messageType: (type || "document") as any,
        waMessageId: waId, status: "sent", agentId: user.id, mediaUrl: mediaDataUrl,
      });
      const claim = conv.status === "queue" || !conv.assignedAgentId;
      await db.update(waConversations).set({ lastMessageAt: new Date(), status: "active", ...(claim ? { assignedAgentId: user.id, assignedAt: new Date() } : {}) }).where(eq(waConversations.id, id));
      waEvents.emit("wa", { kind: "message", conversationId: id, contactId: contact.id, number: contact.waNumber, fromMe: true, text: caption || fileName || "", type: type || "document" });
      res.json({ ok: true });
    } catch (e: any) { res.status(502).json({ error: e?.message || "falha ao enviar mídia" }); }
  });

  // Excluir mensagem (apaga para todos) — só as que o atendente enviou
  app.post("/api/wa/conversations/:id/messages/:msgId/delete", async (req, res) => {
    const user = await auth(req, res);
    if (!user) return;
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "sem banco" });
    const msgId = parseInt(req.params.msgId);
    const m = (await db.select().from(waMessages).where(eq(waMessages.id, msgId)).limit(1))[0];
    if (!m || !m.waMessageId || !m.fromMe) return res.status(400).json({ error: "só é possível apagar mensagens enviadas por você" });
    const { jid } = await convJid(db, m.conversationId);
    if (!jid) return res.status(404).json({ error: "conversa não encontrada" });
    try {
      const { deleteMessage } = await import("./connection");
      await deleteMessage(jid, { remoteJid: jid, id: m.waMessageId, fromMe: true });
      await db.update(waMessages).set({ content: "🚫 Mensagem apagada", messageType: "other" }).where(eq(waMessages.id, msgId));
      waEvents.emit("wa", { kind: "message", conversationId: m.conversationId, contactId: 0, number: "", fromMe: true, text: "", type: "delete" });
      res.json({ ok: true });
    } catch (e: any) { res.status(502).json({ error: e?.message || "falha ao apagar" }); }
  });

  // Editar mensagem — só as que o atendente enviou (texto)
  app.post("/api/wa/conversations/:id/messages/:msgId/edit", async (req, res) => {
    const user = await auth(req, res);
    if (!user) return;
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "sem banco" });
    const msgId = parseInt(req.params.msgId);
    const text = (req.body?.text || "").toString().trim();
    if (!text) return res.status(400).json({ error: "texto vazio" });
    const m = (await db.select().from(waMessages).where(eq(waMessages.id, msgId)).limit(1))[0];
    if (!m || !m.waMessageId || !m.fromMe) return res.status(400).json({ error: "só é possível editar mensagens enviadas por você" });
    const { jid } = await convJid(db, m.conversationId);
    if (!jid) return res.status(404).json({ error: "conversa não encontrada" });
    try {
      const { editMessage } = await import("./connection");
      await editMessage(jid, { remoteJid: jid, id: m.waMessageId, fromMe: true }, text);
      await db.update(waMessages).set({ content: text }).where(eq(waMessages.id, msgId));
      waEvents.emit("wa", { kind: "message", conversationId: m.conversationId, contactId: 0, number: "", fromMe: true, text: "", type: "edit" });
      res.json({ ok: true });
    } catch (e: any) { res.status(502).json({ error: e?.message || "falha ao editar" }); }
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
    await db.update(waConversations).set({ assignedAgentId: agentId, status: "active", concludedAt: null, assignedAt: new Date() }).where(eq(waConversations.id, id));
    const who = await nameOf(db, agentId);
    if (agentId === user.id) await sysMsg(db, id, `🟢 Atendimento iniciado por ${who} ${nowBR()}`, user.id);
    else await sysMsg(db, id, `🟢 Atendimento atribuído por ${await nameOf(db, user.id)} para ${who} ${nowBR()}`, user.id);
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
    await sysMsg(db, id, `✅ Atendimento concluído por ${await nameOf(db, user.id)} ${nowBR()}`, user.id);
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
    await db.update(waConversations).set({ status: "queue", assignedAgentId: null, concludedAt: null, queuedAt: new Date() }).where(eq(waConversations.id, id));
    await sysMsg(db, id, `↩️ Devolvido à fila por ${await nameOf(db, user.id)} ${nowBR()}`, user.id);
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
    const fromName = await nameOf(db, user.id);
    const toName = await nameOf(db, toId);
    await db.update(waConversations).set({ assignedAgentId: toId, status: "active", concludedAt: null, assignedAt: new Date() }).where(eq(waConversations.id, id));
    await sysMsg(db, id, `🔁 Transferido por ${fromName} para ${toName} ${nowBR()}${note ? `\n💬 ${note}` : ""}`, user.id);
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
      .where(sql`${clients.active} = 1`)
      .orderBy(clients.name)
      .limit(2000);
    res.json(rows);
  });

  // Iniciar conversa (por número novo ou por cliente cadastrado)
  app.post("/api/wa/start-conversation", async (req, res) => {
    const user = await auth(req, res);
    if (!user) return;
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "sem banco" });
    try {
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
    } catch (e: any) {
      console.error("[WA] start-conversation:", e?.message);
      if (!res.headersSent) res.status(500).json({ error: e?.message || "falha ao iniciar a conversa" });
    }
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

  // Salvar um novo contato manualmente (qualquer usuário) — nome, número e empresa opcional
  app.post("/api/wa/contacts", async (req, res) => {
    const user = await auth(req, res);
    if (!user) return;
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "sem banco" });
    const number = normalizeBR(req.body?.number || "");
    const name = (req.body?.name || "").toString().trim() || null;
    const clientId = req.body?.clientId ? parseInt(req.body.clientId) : null;
    if (!number || number.length < 12) return res.status(400).json({ error: "número inválido (use DDD)" });
    const exists = (await db.select().from(waContacts).where(eq(waContacts.waNumber, number)).limit(1))[0];
    if (exists) {
      await db.update(waContacts).set({ ...(name ? { name } : {}), ...(clientId ? { clientId } : {}) }).where(eq(waContacts.id, exists.id));
      return res.json({ ok: true, id: exists.id, existed: true });
    }
    await db.insert(waContacts).values({ waNumber: number, jid: `${number}@s.whatsapp.net`, name, clientId });
    const created = (await db.select().from(waContacts).where(eq(waContacts.waNumber, number)).limit(1))[0];
    res.json({ ok: true, id: created?.id });
  });

  // Editar contato: nome e empresa (qualquer usuário); número (SÓ administrador)
  app.post("/api/wa/contacts/:id/edit", async (req, res) => {
    const user = await auth(req, res);
    if (!user) return;
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "sem banco" });
    const id = parseInt(req.params.id);
    const patch: any = {};
    if (typeof req.body?.name === "string") patch.name = req.body.name.trim() || null;
    if (req.body?.clientId !== undefined) patch.clientId = req.body.clientId ? parseInt(req.body.clientId) : null;
    if (req.body?.number !== undefined && req.body.number !== null) {
      if (user.role !== "admin") return res.status(403).json({ error: "apenas administradores podem alterar o número" });
      const number = normalizeBR(req.body.number || "");
      if (!number || number.length < 12) return res.status(400).json({ error: "número inválido (use DDD)" });
      const clash = (await db.select().from(waContacts).where(eq(waContacts.waNumber, number)).limit(1))[0];
      if (clash && clash.id !== id) return res.status(400).json({ error: "já existe um contato com esse número" });
      patch.waNumber = number;
      patch.jid = `${number}@s.whatsapp.net`;
    }
    if (Object.keys(patch).length) await db.update(waContacts).set(patch).where(eq(waContacts.id, id));
    res.json({ ok: true });
  });
}
