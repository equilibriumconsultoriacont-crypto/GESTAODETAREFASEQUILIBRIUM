import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  ActivityLog,
  CatalogTemplate,
  Client,
  ClientTaskTemplate,
  EmailLog,
  InsertActivityLog,
  InsertCatalogTemplate,
  InsertClient,
  InsertClientTaskTemplate,
  InsertEmailLog,
  InsertRecurringTask,
  InsertTask,
  InsertTaskCatalog,
  InsertTaskFile,
  InsertTaskTemplate,
  InsertUser,
  RecurringTask,
  Task,
  TaskCatalog,
  TaskFile,
  TaskTemplate,
  ActivityLog,
  InsertActivityLog,
  activityLogs,
  catalogTemplates,
  clientTaskTemplates,
  clients,
  emailLogs,
  recurringTasks,
  taskCatalogs,
  taskFiles,
  taskTemplates,
  tasks,
  users,
} from "../drizzle/schema";

// ─── Connection Pool (Railway-safe) ──────────────────────────────────────────
let _pool: mysql.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function getPool(): mysql.Pool {
  if (!_pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL not set");

    _pool = mysql.createPool({
      uri: url,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      connectTimeout: 10000,
    });

    _pool.on("error" as any, (err: Error) => {
      console.error("[DB] Pool error:", err.message);
      _pool = null;
      _db = null;
    });
  }
  return _pool;
}

export async function getDb() {
  if (!_db) {
    try {
      const pool = getPool();
      _db = drizzle(pool);
    } catch (error) {
      console.error("[DB] Failed to initialize:", error);
      return null;
    }
  }
  return _db;
}

export async function checkDbHealth(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  const start = Date.now();
  try {
    const pool = getPool();
    const conn = await pool.getConnection();
    await conn.query("SELECT 1");
    conn.release();
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err: any) {
    return { ok: false, error: err?.message };
  }
}

// ─── Users ───────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const values: Partial<typeof user> = {
    email: user.email,
    loginMethod: user.loginMethod || "local",
  };
  const updateSet: Partial<typeof user> = {};

  if (user.name !== undefined) { values.name = user.name; updateSet.name = user.name; }
  if (user.openId !== undefined) { values.openId = user.openId; updateSet.openId = user.openId; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  if (user.clientId !== undefined) { values.clientId = user.clientId; updateSet.clientId = user.clientId; }
  if (user.passwordHash) {
    values.passwordHash = user.passwordHash;
    updateSet.passwordHash = user.passwordHash;
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values as any).onDuplicateKeyUpdate({ set: updateSet as any });
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] ?? undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const normalized = email.trim().toLowerCase();
  const result = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  return result[0] ?? undefined;
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0] ?? undefined;
}

// ─── Clients ──────────────────────────────────────────────────────────────────
export async function createClient(data: InsertClient): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const normalized = { ...data, email: data.email.trim().toLowerCase() };
  const result = await db.insert(clients).values(normalized);
  return result[0].insertId;
}

export async function listClients(includeInactive = false): Promise<Client[]> {
  const db = await getDb();
  if (!db) return [];
  if (includeInactive) return db.select().from(clients).orderBy(clients.name);
  return db.select().from(clients).where(eq(clients.active, true)).orderBy(clients.name);
}

export async function getClientById(id: number): Promise<Client | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result[0];
}

export async function updateClient(id: number, data: Partial<InsertClient>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const normalized = data.email ? { ...data, email: data.email.trim().toLowerCase() } : data;
  await db.update(clients).set(normalized).where(eq(clients.id, id));
}

