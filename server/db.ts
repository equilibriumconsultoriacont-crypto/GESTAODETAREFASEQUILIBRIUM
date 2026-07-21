import { and, desc, eq, inArray, sql } from "drizzle-orm";
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
  activityLogs,
  catalogTemplates,
  clientTaskTemplates,
  calendarEvents,
  calendarEventGuests,
  userModules,
  proposals,
  clients,
  departments,
  emailLogs,
  clientRevenue,
  clientUserAccess,
  recurringTasks,
  taskCatalogs,
  taskFiles,
  taskTemplates,
  tasks,
  userClients,
  userDepartments,
  users,
} from "../drizzle/schema";

// ─── Connection Pool (Railway-safe) ──────────────────────────────────────────
let _pool: mysql.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

export function getPool(): mysql.Pool {
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
    email: user.email.trim().toLowerCase(),
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
  try {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] ?? undefined;
  } catch (err: any) {
    if (!isMissingColumn(err)) throw err;
    const result = await db.select(userColsSafe).from(users).where(eq(users.id, id)).limit(1);
    return result[0] ? ({ ...result[0], mustChangePassword: false } as any) : undefined;
  }
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const normalized = email.trim().toLowerCase();
  try {
    const result = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
    return result[0] ?? undefined;
  } catch (err: any) {
    if (!isMissingColumn(err)) throw err;
    const result = await db.select(userColsSafe).from(users).where(eq(users.email, normalized)).limit(1);
    return result[0] ? ({ ...result[0], mustChangePassword: false } as any) : undefined;
  }
}

// Cria o acesso (usuário) de um cliente com senha inicial padrão e a marca de
// "trocar senha no primeiro login". Não sobrescreve usuário existente.
export async function createPendingClientUser(email: string, passwordHash: string, clientId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(users).values({
    email: email.trim().toLowerCase(),
    name: email.trim().toLowerCase(),
    passwordHash,
    role: "client",
    clientId,
    mustChangePassword: true,
    loginMethod: "local",
    lastSignedIn: new Date(),
  } as any);
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
// Fallback: se a coluna dueDateAdjust ainda nao existir no banco (migracao
// pendente ou falha), seleciona apenas as colunas seguras e aplica o padrao —
// evita que uma diferenca de schema derrube toda a listagem.
function isMissingColumn(err: any): boolean {
  const m = String(err?.message ?? "");
  return err?.code === "ER_BAD_FIELD_ERROR" || /Unknown column/i.test(m) || /dueDateAdjust/i.test(m);
}
const recurringColsSafe = {
  id: recurringTasks.id, clientId: recurringTasks.clientId, taskTemplateId: recurringTasks.taskTemplateId,
  title: recurringTasks.title, description: recurringTasks.description, taskType: recurringTasks.taskType,
  department: recurringTasks.department, dueDayOfMonth: recurringTasks.dueDayOfMonth,
  periodicity: recurringTasks.periodicity, competenciaOffset: recurringTasks.competenciaOffset,
  annualMonth: recurringTasks.annualMonth, sendToClient: recurringTasks.sendToClient,
  active: recurringTasks.active, createdAt: recurringTasks.createdAt, updatedAt: recurringTasks.updatedAt,
};
const userColsSafe = {
  id: users.id, openId: users.openId, name: users.name, email: users.email,
  passwordHash: users.passwordHash, loginMethod: users.loginMethod, role: users.role,
  clientId: users.clientId, createdAt: users.createdAt, updatedAt: users.updatedAt,
  lastSignedIn: users.lastSignedIn,
};
const templateColsSafe = {
  id: taskTemplates.id, title: taskTemplates.title, description: taskTemplates.description,
  taskType: taskTemplates.taskType, dueDayOfMonth: taskTemplates.dueDayOfMonth,
  periodicity: taskTemplates.periodicity, competenciaOffset: taskTemplates.competenciaOffset,
  annualMonth: taskTemplates.annualMonth, sendToClient: taskTemplates.sendToClient,
  ocrKeywords: taskTemplates.ocrKeywords, department: taskTemplates.department,
  active: taskTemplates.active, createdAt: taskTemplates.createdAt, updatedAt: taskTemplates.updatedAt,
};

export async function listRecurringTasks(clientId?: number): Promise<RecurringTask[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    if (clientId !== undefined) {
      return await db.select().from(recurringTasks).where(eq(recurringTasks.clientId, clientId));
    }
    return await db.select().from(recurringTasks);
  } catch (err: any) {
    if (!isMissingColumn(err)) throw err;
    const rows = clientId !== undefined
      ? await db.select(recurringColsSafe).from(recurringTasks).where(eq(recurringTasks.clientId, clientId))
      : await db.select(recurringColsSafe).from(recurringTasks);
    return rows.map((r) => ({ ...r, dueDateAdjust: "PROXIMO_DIA_UTIL" as const })) as RecurringTask[];
  }
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
  try {
    let query = db.select().from(tasks);
    const conditions: any[] = [];
    if (filters?.clientId !== undefined) conditions.push(eq(tasks.clientId, filters.clientId));
    if (filters?.status) conditions.push(eq(tasks.status, filters.status as any));
    if (filters?.taskType) conditions.push(eq(tasks.taskType, filters.taskType as any));
    if (filters?.competencia) conditions.push(eq(tasks.competencia, filters.competencia));
    if (conditions.length > 0) {
      return await (query as any).where(conditions.length === 1 ? conditions[0] : and(...conditions)).orderBy(desc(tasks.dueDate));
    }
    return await (query as any).orderBy(desc(tasks.dueDate));
  } catch (err: any) {
    // Fallback: raw SQL usando o pool diretamente (não depende do schema Drizzle)
    console.error("[DB] listTasks drizzle failed, using raw SQL:", err?.message);
    try {
      const pool = getPool();
      let rawSql = `SELECT id, clientId, recurringTaskId, title, description, taskType,
        competencia, dueDate, status, notes, completedAt, createdAt, updatedAt,
        COALESCE(priority, 'NORMAL') as priority,
        COALESCE(department, 'GERAL') as department,
        COALESCE(sendToClient, 1) as sendToClient,
        assignedTo, internalDeadline, waitingSince, startedAt
        FROM tasks`;
      const params: any[] = [];
      const wheres: string[] = [];
      if (filters?.clientId !== undefined) { wheres.push("clientId = ?"); params.push(filters.clientId); }
      if (filters?.status) { wheres.push("status = ?"); params.push(filters.status); }
      if (filters?.competencia) { wheres.push("competencia = ?"); params.push(filters.competencia); }
      if (wheres.length > 0) rawSql += " WHERE " + wheres.join(" AND ");
      rawSql += " ORDER BY dueDate DESC";
      const [rows] = await pool.query(rawSql, params);
      return rows as Task[];
    } catch (fallbackErr: any) {
      console.error("[DB] listTasks raw SQL also failed:", fallbackErr?.message);
      return [];
    }
  }
}

