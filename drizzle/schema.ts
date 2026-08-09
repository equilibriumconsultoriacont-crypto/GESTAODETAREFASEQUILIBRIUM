import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  bigint,
  mediumtext,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).notNull(), // único por (email, role) — não mais globalmente único
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }).default("local").notNull(),
  role: mysqlEnum("role", ["user", "admin", "client"]).default("user").notNull(),
  clientId: int("clientId"), // preenchido quando role = "client"
  // Acesso do cliente criado automaticamente com senha padrão; obriga a definir
  // a própria senha no primeiro login.
  mustChangePassword: boolean("mustChangePassword").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Clients ────────────────────────────────────────────────────────────────
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  cnpj: varchar("cnpj", { length: 18 }).notNull().unique(),
  cpf: varchar("cpf", { length: 14 }),
  documentType: mysqlEnum("documentType", ["CNPJ", "CPF"]).default("CNPJ").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  notes: text("notes"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;



// ─── Task Catalogs (pacotes de tarefas) ──────────────────────────────────────
export const taskCatalogs = mysqlTable("task_catalogs", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(), // ex: "Simples Nacional"
  description: text("description"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TaskCatalog = typeof taskCatalogs.$inferSelect;
export type InsertTaskCatalog = typeof taskCatalogs.$inferInsert;

// ─── Catalog Templates (quais tarefas cada catálogo inclui) ──────────────────
export const catalogTemplates = mysqlTable("catalog_templates", {
  id: int("id").autoincrement().primaryKey(),
  catalogId: int("catalogId").notNull(),
  taskTemplateId: int("taskTemplateId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CatalogTemplate = typeof catalogTemplates.$inferSelect;
export type InsertCatalogTemplate = typeof catalogTemplates.$inferInsert;

// ─── Task Templates (catálogo global de tarefas, sem cliente) ────────────────
export const taskTemplates = mysqlTable("task_templates", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  taskType: mysqlEnum("taskType", ["DAS", "NFS", "DCTF", "SPED", "OUTROS", "PIS", "COFINS", "ICMS", "ISSQN", "PGDAS"]).notNull(),
  dueDayOfMonth: int("dueDayOfMonth").notNull(), // dia do mês que vence
  // Periodicidade da obrigação: MENSAL, TRIMESTRAL ou ANUAL
  periodicity: mysqlEnum("periodicity", ["MENSAL", "TRIMESTRAL", "ANUAL"]).default("MENSAL").notNull(),
  // Defasagem: quantos meses o VENCIMENTO fica à frente da COMPETÊNCIA
  // Ex: DAS=1 (compet. junho, vence julho), Parcelamento=0, EFD Contrib.=2
  competenciaOffset: int("competenciaOffset").default(1).notNull(),
  // Para ANUAL: em qual mês (1-12) a obrigação vence. Ex: DEFIS vence em maio → 5
  annualMonth: int("annualMonth"),
  // Se esta obrigação é enviada ao cliente (guia/documento) ou é só interna
  sendToClient: boolean("sendToClient").default(true).notNull(),
  // Ajuste do vencimento para dia útil: PROXIMO_DIA_UTIL (prorroga, padrão),
  // DIA_UTIL_ANTERIOR (antecipa — PIS/COFINS) ou NENHUM (mantém a data exata)
  dueDateAdjust: mysqlEnum("dueDateAdjust", ["PROXIMO_DIA_UTIL", "DIA_UTIL_ANTERIOR", "NENHUM"]).default("PROXIMO_DIA_UTIL").notNull(),
  ocrKeywords: text("ocrKeywords"), // palavras-chave para reconhecimento de documento
  department: varchar("department", { length: 100 }).default("Geral").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TaskTemplate = typeof taskTemplates.$inferSelect;
export type InsertTaskTemplate = typeof taskTemplates.$inferInsert;

// ─── Client Task Templates (vínculo cliente ↔ template) ─────────────────────
export const clientTaskTemplates = mysqlTable("client_task_templates", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  taskTemplateId: int("taskTemplateId").notNull(),
  catalogId: int("catalogId"), // catálogo de origem (null = adicionado manualmente)
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ClientTaskTemplate = typeof clientTaskTemplates.$inferSelect;
export type InsertClientTaskTemplate = typeof clientTaskTemplates.$inferInsert;

// ─── Recurring Task Templates ────────────────────────────────────────────────
export const recurringTasks = mysqlTable("recurring_tasks", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  taskTemplateId: int("taskTemplateId"), // referência ao template global (opcional)
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  taskType: mysqlEnum("taskType", ["DAS", "NFS", "DCTF", "SPED", "OUTROS", "PIS", "COFINS", "ICMS", "ISSQN", "PGDAS"]).notNull(),
  department: varchar("department", { length: 100 }).default("Geral").notNull(),
  dueDayOfMonth: int("dueDayOfMonth").notNull(), // dia do mês que vence
  periodicity: mysqlEnum("periodicity", ["MENSAL", "TRIMESTRAL", "ANUAL"]).default("MENSAL").notNull(),
  competenciaOffset: int("competenciaOffset").default(1).notNull(),
  annualMonth: int("annualMonth"),
  sendToClient: boolean("sendToClient").default(true).notNull(),
  dueDateAdjust: mysqlEnum("dueDateAdjust", ["PROXIMO_DIA_UTIL", "DIA_UTIL_ANTERIOR", "NENHUM"]).default("PROXIMO_DIA_UTIL").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RecurringTask = typeof recurringTasks.$inferSelect;
export type InsertRecurringTask = typeof recurringTasks.$inferInsert;

// ─── Tasks (instances) ───────────────────────────────────────────────────────
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  recurringTaskId: int("recurringTaskId"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  taskType: mysqlEnum("taskType", ["DAS", "NFS", "DCTF", "SPED", "OUTROS", "PIS", "COFINS", "ICMS", "ISSQN", "PGDAS"]).notNull(),
  competencia: varchar("competencia", { length: 7 }).notNull(), // MM/YYYY
  dueDate: timestamp("dueDate").notNull(),
  status: mysqlEnum("status", [
    "PENDENTE",
    "EM_ANDAMENTO",
    "AGUARDANDO_CLIENTE",
    "EM_REVISAO",
    "CONCLUIDA",
    "CANCELADA",
    "VENCIDA",
  ]).default("PENDENTE").notNull(),
  priority: mysqlEnum("priority", ["BAIXA", "NORMAL", "ALTA", "URGENTE"]).default("NORMAL").notNull(),
  department: varchar("department", { length: 100 }).default("Geral").notNull(),
  sendToClient: boolean("sendToClient").default(true).notNull(),
  valor: varchar("valor", { length: 20 }), // valor principal da guia (OCR ou manual), ex "1234.56"
  clientPaid: boolean("clientPaid").default(false), // marca pessoal do cliente ("já paguei"), só informativo
  movimentaFinanceiro: boolean("movimentaFinanceiro").default(false), // gera conta a receber no Financeiro?
  finValor: varchar("finValor", { length: 20 }), // valor do serviço a cobrar (honorário avulso), separado da guia
  finVencimento: timestamp("finVencimento"), // vencimento da cobrança gerada (opcional; senão usa dueDate)
  assignedTo: int("assignedTo"), // FK users.id
  internalDeadline: timestamp("internalDeadline"), // prazo interno (antes do vencimento fiscal)
  waitingSince: timestamp("waitingSince"), // quando entrou em AGUARDANDO_CLIENTE
  startedAt: timestamp("startedAt"), // quando iniciou EM_ANDAMENTO
  notes: text("notes"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// ─── Task Files ──────────────────────────────────────────────────────────────
export const taskFiles = mysqlTable("task_files", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  clientId: int("clientId").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: bigint("fileSize", { mode: "number" }),
  uploadedBy: int("uploadedBy"),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});

export type TaskFile = typeof taskFiles.$inferSelect;
export type InsertTaskFile = typeof taskFiles.$inferInsert;


// ─── Activity Logs (auditoria completa) ──────────────────────────────────────
export const activityLogs = mysqlTable("activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  entityType: varchar("entityType", { length: 50 }).notNull(), // task, client, email_log
  entityId: int("entityId").notNull(),
  action: varchar("action", { length: 100 }).notNull(), // status_changed, file_uploaded, email_sent
  before: text("before"), // JSON snapshot antes
  after: text("after"),   // JSON snapshot depois
  userId: int("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;

// ─── Email Logs ──────────────────────────────────────────────────────────────
export const emailLogs = mysqlTable("email_logs", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  clientId: int("clientId").notNull(),
  taskFileId: int("taskFileId"),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  body: text("body"),
  status: mysqlEnum("status", ["ENVIADO", "FALHOU"]).default("ENVIADO").notNull(),
  errorMessage: text("errorMessage"),
  sentBy: int("sentBy"),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
});

export type EmailLog = typeof emailLogs.$inferSelect;

// ─── Faturamento do cliente (por mês) ─────────────────────────────────────────
export const clientRevenue = mysqlTable("client_revenue", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  year: int("year").notNull(),
  month: int("month").notNull(),
  valor: varchar("valor", { length: 20 }).notNull(), // faturamento, ex "12345.67"
  imposto: varchar("imposto", { length: 20 }), // imposto declarado no PGDAS
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ClientRevenue = typeof clientRevenue.$inferSelect;

// ─── Acesso de um usuário (e-mail) a várias empresas (many-to-many) ───────────
export const clientUserAccess = mysqlTable("client_user_access", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  clientId: int("clientId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ClientUserAccess = typeof clientUserAccess.$inferSelect;
export type InsertEmailLog = typeof emailLogs.$inferInsert;

// ─── Departamentos (gerenciáveis) ────────────────────────────────────────────
export const departments = mysqlTable("departments", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  color: varchar("color", { length: 20 }).default("#a1a1aa").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Department = typeof departments.$inferSelect;
export type InsertDepartment = typeof departments.$inferInsert;

// ─── Vínculo Usuário ↔ Departamentos (N:N) ───────────────────────────────────
export const userDepartments = mysqlTable("user_departments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  departmentId: int("departmentId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserDepartment = typeof userDepartments.$inferSelect;
export type InsertUserDepartment = typeof userDepartments.$inferInsert;

// ─── Vínculo Usuário ↔ Empresas/Clientes (N:N) ───────────────────────────────
// Define de quais empresas o usuário é responsável
export const userClients = mysqlTable("user_clients", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  clientId: int("clientId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserClient = typeof userClients.$inferSelect;
export type InsertUserClient = typeof userClients.$inferInsert;

// ─── Calendário: Eventos/Compromissos ────────────────────────────────────────
export const calendarEvents = mysqlTable("calendar_events", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(), // usuário que criou o evento
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  location: varchar("location", { length: 255 }),
  startAt: timestamp("startAt").notNull(),
  endAt: timestamp("endAt").notNull(),
  allDay: boolean("allDay").default(false).notNull(),
  color: varchar("color", { length: 20 }).default("#24646c").notNull(),
  // Gancho para Google Calendar (preenchido quando/se integrar)
  googleEventId: varchar("googleEventId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = typeof calendarEvents.$inferInsert;

// ─── Calendário: Convidados de um evento ─────────────────────────────────────
export const calendarEventGuests = mysqlTable("calendar_event_guests", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("eventId").notNull(),
  userId: int("userId").notNull(), // usuário convidado
  status: mysqlEnum("status", ["PENDENTE", "ACEITO", "RECUSADO"]).default("PENDENTE").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CalendarEventGuest = typeof calendarEventGuests.$inferSelect;
export type InsertCalendarEventGuest = typeof calendarEventGuests.$inferInsert;

// ─── Integração Google Calendar (tokens OAuth por usuário) ───────────────────
// Preparado para quando a integração for ativada. Guarda os tokens do usuário.
export const googleCalendarTokens = mysqlTable("google_calendar_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  expiryDate: timestamp("expiryDate"),
  connected: boolean("connected").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GoogleCalendarToken = typeof googleCalendarTokens.$inferSelect;
export type InsertGoogleCalendarToken = typeof googleCalendarTokens.$inferInsert;

// ─── Plataforma: Vínculo Usuário ↔ Módulos + nível no módulo (N:N) ───────────
// Camada 1 (acesso ao módulo) + Camada 2 (nível/papel dentro do módulo).
// module: qual módulo da plataforma (tarefas, propostas, whatsapp)
// level: o papel do usuário DENTRO daquele módulo
//   - tarefas: "admin" | "colaborador"
//   - propostas: "admin" | "editor" | "leitor"
//   - whatsapp: "admin" | "atendente" (preparado para o futuro)
export const userModules = mysqlTable("user_modules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  module: varchar("module", { length: 40 }).notNull(),
  level: varchar("level", { length: 40 }).default("colaborador").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserModule = typeof userModules.$inferSelect;
export type InsertUserModule = typeof userModules.$inferInsert;

// ─── Módulo Propostas: propostas salvas ──────────────────────────────────────
export const proposals = mysqlTable("proposals", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(), // usuário que criou
  title: varchar("title", { length: 255 }).notNull(),
  clientName: varchar("clientName", { length: 255 }),
  // Documento completo da proposta (JSON com todos os campos do gerador)
  data: text("data").notNull(),
  status: mysqlEnum("status", ["RASCUNHO", "ENVIADA", "ACEITA", "RECUSADA"]).default("RASCUNHO").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Proposal = typeof proposals.$inferSelect;
export type InsertProposal = typeof proposals.$inferInsert;

// ─── WhatsApp: Atendimento ────────────────────────────────────────────────────
export const waContacts = mysqlTable("wa_contacts", {
  id: int("id").autoincrement().primaryKey(),
  waNumber: varchar("waNumber", { length: 32 }).notNull().unique(),
  jid: varchar("jid", { length: 128 }),
  lid: varchar("lid", { length: 128 }), // identificador interno do WhatsApp (para casar mensagens que chegam por LID)
  clientId: int("clientId"), // vinculo com o cadastro de clientes (tarefas)
  name: varchar("name", { length: 255 }),
  avatarUrl: mediumtext("avatarUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type WaContact = typeof waContacts.$inferSelect;

export const waConversations = mysqlTable("wa_conversations", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull(),
  // fila (sem dono) → active (em atendimento) → concluded/dismissed
  // (os valores legados open/pending/closed foram removidos; a migração em
  // ensureSchema normaliza qualquer conversa antiga antes de estreitar o enum)
  status: mysqlEnum("status", ["queue", "active", "concluded", "dismissed"]).default("queue").notNull(),
  assignedAgentId: int("assignedAgentId"), // users.id — quem está atendendo
  unreadCount: int("unreadCount").default(0).notNull(),
  lastMessageAt: timestamp("lastMessageAt").defaultNow().notNull(),
  concludedAt: timestamp("concludedAt"),
  queuedAt: timestamp("queuedAt"),
  assignedAt: timestamp("assignedAt"),
  lastAutoReplyAt: timestamp("lastAutoReplyAt"), // último aviso automático de "fora do expediente"
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type WaConversation = typeof waConversations.$inferSelect;

export const waMessages = mysqlTable("wa_messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  senderType: mysqlEnum("senderType", ["contact", "agent", "system"]).notNull(),
  fromMe: boolean("fromMe").default(false).notNull(),
  content: text("content"),
  messageType: mysqlEnum("messageType", ["text", "image", "audio", "video", "document", "sticker", "location", "template", "other"]).default("text").notNull(),
  mediaUrl: mediumtext("mediaUrl"),
  replyTo: text("replyTo"), // trecho da mensagem citada
  waMessageId: varchar("waMessageId", { length: 128 }),
  status: mysqlEnum("status", ["received", "sent", "delivered", "read", "failed"]).default("sent").notNull(),
  agentId: int("agentId"), // users.id quando senderType = agent
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type WaMessage = typeof waMessages.$inferSelect;

export const waTags = mysqlTable("wa_tags", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  color: varchar("color", { length: 20 }).default("#3E9AA6").notNull(),
});

export const waConversationTags = mysqlTable("wa_conversation_tags", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  tagId: int("tagId").notNull(),
});

// Persiste as chaves de autenticação do Baileys no banco (o filesystem do Render é
// efêmero — sem isso, o QR precisaria ser lido de novo a cada reinício).
export const waSessions = mysqlTable("wa_sessions", {
  id: int("id").autoincrement().primaryKey(),
  sessionName: varchar("sessionName", { length: 64 }).notNull(),
  keyId: varchar("keyId", { length: 255 }).notNull(),
  keyData: mediumtext("keyData"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const waConfig = mysqlTable("wa_config", {
  k: varchar("k", { length: 64 }).notNull().primaryKey(),
  v: text("v"),
});

export const waPushSubs = mysqlTable("wa_push_subs", {
  id: int("id").autoincrement().primaryKey(),
  endpoint: varchar("endpoint", { length: 512 }).notNull().unique(),
  p256dh: varchar("p256dh", { length: 255 }),
  auth: varchar("auth", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Mensagens digitadas agora para serem enviadas em uma data/hora futura
export const waScheduledMessages = mysqlTable("wa_scheduled_messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  agentId: int("agentId").notNull(),
  content: text("content").notNull(),
  sendAt: timestamp("sendAt").notNull(),
  status: mysqlEnum("status", ["pending", "sent", "failed", "cancelled"]).default("pending").notNull(),
  errorMsg: text("errorMsg"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO FINANCEIRO (contas a receber / honorários) — inspirado no Contas a Receber
// e na Régua de Cobrança do OMIE.
// ══════════════════════════════════════════════════════════════════════════════

// Configuração financeira por cliente: se tem honorário mensal, valor, quando vence e
// quando a cobrança é enviada. Alimentado pelos clientes do módulo de Tarefas.
export const financialClientConfig = mysqlTable("fin_client_config", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull().unique(),
  hasHonorario: boolean("hasHonorario").default(false).notNull(),
  honorarioValue: varchar("honorarioValue", { length: 20 }), // ex "350.00"
  dueDay: int("dueDay"), // dia do mês em que o honorário vence (1-28)
  sendDay: int("sendDay"), // dia do mês em que a cobrança é enviada por e-mail
  // Regra quando o vencimento cai em fim de semana/feriado (inspirado no OMIE):
  weekendRule: mysqlEnum("weekendRule", ["mantem", "antecipa", "posterga"]).default("mantem").notNull(),
  billingEmail: varchar("billingEmail", { length: 320 }), // opcional; vazio = usa o e-mail do cadastro
  recurring: boolean("recurring").default(true).notNull(), // recorrente (todo mês) ou mês único
  activated: boolean("activated").default(false).notNull(), // "play" dado — gera cobrança
  lastGenComp: varchar("lastGenComp", { length: 7 }), // última competência (MM/AAAA) já gerada
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type FinancialClientConfig = typeof financialClientConfig.$inferSelect;

// Título = uma conta a receber (honorário mensal ou serviço eventual como abertura/encerramento).
export const financialTitulos = mysqlTable("fin_titulos", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  kind: mysqlEnum("kind", ["honorario", "eventual"]).default("eventual").notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  category: varchar("category", { length: 80 }), // classificação p/ relatórios (Honorário, Abertura, etc.)
  amount: varchar("amount", { length: 20 }).notNull(), // ex "350.00"
  competencia: varchar("competencia", { length: 7 }), // MM/AAAA (para honorários)
  dueDate: timestamp("dueDate").notNull(), // vencimento
  sendDate: timestamp("sendDate"), // dia de enviar a cobrança por e-mail
  status: mysqlEnum("status", [
    "rascunho",   // criado (ex.: por tarefa avulsa) mas ainda a configurar
    "aberto",     // pronto, aguardando o dia de envio
    "enviado",    // cobrança enviada por e-mail, aguardando pagamento
    "em_conferencia", // cliente subiu comprovante, aguardando o escritório validar
    "pago",       // baixa confirmada
    "vencido",    // passou do vencimento sem pagamento
    "cancelado",
  ]).default("aberto").notNull(),
  origin: mysqlEnum("origin", ["manual", "recorrencia", "tarefa"]).default("manual").notNull(),
  recurringConfigId: int("recurringConfigId"), // se veio da recorrência do honorário (fin_client_config.id)
  taskId: int("taskId"), // se veio de "Movimenta financeiro" de uma tarefa
  sentAt: timestamp("sentAt"), // quando o e-mail de cobrança foi enviado
  reminderSentAt: timestamp("reminderSentAt"), // quando o lembrete pós-vencimento foi enviado
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type FinancialTitulo = typeof financialTitulos.$inferSelect;

// Comprovante de pagamento enviado pelo cliente (fica "aguardando conferência" até o escritório validar).
export const financialPayments = mysqlTable("fin_payments", {
  id: int("id").autoincrement().primaryKey(),
  tituloId: int("tituloId").notNull(),
  comprovanteUrl: mediumtext("comprovanteUrl"), // arquivo do comprovante (data URL) — opcional na baixa manual
  amount: varchar("amount", { length: 20 }), // valor informado
  paidDate: timestamp("paidDate"), // data do pagamento (do comprovante)
  method: varchar("method", { length: 30 }), // pix / boleto / manual
  status: mysqlEnum("status", ["aguardando_conferencia", "confirmado", "rejeitado"]).default("aguardando_conferencia").notNull(),
  submittedByClient: boolean("submittedByClient").default(false).notNull(), // veio do portal do cliente?
  confirmedBy: int("confirmedBy"), // usuário do escritório que confirmou/rejeitou
  confirmedAt: timestamp("confirmedAt"),
  note: varchar("note", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type FinancialPayment = typeof financialPayments.$inferSelect;

// Configuração global de recebimento (chave PIX / QR). Fica pronto e vazio até ter a conta PJ.
export const financialConfig = mysqlTable("fin_config", {
  id: int("id").autoincrement().primaryKey(),
  pixKey: varchar("pixKey", { length: 200 }),
  pixKeyType: varchar("pixKeyType", { length: 20 }), // cnpj / email / telefone / aleatoria
  beneficiaryName: varchar("beneficiaryName", { length: 200 }),
  beneficiaryDoc: varchar("beneficiaryDoc", { length: 20 }), // CNPJ
  pixQrImage: mediumtext("pixQrImage"), // imagem do QR (data URL) que você vai me enviar
  instructions: text("instructions"), // instruções extras no e-mail de cobrança
  active: boolean("active").default(false).notNull(), // liga quando a conta PJ estiver pronta
  autoCobranca: boolean("autoCobranca").default(false).notNull(), // régua automática (envio + lembrete) ligada?
  lembreteDias: int("lembreteDias").default(2).notNull(), // dias após o vencimento para o lembrete
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type FinancialConfig = typeof financialConfig.$inferSelect;

// Contas a PAGAR (despesas/fornecedores do escritório) — para ter noção do que entra e do que sai.
export const financialPayables = mysqlTable("fin_payables", {
  id: int("id").autoincrement().primaryKey(),
  description: varchar("description", { length: 255 }).notNull(),
  supplier: varchar("supplier", { length: 200 }), // fornecedor/credor
  category: varchar("category", { length: 80 }), // ex: Aluguel, Salários, Impostos, Software
  amount: varchar("amount", { length: 20 }).notNull(),
  dueDate: timestamp("dueDate").notNull(),
  status: mysqlEnum("status", ["aberto", "pago", "vencido", "cancelado"]).default("aberto").notNull(),
  recurring: boolean("recurring").default(false).notNull(), // despesa fixa mensal?
  paidDate: timestamp("paidDate"),
  paidBy: int("paidBy"),
  note: varchar("note", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type FinancialPayable = typeof financialPayables.$inferSelect;
