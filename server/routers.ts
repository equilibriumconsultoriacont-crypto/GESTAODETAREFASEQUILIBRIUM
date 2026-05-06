import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  addClientTaskTemplate,
  createClient,
  createEmailLog,
  createRecurringTask,
  createTask,
  createTaskFile,
  createTaskTemplate,
  getDashboardStats,
  getClientById,
  getMonthlyPanel,
  getTaskById,
  getTaskFileById,
  getTasksDueSoon,
  listClientTaskTemplates,
  listClients,
  listEmailLogs,
  listRecurringTasks,
  listTaskFiles,
  listTaskTemplates,
  listTasks,
  markOverdueTasks,
  removeClientTaskTemplate,
  taskExistsByRecurringAndCompetencia,
  updateClient,
  updateRecurringTask,
  updateTask,
  updateTaskTemplate,
} from "./db";
import { buildAlertEmailHtml, buildGuiaEmailHtml, sendEmail } from "./email";
import { storagePut } from "./storage";
import { sendGuiaConfirmationWhatsApp } from "./whatsapp";
import { getUserByEmail, upsertUser } from "./db";
import bcryptjs from "bcryptjs";

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
      
      // Reconhecer tipo de documento via OCR
      let documentType = "UNKNOWN";
      let confidence = 0;
      try {
        const { recognizeDocument } = await import("./ocr");
        const recognition = await recognizeDocument(url, input.mimeType || "application/pdf");
        documentType = recognition.documentType;
        confidence = recognition.confidence;
      } catch (error) {
        console.warn("[OCR] Error recognizing document:", error);
      }
      
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
      
      return { 
        id, 
        fileKey, 
        fileUrl: url,
        documentType,
        confidence
      };
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
        `Guia ${task.taskType} — Competência ${task.competencia} | Equilibrium Consultoria`;

      const html = buildGuiaEmailHtml({
        clientName: input.clientName,
        taskTitle: task.title,
        competencia: task.competencia,
        dueDate: task.dueDate,
        notes: task.notes ?? undefined,
      });

      // ── Buscar e anexar o arquivo da guia ───────────────────────────────────
      const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
      let attachmentWarning: string | undefined;

      if (input.taskFileId) {
        const file = await getTaskFileById(input.taskFileId);
        if (file) {
          try {
            const forgeApiUrl = process.env.BUILT_IN_FORGE_API_URL ?? "";
            const forgeApiKey = process.env.BUILT_IN_FORGE_API_KEY ?? "";

            if (!forgeApiUrl || !forgeApiKey) {
              attachmentWarning = "Variáveis BUILT_IN_FORGE_API_URL / BUILT_IN_FORGE_API_KEY não configuradas — anexo ignorado.";
              console.warn("[Email] " + attachmentWarning);
            } else {
              const presignResp = await fetch(
                `${forgeApiUrl.replace(/\/+$/, "")}/v1/storage/presign/get?path=${encodeURIComponent(file.fileKey)}`,
                { headers: { Authorization: `Bearer ${forgeApiKey}` } }
              );

              if (!presignResp.ok) {
                attachmentWarning = `Presign do storage falhou (HTTP ${presignResp.status}) — e-mail enviado sem anexo.`;
                console.warn("[Email]", attachmentWarning);
              } else {
                const { url: signedUrl } = (await presignResp.json()) as { url: string };
                const fileResp = await fetch(signedUrl);

                if (!fileResp.ok) {
                  attachmentWarning = `Download do arquivo falhou (HTTP ${fileResp.status}) — e-mail enviado sem anexo.`;
                  console.warn("[Email]", attachmentWarning);
                } else {
                  attachments.push({
                    filename: file.filename,
                    content: Buffer.from(await fileResp.arrayBuffer()),
                    contentType: file.mimeType || "application/pdf",
                  });
                }
              }
            }
          } catch (attachErr) {
            attachmentWarning = `Erro ao buscar anexo: ${attachErr instanceof Error ? attachErr.message : String(attachErr)} — e-mail enviado sem anexo.`;
            console.warn("[Email]", attachmentWarning);
          }
        } else {
          attachmentWarning = `Arquivo (id=${input.taskFileId}) não encontrado no banco — e-mail enviado sem anexo.`;
          console.warn("[Email]", attachmentWarning);
        }
      }

      // ── Enviar e-mail ────────────────────────────────────────────────────────
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

      // ── Notificação WhatsApp (não bloqueia o retorno) ────────────────────────
      let whatsappSent = false;
      try {
        const clientData = await getClientById(task.clientId);
        if (clientData?.phone) {
          const wppResult = await sendGuiaConfirmationWhatsApp(
            clientData.phone,
            task.title,
            input.clientName
          );
          whatsappSent = wppResult.success;
          if (!wppResult.success) {
            console.warn("[sendGuia] WhatsApp não entregue:", wppResult.error);
          }
        }
      } catch (wppErr) {
        console.warn("[sendGuia] Erro ao enviar WhatsApp:", wppErr);
      }

      return {
        success: true,
        attachmentWarning,
        whatsappSent,
      };
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
          subject: `⚠️ ${dueSoon.length} tarefa(s) vencem em 3 dias — Equilibrium`,
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
          subject: `🚨 ${overdue.length} tarefa(s) vencida(s) sem conclusão — Equilibrium`,
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