export async function getTaskById(id: number): Promise<Task | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  try {
    const result = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    return result[0];
  } catch {
    return undefined;
  }
}

export async function createTask(data: InsertTask): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    const result = await db.insert(tasks).values(data);
    return result[0].insertId;
  } catch (err: any) {
    // Se falhar por coluna nova não existente, tenta sem os campos opcionais
    if (err?.code === "ER_BAD_FIELD_ERROR") {
      console.warn("[DB] createTask: column missing, retrying without new fields:", err.message);
      const { priority, department, assignedTo, internalDeadline, waitingSince, startedAt, ...baseData } = data as any;
      const result = await db.insert(tasks).values(baseData);
      return result[0].insertId;
    }
    throw err;
  }
}

export async function updateTask(id: number, data: Partial<InsertTask>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.update(tasks).set(data).where(eq(tasks.id, id));
  } catch (err: any) {
    // Se falhar por coluna nova, tenta sem campos opcionais
    if (err?.code === "ER_BAD_FIELD_ERROR") {
      console.warn("[DB] updateTask: column missing, retrying without new fields:", err.message);
      const { priority, department, assignedTo, internalDeadline, waitingSince, startedAt, ...baseData } = data as any;
      if (Object.keys(baseData).length > 0) {
        await db.update(tasks).set(baseData).where(eq(tasks.id, id));
      }
    } else {
      throw err;
    }
  }
}

export async function deleteTask(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Remove arquivos vinculados primeiro para não violar FK
  await db.delete(taskFiles).where(eq(taskFiles.taskId, id));
  // Remove a tarefa
  await db.delete(tasks).where(eq(tasks.id, id));
}

export async function taskExistsByRecurringAndCompetencia(
  recurringTaskId: number,
  competencia: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    const result = await db.select({ id: tasks.id }).from(tasks).where(
      and(eq(tasks.recurringTaskId, recurringTaskId), eq(tasks.competencia, competencia))
    ).limit(1);
    return result.length > 0;
  } catch {
    // If recurringTaskId column doesn't exist, fallback to title+client+competencia check
    return false;
  }
}

export async function getTasksDueSoon(daysAhead = 7): Promise<Task[]> {
  try {
    const pool = getPool();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + daysAhead);
    const [rows] = await pool.query(
      `SELECT * FROM tasks WHERE status = 'PENDENTE' AND dueDate <= ? ORDER BY dueDate ASC`,
      [cutoff]
    ) as [any[], any];
    return rows as Task[];
  } catch (err) {
    console.error("[DB] getTasksDueSoon error:", err);
    return [];
  }
}

