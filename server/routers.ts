import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createClient,
  createEmailLog,
  createRecurringTask,
  createTask,
  createTaskFile,
  getDashboardStats,
  getTaskById,
  getTaskFileById,
  getTasksDueSoon,
  listClients,
  listEmailLogs,
  listRecurringTasks,
  listTaskFiles,
  listTasks,
  markOverdueTasks,
  taskExistsByRecurringAndCompetencia,
  updateClient,
  updateRecurringTask,
  updateTask,
} from "./db";
import { buildAlertEmailHtml, buildGuiaEmailHtml, sendEmail } from "./email";
import { storagePut } from "./storage";

// ─── Clients Router ───────────────────────────────────────────────────────────
const clientsRouter = router({
  list: protectedProcedure
    .input(z.object({ includeInactive: z.boolean().optional() }))
    .query(({ input }) => listClients(input.includeInactive)),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2),
        cnpj: z.string().min(14),
        email: z.string().email(),
        phone: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = await createClient({ ...input, active: true });
      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(2).optional(),
        cnpj: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        notes: z.string().optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateClient(id, data);
      return { success: true };
    }),
});

// ─── Recurring Tasks Router ───────────────────────────────────────────────────
const recurringTasksRouter = router({
  list: protectedProcedure
    .input(z.object({ clientId: z.number().optional() }))
    .query(({ input }) => listRecurringTasks(input.clientId)),

  create: protectedProcedure
    .input(
      z.object({
        clientId: z.number(),
        title: z.string().min(2),
        description: z.string().optional(),
        taskType: z.enum(["DAS", "NFS", "DCTF", "SPED", "OUTROS"]),
        dueDayOfMonth: z.number().min(1).max(31),
      })
    )
    .mutation(async ({ input }) => {
      const id = await createRecurringTask({ ...input, active: true });
      return { id };
    }),

  toggle: protectedProcedure
    .input(z.object({ id: z.number(), active: z.boolean() }))
    .mutation(async ({ input }) => {
      await updateRecurringTask(input.id, { active: input.active });
      return { success: true };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        taskType: z.enum(["DAS", "NFS", "DCTF", "SPED", "OUTROS"]).optional(),
        dueDayOfMonth: z.number().min(1).max(31).optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateRecurringTask(id, data);
      return { success: true };
    }),
});

