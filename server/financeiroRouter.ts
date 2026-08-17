import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "./_core/trpc";
import { isFullAdmin, getScopeClientIds, assertClientInScope } from "./_core/scope";
import { getDb } from "./db";
import { signCobranca } from "./cobrancaToken";
import {
  financialClientConfig,
  financialTitulos,
  financialPayments,
  financialConfig,
  financialPayables,
  clients,
  tasks,
  users,
} from "../drizzle/schema";
import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { sendEmail } from "./email";
import { allEmails, allPhones } from "./recipients";
import { buildPixBRCode } from "./pix";

// PIX que uma cobrança deve usar: repasse (partner) → PIX da Equilibrium (global); cobrança do
// CLIENTE numa empresa de parceiro → PIX do parceiro (se ele tiver); senão, o global.
export async function getTituloPix(db: any, titulo: { audience?: string | null; partnerUserId?: number | null }): Promise<any> {
  const globalPix = (await db.select().from(financialConfig).where(eq(financialConfig.id, 1)).limit(1))[0];
  if (titulo.audience === "partner") return globalPix;
  if (titulo.partnerUserId) {
    const p = (await db.select({ name: users.name, pixKey: users.pixKey, pixKeyType: users.pixKeyType }).from(users).where(eq(users.id, titulo.partnerUserId)).limit(1))[0];
    if (p?.pixKey) return { active: true, pixKey: p.pixKey, pixKeyType: p.pixKeyType, beneficiaryName: p.name || "Parceiro", instructions: null };
  }
  return globalPix;
}

const APP_URL = process.env.APP_URL || "https://gestaodetarefasequilibrium.onrender.com";

const money = z.string().regex(/^\d+([.,]\d{1,2})?$/, "valor inválido").transform((v) => v.replace(",", "."));