export async function markOverdueTasks(): Promise<number> {
  try {
    const pool = getPool();
    // Usa CURDATE() para comparar só a data (sem hora), evitando problema de timezone
    // Marca como VENCIDA tarefas cuja data de vencimento já passou (dia anterior ou antes)
    const [result] = await pool.query(
      `UPDATE tasks SET status = 'VENCIDA'
       WHERE status IN ('PENDENTE', 'EM_ANDAMENTO', 'AGUARDANDO_CLIENTE', 'EM_REVISAO')
       AND DATE(dueDate) < CURDATE()`,
    ) as [any, any];
    return result.affectedRows ?? 0;
  } catch (err) {
    console.error("[DB] markOverdueTasks error:", err);
    return 0;
  }
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
  return db.select().from(taskFiles).where(eq(taskFiles.taskId, taskId)).orderBy(desc(taskFiles.uploadedAt));
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
  const empty = { total: 0, pendentes: 0, emAndamento: 0, aguardandoCliente: 0, emRevisao: 0, concluidas: 0, vencidas: 0, clientesAtivos: 0 };
  try {
    const pool = getPool();
    const [[taskRows], [clientRows]] = await Promise.all([
      pool.query("SELECT status FROM tasks") as Promise<[any[], any]>,
      pool.query("SELECT id FROM clients WHERE active = 1") as Promise<[any[], any]>,
    ]);
    const allTasks = taskRows as { status: string }[];
    return {
      total: allTasks.length,
      pendentes: allTasks.filter(t => t.status === "PENDENTE").length,
      emAndamento: allTasks.filter(t => t.status === "EM_ANDAMENTO").length,
      aguardandoCliente: allTasks.filter(t => t.status === "AGUARDANDO_CLIENTE").length,
      emRevisao: allTasks.filter(t => t.status === "EM_REVISAO").length,
      concluidas: allTasks.filter(t => t.status === "CONCLUIDA").length,
      vencidas: allTasks.filter(t => t.status === "VENCIDA").length,
      clientesAtivos: (clientRows as any[]).length,
    };
  } catch (err) {
    console.error("[DB] getDashboardStats error:", err);
    return empty;
  }
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
  try {
    if (activeOnly) return await db.select().from(taskTemplates).where(eq(taskTemplates.active, true)).orderBy(taskTemplates.title);
    return await db.select().from(taskTemplates).orderBy(taskTemplates.title);
  } catch (err: any) {
    if (!isMissingColumn(err)) throw err;
    const rows = activeOnly
      ? await db.select(templateColsSafe).from(taskTemplates).where(eq(taskTemplates.active, true)).orderBy(taskTemplates.title)
      : await db.select(templateColsSafe).from(taskTemplates).orderBy(taskTemplates.title);
    return rows.map((r) => ({ ...r, dueDateAdjust: "PROXIMO_DIA_UTIL" as const })) as TaskTemplate[];
  }
}

export async function getTaskTemplateById(id: number): Promise<TaskTemplate | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  try {
    const result = await db.select().from(taskTemplates).where(eq(taskTemplates.id, id)).limit(1);
    return result[0];
  } catch (err: any) {
    if (!isMissingColumn(err)) throw err;
    const result = await db.select(templateColsSafe).from(taskTemplates).where(eq(taskTemplates.id, id)).limit(1);
    return result[0] ? ({ ...result[0], dueDateAdjust: "PROXIMO_DIA_UTIL" as const } as TaskTemplate) : undefined;
  }
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
  // Pré-carrega recorrentes para evitar duplicatas
  const existingRecurring = await listRecurringTasks(clientId);
  const existingRecurringTemplateIds = new Set(existingRecurring.map((r) => r.taskTemplateId).filter(Boolean));
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
    if (tmpl && !existingRecurringTemplateIds.has(item.taskTemplateId)) {
      await createRecurringTask({
        clientId,
        taskTemplateId: item.taskTemplateId,
        title: tmpl.title,
        description: tmpl.description ?? undefined,
        taskType: tmpl.taskType,
        department: (tmpl as any).department ?? "Geral",
        periodicity: (tmpl as any).periodicity ?? "MENSAL",
        competenciaOffset: (tmpl as any).competenciaOffset ?? 1,
        annualMonth: (tmpl as any).annualMonth ?? null,
        sendToClient: (tmpl as any).sendToClient ?? true,
        dueDateAdjust: (tmpl as any).dueDateAdjust ?? "PROXIMO_DIA_UTIL",
        dueDayOfMonth: tmpl.dueDayOfMonth,
        active: true,
      });
      existingRecurringTemplateIds.add(item.taskTemplateId);
    }
    added++;
  }
  return added;
}

// ─── Monthly Panel ────────────────────────────────────────────────────────────
export async function getMonthlyPanel(month: number, year: number) {
  try {
    const pool = getPool();
    // O Painel Mensal é um CALENDÁRIO DE VENCIMENTOS: os dias marcados são
    // os dias em que guias vencem. Por isso filtramos por MÊS DE VENCIMENTO
    // (dueDate), não por competência — uma guia de competência 06 pode vencer
    // em 07 (defasagem), e deve aparecer no calendário de julho.
    const [[clientRows], [taskRows]] = await Promise.all([
      pool.query("SELECT id, name FROM clients WHERE active = 1 ORDER BY name") as Promise<[any[], any]>,
      pool.query(
        "SELECT id, clientId, title, taskType, status, dueDate, competencia FROM tasks WHERE MONTH(dueDate) = ? AND YEAR(dueDate) = ?",
        [month, year]
      ) as Promise<[any[], any]>,
    ]);
    const allClients = clientRows as { id: number; name: string }[];
    const allTasks = taskRows as any[];
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
  } catch (err) {
    console.error("[DB] getMonthlyPanel error:", err);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DEPARTAMENTOS
// ═══════════════════════════════════════════════════════════════════════════

export async function listDepartments(includeInactive = false) {
  const db = await getDb();
  if (!db) return [];
  if (includeInactive) return db.select().from(departments).orderBy(departments.name);
  return db.select().from(departments).where(eq(departments.active, true)).orderBy(departments.name);
}

export async function createDepartment(data: { name: string; color?: string }): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB indisponível");
  const result = await db.insert(departments).values({ name: data.name, color: data.color ?? "#a1a1aa" });
  return result[0].insertId;
}

export async function updateDepartment(id: number, data: { name?: string; color?: string; active?: boolean }) {
  const db = await getDb();
  if (!db) return;
  await db.update(departments).set(data).where(eq(departments.id, id));
}

export async function deleteDepartment(id: number) {
  const db = await getDb();
  if (!db) return;
  // Remove vínculos primeiro
  await db.delete(userDepartments).where(eq(userDepartments.departmentId, id));
  await db.delete(departments).where(eq(departments.id, id));
}

// ═══════════════════════════════════════════════════════════════════════════
// USUÁRIOS — vínculos com departamentos e empresas
// ═══════════════════════════════════════════════════════════════════════════

export async function listUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(users.name);
}