// ─── Tasks Router ─────────────────────────────────────────────────────────────
const tasksRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        clientId: z.number().optional(),
        status: z.enum(["PENDENTE", "EM_ANDAMENTO", "CONCLUIDA", "VENCIDA"]).optional(),
        competencia: z.string().optional(),
      })
    )
    .query(({ input }) => listTasks(input)),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const task = await getTaskById(input.id);
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      return task;
    }),

  create: protectedProcedure
    .input(
      z.object({
        clientId: z.number(),
        recurringTaskId: z.number().optional(),
        title: z.string().min(2),
        description: z.string().optional(),
        taskType: z.enum(["DAS", "NFS", "DCTF", "SPED", "OUTROS"]),
        competencia: z.string().regex(/^\d{2}\/\d{4}$/),
        dueDate: z.string(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = await createTask({
        ...input,
        dueDate: new Date(input.dueDate),
        status: "PENDENTE",
      });
      return { id };
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["PENDENTE", "EM_ANDAMENTO", "CONCLUIDA", "VENCIDA"]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const completedAt = input.status === "CONCLUIDA" ? new Date() : undefined;
      await updateTask(input.id, {
        status: input.status,
        notes: input.notes,
        ...(completedAt ? { completedAt } : {}),
      });
      return { success: true };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        dueDate: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, dueDate, ...rest } = input;
      await updateTask(id, {
        ...rest,
        ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
      });
      return { success: true };
    }),

  markOverdue: protectedProcedure.mutation(async () => {
    const count = await markOverdueTasks();
    return { updated: count };
  }),

  dueSoon: protectedProcedure
    .input(z.object({ days: z.number().default(3) }))
    .query(({ input }) => getTasksDueSoon(input.days)),

  dashboard: protectedProcedure.query(() => getDashboardStats()),

  // Generate tasks for a specific month from all active recurring tasks of active clients
  generateMonthly: protectedProcedure
    .input(
      z.object({
        month: z.number().min(1).max(12),
        year: z.number().min(2020),
      })
    )
    .mutation(async ({ input }) => {
      const { month, year } = input;
      const competencia = `${String(month).padStart(2, "0")}/${year}`;
      const allRecurring = await listRecurringTasks();
      const activeRecurring = allRecurring.filter((rt) => rt.active);
      const clients = await listClients(false); // only active
      const activeClientIds = new Set(clients.map((c) => c.id));

      let created = 0;
      let skipped = 0;

      for (const rt of activeRecurring) {
        if (!activeClientIds.has(rt.clientId)) {
          skipped++;
          continue;
        }
        const exists = await taskExistsByRecurringAndCompetencia(rt.id, competencia);
        if (exists) {
          skipped++;
          continue;
        }
        // Build due date: day rt.dueDayOfMonth of the NEXT month after competencia
        const [mm, yyyy] = competencia.split("/").map(Number);
        const dueDate = new Date(yyyy!, mm!, rt.dueDayOfMonth); // month is 1-based, Date uses 0-based so mm = next month
        await createTask({
          clientId: rt.clientId,
          recurringTaskId: rt.id,
          title: rt.title,
          description: rt.description ?? undefined,
          taskType: rt.taskType,
          competencia,
          dueDate,
          status: "PENDENTE",
        });
        created++;
      }
      return { created, skipped };
    }),
});

// ─── Files Router ─────────────────────────────────────────────────────────────
const filesRouter = router({
  listByTask: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .query(({ input }) => listTaskFiles(input.taskId)),

  upload: protectedProcedure
    .input(
      z.object({
        taskId: z.number(),
        clientId: z.number(),
        filename: z.string(),
        mimeType: z.string().optional(),
        fileSize: z.number().optional(),
        base64: z.string(), // base64 encoded file content
      })
    )
    .mutation(async ({ input, ctx }) => {
      const buffer = Buffer.from(input.base64, "base64");
      const fileKey = `tasks/${input.taskId}/${Date.now()}-${input.filename}`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType || "application/pdf");
      const id = await createTaskFile({
        taskId: input.taskId,
        clientId: input.clientId,
        filename: input.filename,
        fileKey,
        fileUrl: url,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        uploadedBy: ctx.user?.id,
      });
      return { id, fileKey, fileUrl: url };
    }),
});

