import { z } from "zod";
import { adminProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  financialClientConfig,
  financialTitulos,
  financialPayments,
  financialConfig,
  clients,
} from "../drizzle/schema";
import { and, desc, eq, sql } from "drizzle-orm";

const money = z.string().regex(/^\d+([.,]\d{1,2})?$/, "valor inválido").transform((v) => v.replace(",", "."));

export const financeiroRouter = router({
  // ── Painel: resumo ──────────────────────────────────────────────────────────
  dashboard: adminProcedure.query(async () => {
    const db = await getDb();
    const empty = { aReceber: "0.00", recebido: "0.00", vencidos: 0, emConferencia: 0, honorariosAtivos: 0 };
    if (!db) return empty;
    try {
      const sum = (whereStatus: string[]) =>
        db
          .select({ total: sql<string>`coalesce(sum(cast(${financialTitulos.amount} as decimal(12,2))), 0)` })
          .from(financialTitulos)
          .where(sql`${financialTitulos.status} in (${sql.join(whereStatus.map((s) => sql`${s}`), sql`, `)})`);
      const [aReceber] = await sum(["aberto", "enviado", "em_conferencia", "vencido"]);
      const [recebido] = await sum(["pago"]);
      const [venc] = await db.select({ n: sql<number>`count(*)` }).from(financialTitulos).where(eq(financialTitulos.status, "vencido"));
      const [conf] = await db.select({ n: sql<number>`count(*)` }).from(financialTitulos).where(eq(financialTitulos.status, "em_conferencia"));
      const [hon] = await db.select({ n: sql<number>`count(*)` }).from(financialClientConfig).where(and(eq(financialClientConfig.hasHonorario, true), eq(financialClientConfig.active, true)));
      return {
        aReceber: Number(aReceber?.total ?? 0).toFixed(2),
        recebido: Number(recebido?.total ?? 0).toFixed(2),
        vencidos: Number(venc?.n ?? 0),
        emConferencia: Number(conf?.n ?? 0),
        honorariosAtivos: Number(hon?.n ?? 0),
      };
    } catch (e: any) {
      console.warn("[Financeiro] dashboard:", e?.message);
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
        updatedAt: new Date(),
      };
      const existing = (await db.select({ id: financialConfig.id }).from(financialConfig).where(eq(financialConfig.id, 1)).limit(1))[0];
      if (existing) await db.update(financialConfig).set(values).where(eq(financialConfig.id, 1));
      else await db.insert(financialConfig).values({ id: 1, ...values } as any);
      return { ok: true };
    }),
});
