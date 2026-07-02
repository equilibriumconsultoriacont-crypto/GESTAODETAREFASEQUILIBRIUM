import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  bigint,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }).default("local").notNull(),
  role: mysqlEnum("role", ["user", "admin", "client"]).default("user").notNull(),
  clientId: int("clientId"), // preenchido quando role = "client"
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
  taskType: mysqlEnum("taskType", ["DAS", "NFS", "DCTF", "SPED", "OUTROS"]).notNull(),
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
  taskType: mysqlEnum("taskType", ["DAS", "NFS", "DCTF", "SPED", "OUTROS"]).notNull(),
  department: varchar("department", { length: 100 }).default("Geral").notNull(),
  dueDayOfMonth: int("dueDayOfMonth").notNull(), // dia do mês que vence
  periodicity: mysqlEnum("periodicity", ["MENSAL", "TRIMESTRAL", "ANUAL"]).default("MENSAL").notNull(),
  competenciaOffset: int("competenciaOffset").default(1).notNull(),
  annualMonth: int("annualMonth"),
  sendToClient: boolean("sendToClient").default(true).notNull(),
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
  taskType: mysqlEnum("taskType", ["DAS", "NFS", "DCTF", "SPED", "OUTROS"]).notNull(),
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