// ─── Email Router ─────────────────────────────────────────────────────────────
const emailRouter = router({
  sendGuia: protectedProcedure
    .input(
      z.object({
        taskId: z.number(),
        taskFileId: z.number().optional(),
        recipientEmail: z.string().email(),
        clientName: z.string(),
        subject: z.string().optional(),
        customBody: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const task = await getTaskById(input.taskId);
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Tarefa não encontrada" });

      const subject =
        input.subject ||
        `Guia ${task.taskType} — Competência ${task.competencia} | Equilíbrio Consultoria`;

      const html = buildGuiaEmailHtml({
        clientName: input.clientName,
        taskTitle: task.title,
        competencia: task.competencia,
        dueDate: task.dueDate,
        notes: task.notes ?? undefined,
      });

      const attachments: Array<{ filename: string; path?: string; content?: Buffer; contentType: string }> = [];
      if (input.taskFileId) {
        const file = await getTaskFileById(input.taskFileId);
        if (file) {
          // Fetch the file content from storage proxy to attach to email
          try {
            const forgeApiUrl = process.env.BUILT_IN_FORGE_API_URL ?? "";
            const forgeApiKey = process.env.BUILT_IN_FORGE_API_KEY ?? "";
            const storageKey = file.fileKey;
            const presignResp = await fetch(
              `${forgeApiUrl.replace(/\/+$/, "")}/v1/storage/presign/get?path=${encodeURIComponent(storageKey)}`,
              { headers: { Authorization: `Bearer ${forgeApiKey}` } }
            );
            if (presignResp.ok) {
              const { url: signedUrl } = (await presignResp.json()) as { url: string };
              const fileResp = await fetch(signedUrl);
              if (fileResp.ok) {
                const arrayBuffer = await fileResp.arrayBuffer();
                attachments.push({
                  filename: file.filename,
                  content: Buffer.from(arrayBuffer),
                  contentType: file.mimeType || "application/pdf",
                });
              }
            }
          } catch (attachErr) {
            console.warn("[Email] Could not fetch attachment:", attachErr);
          }
        }
      }

      let status: "ENVIADO" | "FALHOU" = "ENVIADO";
      let errorMessage: string | undefined;

      try {
        await sendEmail({ to: input.recipientEmail, subject, html, attachments });
      } catch (err) {
        status = "FALHOU";
        errorMessage = err instanceof Error ? err.message : String(err);
      }

      await createEmailLog({
        taskId: input.taskId,
        clientId: task.clientId,
        taskFileId: input.taskFileId,
        recipientEmail: input.recipientEmail,
        subject,
        body: html,
        status,
        errorMessage,
        sentBy: ctx.user?.id,
      });

      if (status === "FALHOU") {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: errorMessage });
      }

      return { success: true };
    }),

  sendAlerts: protectedProcedure.mutation(async () => {
    const dueSoon = await getTasksDueSoon(3);
    const overdue = await listTasks({ status: "VENCIDA" });

    const alertEmail = process.env.SMTP_USER;
    if (!alertEmail) return { sent: false, reason: "SMTP not configured" };

    let sent = 0;

    if (dueSoon.length > 0) {
      // Fetch client names for tasks
      const clientsData = await listClients(true);
      const clientMap = new Map(clientsData.map((c) => [c.id, c.name]));
      const html = buildAlertEmailHtml({
        type: "vencendo",
        tasks: dueSoon.map((t) => ({
          title: t.title,
          clientName: clientMap.get(t.clientId) ?? "—",
          competencia: t.competencia,
          dueDate: t.dueDate,
          status: t.status,
        })),
      });
      try {
        await sendEmail({
          to: alertEmail,
          subject: `⚠️ ${dueSoon.length} tarefa(s) vencem em 3 dias — Equilíbrio`,
          html,
        });
        sent++;
      } catch {
        // ignore
      }
    }

    if (overdue.length > 0) {
      const clientsData = await listClients(true);
      const clientMap = new Map(clientsData.map((c) => [c.id, c.name]));
      const html = buildAlertEmailHtml({
        type: "vencida",
        tasks: overdue.slice(0, 20).map((t) => ({
          title: t.title,
          clientName: clientMap.get(t.clientId) ?? "—",
          competencia: t.competencia,
          dueDate: t.dueDate,
          status: t.status,
        })),
      });
      try {
        await sendEmail({
          to: alertEmail,
          subject: `🚨 ${overdue.length} tarefa(s) vencida(s) sem conclusão — Equilíbrio`,
          html,
        });
        sent++;
      } catch {
        // ignore
      }
    }

    return { sent, dueSoon: dueSoon.length, overdue: overdue.length };
  }),

  logs: protectedProcedure
    .input(z.object({ taskId: z.number().optional(), clientId: z.number().optional() }))
    .query(({ input }) => listEmailLogs(input.taskId, input.clientId)),
});

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  clients: clientsRouter,
  recurringTasks: recurringTasksRouter,
  tasks: tasksRouter,
  files: filesRouter,
  email: emailRouter,
});

export type AppRouter = typeof appRouter;
