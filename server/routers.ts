import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { randomUUID } from "crypto"; // Node 18 não tem crypto global
import { COOKIE_NAME, SESSION_DURATION_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  addClientTaskTemplate,
  applyCatalogToClient,
  logActivity,
  getActivityLogs,
  getOperationalQueue,
  createTaskCatalog,
  getCatalogTemplates,
  addCatalogTemplate,
  removeCatalogTemplate,
  listTaskCatalogs,
  updateTaskCatalog,
  createClient,
  createPendingClientUser,
  getClientRevenue,
  upsertClientRevenue,
  createEmailLog,
  createRecurringTask,
  createTask,
  createTaskFile,
  createTaskTemplate,
  createPasswordResetToken,
  deleteTaskFile,
  getDashboardStats,
  getClientById,
  getMonthlyPanel,
  getTaskById,
  getTaskFileById,
  getTasksDueSoon,
  getUserByResetToken,
  listClientTaskTemplates,
  listClients,
  listEmailLogs,
  listRecurringTasks,
  listTaskFiles,
  getTaskTemplateById,
  listTaskTemplates,
  listTasks,
  markOverdueTasks,
  removeClientTaskTemplate,
  resetUserPassword,
  taskExistsByRecurringAndCompetencia,
  updateClient,
  updateRecurringTask,
  updateTask,
  deleteTask,
  updateTaskTemplate,
  getDb,
  getPool,
  upsertUser,
  getUserByEmail,
} from "./db";
import { buildAlertEmailHtml, buildGuiaEmailHtml, sendEmail } from "./email";
import { storagePut, storageDelete, storageGetBuffer } from "./storage";
import { sendGuiaConfirmationWhatsApp } from "./whatsapp";
// getUserByEmail, upsertUser already imported above
import bcryptjs from "bcryptjs";

// ─── Clients Router ───────────────────────────────────────────────────────────
const clientsRouter = router({
  list: protectedProcedure
    .input(z.object({ includeInactive: z.boolean().optional() }))
    .query(({ input }) => listClients(input.includeInactive)),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(2),
        cnpj: z.string().min(14),
        cpf: z.string().optional(),
        documentType: z.enum(["CNPJ", "CPF"]).default("CNPJ"),
        email: z.string().email(),
        phone: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = await createClient({ ...input, email: input.email.trim().toLowerCase(), active: true });
      // Cria automaticamente o acesso do cliente (senha inicial 123456, troca no 1º login).
      try {
        const email = input.email.trim().toLowerCase();
        const existing = await getUserByEmail(email);
        if (!existing) {
          const passwordHash = await bcryptjs.hash("123456", 10);
          await createPendingClientUser(email, passwordHash, id);
        }
      } catch { /* não bloqueia a criação do cliente */ }
      return { id };
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number().positive(),
        name: z.string().min(2).max(255).optional(),
        cnpj: z.string().optional(),
        cpf: z.string().optional(),
        documentType: z.enum(["CNPJ", "CPF"]).optional(),
        email: z.string().email().optional(),
        phone: z.string().max(20).optional(),
        notes: z.string().max(2000).optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      if (data.email) data.email = data.email.trim().toLowerCase();
      await updateClient(id, data);
      if (data.email) {
        try {
          const existing = await getUserByEmail(data.email);
          if (!existing) {
            const passwordHash = await bcryptjs.hash("123456", 10);
            await createPendingClientUser(data.email, passwordHash, id);
          }
        } catch { /* ignore */ }
      }
      return { success: true };
    }),
});