// ─── Recurring Tasks ──────────────────────────────────────────────────────────
export async function listRecurringTasks(clientId?: number): Promise<RecurringTask[]> {
  const db = await getDb();
  if (!db) return [];
  if (clientId !== undefined) {
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

// ─── Tasks ────────────────────────────────────────────────────────────────────
export async function listTasks(filters?: {
  clientId?: number;
  status?: string;
  taskType?: string;
  competencia?: string;
}): Promise<Task[]> {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(tasks);
  const conditions: any[] = [];
  if (filters?.clientId !== undefined) conditions.push(eq(tasks.clientId, filters.clientId));
  if (filters?.status) conditions.push(eq(tasks.status, filters.status as any));
  if (filters?.taskType) conditions.push(eq(tasks.taskType, filters.taskType as any));
  if (filters?.competencia) conditions.push(eq(tasks.competencia, filters.competencia));
  if (conditions.length > 0) {
    return (query as any).where(conditions.length === 1 ? conditions[0] : and(...conditions)).orderBy(desc(tasks.dueDate));
  }
  return (query as any).orderBy(desc(tasks.dueDate));
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

export async function taskExistsByRecurringAndCompetencia(
  recurringTaskId: number,
  competencia: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select().from(tasks).where(
    and(eq(tasks.recurringTaskId, recurringTaskId), eq(tasks.competencia, competencia))
  ).limit(1);
  return result.length > 0;
}

export async function getTasksDueSoon(daysAhead = 7): Promise<Task[]> {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysAhead);
  return db.select().from(tasks).where(
    and(eq(tasks.status, "PENDENTE"), sql`${tasks.dueDate} <= ${cutoff}`)
  );
}

export async function markOverdueTasks(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const now = new Date();
  const result = await db.update(tasks).set({ status: "VENCIDA" }).where(
    and(eq(tasks.status, "PENDENTE"), sql`${tasks.dueDate} < ${now}`)
  );
  return (result[0] as any).affectedRows ?? 0;
}

// ─── Task Files ───────────────────────────────────────────────────────────────
export async function createTaskFile(data: InsertTaskFile): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Sanitize filename
  const safe = { ...data, filename: data.filename.replace(/[^a-zA-Z0-9._\-]/g, "_").slice(0, 255) };
  const result = await db.insert(taskFiles).values(safe);
  return result[0].insertId;
}

export async function listTaskFiles(taskId: number): Promise<TaskFile[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(taskFiles).where(eq(taskFiles.taskId, taskId)).orderBy(desc(taskFiles.createdAt));
}

export async function getTaskFileById(id: number): Promise<TaskFile | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(taskFiles).where(eq(taskFiles.id, id)).limit(1);
  return result[0];
}

export async function deleteTaskFile(fileId: number): Promise<TaskFile | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(taskFiles).where(eq(taskFiles.id, fileId)).limit(1);
  if (!result[0]) return undefined;
  await db.delete(taskFiles).where(eq(taskFiles.id, fileId));
  return result[0];
}

// ─── Email Logs ───────────────────────────────────────────────────────────────
export async function createEmailLog(data: InsertEmailLog): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(emailLogs).values(data);
  return result[0].insertId;
}

export async function listEmailLogs(taskId?: number, clientId?: number): Promise<EmailLog[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (taskId !== undefined) conditions.push(eq(emailLogs.taskId, taskId));
  if (clientId !== undefined) conditions.push(eq(emailLogs.clientId, clientId));
  if (conditions.length === 0) return db.select().from(emailLogs).orderBy(desc(emailLogs.sentAt));
  return db.select().from(emailLogs)
    .where(conditions.length === 1 ? conditions[0] : and(...conditions))
    .orderBy(desc(emailLogs.sentAt));
}


// ─── Activity Logs ────────────────────────────────────────────────────────────
export async function logActivity(data: InsertActivityLog): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(activityLogs).values(data);
  } catch {
    // Logging should never break the main flow
  }
}

export async function getActivityLogs(entityType: string, entityId: number): Promise<ActivityLog[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(activityLogs)
    .where(and(eq(activityLogs.entityType, entityType), eq(activityLogs.entityId, entityId)))
    .orderBy(desc(activityLogs.createdAt))
    .limit(50);
}

export async function getOperationalQueue(filters?: {
  department?: string;
  status?: string;
  assignedTo?: number;
  urgent?: boolean;
}): Promise<Task[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.department) conditions.push(eq(tasks.department as any, filters.department));
  if (filters?.status) conditions.push(eq(tasks.status, filters.status as any));
  if (filters?.assignedTo) conditions.push(eq(tasks.assignedTo as any, filters.assignedTo));
  if (filters?.urgent) conditions.push(eq(tasks.priority as any, "URGENTE"));

  let q = db.select().from(tasks);
  if (conditions.length > 0) q = (q as any).where(conditions.length === 1 ? conditions[0] : and(...conditions));
  return (q as any).orderBy(tasks.dueDate);
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return { total: 0, pendentes: 0, emAndamento: 0, concluidas: 0, vencidas: 0, clientesAtivos: 0 };
  const [allTasks, allClients] = await Promise.all([
    db.select().from(tasks),
    db.select().from(clients).where(eq(clients.active, true)),
  ]);
  return {
    total: allTasks.length,
    pendentes: allTasks.filter((t) => t.status === "PENDENTE").length,
    emAndamento: allTasks.filter((t) => t.status === "EM_ANDAMENTO").length,
    concluidas: allTasks.filter((t) => t.status === "CONCLUIDA").length,
    vencidas: allTasks.filter((t) => t.status === "VENCIDA").length,
    clientesAtivos: allClients.length,
  };
}