const brl = (v: any) => "R$ " + Number(String(v ?? 0).replace(",", ".")).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Escopo por empresa (ADM Limitado) ────────────────────────────────────────
// ADM total enxerga tudo. ADM Limitado só as empresas vinculadas a ele: as listagens
// ganham um filtro por clientId; as escritas passam por assertFinClient.
// Retorna null (sem restrição) para ADM total, ou o array de clientIds permitidos.
async function scopeClientIds(ctx: any): Promise<number[] | null> {
  if (isFullAdmin(ctx.user)) return null;
  return [...(await getScopeClientIds(ctx.user.id))];
}
// Garante que o usuário pode agir sobre um lançamento daquela empresa. Despesas gerais do
// escritório (clientId nulo) só o ADM total pode mexer.
async function assertFinClient(user: any, clientId: number | null): Promise<void> {
  if (isFullAdmin(user)) return;
  if (clientId == null) throw new TRPCError({ code: "FORBIDDEN", message: "Lançamento fora do seu acesso." });
  await assertClientInScope(user, clientId);
}
async function tituloClientId(db: any, id: number): Promise<number | null> {
  const r = (await db.select({ c: financialTitulos.clientId }).from(financialTitulos).where(eq(financialTitulos.id, id)).limit(1))[0];
  return r?.c ?? null;
}
async function payableClientId(db: any, id: number): Promise<number | null> {
  const r = (await db.select({ c: financialPayables.clientId }).from(financialPayables).where(eq(financialPayables.id, id)).limit(1))[0];
  return r?.c ?? null;
}
// Guarda comum para ADM Limitado sem nenhuma empresa vinculada: não vê nada.
function scopeBlocksAll(scope: number[] | null): boolean {
  return scope !== null && scope.length === 0;
}

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
  const tok = signCobranca(opts.tituloId);
  const compUrl = `${opts.baseUrl}/cobranca/${opts.tituloId}?t=${tok}`;
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
        <img src="${opts.baseUrl}/api/financeiro/pix-qr/${opts.tituloId}.png?t=${tok}" alt="QR Code PIX" width="200" height="200" style="border:1px solid #eee;border-radius:8px"/>
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
  const existsFor = async (audience: string) =>
    (await db.select({ id: financialTitulos.id }).from(financialTitulos)
      .where(and(eq(financialTitulos.clientId, cfg.clientId), eq(financialTitulos.kind, "honorario"), eq(financialTitulos.competencia, comp), eq(financialTitulos.audience, audience), sql`${financialTitulos.status} <> 'cancelado'`)).limit(1))[0];
  let createdAny = false;

  // 1) Honorário do CLIENTE (valor cheio). Numa empresa de parceiro, a cobrança usa o PIX do parceiro.
  if (!(await existsFor("client"))) {
    await db.insert(financialTitulos).values({
      clientId: cfg.clientId, kind: "honorario", description: `Honorário ${comp}`, category: "Honorário",
      amount: cfg.honorarioValue, competencia: comp, dueDate: due, sendDate, status: "aberto",
      origin: "recorrencia", recurringConfigId: cfg.id, audience: "client", partnerUserId: cfg.partnerUserId ?? null,
    });
    createdAny = true;
  }

  // 2) Honorário da NOSSA PARTE (cobrado do parceiro) — só em empresa de parceiro com valor definido.
  if (cfg.partnerUserId && cfg.partnerHonorarioValue && !(await existsFor("partner"))) {
    await db.insert(financialTitulos).values({
      clientId: cfg.clientId, kind: "honorario", description: `Repasse Equilibrium — ${comp}`, category: "Repasse parceiro",
      amount: cfg.partnerHonorarioValue, competencia: comp, dueDate: due, sendDate, status: "aberto",
      origin: "recorrencia", recurringConfigId: cfg.id, audience: "partner", partnerUserId: cfg.partnerUserId,
    });
    createdAny = true;
  }
  return { created: createdAny };
}
export function compAtual(d = new Date()): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// Sincroniza o vínculo Parceiro↔empresas: cada empresa do parceiro fica com
// fin_client_config.partnerUserId = ele (criando a config se faltar); empresas removidas dele
// têm o vínculo limpo. É isso que "puxa" o 2º honorário (repasse) ao vincular a empresa ao parceiro.
export async function syncPartnerCompanies(db: any, partnerUserId: number, clientIds: number[]): Promise<void> {
  try {
    if (clientIds.length) {
      await db.update(financialClientConfig).set({ partnerUserId: null, updatedAt: new Date() })
        .where(and(eq(financialClientConfig.partnerUserId, partnerUserId), notInArray(financialClientConfig.clientId, clientIds)));
    } else {
      await db.update(financialClientConfig).set({ partnerUserId: null, updatedAt: new Date() })
        .where(eq(financialClientConfig.partnerUserId, partnerUserId));
    }
    for (const cid of clientIds) {
      const ex = (await db.select({ id: financialClientConfig.id }).from(financialClientConfig).where(eq(financialClientConfig.clientId, cid)).limit(1))[0];
      if (ex) await db.update(financialClientConfig).set({ partnerUserId, updatedAt: new Date() }).where(eq(financialClientConfig.id, ex.id));
      else await db.insert(financialClientConfig).values({ clientId: cid, partnerUserId, updatedAt: new Date() } as any);
    }
  } catch (e: any) { console.warn("[syncPartnerCompanies]", e?.message); }
}

