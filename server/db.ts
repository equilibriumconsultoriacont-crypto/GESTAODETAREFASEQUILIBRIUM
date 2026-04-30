import { and, desc, eq, gte, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  Client,
  EmailLog,
  InsertClient,
  InsertEmailLog,
  InsertRecurringTask,
  InsertTask,
  InsertTaskFile,
  InsertUser,
  RecurringTask,
  Task,
  TaskFile,
  clients,
  emailLogs,
  recurringTasks,
  taskFiles,
  tasks,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Clients ─────────────────────────────────────────────────────────────────
export async function listClients(includeInactive = false): Promise<Client[]> {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(clients).orderBy(desc(clients.createdAt));
  if (!includeInactive) {
    return db.select().from(clients).where(eq(clients.active, true)).orderBy(clients.name);
  }
  return db.select().from(clients).orderBy(clients.name);
}

export async function getClientById(id: number): Promise<Client | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result[0];
}

export async function createClient(data: InsertClient): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(clients).values(data);
  return (result[0] as { insertId: number }).insertId;
}

export async function updateClient(id: number, data: Partial<InsertClient>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(clients).set(data).where(eq(clients.id, id));
}

// ─── Recurring Tasks ─────────────────────────────────────────────────────────
export async function listRecurringTasks(clientId?: number): Promise<RecurringTask[]> {
  const db = await getDb();
  if (!db) return [];
  if (clientId) {
    return db.select().from(recurringTasks).where(eq(recurringTasks.clientId, clientId)).orderBy(recurringTasks.title);
  }
  return db.select().from(recurringTasks).orderBy(recurringTasks.clientId);
}

export async function createRecurringTask(data: InsertRecurringTask): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(recurringTasks).values(data);
  return (result[0] as { insertId: number }).insertId;
}

export async function updateRecurringTask(id: number, data: Partial<InsertRecurringTask>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(recurringTasks).set(data).where(eq(recurringTasks.id, id));
}

// ─── Tasks ───────────────────────────────────────────────────────────────────
export async function listTasks(filters?: {
  clientId?: number;
  status?: Task["status"];
  competencia?: string;
}): Promise<Task[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.clientId) conditions.push(eq(tasks.clientId, filters.clientId));
  if (filters?.status) conditions.push(eq(tasks.status, filters.status));
  if (filters?.competencia) conditions.push(eq(tasks.competencia, filters.competencia));
  if (conditions.length > 0) {
    return db.select().from(tasks).where(and(...conditions)).orderBy(desc(tasks.dueDate));
  }
  return db.select().from(tasks).orderBy(desc(tasks.dueDate));
}

export async function getTaskById(id: number): Promise<Task | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return result[0];
}

export async function createTask(data: InsertTask): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(tasks).values(data);
  return (result[0] as { insertId: number }).insertId;
}

export async function updateTask(id: number, data: Partial<InsertTask>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(tasks).set(data).where(eq(tasks.id, id));
}

export async function taskExistsByRecurringAndCompetencia(
  recurringTaskId: number,
  competencia: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.recurringTaskId, recurringTaskId), eq(tasks.competencia, competencia)))
    .limit(1);
  return result.length > 0;
}

export async function markOverdueTasks(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const now = new Date();
  const result = await db
    .update(tasks)
    .set({ status: "VENCIDA" })
    .where(
      and(
        lte(tasks.dueDate, now),
        or(eq(tasks.status, "PENDENTE"), eq(tasks.status, "EM_ANDAMENTO"))
      )
    );
  return (result[0] as { affectedRows: number }).affectedRows ?? 0;
}

export async function getTasksDueSoon(daysAhead: number): Promise<Task[]> {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  return db
    .select()
    .from(tasks)
    .where(
      and(
        gte(tasks.dueDate, now),
        lte(tasks.dueDate, future),
        or(eq(tasks.status, "PENDENTE"), eq(tasks.status, "EM_ANDAMENTO"))
      )
    )
    .orderBy(tasks.dueDate);
}

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return { pendente: 0, em_andamento: 0, concluida: 0, vencida: 0, total: 0 };
  const rows = await db
    .select({ status: tasks.status, count: sql<number>`count(*)` })
    .from(tasks)
    .groupBy(tasks.status);
  const stats = { pendente: 0, em_andamento: 0, concluida: 0, vencida: 0, total: 0 };
  for (const row of rows) {
    const count = Number(row.count);
    stats.total += count;
    if (row.status === "PENDENTE") stats.pendente = count;
    if (row.status === "EM_ANDAMENTO") stats.em_andamento = count;
    if (row.status === "CONCLUIDA") stats.concluida = count;
    if (row.status === "VENCIDA") stats.vencida = count;
  }
  return stats;
}

// ─── Task Files ───────────────────────────────────────────────────────────────
export async function listTaskFiles(taskId: number): Promise<TaskFile[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(taskFiles).where(eq(taskFiles.taskId, taskId)).orderBy(desc(taskFiles.uploadedAt));
}

export async function createTaskFile(data: InsertTaskFile): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(taskFiles).values(data);
  return (result[0] as { insertId: number }).insertId;
}

export async function getTaskFileById(id: number): Promise<TaskFile | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(taskFiles).where(eq(taskFiles.id, id)).limit(1);
  return result[0];
}

// ─── Email Logs ───────────────────────────────────────────────────────────────
export async function listEmailLogs(taskId?: number, clientId?: number): Promise<EmailLog[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (taskId) conditions.push(eq(emailLogs.taskId, taskId));
  if (clientId) conditions.push(eq(emailLogs.clientId, clientId));
  if (conditions.length > 0) {
    return db.select().from(emailLogs).where(and(...conditions)).orderBy(desc(emailLogs.sentAt));
  }
  return db.select().from(emailLogs).orderBy(desc(emailLogs.sentAt));
}

export async function createEmailLog(data: InsertEmailLog): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(emailLogs).values(data);
  return (result[0] as { insertId: number }).insertId;
}