// ─── Recurring Tasks Router ───────────────────────────────────────────────────
const recurringTasksRouter = router({
  list: protectedProcedure
    .input(z.object({ clientId: z.number().optional() }))
    .query(({ input }) => listRecurringTasks(input.clientId)),

  create: adminProcedure
    .input(
      z.object({
        clientId: z.number(),
        title: z.string().min(2),
        description: z.string().optional(),
        taskType: z.enum(["DAS", "NFS", "DCTF", "SPED", "OUTROS", "PIS", "COFINS", "ICMS", "ISSQN", "PGDAS"]),
        dueDayOfMonth: z.number().min(1).max(31),
      })
    )
    .mutation(async ({ input }) => {
      const id = await createRecurringTask({ ...input, active: true });
      return { id };
    }),

  toggle: adminProcedure
    .input(z.object({ id: z.number(), active: z.boolean() }))
    .mutation(async ({ input }) => {
      await updateRecurringTask(input.id, { active: input.active });
      return { success: true };
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        taskType: z.enum(["DAS", "NFS", "DCTF", "SPED", "OUTROS", "PIS", "COFINS", "ICMS", "ISSQN", "PGDAS"]).optional(),
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
        status: z.enum(["PENDENTE","EM_ANDAMENTO","AGUARDANDO_CLIENTE","EM_REVISAO","CONCLUIDA","CANCELADA","VENCIDA"]).optional(),
        competencia: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const tasks = await listTasks(input);

      // Admin vê tudo. Colaborador vê só tarefas das empresas vinculadas
      // E dos departamentos que ele faz parte.
      if (ctx.user?.role === "admin") return tasks;

      const { getUserClients, getUserDepartments, listDepartments } = await import("./db");
      const userId = ctx.user!.id;
      const allowedClientIds = new Set(await getUserClients(userId));
      const userDeptIds = await getUserDepartments(userId);

      // Converter IDs de departamento para NOMES (a tarefa guarda o nome)
      const allDepts = await listDepartments(true);
      const allowedDeptNames = new Set(
        allDepts.filter((d) => userDeptIds.includes(d.id)).map((d) => d.name)
      );

      return tasks.filter((t) => {
        const clientOk = allowedClientIds.has(t.clientId);
        const deptOk = allowedDeptNames.has((t as any).department ?? "Geral");
        return clientOk && deptOk;
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const task = await getTaskById(input.id);
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      return task;
    }),

  history: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const { getTaskHistory } = await import("./db");
      return getTaskHistory(input.id);
    }),

  create: adminProcedure
    .input(
      z.object({
        clientId: z.number(),
        recurringTaskId: z.number().optional(),
        title: z.string().min(2),
        description: z.string().optional(),
        taskType: z.enum(["DAS", "NFS", "DCTF", "SPED", "OUTROS", "PIS", "COFINS", "ICMS", "ISSQN", "PGDAS"]),
        competencia: z.string().regex(/^\d{2}\/\d{4}$/),
        dueDate: z.string(),
        notes: z.string().optional(),
        department: z.enum(["FISCAL", "CONTABIL", "DP", "SOCIETARIO", "FINANCEIRO", "GERAL"]).optional(),
        priority: z.enum(["BAIXA", "NORMAL", "ALTA", "URGENTE"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = await createTask({
        ...input,
        dueDate: new Date(input.dueDate),
        status: "PENDENTE",
        department: input.department ?? "GERAL",
        priority: input.priority ?? "NORMAL",
      });
      return { id };
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number().positive(),
        status: z.enum(["PENDENTE","EM_ANDAMENTO","AGUARDANDO_CLIENTE","EM_REVISAO","CONCLUIDA","CANCELADA","VENCIDA"]),
        notes: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { logActivity } = await import("./db");
      const before = await getTaskById(input.id);
      const now = new Date();
      const extra: Record<string, any> = {};
      if (input.status === "CONCLUIDA") extra.completedAt = now;
      if (input.status === "EM_ANDAMENTO" && before?.status === "PENDENTE") extra.startedAt = now;
      if (input.status === "AGUARDANDO_CLIENTE") extra.waitingSince = now;
      await updateTask(input.id, { status: input.status, notes: input.notes, ...extra });
      await logActivity({
        entityType: "task",
        entityId: input.id,
        action: "status_changed",
        before: JSON.stringify({ status: before?.status }),
        after: JSON.stringify({ status: input.status }),
        userId: ctx.user?.id,
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

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteTask(input.id);
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

  // Dashboard gerencial: admin vê visão do escritório + equipe; colaborador vê o dele
  managerialDashboard: protectedProcedure
    .input(z.object({ competencia: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const { getAdminDashboard, getCollaboratorDashboard } = await import("./db");
      const competencia = input?.competencia;
      if (ctx.user?.role === "admin") {
        return { role: "admin" as const, ...(await getAdminDashboard(competencia)) };
      }
      return { role: "collaborator" as const, ...(await getCollaboratorDashboard(ctx.user!.id, competencia)) };
    }),

  // Generate tasks for a specific month from all active recurring tasks of active clients
  generateMonthly: adminProcedure
    .input(
      z.object({
        month: z.number().min(1).max(12),
        year: z.number().min(2020),
        clientId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { generateTasksForCompetencia } = await import("./taskGenerator");
      return generateTasksForCompetencia(input.month, input.year, input.clientId);
    }),
});

// ─── Files Router ─────────────────────────────────────────────────────────────
const filesRouter = router({
  listByTask: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .query(({ input }) => listTaskFiles(input.taskId)),

  delete: protectedProcedure
    .input(z.object({ fileId: z.number() }))
    .mutation(async ({ input }) => {
      const file = await deleteTaskFile(input.fileId);
      if (!file) throw new TRPCError({ code: "NOT_FOUND" });
      // Tentar deletar do storage (não bloqueia se falhar)
      try {
        await storageDelete(file.fileKey);
      } catch (err) {
        console.warn("[Files] Storage delete failed:", err);
      }
      return { success: true };
    }),

  upload: protectedProcedure
    .input(
      z.object({
        taskId: z.number(),
        clientId: z.number(),
        filename: z.string(),
        mimeType: z.string().optional(),
        fileSize: z.number().optional(),
        base64: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Upload manual — o arquivo já está sendo colocado na tarefa certa
      // NÃO precisa de OCR (OCR é só para o Upload Inteligente)
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
        `Guia ${task.taskType} — Competência ${task.competencia} | Equilibrium Consultoria`;

      const html = buildGuiaEmailHtml({
        clientName: input.clientName,
        taskTitle: task.title,
        competencia: task.competencia,
        dueDate: new Date(task.dueDate),
        notes: task.notes ?? undefined,
      });

      // ── Buscar e anexar o arquivo da guia ───────────────────────────────────
      const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
      let attachmentWarning: string | undefined;

      if (input.taskFileId) {
        const file = await getTaskFileById(input.taskFileId);
        if (file) {
          try {
            const buf = await storageGetBuffer(file.fileKey, file.fileUrl);
            if (buf) {
              attachments.push({
                filename: file.filename,
                content: buf,
                contentType: file.mimeType || "application/pdf",
              });
            } else {
              attachmentWarning = "Não foi possível carregar o arquivo — e-mail enviado sem anexo.";
              console.warn("[Email]", attachmentWarning);
            }
          } catch (attachErr) {
            attachmentWarning = `Erro ao buscar anexo: ${attachErr instanceof Error ? attachErr.message : String(attachErr)}`;
            console.warn("[Email]", attachmentWarning);
          }
        } else {
          attachmentWarning = `Arquivo (id=${input.taskFileId}) não encontrado.`;
          console.warn("[Email]", attachmentWarning);
        }
      }

      // ── Enviar e-mail ────────────────────────────────────────────────────────
      let status: "ENVIADO" | "FALHOU" = "ENVIADO";
      let errorMessage: string | undefined;

      try {
        await sendEmail({ to: input.recipientEmail, subject, html, attachments });
        console.log(`[Email] Enviado para ${input.recipientEmail} — tarefa ${input.taskId}`);
      } catch (err) {
        status = "FALHOU";
        errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[Email] FALHOU para ${input.recipientEmail}:`, errorMessage);
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

      // ── Marcar tarefa como CONCLUIDA após envio bem-sucedido ─────────────────
      if (task.status !== "CONCLUIDA" && task.status !== "CANCELADA") {
        await updateTask(task.id, { status: "CONCLUIDA", completedAt: new Date() });
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
  // Disparo manual do auto-envio
  sendGuias: protectedProcedure.mutation(async () => {
    const { autoSendPendingGuias, sendDueSoonAlerts } = await import("./autoSend");
    const sendResult = await autoSendPendingGuias();
    const alertResult = await sendDueSoonAlerts();
    return { guias: sendResult, alerts: alertResult };
  }),

  // Listar arquivos anexados que ainda não foram enviados por e-mail ao cliente
  // Lógica: cada arquivo (taskFile) individualmente — se não há email_log
  // ENVIADO com aquele taskFileId específico, o arquivo é pendente de envio.
  // Isso garante que um envio de teste sem arquivo não "oculte" a guia real.
  pendingGuias: protectedProcedure.query(async () => {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT 
        t.id as taskId, t.title, t.taskType, t.competencia, t.dueDate, t.status,
        t.clientId, t.department,
        c.name as clientName, c.email as clientEmail,
        f.id as fileId, f.filename, f.uploadedAt, f.mimeType,
        f.fileKey, f.fileUrl
      FROM task_files f
      INNER JOIN tasks t ON t.id = f.taskId
      INNER JOIN clients c ON c.id = t.clientId
      WHERE t.status NOT IN ('CANCELADA')
        AND t.sendToClient = 1
        AND c.active = 1
        AND c.email IS NOT NULL AND c.email != ''
        AND NOT EXISTS (
          SELECT 1 FROM email_logs el
          WHERE el.taskFileId = f.id
            AND el.status = 'ENVIADO'
        )
      ORDER BY t.dueDate ASC
      LIMIT 100
    `) as [any[], any];
    return rows;
  }),
});



// ─── Smart Upload Router ──────────────────────────────────────────────────────
// Reconhece PDF de guia DAS/DAS MEI, aloca na tarefa certa e notifica cliente
const smartUploadRouter = router({
  process: protectedProcedure
    .input(z.object({
      filename: z.string(),
      mimeType: z.string().optional(),
      base64: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // 1. Salvar arquivo temporariamente no storage
      const fileKey = `smart-upload/${Date.now()}-${input.filename}`;
      const buffer = Buffer.from(input.base64, "base64");
      const { url } = await storagePut(fileKey, buffer, input.mimeType || "application/pdf");

      // 2. Reconhecer documento via OCR (passa base64 diretamente para Anthropic)
      const { recognizeDocument } = await import("./ocr");
      const recognition = await recognizeDocument(url, input.mimeType || "application/pdf", input.base64);

      // 3. Validar tipo de documento
      const supportedTypes = ["DAS", "DAS_MEI", "NFS", "DCTF", "SPED", "OUTROS", "PGDAS"];
      if (!supportedTypes.includes(recognition.documentType)) {
        return {
          success: false,
          error: `Não foi possível identificar o tipo do documento (confiança: ${recognition.confidence}%). Verifique se o arquivo é uma guia contábil válida.`,
          recognition,
        };
      }

      if (recognition.confidence < 40) {
        return {
          success: false,
          error: `Confiança muito baixa (${recognition.confidence}%). Verifique se o PDF está legível e é uma guia contábil.`,
          recognition,
        };
      }

      // 4. Localizar cliente pelo CNPJ ou CPF extraído
      const allClients = await listClients(false);
      let matchedClient = null;

      if (recognition.cnpj) {
        const cleanCnpj = recognition.cnpj.replace(/\D/g, "");
        matchedClient = allClients.find((c) => c.cnpj.replace(/\D/g, "") === cleanCnpj);
      }
      if (!matchedClient && recognition.cpf) {
        const cleanCpf = recognition.cpf.replace(/\D/g, "");
        matchedClient = allClients.find((c) => c.cpf && c.cpf.replace(/\D/g, "") === cleanCpf);
      }

      if (!matchedClient) {
        return {
          success: false,
          error: `Cliente não encontrado para o documento ${recognition.cnpj || recognition.cpf || "sem CNPJ/CPF"}. Verifique se o cliente está cadastrado.`,
          recognition,
        };
      }

      if (!recognition.competencia) {
        return {
          success: false,
          error: "Não foi possível extrair a competência do documento.",
          recognition,
          clientFound: { id: matchedClient.id, name: matchedClient.name },
        };
      }

      // PGDAS (declaração do Simples): alimenta o faturamento + imposto do cliente
      // na aba "Faturamento e Imposto". Não exige uma tarefa específica; se houver
      // uma tarefa PGDAS da competência, anexa o arquivo e grava o valor nela.
      if (recognition.documentType === "PGDAS") {
        const [pmm, pyyyy] = recognition.competencia.split("/").map(Number);
        if (recognition.receitaBruta) {
          await upsertClientRevenue(matchedClient.id, pyyyy, pmm, recognition.receitaBruta, recognition.impostoDeclarado);
        }
        const clientTasksP = await listTasks({ clientId: matchedClient.id });
        const pgdasTask = clientTasksP.find(
          (t) => t.competencia === recognition.competencia && t.taskType === "PGDAS"
        );
        if (pgdasTask) {
          const key = `tasks/${pgdasTask.id}/${Date.now()}-${input.filename}`;
          const { url } = await storagePut(key, buffer, input.mimeType || "application/pdf");
          await createTaskFile({
            taskId: pgdasTask.id, clientId: matchedClient.id, filename: input.filename,
            fileKey: key, fileUrl: url, mimeType: input.mimeType, fileSize: buffer.length, uploadedBy: ctx.user?.id,
          });
          if ((pgdasTask as any).valor == null && recognition.impostoDeclarado) {
            await updateTask(pgdasTask.id, { valor: recognition.impostoDeclarado } as any);
          }
        }
        return {
          success: true,
          message: `PGDAS de ${matchedClient.name}: faturamento R$ ${recognition.receitaBruta ?? "?"} e imposto R$ ${recognition.impostoDeclarado ?? "?"} registrados na competência ${recognition.competencia}.`,
          recognition,
          clientFound: { id: matchedClient.id, name: matchedClient.name },
        };
      }

      // 5. Localizar a tarefa do cliente para a competência e tipo de documento
      const clientTasks = await listTasks({ clientId: matchedClient.id });

      // Mapeamento de tipo de documento para tipo de tarefa
      const docTypeToTaskType: Record<string, string> = {
        DAS: "DAS", DAS_MEI: "DAS", NFS: "NFS", DCTF: "DCTF", SPED: "SPED", OUTROS: "OUTROS",
      };
      const targetTaskType = docTypeToTaskType[recognition.documentType] || "OUTROS";
      const isMei = recognition.documentType === "DAS_MEI";

      // Busca 1: tarefa do tipo certo + competência certa
      let matchedTask = clientTasks.find(
        (t) =>
          t.competencia === recognition.competencia &&
          t.taskType === targetTaskType &&
          (!isMei || t.title.toUpperCase().includes("MEI"))
      );

      // Busca 2: mesma competência, qualquer tipo parecido
      if (!matchedTask && recognition.competencia) {
        matchedTask = clientTasks.find(
          (t) => t.competencia === recognition.competencia && t.taskType === targetTaskType
        );
      }

      // Busca 3: qualquer tarefa do mesmo tipo (sem filtro de competência)
      if (!matchedTask) {
        matchedTask = clientTasks.find((t) => t.taskType === targetTaskType);
      }

      // Busca 4: qualquer tarefa pendente do cliente (último recurso)
      if (!matchedTask) {
        matchedTask = clientTasks.find((t) => t.status === "PENDENTE");
      }

      if (!matchedTask) {
        return {
          success: false,
          error: `Nenhuma tarefa DAS encontrada para ${matchedClient.name} na competência ${recognition.competencia}. Gere as tarefas do mês primeiro.`,
          recognition,
          clientFound: { id: matchedClient.id, name: matchedClient.name },
        };
      }

      // 6. Salvar arquivo vinculado à tarefa
      const finalFileKey = `tasks/${matchedTask.id}/${Date.now()}-${input.filename}`;
      const { url: finalUrl } = await storagePut(finalFileKey, buffer, input.mimeType || "application/pdf");

      const fileId = await createTaskFile({
        taskId: matchedTask.id,
        clientId: matchedClient.id,
        filename: input.filename,
        fileKey: finalFileKey,
        fileUrl: finalUrl,
        mimeType: input.mimeType,
        fileSize: buffer.length,
        uploadedBy: ctx.user?.id,
      });

      // 7. Atualizar dueDate com a data real da guia + status para EM_ANDAMENTO
      const taskUpdates: Record<string, any> = {};
      if (matchedTask.status === "PENDENTE") {
        taskUpdates.status = "EM_ANDAMENTO";
      }
      // Valor extraído pelo OCR (ex: valor do DAS) — alimenta a aba de imposto do cliente
      if (recognition.valorPrincipal) {
        taskUpdates.valor = recognition.valorPrincipal;
      }
      // Se o OCR extraiu dataVencimento, usa ela como dueDate real (ex: 30/06/2026)
      if (recognition.dataVencimento) {
        const [dd, mm, yyyy] = recognition.dataVencimento.split("/").map(Number);
        if (dd && mm && yyyy) {
          taskUpdates.dueDate = new Date(yyyy, mm - 1, dd);
          console.log(`[SmartUpload] dueDate atualizado para ${recognition.dataVencimento} pela guia`);
        }
      }
      if (Object.keys(taskUpdates).length > 0) {
        await updateTask(matchedTask.id, taskUpdates);
      }

      // 8. Arquivo salvo — vai para Pendentes de Envio para o ciclo automático disparar
      // O e-mail NÃO é enviado aqui. O scheduler de 1h verifica pendentes e dispara.
      console.log(`[SmartUpload] Arquivo ${fileId} salvo. Aguardando ciclo de envio automático.`);

      // Registra no histórico da tarefa que o envio foi agendado
      try {
        const { logActivity } = await import("./db");
        await logActivity({
          entityType: "task",
          entityId: matchedTask.id,
          action: "scheduled",
          before: null,
          after: JSON.stringify({ fileId, filename: input.filename }),
          userId: ctx.user?.id,
        });
      } catch {}

      return {
        success: true,
        recognition,
        client: { id: matchedClient.id, name: matchedClient.name },
        task: { id: matchedTask.id, title: matchedTask.title, competencia: matchedTask.competencia },
        fileId,
        emailSent: false,
        pendingEmail: true,
        message: "Guia anexada com sucesso! Será enviada ao cliente no próximo ciclo automático.",
      };
    }),
});


// ─── Task Catalogs Router ─────────────────────────────────────────────────────
const taskCatalogsRouter = router({
  list: protectedProcedure
    .input(z.object({ activeOnly: z.boolean().default(true) }))
    .query(({ input }) => listTaskCatalogs(input.activeOnly)),

  create: adminProcedure
    .input(z.object({
      name: z.string().min(2),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await createTaskCatalog({ ...input, active: true });
      return { id };
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateTaskCatalog(id, data);
      return { success: true };
    }),

  getTemplates: protectedProcedure
    .input(z.object({ catalogId: z.number() }))
    .query(({ input }) => getCatalogTemplates(input.catalogId)),

  addTemplate: protectedProcedure
    .input(z.object({ catalogId: z.number(), taskTemplateId: z.number() }))
    .mutation(async ({ input }) => {
      await addCatalogTemplate(input);
      return { success: true };
    }),

  removeTemplate: protectedProcedure
    .input(z.object({ catalogId: z.number(), taskTemplateId: z.number() }))
    .mutation(async ({ input }) => {
      await removeCatalogTemplate(input.catalogId, input.taskTemplateId);
      return { success: true };
    }),

  applyToClient: adminProcedure
    .input(z.object({ clientId: z.number(), catalogId: z.number() }))
    .mutation(async ({ input }) => {
      const added = await applyCatalogToClient(input.clientId, input.catalogId);
      return { success: true, added };
    }),
});


// ─── Operational Queue Router ──────────────────────────────────────────────────
const operationalRouter = router({
  queue: protectedProcedure
    .input(z.object({
      department: z.enum(["FISCAL","CONTABIL","DP","SOCIETARIO","FINANCEIRO","GERAL"]).optional(),
      status: z.enum(["PENDENTE","EM_ANDAMENTO","AGUARDANDO_CLIENTE","EM_REVISAO","CONCLUIDA","CANCELADA","VENCIDA"]).optional(),
      urgent: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      const { getOperationalQueue } = await import("./db");
      return getOperationalQueue(input ?? {});
    }),

  activityLog: protectedProcedure
    .input(z.object({ entityType: z.string(), entityId: z.number() }))
    .query(async ({ input }) => {
      return getActivityLogs(input.entityType, input.entityId);
    }),

  stats: protectedProcedure.query(async () => {
    const all = await listTasks();
    const today = new Date();
    const todayStr = today.toDateString();
    return {
      total: all.length,
      pendentes: all.filter((t) => t.status === "PENDENTE").length,
      emAndamento: all.filter((t) => t.status === "EM_ANDAMENTO").length,
      aguardandoCliente: all.filter((t) => t.status === "AGUARDANDO_CLIENTE").length,
      emRevisao: all.filter((t) => t.status === "EM_REVISAO").length,
      concluidas: all.filter((t) => t.status === "CONCLUIDA").length,
      vencidas: all.filter((t) => t.status === "VENCIDA").length,
      vencendoHoje: all.filter((t) => new Date(t.dueDate).toDateString() === todayStr && t.status !== "CONCLUIDA").length,
      urgentes: all.filter((t) => (t as any).priority === "URGENTE" && t.status !== "CONCLUIDA").length,
    };
  }),
});

// ─── Task Templates Router ────────────────────────────────────────────────────
const taskTemplatesRouter = router({
  list: protectedProcedure
    .input(z.object({ activeOnly: z.boolean().default(true) }))
    .query(({ input }) => listTaskTemplates(input.activeOnly)),

  create: adminProcedure
    .input(z.object({
      title: z.string().min(2),
      description: z.string().optional(),
      taskType: z.enum(["DAS", "NFS", "DCTF", "SPED", "OUTROS", "PIS", "COFINS", "ICMS", "ISSQN", "PGDAS"]),
      dueDayOfMonth: z.number().min(1).max(31),
      ocrKeywords: z.string().optional(),
      department: z.string().optional(),
      periodicity: z.enum(["MENSAL", "TRIMESTRAL", "ANUAL"]).optional(),
      competenciaOffset: z.number().min(0).max(12).optional(),
      annualMonth: z.number().min(1).max(12).optional(),
      sendToClient: z.boolean().optional(),
      dueDateAdjust: z.enum(["PROXIMO_DIA_UTIL", "DIA_UTIL_ANTERIOR", "NENHUM"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await createTaskTemplate({ ...input, active: true } as any);
      return { id };
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      taskType: z.enum(["DAS", "NFS", "DCTF", "SPED", "OUTROS", "PIS", "COFINS", "ICMS", "ISSQN", "PGDAS"]).optional(),
      dueDayOfMonth: z.number().min(1).max(31).optional(),
      ocrKeywords: z.string().optional(),
      department: z.string().optional(),
      periodicity: z.enum(["MENSAL", "TRIMESTRAL", "ANUAL"]).optional(),
      competenciaOffset: z.number().min(0).max(12).optional(),
      annualMonth: z.number().min(1).max(12).optional(),
      sendToClient: z.boolean().optional(),
      dueDateAdjust: z.enum(["PROXIMO_DIA_UTIL", "DIA_UTIL_ANTERIOR", "NENHUM"]).optional(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateTaskTemplate(id, data as any);
      return { success: true };
    }),

  toggle: adminProcedure
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

  add: adminProcedure
    .input(z.object({ clientId: z.number(), taskTemplateId: z.number() }))
    .mutation(async ({ input }) => {
      // Verificar se já existe
      const existing = await listClientTaskTemplates(input.clientId);
      const alreadyLinked = existing.find((e) => e.taskTemplateId === input.taskTemplateId);
      if (alreadyLinked) {
        return { id: alreadyLinked.id };
      }

      const id = await addClientTaskTemplate({ ...input, active: true });

      // Criar recurringTask para gerar instâncias mensais (apenas se não existir)
      const template = await getTaskTemplateById(input.taskTemplateId);
      if (template) {
        const existingRecurring = await listRecurringTasks(input.clientId);
        const alreadyHasRecurring = existingRecurring.some(
          (r) => r.taskTemplateId === input.taskTemplateId
        );
        if (!alreadyHasRecurring) {
          await createRecurringTask({
            clientId: input.clientId,
            taskTemplateId: input.taskTemplateId,
            title: template.title,
            description: template.description ?? undefined,
            taskType: template.taskType,
            department: (template as any).department ?? "Geral",
            periodicity: (template as any).periodicity ?? "MENSAL",
            competenciaOffset: (template as any).competenciaOffset ?? 1,
            annualMonth: (template as any).annualMonth ?? null,
            sendToClient: (template as any).sendToClient ?? true,
            dueDateAdjust: (template as any).dueDateAdjust ?? "PROXIMO_DIA_UTIL",
            dueDayOfMonth: template.dueDayOfMonth,
            active: true,
          });
        }
      }
      return { id };
    }),

  remove: adminProcedure
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


// ─── Client Portal Router ─────────────────────────────────────────────────────
// Interface exclusiva para clientes — acesso somente às próprias guias
// Resolve de qual cliente é o portal: o próprio (role client) ou, para equipe
// interna (admin/user), o cliente informado em previewClientId (pré-visualização).
function resolvePortalClientId(ctx: any, previewClientId?: number): number {
  if (ctx.user.role === "client") {
    if (!ctx.user.clientId) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a clientes" });
    return ctx.user.clientId;
  }
  if ((ctx.user.role === "admin" || ctx.user.role === "user") && previewClientId) {
    return previewClientId;
  }
  throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito" });
}

const clientPortalRouter = router({
  // Dados do calendário: tarefas do cliente logado agrupadas por mês
  calendar: protectedProcedure
    .input(z.object({ month: z.number().min(1).max(12), year: z.number().min(2020), previewClientId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const clientId = resolvePortalClientId(ctx, input.previewClientId);
      const clientTasks = await listTasks({ clientId });

      // Guias "disparadas": só marcamos o dia no calendário quando a guia já foi
      // enviada ao cliente (envio bem-sucedido registrado em email_logs). Assim o
      // cliente não vê um vencimento e cobra uma guia que ainda não saiu.
      const logs = await listEmailLogs(undefined, clientId);
      const dispatchedTaskIds = new Set(
        logs.filter((l) => l.status === "ENVIADO").map((l) => l.taskId)
      );

      // O cliente enxerga o calendário por DATA DE VENCIMENTO (quando pagar),
      // não por competência. Ex.: DAS da competência 07 vence em 08/08 → aparece
      // no calendário de agosto. Mesmo critério do Painel Mensal interno.
      // Também só mostramos o que está marcado como "enviar ao cliente"
      // (DAS aparece; consultas/rotinas internas não) E cuja guia já foi disparada.
      const monthTasks = clientTasks.filter((t) => {
        const due = new Date(t.dueDate);
        const inMonth =
          due.getUTCMonth() + 1 === input.month && due.getUTCFullYear() === input.year;
        const visible =
          (t as any).sendToClient !== false && (t as any).sendToClient !== 0;
        const dispatched = dispatchedTaskIds.has(t.id);
        return inMonth && visible && dispatched;
      });
      return monthTasks.map((t) => ({
        id: t.id,
        title: t.title,
        taskType: t.taskType,
        status: t.status,
        dueDate: t.dueDate,
        competencia: t.competencia,
      }));
    }),

  // Arquivos de uma tarefa específica (somente do cliente logado)
  taskFiles: protectedProcedure
    .input(z.object({ taskId: z.number(), previewClientId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const clientId = resolvePortalClientId(ctx, input.previewClientId);
      const task = await getTaskById(input.taskId);
      if (!task || task.clientId !== clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Tarefa não pertence a este cliente" });
      }
      return listTaskFiles(input.taskId);
    }),

  // URL de download de arquivo (presigned)
  fileDownloadUrl: protectedProcedure
    .input(z.object({ taskId: z.number(), fileId: z.number(), previewClientId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const clientId = resolvePortalClientId(ctx, input.previewClientId);
      const task = await getTaskById(input.taskId);
      if (!task || task.clientId !== clientId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const file = await getTaskFileById(input.fileId);
      if (!file) throw new TRPCError({ code: "NOT_FOUND" });

      // fileUrl can be a data URL (Railway) or a manus-storage path (Manus)
      // For data URLs, return directly. For manus paths, get signed URL.
      if (file.fileUrl.startsWith("data:") || file.fileUrl.startsWith("http")) {
        return { url: file.fileUrl };
      }
      try {
        const { storageGetSignedUrl } = await import("./storage");
        const url = await storageGetSignedUrl(file.fileKey);
        return { url: url || file.fileUrl };
      } catch {
        return { url: file.fileUrl };
      }
    }),

  // Número de WhatsApp do escritório (para os botões "Falar com o escritório")
  officeWhatsApp: protectedProcedure.query(() => {
    const raw = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+5519999560591";
    return { number: raw.replace(/\D/g, "") };
  }),

  // Faturamento + impostos do mês (aba "Acompanhar faturamento e imposto")
  financials: protectedProcedure
    .input(z.object({ month: z.number().min(1).max(12), year: z.number().min(2020), previewClientId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const clientId = resolvePortalClientId(ctx, input.previewClientId);
      const clientTasks = await listTasks({ clientId });
      const logs = await listEmailLogs(undefined, clientId);
      const dispatched = new Set(logs.filter((l) => l.status === "ENVIADO").map((l) => l.taskId));
      const taxes = clientTasks
        .filter((t) => {
          const due = new Date(t.dueDate);
          const inMonth = due.getUTCMonth() + 1 === input.month && due.getUTCFullYear() === input.year;
          const visible = (t as any).sendToClient !== false && (t as any).sendToClient !== 0;
          return inMonth && visible && dispatched.has(t.id);
        })
        .map((t) => ({ id: t.id, title: t.title, taskType: t.taskType, valor: (t as any).valor ?? null, dueDate: t.dueDate }));
      const rev = await getClientRevenue(clientId, input.year, input.month);
      return { taxes, revenue: rev?.valor ?? null, imposto: rev?.imposto ?? null };
    }),

  // Lançar/editar faturamento do mês (somente equipe interna, via pré-visualização)
  setRevenue: protectedProcedure
    .input(z.object({ clientId: z.number(), year: z.number(), month: z.number().min(1).max(12), valor: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "user") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas equipe interna" });
      }
      await upsertClientRevenue(input.clientId, input.year, input.month, input.valor.replace(",", "."));
      return { success: true };
    }),
});

// ─── Client Management Router (admin only) ────────────────────────────────────
const clientAccessRouter = router({
  // Criar/redefinir login de acesso para um cliente
  createLogin: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      email: z.string().email(),
      password: z.string().min(6),
    }))
    .mutation(async ({ input }) => {
      const email = input.email.trim().toLowerCase();
      const passwordHash = await bcryptjs.hash(input.password, 10);
      const existing = await getUserByEmail(email);
      if (existing) {
        await upsertUser({
          email,
          passwordHash,
          role: "client",
          clientId: input.clientId,
          lastSignedIn: existing.lastSignedIn,
        });
        return { success: true, action: "updated" };
      }
      await upsertUser({
        email,
        name: email,
        passwordHash,
        role: "client",
        clientId: input.clientId,
        lastSignedIn: new Date(),
      });
      return { success: true, action: "created" };
    }),

  // Listar acessos de clientes existentes
  listLogins: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const { users: usersTable } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    try {
      return await db.select({
        id: usersTable.id,
        email: usersTable.email,
        clientId: usersTable.clientId,
        lastSignedIn: usersTable.lastSignedIn,
        mustChangePassword: usersTable.mustChangePassword,
      }).from(usersTable).where(eq(usersTable.role, "client"));
    } catch {
      const rows = await db.select({
        id: usersTable.id,
        email: usersTable.email,
        clientId: usersTable.clientId,
        lastSignedIn: usersTable.lastSignedIn,
      }).from(usersTable).where(eq(usersTable.role, "client"));
      return rows.map((r) => ({ ...r, mustChangePassword: false }));
    }
  }),

  deleteLogin: protectedProcedure
    .input(z.object({ id: z.number().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { users: usersTable } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(usersTable).where(eq(usersTable.id, input.id));
      return { success: true };
    }),

  resetClientPassword: protectedProcedure
    .input(z.object({
      id: z.number().positive(),
      newPassword: z.string().min(6).max(100),
    }))
    .mutation(async ({ input }) => {
      const passwordHash = await bcryptjs.hash(input.newPassword, 10);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { users: usersTable } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, input.id));
      return { success: true };
    }),
});


// ─── Health Router ────────────────────────────────────────────────────────────
const healthRouter = router({
  check: publicProcedure.query(async () => {
    const { checkDbHealth } = await import("./db");
    const db = await checkDbHealth();
    return {
      status: db.ok ? "ok" : "degraded",
      uptime: process.uptime(),
      memory: process.memoryUsage().heapUsed,
      db,
      timestamp: new Date().toISOString(),
    };
  }),
});

// ─── Departments Router ───────────────────────────────────────────────────────
const departmentsRouter = router({
  list: protectedProcedure.query(async () => {
    const { listDepartments } = await import("./db");
    return listDepartments(false);
  }),

  listAll: adminProcedure.query(async () => {
    const { listDepartments } = await import("./db");
    return listDepartments(true);
  }),

  create: adminProcedure
    .input(z.object({ name: z.string().min(1).max(100), color: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { createDepartment } = await import("./db");
      const id = await createDepartment(input);
      return { id };
    }),

  update: adminProcedure
    .input(z.object({ id: z.number(), name: z.string().optional(), color: z.string().optional(), active: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const { updateDepartment } = await import("./db");
      const { id, ...data } = input;
      await updateDepartment(id, data);
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { deleteDepartment } = await import("./db");
      await deleteDepartment(input.id);
      return { success: true };
    }),
});

// ─── Users Management Router (admin only) ─────────────────────────────────────
const usersRouter = router({
  list: adminProcedure.query(async () => {
    const { listUsers, getUserDepartments, getUserClients, getUserModules } = await import("./db");
    const users = await listUsers();
    // Enriquecer com departamentos, empresas e módulos de cada usuário
    const enriched = await Promise.all(users.map(async (u) => ({
      ...u,
      passwordHash: undefined, // nunca expor o hash
      departmentIds: await getUserDepartments(u.id),
      clientIds: await getUserClients(u.id),
      modules: await getUserModules(u.id),
    })));
    return enriched;
  }),

  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(6),
      role: z.enum(["admin", "user"]).default("user"),
      departmentIds: z.array(z.number()).default([]),
      clientIds: z.array(z.number()).default([]),
      modules: z.array(z.object({ module: z.string(), level: z.string() })).default([]),
    }))
    .mutation(async ({ input }) => {
      const { createLocalUser, setUserDepartments, setUserClients, setUserModules, getUserByEmail } = await import("./db");
      const bcryptjs = (await import("bcryptjs")).default;

      const existing = await getUserByEmail(input.email);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Já existe um usuário com esse e-mail" });

      const passwordHash = await bcryptjs.hash(input.password, 10);
      const userId = await createLocalUser({
        name: input.name, email: input.email, passwordHash, role: input.role,
      });
      await setUserDepartments(userId, input.departmentIds);
      await setUserClients(userId, input.clientIds);
      await setUserModules(userId, input.modules);
      return { id: userId };
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      email: z.string().email().optional(),
      password: z.string().min(6).optional(),
      role: z.enum(["admin", "user"]).optional(),
      departmentIds: z.array(z.number()).optional(),
      clientIds: z.array(z.number()).optional(),
      modules: z.array(z.object({ module: z.string(), level: z.string() })).optional(),
    }))
    .mutation(async ({ input }) => {
      const { updateUserBasic, setUserDepartments, setUserClients, setUserModules } = await import("./db");
      const bcryptjs = (await import("bcryptjs")).default;

      const basic: any = {};
      if (input.name !== undefined) basic.name = input.name;
      if (input.email !== undefined) basic.email = input.email;
      if (input.role !== undefined) basic.role = input.role;
      if (input.password) basic.passwordHash = await bcryptjs.hash(input.password, 10);
      if (Object.keys(basic).length > 0) await updateUserBasic(input.id, basic);

      if (input.departmentIds !== undefined) await setUserDepartments(input.id, input.departmentIds);
      if (input.clientIds !== undefined) await setUserClients(input.id, input.clientIds);
      if (input.modules !== undefined) await setUserModules(input.id, input.modules);
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (input.id === ctx.user?.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível excluir a si mesmo" });
      const { deleteUser } = await import("./db");
      await deleteUser(input.id);
      return { success: true };
    }),
});

// ─── Calendar Router ──────────────────────────────────────────────────────────
const calendarRouter = router({
  // Lista eventos num intervalo (mês)
  events: protectedProcedure
    .input(z.object({ startISO: z.string(), endISO: z.string() }))
    .query(async ({ input, ctx }) => {
      const { getCalendarEvents } = await import("./db");
      return getCalendarEvents(ctx.user!.id, input.startISO, input.endISO);
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      location: z.string().optional(),
      startAt: z.string(),
      endAt: z.string(),
      allDay: z.boolean().optional(),
      color: z.string().optional(),
      guestUserIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { createCalendarEvent } = await import("./db");
      const id = await createCalendarEvent({
        ownerId: ctx.user!.id,
        title: input.title,
        description: input.description,
        location: input.location,
        startAt: new Date(input.startAt),
        endAt: new Date(input.endAt),
        allDay: input.allDay,
        color: input.color,
        guestUserIds: input.guestUserIds,
      });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      location: z.string().optional(),
      startAt: z.string().optional(),
      endAt: z.string().optional(),
      allDay: z.boolean().optional(),
      color: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { updateCalendarEvent } = await import("./db");
      const { id, startAt, endAt, ...rest } = input;
      await updateCalendarEvent(id, ctx.user!.id, {
        ...rest,
        ...(startAt ? { startAt: new Date(startAt) } : {}),
        ...(endAt ? { endAt: new Date(endAt) } : {}),
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const { deleteCalendarEvent } = await import("./db");
      await deleteCalendarEvent(input.id, ctx.user!.id);
      return { success: true };
    }),

  respondInvite: protectedProcedure
    .input(z.object({ eventId: z.number(), status: z.enum(["ACEITO", "RECUSADO"]) }))
    .mutation(async ({ input, ctx }) => {
      const { respondToCalendarInvite } = await import("./db");
      await respondToCalendarInvite(input.eventId, ctx.user!.id, input.status);
      return { success: true };
    }),

  pendingInvites: protectedProcedure.query(async ({ ctx }) => {
    const { getPendingInvites } = await import("./db");
    return getPendingInvites(ctx.user!.id);
  }),

  // Lista usuários que podem ser convidados (equipe, exceto o próprio)
  invitableUsers: protectedProcedure.query(async ({ ctx }) => {
    const { listUsers } = await import("./db");
    const users = await listUsers();
    return users
      .filter((u) => u.id !== ctx.user!.id && u.role !== "client")
      .map((u) => ({ id: u.id, name: u.name, email: u.email }));
  }),

  // Status da integração Google (gancho — sempre desconectado por enquanto)
  googleStatus: protectedProcedure.query(async () => {
    // Quando a integração for ativada, consultar google_calendar_tokens
    return { connected: false, available: false };
  }),
});

// ─── Modules Router (plataforma) ──────────────────────────────────────────────
const modulesRouter = router({
  // Módulos do usuário logado (para montar o Hub)
  mine: protectedProcedure.query(async ({ ctx }) => {
    const { getUserModules } = await import("./db");
    return getUserModules(ctx.user!.id);
  }),
});

// ─── Proposals Router (módulo propostas) ──────────────────────────────────────
const proposalsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { getUserModules, listProposals } = await import("./db");
    const mods = await getUserModules(ctx.user!.id);
    const propMod = mods.find((m) => m.module === "propostas");
    if (!propMod) throw new TRPCError({ code: "FORBIDDEN", message: "Sem acesso ao módulo Propostas" });
    const isAdmin = propMod.level === "admin";
    return listProposals(ctx.user!.id, isAdmin);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const { getProposal, getUserModules } = await import("./db");
      const mods = await getUserModules(ctx.user!.id);
      const propMod = mods.find((m) => m.module === "propostas");
      if (!propMod) throw new TRPCError({ code: "FORBIDDEN" });
      const p = await getProposal(input.id);
      if (!p) throw new TRPCError({ code: "NOT_FOUND" });
      // Leitor/editor só acessa as próprias; admin acessa todas
      if (propMod.level !== "admin" && p.ownerId !== ctx.user!.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return p;
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      clientName: z.string().optional(),
      data: z.string(),
      status: z.enum(["RASCUNHO", "ENVIADA", "ACEITA", "RECUSADA"]).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { getUserModules, createProposal } = await import("./db");
      const mods = await getUserModules(ctx.user!.id);
      const propMod = mods.find((m) => m.module === "propostas");
      if (!propMod || propMod.level === "leitor") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para criar propostas" });
      }
      const id = await createProposal({ ownerId: ctx.user!.id, ...input });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      clientName: z.string().optional(),
      data: z.string().optional(),
      status: z.enum(["RASCUNHO", "ENVIADA", "ACEITA", "RECUSADA"]).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { getUserModules, getProposal, updateProposal } = await import("./db");
      const mods = await getUserModules(ctx.user!.id);
      const propMod = mods.find((m) => m.module === "propostas");
      if (!propMod || propMod.level === "leitor") throw new TRPCError({ code: "FORBIDDEN" });
      const p = await getProposal(input.id);
      if (!p) throw new TRPCError({ code: "NOT_FOUND" });
      if (propMod.level !== "admin" && p.ownerId !== ctx.user!.id) throw new TRPCError({ code: "FORBIDDEN" });
      const { id, ...data } = input;
      await updateProposal(id, data);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const { getUserModules, getProposal, deleteProposal } = await import("./db");
      const mods = await getUserModules(ctx.user!.id);
      const propMod = mods.find((m) => m.module === "propostas");
      if (!propMod || propMod.level === "leitor") throw new TRPCError({ code: "FORBIDDEN" });
      const p = await getProposal(input.id);
      if (!p) throw new TRPCError({ code: "NOT_FOUND" });
      if (propMod.level !== "admin" && p.ownerId !== ctx.user!.id) throw new TRPCError({ code: "FORBIDDEN" });
      await deleteProposal(input.id);
      return { success: true };
    }),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(async (opts) => {
      const user = opts.ctx.user;
      if (!user) return null;
      // Anexa os módulos do usuário (para o Hub e o controle de acesso no front)
      try {
        const { getUserModules } = await import("./db");
        const modules = await getUserModules((user as any).id);
        return { ...user, modules };
      } catch {
        return { ...user, modules: [] };
      }
    }),
    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(6) }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByEmail(input.email.trim().toLowerCase());
        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Credenciais inválidas" });
        }
        // Detectar hash legado do Manus (não-bcrypt, 44 chars base64)
        const isBcryptHash = user.passwordHash.startsWith("$2b$") || user.passwordHash.startsWith("$2a$");
        if (!isBcryptHash) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Senha incompatível com o novo sistema. Contate o administrador para redefinir sua senha.",
          });
        }
        const isValidPassword = await bcryptjs.compare(input.password, user.passwordHash);
        if (!isValidPassword) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Credenciais inválidas" });
        }
        // Atualiza lastSignedIn sem tocar no passwordHash
        const db = await getDb();
        if (db) {
          const { users: usersTable } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await db.update(usersTable).set({ lastSignedIn: new Date() }).where(eq(usersTable.id, user.id));
        }
        const { sdk } = await import("./_core/sdk");
        const sessionToken = await sdk.createSessionToken(user.id.toString(), {
          name: user.name || user.email,
          expiresInMs: SESSION_DURATION_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: SESSION_DURATION_MS,
        });
        return { success: true, user, role: user.role, clientId: (user as any).clientId };
      }),
    // Cliente define a própria senha no primeiro acesso (limpa mustChangePassword)
    setInitialPassword: protectedProcedure
      .input(z.object({ newPassword: z.string().min(6) }))
      .mutation(async ({ input, ctx }) => {
        const passwordHash = await bcryptjs.hash(input.newPassword, 10);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { users: usersTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await db.update(usersTable)
          .set({ passwordHash, mustChangePassword: false })
          .where(eq(usersTable.id, ctx.user.id));
        return { success: true };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    forgotPassword: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const user = await getUserByEmail(input.email.trim().toLowerCase());
        if (!user) return { success: true }; // Não revelar se e-mail existe
        const token = randomUUID().replace(/-/g, "");
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hora
        await createPasswordResetToken(user.id, token, expiresAt);
        const resetUrl = `${process.env.OAUTH_SERVER_URL || "http://localhost:8080"}/reset-senha?token=${token}`;
        await sendEmail({
          to: input.email,
          subject: "Redefinição de senha — Equilibrium",
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto"><h2 style="color:#24646c">Redefinição de senha</h2><p>Recebemos uma solicitação para redefinir a senha da sua conta no sistema Equilibrium.</p><p>Clique no botão abaixo para criar uma nova senha. O link é válido por <strong>1 hora</strong>.</p><a href="${resetUrl}" style="display:inline-block;background:#24646c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">Redefinir senha</a><p style="color:#999;font-size:12px">Se você não solicitou a redefinição, ignore este e-mail.</p></div>`,
          attachments: [],
        });
        return { success: true };
      }),

    resetPassword: publicProcedure
      .input(z.object({ token: z.string(), newPassword: z.string().min(6) }))
      .mutation(async ({ input }) => {
        const user = await getUserByResetToken(input.token);
        if (!user) throw new TRPCError({ code: "BAD_REQUEST", message: "Token inválido ou expirado" });
        const passwordHash = await bcryptjs.hash(input.newPassword, 10);
        await resetUserPassword(user.id, passwordHash);
        return { success: true };
      }),
  }),
  clients: clientsRouter,
  recurringTasks: recurringTasksRouter,
  tasks: tasksRouter,
  files: filesRouter,
  email: emailRouter,
  autoSend: autoSendRouter,
  health: healthRouter,
  operational: operationalRouter,
  taskTemplates: taskTemplatesRouter,
  taskCatalogs: taskCatalogsRouter,
  clientTemplates: clientTemplatesRouter,
  monthlyPanel: monthlyPanelRouter,
  smartUpload: smartUploadRouter,
  departments: departmentsRouter,
  usersAdmin: usersRouter,
  calendar: calendarRouter,
  modules: modulesRouter,
  proposals: proposalsRouter,
  clientPortal: clientPortalRouter,
  clientAccess: clientAccessRouter,
});

export type AppRouter = typeof appRouter;
