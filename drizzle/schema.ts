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
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
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
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  notes: text("notes"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

// ─── Recurring Task Templates ────────────────────────────────────────────────
export const recurringTasks = mysqlTable("recurring_tasks", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  taskType: mysqlEnum("taskType", ["DAS", "NFS", "DCTF", "SPED", "OUTROS"]).notNull(),
  dueDayOfMonth: int("dueDayOfMonth").notNull(), // dia do mês que vence
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
  status: mysqlEnum("status", ["PENDENTE", "EM_ANDAMENTO", "CONCLUIDA", "VENCIDA"])
    .default("PENDENTE")
    .notNull(),
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
  fileUrl: varchar("fileUrl", { length: 1024 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: bigint("fileSize", { mode: "number" }),
  uploadedBy: int("uploadedBy"),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});

export type TaskFile = typeof taskFiles.$inferSelect;
export type InsertTaskFile = typeof taskFiles.$inferInsert;

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
