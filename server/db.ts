import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  Client,
  ClientTaskTemplate,
  EmailLog,
  InsertClient,
  InsertClientTaskTemplate,
  InsertEmailLog,
  InsertRecurringTask,
  InsertTask,
  InsertTaskFile,
  InsertTaskTemplate,
  InsertUser,
  RecurringTask,
  Task,
  TaskFile,
  TaskTemplate,
  clientTaskTemplates,
  clients,
  emailLogs,
  recurringTasks,
  taskFiles,
  taskTemplates,
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
  if (!user.email) throw new Error("User email is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { email: user.email };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value || undefined;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  
  if (user.openId !== undefined) {
    values.openId = user.openId || undefined;
    updateSet.openId = user.openId || undefined;
  }
  
  if (user.passwordHash !== undefined) {
    values.passwordHash = user.passwordHash || undefined;
    updateSet.passwordHash = user.passwordHash || undefined;
  }
  
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  }

  if (!values.lastSignedIn) {
    values.lastSignedIn = new Date();
  }

  if (Object.keys(updateSet).length === 0) {
    updateSet.lastSignedIn = new Date();
  }

  await db.insert(users).values(values).onDuplicateKeyUpdate({
    set: updateSet,
  });
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
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
  if (!db) throw new Error("Database not available");
  const result = await db.insert(clients).values(data);
  return result[0].insertId;
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
    return db.select().from(recurringTasks).where(eq(recurringTasks.clientId, clientId));
  }
  return db.select().from(recurringTasks);
}

export async function createRecurringTask(data: InsertRecurringTask): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(recurringTasks).values(data);
  return result[0].insertId;
}

export async function updateRecurringTask(id: number, data: Partial<InsertRecurringTask>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(recurringTasks).set(data).where(eq(recurringTasks.id, id));
}

// ─── Tasks ───────────────────────────────────────────────────────────────────
export async function listTasks(filters?: {
  clientId?: number;
  status?: string;
  competencia?: string;
}): Promise<Task[]> {
  const db = await getDb();
  if (!db) return [];
  const allTasks = await db.select().from(tasks);
  let filtered = allTasks;
  if (filters?.clientId) filtered = filtered.filter((t) => t.clientId === filters.clientId);
  if (filters?.status) filtered = filtered.filter((t) => t.status === filters.status);
  if (filters?.competencia) filtered = filtered.filter((t) => t.competencia === filters.competencia);
  return filtered.sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());
}

export async function getTaskById(id: number): Promise<Task | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return result[0];
}

export async function createTask(data: InsertTask): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(tasks).values(data);
  return result[0].insertId;
}

export async function updateTask(id: number, data: Partial<InsertTask>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(tasks).set(data).where(eq(tasks.id, id));
}

export async function markOverdueTasks(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const now = new Date();
  const result = await db
    .update(tasks)
    .set({ status: "VENCIDA" })
    .where(eq(tasks.status, "PENDENTE"));
  return result[0].affectedRows ?? 0;
}

export async function getTasksDueSoon(days: number = 3): Promise<Task[]> {
  const db = await getDb();
  if (!db) return [];
  const allTasks = await db.select().from(tasks).where(eq(tasks.status, "PENDENTE"));
  const now = new Date();
  const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return allTasks
    .filter((t) => t.dueDate <= threshold && t.dueDate >= now)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

export async function taskExistsByRecurringAndCompetencia(
  recurringTaskId: number,
  competencia: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db
    .select()
    .from(tasks)
    .where(eq(tasks.recurringTaskId, recurringTaskId) && eq(tasks.competencia, competencia))
    .limit(1);
  return result.length > 0;
}

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return { pendentes: 0, emAndamento: 0, concluidas: 0, vencidas: 0 };
  const allTasks = await db.select().from(tasks);
  return {
    pendentes: allTasks.filter((t) => t.status === "PENDENTE").length,
    emAndamento: allTasks.filter((t) => t.status === "EM_ANDAMENTO").length,
    concluidas: allTasks.filter((t) => t.status === "CONCLUIDA").length,
    vencidas: allTasks.filter((t) => t.status === "VENCIDA").length,
  };
}

// ─── Task Files ──────────────────────────────────────────────────────────────
export async function listTaskFiles(taskId: number): Promise<TaskFile[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(taskFiles).where(eq(taskFiles.taskId, taskId));
}

export async function getTaskFileById(id: number): Promise<TaskFile | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(taskFiles).where(eq(taskFiles.id, id)).limit(1);
  return result[0];
}

export async function createTaskFile(data: InsertTaskFile): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(taskFiles).values(data);
  return result[0].insertId;
}

// ─── Email Logs ──────────────────────────────────────────────────────────────
export async function listEmailLogs(taskId?: number, clientId?: number): Promise<EmailLog[]> {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(emailLogs);
  if (taskId) query = query.where(eq(emailLogs.taskId, taskId)) as any;
  if (clientId) query = query.where(eq(emailLogs.clientId, clientId)) as any;
  return query.orderBy(desc(emailLogs.sentAt));
}

export async function createEmailLog(data: InsertEmailLog): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(emailLogs).values(data);
  return result[0].insertId;
}

// ─── Task Templates ───────────────────────────────────────────────────────────
export async function listTaskTemplates(activeOnly = true): Promise<TaskTemplate[]> {
  const db = await getDb();
  if (!db) return [];
  if (activeOnly) return db.select().from(taskTemplates).where(eq(taskTemplates.active, true)).orderBy(taskTemplates.title);
  return db.select().from(taskTemplates).orderBy(taskTemplates.title);
}

export async function getTaskTemplateById(id: number): Promise<TaskTemplate | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(taskTemplates).where(eq(taskTemplates.id, id)).limit(1);
  return result[0];
}

export async function createTaskTemplate(data: InsertTaskTemplate): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(taskTemplates).values(data);
  return result[0].insertId;
}

export async function updateTaskTemplate(id: number, data: Partial<InsertTaskTemplate>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(taskTemplates).set(data).where(eq(taskTemplates.id, id));
}

// ─── Client Task Templates ────────────────────────────────────────────────────
export async function listClientTaskTemplates(clientId: number): Promise<ClientTaskTemplate[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clientTaskTemplates).where(eq(clientTaskTemplates.clientId, clientId));
}

export async function addClientTaskTemplate(data: InsertClientTaskTemplate): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(clientTaskTemplates).values(data);
  return result[0].insertId;
}

export async function removeClientTaskTemplate(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(clientTaskTemplates).set({ active: false }).where(eq(clientTaskTemplates.id, id));
}

export async function getMonthlyPanel(month: number, year: number): Promise<{
  clientId: number;
  clientName: string;
  tasks: { taskId: number; title: string; taskType: string; status: string; dueDate: Date; competencia: string }[];
}[]> {
  const db = await getDb();
  if (!db) return [];
  const competencia = `${String(month).padStart(2, "0")}/${year}`;
  const allClients = await listClients(false);
  const allTasks = await db.select().from(tasks).where(eq(tasks.competencia, competencia));

  return allClients.map((client) => ({
    clientId: client.id,
    clientName: client.name,
    tasks: allTasks
      .filter((t) => t.clientId === client.id)
      .map((t) => ({
        taskId: t.id,
        title: t.title,
        taskType: t.taskType,
        status: t.status,
        dueDate: t.dueDate,
        competencia: t.competencia,
      })),
  })).filter((c) => c.tasks.length > 0);
}