// Envia (ou reenvia como lembrete) a cobrança de um título por e-mail. Reutilizado pela procedure
// manual e pela régua automática. Retorna { ok, to } ou { ok:false, reason }.
export async function enviarCobrancaPorId(db: any, tituloId: number, opts?: { reminder?: boolean }): Promise<{ ok: boolean; to?: string; reason?: string }> {
  const row = (await db
    .select({ id: financialTitulos.id, status: financialTitulos.status, description: financialTitulos.description, amount: financialTitulos.amount, competencia: financialTitulos.competencia, dueDate: financialTitulos.dueDate, audience: financialTitulos.audience, partnerUserId: financialTitulos.partnerUserId, clientName: clients.name, clientEmail: clients.email, clientCcEmails: clients.ccEmails, clientPhone: clients.phone, clientCcPhones: clients.ccPhones, billingEmail: financialClientConfig.billingEmail })
    .from(financialTitulos).leftJoin(clients, eq(clients.id, financialTitulos.clientId)).leftJoin(financialClientConfig, eq(financialClientConfig.clientId, financialTitulos.clientId))
    .where(eq(financialTitulos.id, tituloId)).limit(1))[0];
  if (!row) return { ok: false, reason: "não encontrado" };
  // Destinatários e nome exibido dependem da AUDIÊNCIA: repasse vai para o PARCEIRO; senão, cliente + extras.
  let toList: string[]; let displayName: string;
  if (row.audience === "partner" && row.partnerUserId) {
    const p = (await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, row.partnerUserId)).limit(1))[0];
    toList = allEmails(p?.email, null);
    displayName = p?.name || "Parceiro";
  } else {
    toList = allEmails(row.billingEmail || row.clientEmail, row.clientCcEmails);
    displayName = row.clientName || "";
  }
  if (!toList.length) return { ok: false, reason: "sem e-mail" };
  const pix = await getTituloPix(db, row);
  const html = buildCobrancaEmail({ tituloId: row.id, baseUrl: APP_URL, clientName: displayName, description: row.description, amount: row.amount, dueDate: new Date(row.dueDate as any), competencia: row.competencia, pix, reminder: opts?.reminder });
  const subject = opts?.reminder ? `Lembrete de cobrança - ${row.description}` : `Cobrança - ${row.description}`;
  await sendEmail({ to: toList[0], cc: toList.slice(1).join(",") || undefined, subject, html });
  const to = toList.join(", ");

  // Cobrança também pelo WhatsApp (não bloqueia). Repasse → telefone do parceiro; senão → cliente + extras.
  try {
    let phones: string[];
    if (row.audience === "partner" && row.partnerUserId) {
      const pp = (await db.select({ phone: users.phone }).from(users).where(eq(users.id, row.partnerUserId)).limit(1))[0];
      phones = allPhones(pp?.phone, null);
    } else {
      phones = allPhones(row.clientPhone, row.clientCcPhones);
    }
    if (phones.length) {
      const { sendText, getWAStatus } = await import("./wa/connection");
      if (getWAStatus().status === "open") {
        const venc = new Date(row.dueDate as any).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
        const link = `${APP_URL}/cobranca/${row.id}?t=${signCobranca(row.id)}`;
        let msg = `*Equilibrium Consultoria Contábil*\n\nOlá, ${displayName || "cliente"}! Segue a cobrança de *${row.description}*${row.competencia ? ` (${row.competencia})` : ""}.\n\n💰 Valor: *${brl(row.amount)}*\n📅 Vencimento: ${venc}`;
        if (pix?.active && pix?.pixKey) {
          let copiaCola = "";
          try { copiaCola = buildPixBRCode({ key: pix.pixKey, keyType: pix.pixKeyType || undefined, name: pix.beneficiaryName || "Equilibrium", city: "Rio Claro", amount: row.amount, txid: `T${row.id}` }); } catch { copiaCola = ""; }
          if (copiaCola) msg += `\n\n*PIX copia e cola:*\n${copiaCola}`;
        }
        msg += `\n\nPara pagar e enviar o comprovante:\n${link}`;
        for (const ph of phones) { try { await sendText(ph, msg); } catch (e: any) { console.warn(`[Cobrança WhatsApp ${ph}]`, e?.message); } }
      }
    }
  } catch (e: any) { console.warn("[Cobrança WhatsApp]", e?.message); }
  if (opts?.reminder) {
    await db.update(financialTitulos).set({ reminderSentAt: new Date(), updatedAt: new Date() }).where(eq(financialTitulos.id, tituloId));
  } else {
    await db.update(financialTitulos).set({ status: row.status === "pago" ? "pago" : "enviado", sentAt: new Date(), updatedAt: new Date() }).where(eq(financialTitulos.id, tituloId));
  }
  return { ok: true, to };
}

