import { z } from "zod";
import { adminProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  financialClientConfig,
  financialTitulos,
  financialPayments,
  financialConfig,
  financialPayables,
  clients,
} from "../drizzle/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { sendEmail } from "./email";
import { buildPixBRCode } from "./pix";

const APP_URL = process.env.APP_URL || "https://gestaodetarefasequilibrium.onrender.com";

const money = z.string().regex(/^\d+([.,]\d{1,2})?$/, "valor inválido").transform((v) => v.replace(",", "."));

const brl = (v: any) => "R$ " + Number(String(v ?? 0).replace(",", ".")).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Ajusta o vencimento se cair em fim de semana (regra do cliente, inspirado no OMIE).
function adjustWeekend(d: Date, rule: string | null): Date {
  const day = d.getDay(); // 0 = domingo, 6 = sábado
  if (rule === "antecipa") {
    if (day === 0) d.setDate(d.getDate() - 2);
    else if (day === 6) d.setDate(d.getDate() - 1);
  } else if (rule === "posterga") {
    if (day === 6) d.setDate(d.getDate() + 2);
    else if (day === 0) d.setDate(d.getDate() + 1);
  }
  return d;
}

// HTML do e-mail de cobrança: valor, vencimento, PIX (QR + copia e cola) e botão de comprovante.
function buildCobrancaEmail(opts: { tituloId: number; baseUrl: string; clientName: string; description: string; amount: string; dueDate: Date; competencia?: string | null; pix?: any; reminder?: boolean }): string {
  const venc = opts.dueDate.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const compUrl = `${opts.baseUrl}/cobranca/${opts.tituloId}`;
  const reminderBanner = opts.reminder
    ? `<div style="background:#fef3c7;border:1px solid #fcd34d;color:#92400e;padding:10px 14px;border-radius:8px;margin-bottom:14px;font-size:13px"><strong>Lembrete:</strong> identificamos que a cobrança abaixo continua em aberto. Se já pagou, é só enviar o comprovante.</div>`
    : "";
  let pixBlock: string;
  if (opts.pix?.active && opts.pix?.pixKey) {
    let copiaCola = "";
    try {
      copiaCola = buildPixBRCode({ key: opts.pix.pixKey, keyType: opts.pix.pixKeyType || undefined, name: opts.pix.beneficiaryName || "Equilibrium", city: "Rio Claro", amount: opts.amount, txid: `T${opts.tituloId}` });
    } catch { copiaCola = ""; }
    pixBlock = `<tr><td style="padding:16px 0;border-top:1px solid #eee">
      <strong>Pague com PIX</strong><br/>
      <div style="text-align:center;margin:10px 0">
        <img src="${opts.baseUrl}/api/financeiro/pix-qr/${opts.tituloId}.png" alt="QR Code PIX" width="200" height="200" style="border:1px solid #eee;border-radius:8px"/>
      </div>
      ${copiaCola ? `<div style="font-size:12px;color:#555;margin-bottom:4px">PIX copia e cola:</div>
      <div style="word-break:break-all;background:#f3f4f6;padding:10px;border-radius:6px;font-family:monospace;font-size:11px">${copiaCola}</div>` : ""}
      ${opts.pix.beneficiaryName ? `<div style="font-size:12px;color:#555;margin-top:8px">Beneficiário: ${opts.pix.beneficiaryName}</div>` : ""}
      ${opts.pix.instructions ? `<div style="font-size:12px;color:#555;margin-top:4px">${opts.pix.instructions}</div>` : ""}
    </td></tr>`;
  } else {
    pixBlock = `<tr><td style="padding:16px 0;border-top:1px solid #eee;color:#555">Os dados para pagamento serão informados pelo escritório.</td></tr>`;
  }
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#222">
    <h2 style="color:#24646c">Equilibrium Consultoria Contábil</h2>
    ${reminderBanner}
    <p>Olá, ${opts.clientName || "cliente"}.</p>
    <p>Segue a cobrança referente a <strong>${opts.description}</strong>${opts.competencia ? " (competência " + opts.competencia + ")" : ""}.</p>
    <table style="width:100%;border-collapse:collapse;margin:12px 0">
      <tr><td style="padding:8px 0"><strong>Valor</strong></td><td style="text-align:right;font-size:20px;font-weight:bold;color:#24646c">${brl(opts.amount)}</td></tr>
      <tr><td style="padding:8px 0"><strong>Vencimento</strong></td><td style="text-align:right">${venc}</td></tr>
      ${pixBlock}
    </table>
    <div style="text-align:center;margin:20px 0">
      <a href="${compUrl}" style="display:inline-block;background:#24646c;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">Já paguei — enviar comprovante</a>
    </div>
    <p style="color:#888;font-size:12px">Ao enviar o comprovante, ele fica em conferência e o escritório dá baixa após validar. Se já enviou, desconsidere.</p>
  </div>`;
}

// Gera o título de honorário de uma competência a partir da config, sem duplicar. Reutilizado
// pelo botão "play" e pelo job mensal automático.
export async function gerarTituloHonorario(db: any, cfg: any, comp: string): Promise<{ created: boolean }> {
  if (!cfg?.honorarioValue || !cfg?.dueDay) return { created: false };
  const [mm, yyyy] = comp.split("/").map(Number);
  const due = adjustWeekend(new Date(yyyy, mm - 1, cfg.dueDay), cfg.weekendRule);
  const sendDate = cfg.sendDay ? new Date(yyyy, mm - 1, cfg.sendDay) : null;
  const existing = (await db.select({ id: financialTitulos.id }).from(financialTitulos)
    .where(and(eq(financialTitulos.clientId, cfg.clientId), eq(financialTitulos.kind, "honorario"), eq(financialTitulos.competencia, comp), sql`${financialTitulos.status} <> 'cancelado'`)).limit(1))[0];
  if (existing) return { created: false };
  await db.insert(financialTitulos).values({
    clientId: cfg.clientId, kind: "honorario", description: `Honorário ${comp}`, category: "Honorário",
    amount: cfg.honorarioValue, competencia: comp, dueDate: due, sendDate, status: "aberto", origin: "recorrencia", recurringConfigId: cfg.id,
  });
  return { created: true };
}
export function compAtual(d = new Date()): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// Envia (ou reenvia como lembrete) a cobrança de um título por e-mail. Reutilizado pela procedure
// manual e pela régua automática. Retorna { ok, to } ou { ok:false, reason }.
export async function enviarCobrancaPorId(db: any, tituloId: number, opts?: { reminder?: boolean }): Promise<{ ok: boolean; to?: string; reason?: string }> {
  const row = (await db
    .select({ id: financialTitulos.id, status: financialTitulos.status, description: financialTitulos.description, amount: financialTitulos.amount, competencia: financialTitulos.competencia, dueDate: financialTitulos.dueDate, clientName: clients.name, clientEmail: clients.email, billingEmail: financialClientConfig.billingEmail })
    .from(financialTitulos).leftJoin(clients, eq(clients.id, financialTitulos.clientId)).leftJoin(financialClientConfig, eq(financialClientConfig.clientId, financialTitulos.clientId))
    .where(eq(financialTitulos.id, tituloId)).limit(1))[0];
  if (!row) return { ok: false, reason: "não encontrado" };
  const to = row.billingEmail || row.clientEmail;
  if (!to) return { ok: false, reason: "sem e-mail" };
  const pix = (await db.select().from(financialConfig).where(eq(financialConfig.id, 1)).limit(1))[0];
  const html = buildCobrancaEmail({ tituloId: row.id, baseUrl: APP_URL, clientName: row.clientName || "", description: row.description, amount: row.amount, dueDate: new Date(row.dueDate as any), competencia: row.competencia, pix, reminder: opts?.reminder });
  const subject = opts?.reminder ? `Lembrete de cobrança - ${row.description}` : `Cobrança - ${row.description}`;
  await sendEmail({ to, subject, html });
  if (opts?.reminder) {
    await db.update(financialTitulos).set({ reminderSentAt: new Date(), updatedAt: new Date() }).where(eq(financialTitulos.id, tituloId));
  } else {
    await db.update(financialTitulos).set({ status: row.status === "pago" ? "pago" : "enviado", sentAt: new Date(), updatedAt: new Date() }).where(eq(financialTitulos.id, tituloId));
  }
  return { ok: true, to };
}

export const financeiroRouter = router({
  // ── Painel: resumo ──────────────────────────────────────────────────────────
  dashboard: adminProcedure.query(async () => {
    const db = await getDb();
    const empty = { aReceber: "0.00", recebido: "0.00", aPagar: "0.00", pago: "0.00", saldo: "0.00", vencidos: 0, emConferencia: 0, honorariosAtivos: 0 };
    if (!db) return empty;
    try {
      const sum = (whereStatus: string[]) =>
        db
          .select({ total: sql<string>`coalesce(sum(cast(${financialTitulos.amount} as decimal(12,2))), 0)` })
          .from(financialTitulos)
          .where(sql`${financialTitulos.status} in (${sql.join(whereStatus.map((s) => sql`${s}`), sql`, `)})`);
      const sumPay = (whereStatus: string[]) =>
        db
          .select({ total: sql<string>`coalesce(sum(cast(${financialPayables.amount} as decimal(12,2))), 0)` })
          .from(financialPayables)
          .where(sql`${financialPayables.status} in (${sql.join(whereStatus.map((s) => sql`${s}`), sql`, `)})`);
      const [aReceber] = await sum(["aberto", "enviado", "em_conferencia", "vencido"]);
      const [recebido] = await sum(["pago"]);
      const [aPagar] = await sumPay(["aberto", "vencido"]);
      const [pago] = await sumPay(["pago"]);
      const [venc] = await db.select({ n: sql<number>`count(*)` }).from(financialTitulos).where(eq(financialTitulos.status, "vencido"));
      const [conf] = await db.select({ n: sql<number>`count(*)` }).from(financialTitulos).where(eq(financialTitulos.status, "em_conferencia"));
      const [hon] = await db.select({ n: sql<number>`count(*)` }).from(financialClientConfig).where(and(eq(financialClientConfig.hasHonorario, true), eq(financialClientConfig.active, true)));
      const recebidoN = Number(recebido?.total ?? 0);
      const pagoN = Number(pago?.total ?? 0);
      return {
        aReceber: Number(aReceber?.total ?? 0).toFixed(2),
        recebido: recebidoN.toFixed(2),
        aPagar: Number(aPagar?.total ?? 0).toFixed(2),
        pago: pagoN.toFixed(2),
        saldo: (recebidoN - pagoN).toFixed(2),
        vencidos: Number(venc?.n ?? 0),
        emConferencia: Number(conf?.n ?? 0),
        honorariosAtivos: Number(hon?.n ?? 0),
      };
    } catch (e: any) {
      console.warn("[Financeiro] dashboard:", e?.message);
      return empty;
    }
  }),

  // ── Dados para os gráficos do dashboard ──────────────────────────────────────
  // Fluxo projetado (a receber x a pagar por mês futuro), recebido x pago por mês (histórico),
  // e quebra por categoria. Retorna arrays crus; o frontend monta os eixos.
  dashboardCharts: adminProcedure.query(async () => {
    const db = await getDb();
    const empty = { recFuturo: [] as any[], pagFuturo: [] as any[], recebidoMensal: [] as any[], pagoMensal: [] as any[], catReceita: [] as any[], catDespesa: [] as any[] };
    if (!db) return empty;
    const num = (v: any) => Number(v ?? 0);
    try {
      const recFuturo = await db.select({ mes: sql<string>`DATE_FORMAT(${financialTitulos.dueDate}, '%Y-%m')`, total: sql<string>`coalesce(sum(cast(${financialTitulos.amount} as decimal(12,2))),0)` })
        .from(financialTitulos).where(sql`${financialTitulos.status} in ('aberto','enviado','em_conferencia','vencido')`).groupBy(sql`DATE_FORMAT(${financialTitulos.dueDate}, '%Y-%m')`);
      const pagFuturo = await db.select({ mes: sql<string>`DATE_FORMAT(${financialPayables.dueDate}, '%Y-%m')`, total: sql<string>`coalesce(sum(cast(${financialPayables.amount} as decimal(12,2))),0)` })
        .from(financialPayables).where(sql`${financialPayables.status} in ('aberto','vencido')`).groupBy(sql`DATE_FORMAT(${financialPayables.dueDate}, '%Y-%m')`);
      const recebidoMensal = await db.select({ mes: sql<string>`DATE_FORMAT(${financialPayments.paidDate}, '%Y-%m')`, total: sql<string>`coalesce(sum(cast(${financialPayments.amount} as decimal(12,2))),0)` })
        .from(financialPayments).where(sql`${financialPayments.status}='confirmado' and ${financialPayments.paidDate} is not null`).groupBy(sql`DATE_FORMAT(${financialPayments.paidDate}, '%Y-%m')`);
      const pagoMensal = await db.select({ mes: sql<string>`DATE_FORMAT(${financialPayables.paidDate}, '%Y-%m')`, total: sql<string>`coalesce(sum(cast(${financialPayables.amount} as decimal(12,2))),0)` })
        .from(financialPayables).where(sql`${financialPayables.status}='pago' and ${financialPayables.paidDate} is not null`).groupBy(sql`DATE_FORMAT(${financialPayables.paidDate}, '%Y-%m')`);
      const catReceita = await db.select({ categoria: financialTitulos.category, total: sql<string>`coalesce(sum(cast(${financialTitulos.amount} as decimal(12,2))),0)` })
        .from(financialTitulos).where(sql`${financialTitulos.status} <> 'cancelado'`).groupBy(financialTitulos.category);
      const catDespesa = await db.select({ categoria: financialPayables.category, total: sql<string>`coalesce(sum(cast(${financialPayables.amount} as decimal(12,2))),0)` })
        .from(financialPayables).where(sql`${financialPayables.status} <> 'cancelado'`).groupBy(financialPayables.category);
      return {
        recFuturo: recFuturo.map((r) => ({ mes: r.mes, total: num(r.total) })),
        pagFuturo: pagFuturo.map((r) => ({ mes: r.mes, total: num(r.total) })),
        recebidoMensal: recebidoMensal.map((r) => ({ mes: r.mes, total: num(r.total) })),
        pagoMensal: pagoMensal.map((r) => ({ mes: r.mes, total: num(r.total) })),
        catReceita: catReceita.map((r) => ({ categoria: r.categoria ?? "Sem categoria", total: num(r.total) })),
        catDespesa: catDespesa.map((r) => ({ categoria: r.categoria ?? "Sem categoria", total: num(r.total) })),
      };
    } catch (e: any) {
      console.warn("[Financeiro] dashboardCharts:", e?.message);
      return empty;
    }
  }),

  // ── Clientes + configuração de honorário (aba Honorários) ────────────────────
  clientsWithConfig: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select({
        clientId: clients.id,
        name: clients.name,
        cnpj: clients.cnpj,
        email: clients.email,
        hasHonorario: financialClientConfig.hasHonorario,
        honorarioValue: financialClientConfig.honorarioValue,
        dueDay: financialClientConfig.dueDay,
        sendDay: financialClientConfig.sendDay,
        weekendRule: financialClientConfig.weekendRule,
        billingEmail: financialClientConfig.billingEmail,
        recurring: financialClientConfig.recurring,
        activated: financialClientConfig.activated,
        configId: financialClientConfig.id,
      })
      .from(clients)
      .leftJoin(financialClientConfig, eq(financialClientConfig.clientId, clients.id))
      .where(eq(clients.active, true))
      .orderBy(clients.name);
  }),

  upsertClientConfig: adminProcedure
    .input(
      z.object({
        clientId: z.number(),
        hasHonorario: z.boolean(),
        honorarioValue: money.optional(),
        dueDay: z.number().min(1).max(28).optional(),
        sendDay: z.number().min(1).max(28).optional(),
        weekendRule: z.enum(["mantem", "antecipa", "posterga"]).default("mantem"),
        recurring: z.boolean().default(true),
        billingEmail: z.string().email().optional().or(z.literal("")),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("sem banco");
      const values = {
        clientId: input.clientId,
        hasHonorario: input.hasHonorario,
        honorarioValue: input.honorarioValue ?? null,
        dueDay: input.dueDay ?? null,
        sendDay: input.sendDay ?? null,
        weekendRule: input.weekendRule,
        recurring: input.recurring,
        billingEmail: input.billingEmail || null,
        updatedAt: new Date(),
      };
      const existing = (await db.select({ id: financialClientConfig.id }).from(financialClientConfig).where(eq(financialClientConfig.clientId, input.clientId)).limit(1))[0];
      if (existing) await db.update(financialClientConfig).set(values).where(eq(financialClientConfig.id, existing.id));
      else await db.insert(financialClientConfig).values(values as any);
      return { ok: true };
    }),

  // ── Títulos (contas a receber) ───────────────────────────────────────────────
  listTitulos: adminProcedure
    .input(z.object({ status: z.string().optional(), clientId: z.number().optional(), kind: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conds: any[] = [];
      if (input?.status && input.status !== "todos") conds.push(eq(financialTitulos.status, input.status as any));
      if (input?.clientId) conds.push(eq(financialTitulos.clientId, input.clientId));
      if (input?.kind && input.kind !== "todos") conds.push(eq(financialTitulos.kind, input.kind as any));
      return db
        .select({
          id: financialTitulos.id,
          clientId: financialTitulos.clientId,
          clientName: clients.name,
          kind: financialTitulos.kind,
          description: financialTitulos.description,
          category: financialTitulos.category,
          amount: financialTitulos.amount,
          competencia: financialTitulos.competencia,
          dueDate: financialTitulos.dueDate,
          sendDate: financialTitulos.sendDate,
          status: financialTitulos.status,
          origin: financialTitulos.origin,
          sentAt: financialTitulos.sentAt,
          createdAt: financialTitulos.createdAt,
        })
        .from(financialTitulos)
        .leftJoin(clients, eq(clients.id, financialTitulos.clientId))
        .where(conds.length ? and(...conds) : sql`1=1`)
        .orderBy(desc(financialTitulos.dueDate))
        .limit(500);
    }),

  createTitulo: adminProcedure
    .input(
      z.object({
        clientId: z.number(),
        kind: z.enum(["honorario", "eventual"]).default("eventual"),
        description: z.string().min(1),
        category: z.string().optional(),
        amount: money,
        competencia: z.string().regex(/^\d{2}\/\d{4}$/).optional(),
        dueDate: z.string(),
        sendDate: z.string().optional(),
        status: z.enum(["rascunho", "aberto"]).default("aberto"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("sem banco");
      const result = await db.insert(financialTitulos).values({
        clientId: input.clientId,
        kind: input.kind,
        description: input.description,
        category: input.category || (input.kind === "honorario" ? "Honorário" : "Serviço eventual"),
        amount: input.amount,
        competencia: input.competencia || null,
        dueDate: new Date(input.dueDate),
        sendDate: input.sendDate ? new Date(input.sendDate) : null,
        status: input.status,
        origin: "manual",
      } as any);
      return { ok: true, id: (result as any)[0]?.insertId };
    }),

  updateTitulo: adminProcedure
    .input(
      z.object({
        id: z.number(),
        description: z.string().optional(),
        category: z.string().optional(),
        amount: money.optional(),
        competencia: z.string().optional(),
        dueDate: z.string().optional(),
        sendDate: z.string().optional(),
        status: z.enum(["rascunho", "aberto", "enviado", "vencido"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("sem banco");
      const patch: any = { updatedAt: new Date() };
      if (input.description !== undefined) patch.description = input.description;
      if (input.category !== undefined) patch.category = input.category;
      if (input.amount !== undefined) patch.amount = input.amount;
      if (input.competencia !== undefined) patch.competencia = input.competencia || null;
      if (input.dueDate !== undefined) patch.dueDate = new Date(input.dueDate);
      if (input.sendDate !== undefined) patch.sendDate = input.sendDate ? new Date(input.sendDate) : null;
      if (input.status !== undefined) patch.status = input.status;
      await db.update(financialTitulos).set(patch).where(eq(financialTitulos.id, input.id));
      return { ok: true };
    }),

  cancelTitulo: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("sem banco");
    await db.update(financialTitulos).set({ status: "cancelado", updatedAt: new Date() }).where(eq(financialTitulos.id, input.id));
    return { ok: true };
  }),

  // Exclui de vez o título (para erros de teste ou lançamentos que não deveriam existir).
  // Remove também eventuais comprovantes/baixas ligados a ele.
  deleteTitulo: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("sem banco");
    await db.delete(financialPayments).where(eq(financialPayments.tituloId, input.id));
    await db.delete(financialTitulos).where(eq(financialTitulos.id, input.id));
    return { ok: true };
  }),

  // ── Baixa manual (dar como pago) e reversão ──────────────────────────────────
  baixaManual: adminProcedure
    .input(z.object({ tituloId: z.number(), amount: money.optional(), paidDate: z.string().optional(), method: z.string().optional(), note: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("sem banco");
      const titulo = (await db.select().from(financialTitulos).where(eq(financialTitulos.id, input.tituloId)).limit(1))[0];
      if (!titulo) throw new Error("título não encontrado");
      await db.insert(financialPayments).values({
        tituloId: input.tituloId,
        amount: input.amount ?? titulo.amount,
        paidDate: input.paidDate ? new Date(input.paidDate) : new Date(),
        method: input.method || "manual",
        status: "confirmado",
        submittedByClient: false,
        confirmedBy: ctx.user!.id,
        confirmedAt: new Date(),
        note: input.note || "Baixa manual",
      } as any);
      await db.update(financialTitulos).set({ status: "pago", updatedAt: new Date() }).where(eq(financialTitulos.id, input.tituloId));
      return { ok: true };
    }),

  reverterBaixa: adminProcedure.input(z.object({ tituloId: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("sem banco");
    // Remove baixas confirmadas e reabre o título
    await db.update(financialPayments).set({ status: "rejeitado", note: sql`concat(coalesce(note,''), ' (revertida)')` }).where(and(eq(financialPayments.tituloId, input.tituloId), eq(financialPayments.status, "confirmado")));
    await db.update(financialTitulos).set({ status: "aberto", updatedAt: new Date() }).where(eq(financialTitulos.id, input.tituloId));
    return { ok: true };
  }),

  // Comprovantes de um título (para conferência)
  listPayments: adminProcedure.input(z.object({ tituloId: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(financialPayments).where(eq(financialPayments.tituloId, input.tituloId)).orderBy(desc(financialPayments.createdAt));
  }),

  // Confere um comprovante enviado pelo cliente: confirma (dá baixa) ou rejeita
  conferirComprovante: adminProcedure
    .input(z.object({ paymentId: z.number(), decisao: z.enum(["confirmar", "rejeitar"]), note: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("sem banco");
      const pay = (await db.select().from(financialPayments).where(eq(financialPayments.id, input.paymentId)).limit(1))[0];
      if (!pay) throw new Error("comprovante não encontrado");
      await db.update(financialPayments).set({
        status: input.decisao === "confirmar" ? "confirmado" : "rejeitado",
        confirmedBy: ctx.user!.id, confirmedAt: new Date(), note: input.note || pay.note,
      }).where(eq(financialPayments.id, input.paymentId));
      // título: pago se confirmou; volta para enviado se rejeitou
      await db.update(financialTitulos).set({ status: input.decisao === "confirmar" ? "pago" : "enviado", updatedAt: new Date() }).where(eq(financialTitulos.id, pay.tituloId));
      return { ok: true };
    }),

  // ── Ativar ("play"), pausar e gerar honorário ────────────────────────────────
  // "Play": marca como ativo e já gera a cobrança do mês atual. Se for recorrente, o job mensal
  // gera os próximos meses sozinho. Se for mês único, gera só este e não repete.
  ativarHonorario: adminProcedure.input(z.object({ clientId: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("sem banco");
    const cfg = (await db.select().from(financialClientConfig).where(eq(financialClientConfig.clientId, input.clientId)).limit(1))[0];
    if (!cfg || !cfg.hasHonorario) throw new Error("Cliente sem honorário configurado");
    if (!cfg.honorarioValue || !cfg.dueDay) throw new Error("Configure valor e dia de vencimento antes de ativar");
    const comp = compAtual();
    const { created } = await gerarTituloHonorario(db, cfg, comp);
    await db.update(financialClientConfig).set({ activated: true, lastGenComp: comp, updatedAt: new Date() }).where(eq(financialClientConfig.id, cfg.id));
    return { ok: true, competencia: comp, created, recurring: cfg.recurring };
  }),

  pausarHonorario: adminProcedure.input(z.object({ clientId: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("sem banco");
    await db.update(financialClientConfig).set({ activated: false, updatedAt: new Date() }).where(eq(financialClientConfig.clientId, input.clientId));
    return { ok: true };
  }),

  // Geração manual avulsa de um mês específico (sem mexer no play/recorrência)
  gerarCobrancaMes: adminProcedure
    .input(z.object({ clientId: z.number(), competencia: z.string().regex(/^\d{2}\/\d{4}$/).optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("sem banco");
      const cfg = (await db.select().from(financialClientConfig).where(eq(financialClientConfig.clientId, input.clientId)).limit(1))[0];
      if (!cfg || !cfg.hasHonorario) throw new Error("Cliente sem honorário configurado");
      if (!cfg.honorarioValue || !cfg.dueDay) throw new Error("Configure o valor e o dia de vencimento do honorário primeiro");
      const comp = input.competencia || compAtual();
      const { created } = await gerarTituloHonorario(db, cfg, comp);
      if (!created) throw new Error(`Já existe cobrança de honorário para ${comp}`);
      return { ok: true, competencia: comp };
    }),

  // ── Enviar a cobrança por e-mail (manual, disponível já na fase de teste) ─────
  enviarCobranca: adminProcedure.input(z.object({ tituloId: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("sem banco");
    const r = await enviarCobrancaPorId(db, input.tituloId);
    if (!r.ok) throw new Error(r.reason === "sem e-mail" ? "Cliente sem e-mail cadastrado" : "Título não encontrado");
    return { ok: true, to: r.to };
  }),

  // ── Contas a PAGAR (despesas do escritório) ──────────────────────────────────
  listPayables: adminProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conds: any[] = [];
      if (input?.status && input.status !== "todos") conds.push(eq(financialPayables.status, input.status as any));
      return db.select().from(financialPayables).where(conds.length ? and(...conds) : sql`1=1`).orderBy(desc(financialPayables.dueDate)).limit(500);
    }),

  createPayable: adminProcedure
    .input(z.object({ description: z.string().min(1), supplier: z.string().optional(), category: z.string().optional(), amount: money, dueDate: z.string(), recurring: z.boolean().default(false), note: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("sem banco");
      const r = await db.insert(financialPayables).values({
        description: input.description, supplier: input.supplier || null, category: input.category || null,
        amount: input.amount, dueDate: new Date(input.dueDate), recurring: input.recurring, note: input.note || null, status: "aberto",
      } as any);
      return { ok: true, id: (r as any)[0]?.insertId };
    }),

  updatePayable: adminProcedure
    .input(z.object({ id: z.number(), description: z.string().optional(), supplier: z.string().optional(), category: z.string().optional(), amount: money.optional(), dueDate: z.string().optional(), recurring: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("sem banco");
      const patch: any = { updatedAt: new Date() };
      for (const k of ["description", "supplier", "category", "amount", "recurring"] as const) if (input[k] !== undefined) patch[k] = input[k];
      if (input.dueDate !== undefined) patch.dueDate = new Date(input.dueDate);
      await db.update(financialPayables).set(patch).where(eq(financialPayables.id, input.id));
      return { ok: true };
    }),

  baixaPayable: adminProcedure.input(z.object({ id: z.number(), paidDate: z.string().optional() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("sem banco");
    await db.update(financialPayables).set({ status: "pago", paidDate: input.paidDate ? new Date(input.paidDate) : new Date(), paidBy: ctx.user!.id, updatedAt: new Date() }).where(eq(financialPayables.id, input.id));
    return { ok: true };
  }),

  reverterPayable: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("sem banco");
    await db.update(financialPayables).set({ status: "aberto", paidDate: null, updatedAt: new Date() }).where(eq(financialPayables.id, input.id));
    return { ok: true };
  }),

  deletePayable: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("sem banco");
    await db.delete(financialPayables).where(eq(financialPayables.id, input.id));
    return { ok: true };
  }),

  // ── Configuração global de recebimento (PIX / QR) ────────────────────────────
  getConfig: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const row = (await db.select().from(financialConfig).where(eq(financialConfig.id, 1)).limit(1))[0];
    return row ?? null;
  }),

  upsertConfig: adminProcedure
    .input(
      z.object({
        pixKey: z.string().optional(),
        pixKeyType: z.string().optional(),
        beneficiaryName: z.string().optional(),
        beneficiaryDoc: z.string().optional(),
        pixQrImage: z.string().optional(),
        instructions: z.string().optional(),
        active: z.boolean().optional(),
        autoCobranca: z.boolean().optional(),
        lembreteDias: z.number().min(0).max(60).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("sem banco");
      const values = {
        pixKey: input.pixKey ?? null,
        pixKeyType: input.pixKeyType ?? null,
        beneficiaryName: input.beneficiaryName ?? null,
        beneficiaryDoc: input.beneficiaryDoc ?? null,
        pixQrImage: input.pixQrImage ?? null,
        instructions: input.instructions ?? null,
        active: input.active ?? false,
        autoCobranca: input.autoCobranca ?? false,
        lembreteDias: input.lembreteDias ?? 2,
        updatedAt: new Date(),
      };
      const existing = (await db.select({ id: financialConfig.id }).from(financialConfig).where(eq(financialConfig.id, 1)).limit(1))[0];
      if (existing) await db.update(financialConfig).set(values).where(eq(financialConfig.id, 1));
      else await db.insert(financialConfig).values({ id: 1, ...values } as any);
      return { ok: true };
    }),
});
