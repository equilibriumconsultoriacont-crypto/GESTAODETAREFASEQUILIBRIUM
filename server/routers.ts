import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  addClientTaskTemplate,
  applyCatalogToClient,
  createTaskCatalog,
  getCatalogTemplates,
  addCatalogTemplate,
  removeCatalogTemplate,
  listTaskCatalogs,
  updateTaskCatalog,
  createClient,
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
  updateTaskTemplate,
} from "./db";
import { buildAlertEmailHtml, buildGuiaEmailHtml, sendEmail } from "./email";
import { storagePut, storageDelete, storageGetBuffer } from "./storage";
import { sendGuiaConfirmationWhatsApp } from "./whatsapp";
import { getDb, getUserByEmail, upsertUser } from "./db";
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
        cpf: z.string().optional(),
        documentType: z.enum(["CNPJ", "CPF"]).default("CNPJ"),
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
        cpf: z.string().optional(),
        documentType: z.enum(["CNPJ", "CPF"]).optional(),
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

      // 2. Reconhecer documento via OCR
      const { recognizeDocument } = await import("./ocr");
      const recognition = await recognizeDocument(url, input.mimeType || "application/pdf");

      // 3. Validar: só aceita DAS e DAS_MEI por enquanto
      const supportedTypes = ["DAS", "DAS_MEI"];
      if (!supportedTypes.includes(recognition.documentType)) {
        return {
          success: false,
          error: `Tipo de documento não suportado: ${recognition.documentType}. Por enquanto só DAS e DAS MEI são aceitos.`,
          recognition,
        };
      }

      if (recognition.confidence < 50) {
        return {
          success: false,
          error: `Confiança muito baixa (${recognition.confidence}%). Verifique se o PDF é uma guia DAS ou DAS MEI.`,
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

      // 5. Localizar a tarefa DAS/DAS_MEI do cliente para a competência
      const clientTasks = await listTasks({ clientId: matchedClient.id });
      const taskTypeSearch = recognition.documentType === "DAS_MEI" ? "MEI" : "DAS";
      let matchedTask = clientTasks.find(
        (t) =>
          t.competencia === recognition.competencia &&
          t.taskType === "DAS" &&
          t.title.toUpperCase().includes(taskTypeSearch)
      );

      // Se não encontrar tarefa existente, buscar a mais recente do tipo
      if (!matchedTask) {
        matchedTask = clientTasks.find(
          (t) => t.taskType === "DAS" && t.title.toUpperCase().includes(taskTypeSearch)
        );
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

      // 7. Atualizar status da tarefa para EM_ANDAMENTO se ainda PENDENTE
      if (matchedTask.status === "PENDENTE") {
        await updateTask(matchedTask.id, { status: "EM_ANDAMENTO" });
      }

      // 8. Enviar e-mail ao cliente com a guia em anexo
      let emailSent = false;
      let emailWarning: string | undefined;
      try {
        const { buildGuiaEmailHtml } = await import("./email");
        const subject = `Guia ${recognition.documentType === "DAS_MEI" ? "DAS MEI" : "DAS"} — Competência ${recognition.competencia} | Equilibrium Consultoria`;
        const html = buildGuiaEmailHtml({
          clientName: matchedClient.name,
          taskTitle: matchedTask.title,
          competencia: recognition.competencia,
          dueDate: new Date(matchedTask.dueDate),
          notes: recognition.valorPrincipal ? `Valor: R$ ${recognition.valorPrincipal}` : undefined,
        });

        // Buscar buffer para anexo via presigned URL
        const attachments: any[] = [];
        try {
          const buf = await storageGetBuffer(finalFileKey, finalUrl);
          if (buf) {
            attachments.push({
              filename: input.filename,
              content: buf,
              contentType: input.mimeType || "application/pdf",
            });
          }
        } catch (e) {
          console.warn("[SmartUpload] Could not load attachment:", e);
        }

        await sendEmail({ to: matchedClient.email, subject, html, attachments });
        emailSent = true;

        // Log do envio
        await createEmailLog({
          taskId: matchedTask.id,
          clientId: matchedClient.id,
          taskFileId: fileId,
          recipientEmail: matchedClient.email,
          subject,
          body: html,
          status: "ENVIADO",
          sentBy: ctx.user?.id,
        });
      } catch (emailErr) {
        emailWarning = `E-mail não enviado: ${emailErr instanceof Error ? emailErr.message : String(emailErr)}`;
        console.warn("[SmartUpload] Email failed:", emailErr);
        await createEmailLog({
          taskId: matchedTask.id,
          clientId: matchedClient.id,
          taskFileId: fileId,
          recipientEmail: matchedClient.email,
          subject: `Guia DAS — ${recognition.competencia}`,
          body: "",
          status: "FALHOU",
          errorMessage: emailWarning,
          sentBy: ctx.user?.id,
        });
      }

      // 9. Enviar WhatsApp (não bloqueia)
      let whatsappSent = false;
      try {
        if (matchedClient.phone) {
          const wppResult = await sendGuiaConfirmationWhatsApp(
            matchedClient.phone,
            matchedTask.title,
            matchedClient.name
          );
          whatsappSent = wppResult.success;
        }
      } catch (wppErr) {
        console.warn("[SmartUpload] WhatsApp failed:", wppErr);
      }

      return {
        success: true,
        recognition,
        client: { id: matchedClient.id, name: matchedClient.name },
        task: { id: matchedTask.id, title: matchedTask.title, competencia: matchedTask.competencia },
        fileId,
        emailSent,
        emailWarning,
        whatsappSent,
      };
    }),
});