// ─── Auto-Send Router (para tarefa agendada) ───────────────────────────────────
const autoSendRouter = router({
  sendGuias: publicProcedure.mutation(async () => {
    const { autoSendPendingGuias, sendDueSoonAlerts } = await import("./autoSend");
    const sendResult = await autoSendPendingGuias();
    const alertResult = await sendDueSoonAlerts();
    return {
      guias: sendResult,
      alerts: alertResult,
    };
  }),
});


// ─── Task Templates Router ────────────────────────────────────────────────────
const taskTemplatesRouter = router({
  list: protectedProcedure
    .input(z.object({ activeOnly: z.boolean().default(true) }))
    .query(({ input }) => listTaskTemplates(input.activeOnly)),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(2),
      description: z.string().optional(),
      taskType: z.enum(["DAS", "NFS", "DCTF", "SPED", "OUTROS"]),
      dueDayOfMonth: z.number().min(1).max(31),
      ocrKeywords: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await createTaskTemplate({ ...input, active: true });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      taskType: z.enum(["DAS", "NFS", "DCTF", "SPED", "OUTROS"]).optional(),
      dueDayOfMonth: z.number().min(1).max(31).optional(),
      ocrKeywords: z.string().optional(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateTaskTemplate(id, data);
      return { success: true };
    }),

  toggle: protectedProcedure
    .input(z.object({ id: z.number(), active: z.boolean() }))
    .mutation(async ({ input }) => {
      await updateTaskTemplate(input.id, { active: input.active });
      return { success: true };
    }),
});

// ─── Client Task Templates Router ─────────────────────────────────────────────
const clientTemplatesRouter = router({
  listByClient: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(({ input }) => listClientTaskTemplates(input.clientId)),

  add: protectedProcedure
    .input(z.object({ clientId: z.number(), taskTemplateId: z.number() }))
    .mutation(async ({ input }) => {
      const id = await addClientTaskTemplate({ ...input, active: true });
      // Também cria recurringTask para esse cliente com os dados do template
      const templates = await listTaskTemplates(false);
      const template = templates.find((t) => t.id === input.taskTemplateId);
      if (template) {
        await createRecurringTask({
          clientId: input.clientId,
          taskTemplateId: input.taskTemplateId,
          title: template.title,
          description: template.description ?? undefined,
          taskType: template.taskType,
          dueDayOfMonth: template.dueDayOfMonth,
          active: true,
        });
      }
      return { id };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await removeClientTaskTemplate(input.id);
      return { success: true };
    }),
});

// ─── Monthly Panel Router ─────────────────────────────────────────────────────
const monthlyPanelRouter = router({
  get: protectedProcedure
    .input(z.object({ month: z.number().min(1).max(12), year: z.number().min(2020) }))
    .query(({ input }) => getMonthlyPanel(input.month, input.year)),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(6) }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByEmail(input.email);
        if (!user || !user.passwordHash) {
          throw new Error("Credenciais inválidas");
        }
        const isValidPassword = await bcryptjs.compare(input.password, user.passwordHash);
        if (!isValidPassword) {
          throw new Error("Credenciais inválidas");
        }
        await upsertUser({
          email: user.email,
          lastSignedIn: new Date(),
        });
        const { sdk } = await import("./_core/sdk");
        const sessionToken = await sdk.createSessionToken(user.id.toString(), {
          name: user.name || user.email,
          expiresInMs: 1000 * 60 * 60 * 24 * 365,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: 1000 * 60 * 60 * 24 * 365,
        });
        return { success: true, user };
      }),
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
  autoSend: autoSendRouter,
  taskTemplates: taskTemplatesRouter,
  clientTemplates: clientTemplatesRouter,
  monthlyPanel: monthlyPanelRouter,
});

export type AppRouter = typeof appRouter;