// Sincroniza a conta a receber gerada por uma tarefa (Movimenta financeiro).
// Marcada + com valor -> cria/atualiza o título vinculado (origin='tarefa'). Desmarcada ou sem valor
// -> cancela o título vinculado que ainda não foi pago.
export async function sincronizarTituloTarefa(db: any, taskId: number): Promise<void> {
  try {
    const task = (await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1))[0];
    if (!task) return;
    const existing = (await db.select().from(financialTitulos).where(eq(financialTitulos.taskId, taskId)).limit(1))[0];
    const valorNum = parseFloat(String(task.finValor ?? "").replace(",", ".")) || 0;
    const quer = !!task.movimentaFinanceiro && valorNum > 0;
    if (quer) {
      const amount = String(task.finValor).replace(",", ".");
      const due = task.finVencimento ? new Date(task.finVencimento) : new Date(task.dueDate);
      if (existing) {
        if (existing.status !== "pago") {
          await db.update(financialTitulos)
            .set({ clientId: task.clientId, description: task.title, amount, dueDate: due, competencia: task.competencia, status: existing.status === "cancelado" ? "aberto" : existing.status, updatedAt: new Date() })
            .where(eq(financialTitulos.id, existing.id));
        }
      } else {
        await db.insert(financialTitulos).values({
          clientId: task.clientId, kind: "eventual", description: task.title, category: "Serviço avulso",
          amount, competencia: task.competencia, dueDate: due, status: "aberto", origin: "tarefa", taskId,
        });
      }
    } else if (existing && existing.status !== "pago") {
      await db.update(financialTitulos).set({ status: "cancelado", updatedAt: new Date() }).where(eq(financialTitulos.id, existing.id));
    }
  } catch (e: any) {
    console.warn("[Financeiro] sincronizarTituloTarefa:", e?.message);
  }
}