// ─── Password Reset ───────────────────────────────────────────────────────────
export async function createPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users)
    .set({ openId: `reset:${token}:${expiresAt.getTime()}` })
    .where(eq(users.id, userId));
}

export async function getUserByResetToken(token: string): Promise<typeof users.$inferSelect | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users)
    .where(sql`${users.openId} LIKE ${'reset:' + token + ':%'}`)
    .limit(1);
  if (!result[0]) return undefined;
  const parts = result[0].openId?.split(":");
  if (!parts || parts.length < 3) return undefined;
  if (Date.now() > Number(parts[2])) return undefined;
  return result[0];
}

export async function resetUserPassword(userId: number, passwordHash: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ passwordHash, openId: null }).where(eq(users.id, userId));
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
export async function listClientTaskTemplates(clientId: number, activeOnly = true): Promise<ClientTaskTemplate[]> {
  const db = await getDb();
  if (!db) return [];
  if (activeOnly) {
    return db.select().from(clientTaskTemplates).where(
      and(eq(clientTaskTemplates.clientId, clientId), eq(clientTaskTemplates.active, true))
    );
  }
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
  await db.delete(clientTaskTemplates).where(eq(clientTaskTemplates.id, id));
}

// ─── Task Catalogs ────────────────────────────────────────────────────────────
export async function listTaskCatalogs(activeOnly = true): Promise<TaskCatalog[]> {
  const db = await getDb();
  if (!db) return [];
  if (activeOnly) return db.select().from(taskCatalogs).where(eq(taskCatalogs.active, true)).orderBy(taskCatalogs.name);
  return db.select().from(taskCatalogs).orderBy(taskCatalogs.name);
}

export async function createTaskCatalog(data: InsertTaskCatalog): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(taskCatalogs).values(data);
  return result[0].insertId;
}

export async function updateTaskCatalog(id: number, data: Partial<InsertTaskCatalog>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(taskCatalogs).set(data).where(eq(taskCatalogs.id, id));
}

export async function getCatalogTemplates(catalogId: number): Promise<CatalogTemplate[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(catalogTemplates).where(eq(catalogTemplates.catalogId, catalogId));
}

export async function addCatalogTemplate(data: InsertCatalogTemplate): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(catalogTemplates).values(data);
}

export async function removeCatalogTemplate(catalogId: number, taskTemplateId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(catalogTemplates).where(
    and(eq(catalogTemplates.catalogId, catalogId), eq(catalogTemplates.taskTemplateId, taskTemplateId))
  );
}

export async function applyCatalogToClient(clientId: number, catalogId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const items = await getCatalogTemplates(catalogId);
  const existing = await listClientTaskTemplates(clientId, true);
  const existingIds = new Set(existing.map((e) => e.taskTemplateId));
  let added = 0;
  for (const item of items) {
    if (existingIds.has(item.taskTemplateId)) continue;
    await db.insert(clientTaskTemplates).values({
      clientId,
      taskTemplateId: item.taskTemplateId,
      catalogId,
      active: true,
    });
    const tmpl = await getTaskTemplateById(item.taskTemplateId);
    if (tmpl) {
      await createRecurringTask({
        clientId,
        taskTemplateId: item.taskTemplateId,
        title: tmpl.title,
        description: tmpl.description ?? undefined,
        taskType: tmpl.taskType,
        dueDayOfMonth: tmpl.dueDayOfMonth,
        active: true,
      });
    }
    added++;
  }
  return added;
}

// ─── Monthly Panel ────────────────────────────────────────────────────────────
export async function getMonthlyPanel(month: number, year: number) {
  const db = await getDb();
  if (!db) return [];
  const competencia = `${String(month).padStart(2, "0")}/${year}`;
  const [allClients, allTasks] = await Promise.all([
    listClients(false),
    db.select().from(tasks).where(eq(tasks.competencia, competencia)),
  ]);
  return allClients
    .map((client) => ({
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
    }))
    .filter((c) => c.tasks.length > 0);
}