export async function getUserDepartments(userId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(userDepartments).where(eq(userDepartments.userId, userId));
  return rows.map((r) => r.departmentId);
}

export async function getUserClients(userId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(userClients).where(eq(userClients.userId, userId));
  return rows.map((r) => r.clientId);
}

export async function setUserDepartments(userId: number, departmentIds: number[]) {
  const db = await getDb();
  if (!db) return;
  await db.delete(userDepartments).where(eq(userDepartments.userId, userId));
  if (departmentIds.length > 0) {
    await db.insert(userDepartments).values(departmentIds.map((departmentId) => ({ userId, departmentId })));
  }
}

export async function setUserClients(userId: number, clientIds: number[]) {
  const db = await getDb();
  if (!db) return;
  await db.delete(userClients).where(eq(userClients.userId, userId));
  if (clientIds.length > 0) {
    await db.insert(userClients).values(clientIds.map((clientId) => ({ userId, clientId })));
  }
}

export async function createLocalUser(data: { name: string; email: string; passwordHash: string; role: "admin" | "user" }): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB indisponível");
  const result = await db.insert(users).values({
    name: data.name, email: data.email, passwordHash: data.passwordHash,
    role: data.role, loginMethod: "local",
  });
  return result[0].insertId;
}

export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(userDepartments).where(eq(userDepartments.userId, userId));
  await db.delete(userClients).where(eq(userClients.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

export async function updateUserBasic(userId: number, data: { name?: string; email?: string; role?: "admin" | "user"; passwordHash?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, userId));
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD GERENCIAL
// ═══════════════════════════════════════════════════════════════════════════

/** Normaliza uma data para meia-noite local (comparação por dia) */
function toLocalMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Dashboard do ADMIN: visão geral do escritório + desempenho por funcionário
 * e por departamento. Baseado na competência informada (ou mês anterior).
 */
export async function getAdminDashboard(competencia?: string) {
  try {
    const pool = getPool();
    const [taskRows] = await pool.query(
      "SELECT id, clientId, title, taskType, department, competencia, dueDate, status, completedAt FROM tasks"
    ) as [any[], any];
    const [clientRows] = await pool.query("SELECT id, name, active FROM clients") as [any[], any];
    const [userRows] = await pool.query("SELECT id, name, email, role FROM users WHERE role != 'client'") as [any[], any];
    const [udRows] = await pool.query("SELECT userId, departmentId FROM user_departments") as [any[], any];
    const [ucRows] = await pool.query("SELECT userId, clientId FROM user_clients") as [any[], any];
    const [deptRows] = await pool.query("SELECT id, name, color FROM departments") as [any[], any];

    const today = toLocalMidnight(new Date());
    const allTasks = taskRows as any[];

    // Filtra por competência se informada
    const tasks = competencia ? allTasks.filter(t => t.competencia === competencia) : allTasks;

    // Helpers de classificação
    const isDone = (t: any) => t.status === "CONCLUIDA";
    const isCancelled = (t: any) => t.status === "CANCELADA";
    const isOverdue = (t: any) => {
      if (isDone(t) || isCancelled(t)) return false;
      return toLocalMidnight(new Date(t.dueDate)) < today;
    };
    const isOpen = (t: any) => !isDone(t) && !isCancelled(t);

    // ── Visão geral ──
    const overview = {
      total: tasks.length,
      abertas: tasks.filter(isOpen).length,
      concluidas: tasks.filter(isDone).length,
      vencidas: tasks.filter(isOverdue).length,
      clientesAtivos: (clientRows as any[]).filter(c => c.active).length,
      // SLA: % de entregas no prazo (concluídas dentro do vencimento / total concluídas)
      slaNoPrazo: (() => {
        const done = tasks.filter(isDone);
        if (done.length === 0) return null;
        const onTime = done.filter(t => {
          if (!t.completedAt) return true;
          return toLocalMidnight(new Date(t.completedAt)) <= toLocalMidnight(new Date(t.dueDate));
        }).length;
        return Math.round((onTime / done.length) * 100);
      })(),
    };

    // ── Desempenho por funcionário ──
    // Mapa userId → clientes e departamentos vinculados
    const userClientsMap = new Map<number, Set<number>>();
    for (const uc of ucRows as any[]) {
      if (!userClientsMap.has(uc.userId)) userClientsMap.set(uc.userId, new Set());
      userClientsMap.get(uc.userId)!.add(uc.clientId);
    }
    const deptById = new Map((deptRows as any[]).map(d => [d.id, d]));
    const userDeptNamesMap = new Map<number, Set<string>>();
    for (const ud of udRows as any[]) {
      if (!userDeptNamesMap.has(ud.userId)) userDeptNamesMap.set(ud.userId, new Set());
      const dept = deptById.get(ud.departmentId);
      if (dept) userDeptNamesMap.get(ud.userId)!.add(dept.name);
    }

    const byUser = (userRows as any[]).map(u => {
      const isAdminUser = u.role === "admin";
      // Admin "vê" todas; colaborador só as vinculadas
      const allowedClients = userClientsMap.get(u.id) ?? new Set();
      const allowedDepts = userDeptNamesMap.get(u.id) ?? new Set();

      const userTasks = isAdminUser
        ? tasks
        : tasks.filter(t => allowedClients.has(t.clientId) && allowedDepts.has(t.department ?? "Geral"));

      return {
        userId: u.id,
        name: u.name,
        role: u.role,
        departments: Array.from(allowedDepts),
        clientCount: allowedClients.size,
        aEntregar: userTasks.filter(isOpen).length,
        entregues: userTasks.filter(isDone).length,
        atrasadas: userTasks.filter(isOverdue).length,
        total: userTasks.length,
      };
    }).filter(u => u.role !== "admin"); // dashboard de equipe mostra só colaboradores

    // ── Por departamento ──
    const byDepartment = (deptRows as any[]).map(d => {
      const deptTasks = tasks.filter(t => (t.department ?? "Geral") === d.name);
      return {
        name: d.name,
        color: d.color,
        abertas: deptTasks.filter(isOpen).length,
        concluidas: deptTasks.filter(isDone).length,
        atrasadas: deptTasks.filter(isOverdue).length,
        total: deptTasks.length,
      };
    }).filter(d => d.total > 0);

    // ── Clientes com mais pendências (gargalos) ──
    const clientById = new Map((clientRows as any[]).map(c => [c.id, c]));
    const clientPendMap = new Map<number, number>();
    for (const t of tasks.filter(isOpen)) {
      clientPendMap.set(t.clientId, (clientPendMap.get(t.clientId) ?? 0) + 1);
    }
    const topClientesPendencias = Array.from(clientPendMap.entries())
      .map(([clientId, count]) => ({ clientId, name: clientById.get(clientId)?.name ?? "—", pendencias: count }))
      .sort((a, b) => b.pendencias - a.pendencias)
      .slice(0, 5);

    return { overview, byUser, byDepartment, topClientesPendencias };
  } catch (err) {
    console.error("[DB] getAdminDashboard error:", err);
    return { overview: { total: 0, abertas: 0, concluidas: 0, vencidas: 0, clientesAtivos: 0, slaNoPrazo: null }, byUser: [], byDepartment: [], topClientesPendencias: [] };
  }
}

/**
 * Dashboard do COLABORADOR: apenas empresas e tarefas dele.
 * Filtra por clientes vinculados E departamentos do usuário.
 */
export async function getCollaboratorDashboard(userId: number, competencia?: string) {
  try {
    const pool = getPool();
    const [taskRows] = await pool.query(
      "SELECT id, clientId, title, taskType, department, competencia, dueDate, status, completedAt FROM tasks"
    ) as [any[], any];
    const [clientRows] = await pool.query("SELECT id, name FROM clients") as [any[], any];
    const [deptRows] = await pool.query("SELECT id, name, color FROM departments") as [any[], any];

    const allowedClientIds = new Set((await getUserClients(userId)));
    const userDeptIds = await getUserDepartments(userId);
    const deptById = new Map((deptRows as any[]).map(d => [d.id, d]));
    const allowedDeptNames = new Set(userDeptIds.map(id => deptById.get(id)?.name).filter(Boolean));

    const today = toLocalMidnight(new Date());
    let tasks = (taskRows as any[]).filter(t =>
      allowedClientIds.has(t.clientId) && allowedDeptNames.has(t.department ?? "Geral")
    );
    if (competencia) tasks = tasks.filter(t => t.competencia === competencia);

    const isDone = (t: any) => t.status === "CONCLUIDA";
    const isCancelled = (t: any) => t.status === "CANCELADA";
    const isOverdue = (t: any) => !isDone(t) && !isCancelled(t) && toLocalMidnight(new Date(t.dueDate)) < today;
    const isOpen = (t: any) => !isDone(t) && !isCancelled(t);

    const clientById = new Map((clientRows as any[]).map(c => [c.id, c]));

    // Minhas empresas com contagem de pendências
    const myClients = Array.from(allowedClientIds).map(cid => {
      const clientTasks = tasks.filter(t => t.clientId === cid);
      return {
        clientId: cid,
        name: clientById.get(cid)?.name ?? "—",
        abertas: clientTasks.filter(isOpen).length,
        atrasadas: clientTasks.filter(isOverdue).length,
        total: clientTasks.length,
      };
    }).filter(c => c.total > 0);

    // Próximas a vencer (abertas, ordenadas por vencimento)
    const proximasVencer = tasks.filter(isOpen)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 8)
      .map(t => ({
        id: t.id, title: t.title, taskType: t.taskType,
        clientName: clientById.get(t.clientId)?.name ?? "—",
        department: t.department, dueDate: t.dueDate, status: t.status,
      }));

    return {
      overview: {
        aEntregar: tasks.filter(isOpen).length,
        entregues: tasks.filter(isDone).length,
        atrasadas: tasks.filter(isOverdue).length,
        minhasEmpresas: myClients.length,
        meusDepartamentos: Array.from(allowedDeptNames),
      },
      myClients,
      proximasVencer,
    };
  } catch (err) {
    console.error("[DB] getCollaboratorDashboard error:", err);
    return { overview: { aEntregar: 0, entregues: 0, atrasadas: 0, minhasEmpresas: 0, meusDepartamentos: [] }, myClients: [], proximasVencer: [] };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HISTÓRICO UNIFICADO DA TAREFA (linha do tempo)
// ═══════════════════════════════════════════════════════════════════════════

export interface TaskHistoryEvent {
  type: "created" | "status" | "file" | "email" | "scheduled";
  date: string; // ISO
  // status
  fromStatus?: string;
  toStatus?: string;
  // file
  fileId?: number;
  fileName?: string;
  fileUrl?: string;
  fileSize?: number;
  // email
  recipientEmail?: string;
  subject?: string;
  emailStatus?: string;
  taskFileId?: number;
  // scheduled
  note?: string;
}

/**
 * Monta o histórico unificado de uma tarefa: criação, mudanças de status
 * (concluída/dispensada/etc), arquivos anexados e e-mails enviados,
 * tudo ordenado do mais recente para o mais antigo.
 */
export async function getTaskHistory(taskId: number): Promise<TaskHistoryEvent[]> {
  try {
    const pool = getPool();
    const [[taskRows], [logRows], [fileRows], [emailRows]] = await Promise.all([
      pool.query("SELECT id, createdAt FROM tasks WHERE id = ?", [taskId]) as Promise<[any[], any]>,
      pool.query("SELECT action, before, after, createdAt FROM activity_logs WHERE entityType = 'task' AND entityId = ? ORDER BY createdAt", [taskId]) as Promise<[any[], any]>,
      pool.query("SELECT id, filename, fileUrl, fileSize, uploadedAt FROM task_files WHERE taskId = ? ORDER BY uploadedAt", [taskId]) as Promise<[any[], any]>,
      pool.query("SELECT id, recipientEmail, subject, status, taskFileId, sentAt FROM email_logs WHERE taskId = ? ORDER BY sentAt", [taskId]) as Promise<[any[], any]>,
    ]);

    const events: TaskHistoryEvent[] = [];

    // Criação
    const task = (taskRows as any[])[0];
    if (task?.createdAt) {
      events.push({ type: "created", date: new Date(task.createdAt).toISOString() });
    }

    // Mudanças de status e agendamentos
    for (const log of logRows as any[]) {
      if (log.action === "status_changed") {
        let fromStatus, toStatus;
        try { fromStatus = JSON.parse(log.before ?? "{}").status; } catch {}
        try { toStatus = JSON.parse(log.after ?? "{}").status; } catch {}
        events.push({
          type: "status",
          date: new Date(log.createdAt).toISOString(),
          fromStatus, toStatus,
        });
      } else if (log.action === "scheduled") {
        let filename;
        try { filename = JSON.parse(log.after ?? "{}").filename; } catch {}
        events.push({
          type: "scheduled",
          date: new Date(log.createdAt).toISOString(),
          note: filename ? `Guia "${filename}" na fila de envio automático` : "Envio automático agendado",
        });
      }
    }

    // Arquivos anexados
    for (const f of fileRows as any[]) {
      events.push({
        type: "file",
        date: new Date(f.uploadedAt).toISOString(),
        fileId: f.id, fileName: f.filename, fileUrl: f.fileUrl, fileSize: f.fileSize,
      });
    }

    // E-mails enviados
    for (const e of emailRows as any[]) {
      events.push({
        type: "email",
        date: new Date(e.sentAt).toISOString(),
        recipientEmail: e.recipientEmail, subject: e.subject,
        emailStatus: e.status, taskFileId: e.taskFileId,
      });
    }

    // Ordena do mais recente para o mais antigo
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return events;
  } catch (err) {
    console.error("[DB] getTaskHistory error:", err);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CALENDÁRIO — eventos e convites
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lista eventos visíveis para um usuário num intervalo de datas.
 * Inclui: eventos que ele criou + eventos para os quais foi convidado (e aceitou/pendente).
 */
export async function getCalendarEvents(userId: number, startISO: string, endISO: string) {
  try {
    const pool = getPool();
    // Eventos próprios
    const [ownRows] = await pool.query(
      `SELECT e.*, 'owner' as myRole, 'ACEITO' as myStatus
       FROM calendar_events e
       WHERE e.ownerId = ? AND e.startAt <= ? AND e.endAt >= ?`,
      [userId, endISO, startISO]
    ) as [any[], any];

    // Eventos como convidado
    const [guestRows] = await pool.query(
      `SELECT e.*, 'guest' as myRole, g.status as myStatus
       FROM calendar_events e
       INNER JOIN calendar_event_guests g ON g.eventId = e.id
       WHERE g.userId = ? AND g.status != 'RECUSADO' AND e.startAt <= ? AND e.endAt >= ?`,
      [userId, endISO, startISO]
    ) as [any[], any];

    // Buscar convidados de cada evento (para exibir participantes)
    const allEvents = [...(ownRows as any[]), ...(guestRows as any[])];
    const eventIds = allEvents.map((e) => e.id);
    let guestsByEvent: Record<number, any[]> = {};
    if (eventIds.length > 0) {
      const placeholders = eventIds.map(() => "?").join(",");
      const [guests] = await pool.query(
        `SELECT g.eventId, g.userId, g.status, u.name, u.email
         FROM calendar_event_guests g
         INNER JOIN users u ON u.id = g.userId
         WHERE g.eventId IN (${placeholders})`,
        eventIds
      ) as [any[], any];
      for (const g of guests as any[]) {
        if (!guestsByEvent[g.eventId]) guestsByEvent[g.eventId] = [];
        guestsByEvent[g.eventId].push({ userId: g.userId, name: g.name, email: g.email, status: g.status });
      }
    }

    return allEvents.map((e) => ({ ...e, guests: guestsByEvent[e.id] ?? [] }));
  } catch (err) {
    console.error("[DB] getCalendarEvents error:", err);
    return [];
  }
}

export async function createCalendarEvent(data: {
  ownerId: number; title: string; description?: string; location?: string;
  startAt: Date; endAt: Date; allDay?: boolean; color?: string; guestUserIds?: number[];
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB indisponível");
  const result = await db.insert(calendarEvents).values({
    ownerId: data.ownerId, title: data.title, description: data.description,
    location: data.location, startAt: data.startAt, endAt: data.endAt,
    allDay: data.allDay ?? false, color: data.color ?? "#24646c",
  });
  const eventId = result[0].insertId;

  // Adicionar convidados
  if (data.guestUserIds && data.guestUserIds.length > 0) {
    await db.insert(calendarEventGuests).values(
      data.guestUserIds.map((uid) => ({ eventId, userId: uid, status: "PENDENTE" as const }))
    );
  }
  return eventId;
}

export async function updateCalendarEvent(id: number, ownerId: number, data: {
  title?: string; description?: string; location?: string;
  startAt?: Date; endAt?: Date; allDay?: boolean; color?: string;
}) {
  const db = await getDb();
  if (!db) return;
  // Só o dono edita
  await db.update(calendarEvents).set(data).where(and(eq(calendarEvents.id, id), eq(calendarEvents.ownerId, ownerId)));
}

export async function deleteCalendarEvent(id: number, ownerId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(calendarEventGuests).where(eq(calendarEventGuests.eventId, id));
  await db.delete(calendarEvents).where(and(eq(calendarEvents.id, id), eq(calendarEvents.ownerId, ownerId)));
}

/** Convidado responde ao convite (aceita ou recusa) */
export async function respondToCalendarInvite(eventId: number, userId: number, status: "ACEITO" | "RECUSADO") {
  const db = await getDb();
  if (!db) return;
  await db.update(calendarEventGuests).set({ status })
    .where(and(eq(calendarEventGuests.eventId, eventId), eq(calendarEventGuests.userId, userId)));
}

/** Convites pendentes de um usuário (para badge de notificação) */
export async function getPendingInvites(userId: number) {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT e.id, e.title, e.startAt, e.endAt, e.location, u.name as ownerName
       FROM calendar_event_guests g
       INNER JOIN calendar_events e ON e.id = g.eventId
       INNER JOIN users u ON u.id = e.ownerId
       WHERE g.userId = ? AND g.status = 'PENDENTE' AND e.endAt >= NOW()
       ORDER BY e.startAt ASC`,
      [userId]
    ) as [any[], any];
    return rows;
  } catch (err) {
    console.error("[DB] getPendingInvites error:", err);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PLATAFORMA — módulos e permissões do usuário
// ═══════════════════════════════════════════════════════════════════════════

/** Retorna os módulos de um usuário com o nível em cada um. */
export async function getUserModules(userId: number): Promise<{ module: string; level: string }[]> {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      "SELECT module, level FROM user_modules WHERE userId = ?", [userId]
    ) as [any[], any];
    return rows as { module: string; level: string }[];
  } catch (err) {
    console.error("[DB] getUserModules error:", err);
    return [];
  }
}

/** Define (substitui) os módulos de um usuário. modules = [{module, level}] */
export async function setUserModules(userId: number, modules: { module: string; level: string }[]) {
  const db = await getDb();
  if (!db) return;
  // Remove os atuais e insere os novos
  await db.delete(userModules).where(eq(userModules.userId, userId));
  if (modules.length > 0) {
    await db.insert(userModules).values(
      modules.map((m) => ({ userId, module: m.module, level: m.level }))
    );
  }
}

/** Verifica se o usuário tem acesso a um módulo (e opcionalmente com nível mínimo). */
export async function userHasModule(userId: number, module: string): Promise<{ has: boolean; level: string | null }> {
  const mods = await getUserModules(userId);
  const found = mods.find((m) => m.module === module);
  return { has: !!found, level: found?.level ?? null };
}

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO PROPOSTAS
// ═══════════════════════════════════════════════════════════════════════════

export async function listProposals(userId: number, isAdmin: boolean) {
  try {
    const pool = getPool();
    // Admin do módulo vê todas; demais veem as próprias
    const [rows] = isAdmin
      ? await pool.query(
          `SELECT p.id, p.title, p.clientName, p.status, p.ownerId, p.createdAt, p.updatedAt, u.name as ownerName
           FROM proposals p LEFT JOIN users u ON u.id = p.ownerId
           ORDER BY p.updatedAt DESC`
        ) as [any[], any]
      : await pool.query(
          `SELECT p.id, p.title, p.clientName, p.status, p.ownerId, p.createdAt, p.updatedAt, u.name as ownerName
           FROM proposals p LEFT JOIN users u ON u.id = p.ownerId
           WHERE p.ownerId = ? ORDER BY p.updatedAt DESC`, [userId]
        ) as [any[], any];
    return rows;
  } catch (err) {
    console.error("[DB] listProposals error:", err);
    return [];
  }
}

export async function getProposal(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createProposal(data: { ownerId: number; title: string; clientName?: string; data: string; status?: any }): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB indisponível");
  const result = await db.insert(proposals).values({
    ownerId: data.ownerId, title: data.title, clientName: data.clientName,
    data: data.data, status: data.status ?? "RASCUNHO",
  });
  return result[0].insertId;
}

export async function updateProposal(id: number, data: { title?: string; clientName?: string; data?: string; status?: any }) {
  const db = await getDb();
  if (!db) return;
  await db.update(proposals).set(data).where(eq(proposals.id, id));
}

export async function deleteProposal(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(proposals).where(eq(proposals.id, id));
}


// ─── Faturamento do cliente ───────────────────────────────────────────────────
export async function getClientRevenue(clientId: number, year: number, month: number): Promise<{ valor: string; imposto: string | null } | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db.select().from(clientRevenue)
      .where(and(eq(clientRevenue.clientId, clientId), eq(clientRevenue.year, year), eq(clientRevenue.month, month)))
      .limit(1);
    if (!rows[0]) return null;
    return { valor: rows[0].valor, imposto: (rows[0] as any).imposto ?? null };
  } catch { return null; }
}

export async function setTaskClientPaid(taskId: number, paid: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try { await db.update(tasks).set({ clientPaid: paid } as any).where(eq(tasks.id, taskId)); } catch {}
}

export async function getClientRevenueYear(clientId: number, year: number): Promise<Array<{ month: number; valor: string; imposto: string | null }>> {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db.select().from(clientRevenue)
      .where(and(eq(clientRevenue.clientId, clientId), eq(clientRevenue.year, year)));
    return rows.map((r) => ({ month: r.month, valor: r.valor, imposto: (r as any).imposto ?? null }));
  } catch { return []; }
}

// valor = faturamento; imposto = opcional (preenchido pelo PGDAS). Se imposto
// vier undefined num update, mantém o valor já gravado.
export async function upsertClientRevenue(clientId: number, year: number, month: number, valor: string, imposto?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(clientRevenue)
    .where(and(eq(clientRevenue.clientId, clientId), eq(clientRevenue.year, year), eq(clientRevenue.month, month)))
    .limit(1);
  if (existing[0]) {
    const set: any = { valor };
    if (imposto !== undefined) set.imposto = imposto;
    await db.update(clientRevenue).set(set).where(eq(clientRevenue.id, existing[0].id));
  } else {
    await db.insert(clientRevenue).values({ clientId, year, month, valor, imposto } as any);
  }
}


// ─── Acesso do usuário a várias empresas ──────────────────────────────────────
export async function getUserCompanies(userId: number): Promise<Array<{ id: number; name: string }>> {
  const db = await getDb();
  if (!db) return [];
  try {
    const access = await db.select().from(clientUserAccess).where(eq(clientUserAccess.userId, userId));
    const ids = access.map((a) => a.clientId);
    if (ids.length === 0) return [];
    const cs = await db.select().from(clients).where(inArray(clients.id, ids));
    return cs.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
}

export async function userHasCompanyAccess(userId: number, clientId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    const rows = await db.select().from(clientUserAccess)
      .where(and(eq(clientUserAccess.userId, userId), eq(clientUserAccess.clientId, clientId))).limit(1);
    return rows.length > 0;
  } catch { return false; }
}

export async function addUserCompanyAccess(userId: number, clientId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    const existing = await db.select().from(clientUserAccess)
      .where(and(eq(clientUserAccess.userId, userId), eq(clientUserAccess.clientId, clientId))).limit(1);
    if (existing.length === 0) await db.insert(clientUserAccess).values({ userId, clientId });
  } catch { /* */ }
}