export const financeiroRouter = router({
  // ── Painel: resumo ──────────────────────────────────────────────────────────
  dashboard: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const empty = { aReceber: "0.00", recebido: "0.00", aPagar: "0.00", pago: "0.00", saldo: "0.00", vencidos: 0, emConferencia: 0, honorariosAtivos: 0 };
    if (!db) return empty;
    try {
      const scope = await scopeClientIds(ctx);
      if (scopeBlocksAll(scope)) return empty; // ADM Limitado sem empresas vinculadas
      const tCond = scope ? inArray(financialTitulos.clientId, scope) : undefined;
      const pCond = scope ? inArray(financialPayables.clientId, scope) : undefined;
      const cfgCond = scope ? inArray(financialClientConfig.clientId, scope) : undefined;
      const sum = (whereStatus: string[]) =>
        db
          .select({ total: sql<string>`coalesce(sum(cast(${financialTitulos.amount} as decimal(12,2))), 0)` })
          .from(financialTitulos)
          .where(and(sql`${financialTitulos.status} in (${sql.join(whereStatus.map((s) => sql`${s}`), sql`, `)})`, tCond));
      const sumPay = (whereStatus: string[]) =>
        db
          .select({ total: sql<string>`coalesce(sum(cast(${financialPayables.amount} as decimal(12,2))), 0)` })
          .from(financialPayables)
          .where(and(sql`${financialPayables.status} in (${sql.join(whereStatus.map((s) => sql`${s}`), sql`, `)})`, pCond));
      const [aReceber] = await sum(["aberto", "enviado", "em_conferencia", "vencido"]);
      const [recebido] = await sum(["pago"]);
      const [aPagar] = await sumPay(["aberto", "vencido"]);
      const [pago] = await sumPay(["pago"]);
      const [venc] = await db.select({ n: sql<number>`count(*)` }).from(financialTitulos).where(and(eq(financialTitulos.status, "vencido"), tCond));
      const [conf] = await db.select({ n: sql<number>`count(*)` }).from(financialTitulos).where(and(eq(financialTitulos.status, "em_conferencia"), tCond));
      const [hon] = await db.select({ n: sql<number>`count(*)` }).from(financialClientConfig).where(and(eq(financialClientConfig.hasHonorario, true), eq(financialClientConfig.active, true), cfgCond));
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
  dashboardCharts: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const empty = { recFuturo: [] as any[], pagFuturo: [] as any[], recebidoMensal: [] as any[], pagoMensal: [] as any[], catReceita: [] as any[], catDespesa: [] as any[] };
    if (!db) return empty;
    const num = (v: any) => Number(v ?? 0);
    try {
      const scope = await scopeClientIds(ctx);
      if (scopeBlocksAll(scope)) return empty;
      const tCond = scope ? inArray(financialTitulos.clientId, scope) : undefined;
      const pCond = scope ? inArray(financialPayables.clientId, scope) : undefined;
      // Comprovantes (fin_payments) ligam à empresa via o título — filtra pelo título da empresa.
      const payCond = scope ? sql`${financialPayments.tituloId} in (select id from fin_titulos where clientId in (${sql.join(scope.map((s) => sql`${s}`), sql`, `)}))` : undefined;
      const recFuturo = await db.select({ mes: sql<string>`DATE_FORMAT(${financialTitulos.dueDate}, '%Y-%m')`, total: sql<string>`coalesce(sum(cast(${financialTitulos.amount} as decimal(12,2))),0)` })
        .from(financialTitulos).where(and(sql`${financialTitulos.status} in ('aberto','enviado','em_conferencia','vencido')`, tCond)).groupBy(sql`DATE_FORMAT(${financialTitulos.dueDate}, '%Y-%m')`);
      const pagFuturo = await db.select({ mes: sql<string>`DATE_FORMAT(${financialPayables.dueDate}, '%Y-%m')`, total: sql<string>`coalesce(sum(cast(${financialPayables.amount} as decimal(12,2))),0)` })
        .from(financialPayables).where(and(sql`${financialPayables.status} in ('aberto','vencido')`, pCond)).groupBy(sql`DATE_FORMAT(${financialPayables.dueDate}, '%Y-%m')`);
      const recebidoMensal = await db.select({ mes: sql<string>`DATE_FORMAT(${financialPayments.paidDate}, '%Y-%m')`, total: sql<string>`coalesce(sum(cast(${financialPayments.amount} as decimal(12,2))),0)` })
        .from(financialPayments).where(and(sql`${financialPayments.status}='confirmado' and ${financialPayments.paidDate} is not null`, payCond)).groupBy(sql`DATE_FORMAT(${financialPayments.paidDate}, '%Y-%m')`);
      const pagoMensal = await db.select({ mes: sql<string>`DATE_FORMAT(${financialPayables.paidDate}, '%Y-%m')`, total: sql<string>`coalesce(sum(cast(${financialPayables.amount} as decimal(12,2))),0)` })
        .from(financialPayables).where(and(sql`${financialPayables.status}='pago' and ${financialPayables.paidDate} is not null`, pCond)).groupBy(sql`DATE_FORMAT(${financialPayables.paidDate}, '%Y-%m')`);
      const catReceita = await db.select({ categoria: financialTitulos.category, total: sql<string>`coalesce(sum(cast(${financialTitulos.amount} as decimal(12,2))),0)` })
        .from(financialTitulos).where(and(sql`${financialTitulos.status} <> 'cancelado'`, tCond)).groupBy(financialTitulos.category);
      const catDespesa = await db.select({ categoria: financialPayables.category, total: sql<string>`coalesce(sum(cast(${financialPayables.amount} as decimal(12,2))),0)` })
        .from(financialPayables).where(and(sql`${financialPayables.status} <> 'cancelado'`, pCond)).groupBy(financialPayables.category);
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
  clientsWithConfig: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const scope = await scopeClientIds(ctx);
    if (scopeBlocksAll(scope)) return [];
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
        autoSend: financialClientConfig.autoSend,
        activated: financialClientConfig.activated,
        partnerUserId: financialClientConfig.partnerUserId,
        partnerHonorarioValue: financialClientConfig.partnerHonorarioValue,
        partnerName: sql<string | null>`(select name from users where id = ${financialClientConfig.partnerUserId})`,
        configId: financialClientConfig.id,
      })
      .from(clients)
      .leftJoin(financialClientConfig, eq(financialClientConfig.clientId, clients.id))
      .where(and(eq(clients.active, true), scope ? inArray(clients.id, scope) : undefined))
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
        autoSend: z.boolean().default(true),
        partnerHonorarioValue: money.optional(), // "nossa parte" cobrada do parceiro (empresa de parceiro)
        billingEmail: z.string().email().optional().or(z.literal("")),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await assertFinClient(ctx.user, input.clientId);
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
        autoSend: input.autoSend,
        partnerHonorarioValue: input.partnerHonorarioValue ?? null,
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
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const scope = await scopeClientIds(ctx);
      if (scopeBlocksAll(scope)) return [];
      const conds: any[] = [];
      if (scope) conds.push(inArray(financialTitulos.clientId, scope)); // ADM Limitado: só as empresas dele
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
    .mutation(async ({ input, ctx }) => {
      await assertFinClient(ctx.user, input.clientId);
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
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("sem banco");
      await assertFinClient(ctx.user, await tituloClientId(db, input.id));
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

  cancelTitulo: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("sem banco");
    await assertFinClient(ctx.user, await tituloClientId(db, input.id));
    await db.update(financialTitulos).set({ status: "cancelado", updatedAt: new Date() }).where(eq(financialTitulos.id, input.id));
    return { ok: true };
  }),

  // Exclui de vez o título (para erros de teste ou lançamentos que não deveriam existir).
  // Remove também eventuais comprovantes/baixas ligados a ele.
  deleteTitulo: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("sem banco");
    await assertFinClient(ctx.user, await tituloClientId(db, input.id));
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
      await assertFinClient(ctx.user, titulo.clientId);
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

  reverterBaixa: adminProcedure.input(z.object({ tituloId: z.number() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("sem banco");
    await assertFinClient(ctx.user, await tituloClientId(db, input.tituloId));
    // Remove baixas confirmadas e reabre o título
    await db.update(financialPayments).set({ status: "rejeitado", note: sql`concat(coalesce(note,''), ' (revertida)')` }).where(and(eq(financialPayments.tituloId, input.tituloId), eq(financialPayments.status, "confirmado")));
    await db.update(financialTitulos).set({ status: "aberto", updatedAt: new Date() }).where(eq(financialTitulos.id, input.tituloId));
    return { ok: true };
  }),

  // Comprovantes de um título (para conferência)
  listPayments: adminProcedure.input(z.object({ tituloId: z.number() })).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) return [];
    await assertFinClient(ctx.user, await tituloClientId(db, input.tituloId));
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
      await assertFinClient(ctx.user, await tituloClientId(db, pay.tituloId));
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
  // "Play": ativa o honorário e gera o PRIMEIRO título. Aceita a competência do primeiro mês
  // (ex.: cadastrei hoje mas o 1º honorário é mês que vem) — senão usa o mês atual. A régua
  // só ENVIA cobrança se o cliente estiver com autoSend ligado (e o interruptor global ligado).
  ativarHonorario: adminProcedure
    .input(z.object({ clientId: z.number(), competencia: z.string().regex(/^\d{2}\/\d{4}$/).optional() }))
    .mutation(async ({ input, ctx }) => {
      await assertFinClient(ctx.user, input.clientId);
      const db = await getDb();
      if (!db) throw new Error("sem banco");
      const cfg = (await db.select().from(financialClientConfig).where(eq(financialClientConfig.clientId, input.clientId)).limit(1))[0];
      if (!cfg || !cfg.hasHonorario) throw new Error("Cliente sem honorário configurado");
      if (!cfg.honorarioValue || !cfg.dueDay) throw new Error("Configure valor e dia de vencimento antes de ativar");
      const comp = input.competencia || compAtual();
      const { created } = await gerarTituloHonorario(db, cfg, comp);
      await db.update(financialClientConfig).set({ activated: true, lastGenComp: comp, updatedAt: new Date() }).where(eq(financialClientConfig.id, cfg.id));
      return { ok: true, competencia: comp, created, recurring: cfg.recurring };
    }),

  pausarHonorario: adminProcedure.input(z.object({ clientId: z.number() })).mutation(async ({ input, ctx }) => {
    await assertFinClient(ctx.user, input.clientId);
    const db = await getDb();
    if (!db) throw new Error("sem banco");
    await db.update(financialClientConfig).set({ activated: false, updatedAt: new Date() }).where(eq(financialClientConfig.clientId, input.clientId));
    return { ok: true };
  }),

  // Geração manual avulsa de um mês específico (sem mexer no play/recorrência)
  gerarCobrancaMes: adminProcedure
    .input(z.object({ clientId: z.number(), competencia: z.string().regex(/^\d{2}\/\d{4}$/).optional() }))
    .mutation(async ({ input, ctx }) => {
      await assertFinClient(ctx.user, input.clientId);
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
  enviarCobranca: adminProcedure.input(z.object({ tituloId: z.number() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("sem banco");
    await assertFinClient(ctx.user, await tituloClientId(db, input.tituloId));
    const r = await enviarCobrancaPorId(db, input.tituloId);
    if (!r.ok) throw new Error(r.reason === "sem e-mail" ? "Cliente sem e-mail cadastrado" : "Título não encontrado");
    return { ok: true, to: r.to };
  }),

  // Envia a cobrança pelo WhatsApp (usa o telefone do cliente + o módulo de Atendimento)
  enviarCobrancaWhatsApp: adminProcedure.input(z.object({ tituloId: z.number() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("sem banco");
    await assertFinClient(ctx.user, await tituloClientId(db, input.tituloId));
    const row = (await db
      .select({ id: financialTitulos.id, status: financialTitulos.status, description: financialTitulos.description, amount: financialTitulos.amount, competencia: financialTitulos.competencia, dueDate: financialTitulos.dueDate, clientName: clients.name, phone: clients.phone })
      .from(financialTitulos).leftJoin(clients, eq(clients.id, financialTitulos.clientId)).where(eq(financialTitulos.id, input.tituloId)).limit(1))[0];
    if (!row) throw new Error("título não encontrado");
    // Normaliza para o padrão do WhatsApp COM DDI do Brasil (55). Sem isso o número ia como
    // "1999999999@s.whatsapp.net" (JID inválido) e o Baileys "enviava" para o vazio — nada
    // chegava e nenhum erro aparecia. (Mesma normalização do módulo de Atendimento.)
    let phone = (row.phone || "").replace(/\D/g, "");
    if (!(phone.length >= 12 && phone.startsWith("55")) && (phone.length === 10 || phone.length === 11)) phone = "55" + phone;
    if (!phone || phone.length < 12) throw new Error("Cliente sem telefone válido cadastrado (informe com DDD)");
    const pix = (await db.select().from(financialConfig).where(eq(financialConfig.id, 1)).limit(1))[0];
    const venc = new Date(row.dueDate as any).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const link = `${APP_URL}/cobranca/${row.id}?t=${signCobranca(row.id)}`;
    let msg = `*Equilibrium Consultoria Contábil*\n\nOlá, ${row.clientName || "cliente"}! Segue sua cobrança referente a *${row.description}*${row.competencia ? ` (${row.competencia})` : ""}.\n\n💰 Valor: *${brl(row.amount)}*\n📅 Vencimento: ${venc}`;
    if (pix?.active && pix?.pixKey) {
      let copiaCola = "";
      try { copiaCola = buildPixBRCode({ key: pix.pixKey, keyType: pix.pixKeyType || undefined, name: pix.beneficiaryName || "Equilibrium", city: "Rio Claro", amount: row.amount, txid: `T${row.id}` }); } catch { copiaCola = ""; }
      if (copiaCola) msg += `\n\n*PIX copia e cola:*\n${copiaCola}`;
    }
    msg += `\n\nPara pagar e enviar o comprovante, acesse:\n${link}`;
    const { sendText } = await import("./wa/connection");
    await sendText(phone, msg);
    // marca como enviado (mas sem sentAt de e-mail; registra que houve envio)
    if (row.status === "aberto") await db.update(financialTitulos).set({ status: "enviado", sentAt: new Date(), updatedAt: new Date() }).where(eq(financialTitulos.id, row.id));
    return { ok: true, phone };
  }),

  // ── Contas a PAGAR (despesas do escritório) ──────────────────────────────────
  listPayables: adminProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const scope = await scopeClientIds(ctx);
      if (scopeBlocksAll(scope)) return [];
      const conds: any[] = [];
      // ADM Limitado só vê contas a pagar das empresas dele (despesas gerais do escritório,
      // com clientId nulo, ficam só para o ADM total).
      if (scope) conds.push(inArray(financialPayables.clientId, scope));
      if (input?.status && input.status !== "todos") conds.push(eq(financialPayables.status, input.status as any));
      return db
        .select({
          id: financialPayables.id,
          description: financialPayables.description,
          supplier: financialPayables.supplier,
          clientId: financialPayables.clientId,
          clientName: clients.name,
          category: financialPayables.category,
          amount: financialPayables.amount,
          dueDate: financialPayables.dueDate,
          status: financialPayables.status,
          recurring: financialPayables.recurring,
          paidDate: financialPayables.paidDate,
          note: financialPayables.note,
          createdAt: financialPayables.createdAt,
        })
        .from(financialPayables)
        .leftJoin(clients, eq(clients.id, financialPayables.clientId))
        .where(conds.length ? and(...conds) : sql`1=1`)
        .orderBy(desc(financialPayables.dueDate))
        .limit(500);
    }),

  createPayable: adminProcedure
    .input(z.object({ description: z.string().min(1), supplier: z.string().optional(), category: z.string().optional(), clientId: z.number().optional(), amount: money, dueDate: z.string(), recurring: z.boolean().default(false), note: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      // ADM Limitado: obrigatório escolher uma empresa dele. ADM total pode deixar sem empresa
      // (despesa geral do escritório).
      if (!isFullAdmin(ctx.user)) {
        if (input.clientId == null) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione a empresa da conta a pagar." });
        await assertClientInScope(ctx.user, input.clientId);
      }
      const db = await getDb();
      if (!db) throw new Error("sem banco");
      const r = await db.insert(financialPayables).values({
        description: input.description, supplier: input.supplier || null, category: input.category || null,
        clientId: input.clientId ?? null,
        amount: input.amount, dueDate: new Date(input.dueDate), recurring: input.recurring, note: input.note || null, status: "aberto",
      } as any);
      return { ok: true, id: (r as any)[0]?.insertId };
    }),

  updatePayable: adminProcedure
    .input(z.object({ id: z.number(), description: z.string().optional(), supplier: z.string().optional(), category: z.string().optional(), amount: money.optional(), dueDate: z.string().optional(), recurring: z.boolean().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("sem banco");
      await assertFinClient(ctx.user, await payableClientId(db, input.id));
      const patch: any = { updatedAt: new Date() };
      for (const k of ["description", "supplier", "category", "amount", "recurring"] as const) if (input[k] !== undefined) patch[k] = input[k];
      if (input.dueDate !== undefined) patch.dueDate = new Date(input.dueDate);
      await db.update(financialPayables).set(patch).where(eq(financialPayables.id, input.id));
      return { ok: true };
    }),

  baixaPayable: adminProcedure.input(z.object({ id: z.number(), paidDate: z.string().optional() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("sem banco");
    await assertFinClient(ctx.user, await payableClientId(db, input.id));
    await db.update(financialPayables).set({ status: "pago", paidDate: input.paidDate ? new Date(input.paidDate) : new Date(), paidBy: ctx.user!.id, updatedAt: new Date() }).where(eq(financialPayables.id, input.id));
    return { ok: true };
  }),

  reverterPayable: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("sem banco");
    await assertFinClient(ctx.user, await payableClientId(db, input.id));
    await db.update(financialPayables).set({ status: "aberto", paidDate: null, updatedAt: new Date() }).where(eq(financialPayables.id, input.id));
    return { ok: true };
  }),

  deletePayable: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("sem banco");
    await assertFinClient(ctx.user, await payableClientId(db, input.id));
    await db.delete(financialPayables).where(eq(financialPayables.id, input.id));
    return { ok: true };
  }),

  // ── Configuração global de recebimento (PIX / QR) — exclusiva do ADM total ────
  getConfig: adminProcedure.query(async ({ ctx }) => {
    if (!isFullAdmin(ctx.user)) return null; // ADM Limitado não gerencia o PIX global do escritório
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
    .mutation(async ({ input, ctx }) => {
      if (!isFullAdmin(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Só o administrador geral configura o recebimento do escritório." });
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