// ─── Task Catalogs Router ─────────────────────────────────────────────────────
const taskCatalogsRouter = router({
  list: protectedProcedure
    .input(z.object({ activeOnly: z.boolean().default(true) }))
    .query(({ input }) => listTaskCatalogs(input.activeOnly)),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(2),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await createTaskCatalog({ ...input, active: true });
      return { id };
    }),

  update: protectedProcedure
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

  applyToClient: protectedProcedure
    .input(z.object({ clientId: z.number(), catalogId: z.number() }))
    .mutation(async ({ input }) => {
      const added = await applyCatalogToClient(input.clientId, input.catalogId);
      return { success: true, added };
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
      // Verificar se já existe
      const existing = await listClientTaskTemplates(input.clientId);
      const alreadyLinked = existing.find((e) => e.taskTemplateId === input.taskTemplateId);
      if (alreadyLinked) {
        return { id: alreadyLinked.id };
      }

      const id = await addClientTaskTemplate({ ...input, active: true });

      // Criar recurringTask para gerar instâncias mensais
      const template = await getTaskTemplateById(input.taskTemplateId);
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


// ─── Client Portal Router ─────────────────────────────────────────────────────
// Interface exclusiva para clientes — acesso somente às próprias guias
const clientPortalRouter = router({
  // Dados do calendário: tarefas do cliente logado agrupadas por mês
  calendar: publicProcedure
    .input(z.object({ month: z.number().min(1).max(12), year: z.number().min(2020) }))
    .query(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      if (ctx.user.role !== "client" || !ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a clientes" });
      }
      const clientTasks = await listTasks({ clientId: ctx.user.clientId });
      const competencia = `${String(input.month).padStart(2, "0")}/${input.year}`;
      const monthTasks = clientTasks.filter((t) => t.competencia === competencia);
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
  taskFiles: publicProcedure
    .input(z.object({ taskId: z.number() }))
    .query(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      if (ctx.user.role !== "client" || !ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const task = await getTaskById(input.taskId);
      if (!task || task.clientId !== ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Tarefa não pertence a este cliente" });
      }
      return listTaskFiles(input.taskId);
    }),

  // URL de download de arquivo (presigned)
  fileDownloadUrl: publicProcedure
    .input(z.object({ taskId: z.number(), fileId: z.number() }))
    .query(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      if (ctx.user.role !== "client" || !ctx.user.clientId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const task = await getTaskById(input.taskId);
      if (!task || task.clientId !== ctx.user.clientId) {
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
      const passwordHash = await bcryptjs.hash(input.password, 10);
      const existing = await getUserByEmail(input.email);
      if (existing) {
        await upsertUser({
          email: input.email,
          passwordHash,
          role: "client",
          clientId: input.clientId,
          lastSignedIn: existing.lastSignedIn,
        });
        return { success: true, action: "updated" };
      }
      await upsertUser({
        email: input.email,
        name: input.email,
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
    return db.select({
      id: usersTable.id,
      email: usersTable.email,
      clientId: usersTable.clientId,
      lastSignedIn: usersTable.lastSignedIn,
    }).from(usersTable).where(eq(usersTable.role, "client"));
  }),
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
          expiresInMs: 1000 * 60 * 60 * 24 * 365,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: 1000 * 60 * 60 * 24 * 365,
        });
        return { success: true, user, role: user.role, clientId: (user as any).clientId };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    forgotPassword: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const user = await getUserByEmail(input.email);
        if (!user) return { success: true }; // Não revelar se e-mail existe
        const token = crypto.randomUUID().replace(/-/g, "");
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
  taskTemplates: taskTemplatesRouter,
  taskCatalogs: taskCatalogsRouter,
  clientTemplates: clientTemplatesRouter,
  monthlyPanel: monthlyPanelRouter,
  smartUpload: smartUploadRouter,
  clientPortal: clientPortalRouter,
  clientAccess: clientAccessRouter,
});

export type AppRouter = typeof appRouter;
