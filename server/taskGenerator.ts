/**
 * Geração de tarefas a partir das recorrentes, com suporte a:
 * - Defasagem de competência (vencimento X meses após a competência)
 * - Periodicidade: MENSAL, TRIMESTRAL, ANUAL
 * - Geração automática mantendo N meses à frente
 */
import {
  createTask,
  listClients,
  listRecurringTasks,
  listTasks,
  taskExistsByRecurringAndCompetencia,
} from "./db";

interface GenResult {
  created: number;
  skipped: number;
}

/**
 * Decide se uma recorrente deve gerar tarefa para uma dada competência,
 * conforme sua periodicidade.
 */
function shouldGenerateForCompetencia(rt: any, month: number): boolean {
  const periodicity = rt.periodicity ?? "MENSAL";

  if (periodicity === "MENSAL") return true;

  if (periodicity === "ANUAL") {
    // Só gera se o mês de competência for o mês configurado (annualMonth).
    // Se annualMonth não estiver setado, assume janeiro (competência de dezembro).
    const annualMonth = rt.annualMonth ?? 1;
    // A competência do anual é o mês anterior ao vencimento pela defasagem.
    // Mas para simplificar: annualMonth representa o mês de COMPETÊNCIA que dispara.
    return month === annualMonth;
  }

  if (periodicity === "TRIMESTRAL") {
    // Gera nos meses que fecham trimestre: março(3), junho(6), setembro(9), dezembro(12)
    return [3, 6, 9, 12].includes(month);
  }

  return true;
}

/**
 * Calcula o vencimento a partir da competência + defasagem configurada.
 * competenciaOffset = quantos meses o vencimento fica À FRENTE da competência.
 */
function calcDueDate(compMonth: number, compYear: number, rt: any): Date {
  const offset = rt.competenciaOffset ?? 1;

  // Soma a defasagem ao mês de competência (0-based para Date)
  // compMonth é 1-based; Date usa 0-based, então compMonth-1 + offset
  const dueDateBase = new Date(compYear, (compMonth - 1) + offset, 1);
  const dueYear = dueDateBase.getFullYear();
  const dueMonth = dueDateBase.getMonth(); // 0-based

  // Dia do vencimento: usa o dueDayOfMonth do template, com ajustes por tipo
  let dueDay = rt.dueDayOfMonth ?? 20;
  if (rt.taskType === "DAS") dueDay = 20;
  else if (rt.taskType === "NFS") dueDay = 10;
  else if (rt.taskType === "DCTF") dueDay = 28;
  // SPED e OUTROS usam o dueDayOfMonth cadastrado

  // Garante que o dia existe no mês (ex: dia 31 em fevereiro → último dia)
  const lastDayOfMonth = new Date(dueYear, dueMonth + 1, 0).getDate();
  if (dueDay > lastDayOfMonth) dueDay = lastDayOfMonth;

  return new Date(dueYear, dueMonth, dueDay);
}

/**
 * Gera tarefas para uma competência específica (mês/ano de APURAÇÃO).
 * Respeita periodicidade e calcula o vencimento pela defasagem.
 */
export async function generateTasksForCompetencia(
  month: number,
  year: number,
  clientId?: number
): Promise<GenResult> {
  const competencia = `${String(month).padStart(2, "0")}/${year}`;
  const allRecurring = await listRecurringTasks();
  const activeRecurring = allRecurring.filter(
    (rt: any) => rt.active && (clientId ? rt.clientId === clientId : true)
  );
  const clients = await listClients(false);
  const activeClientIds = new Set(clients.map((c) => c.id));

  let created = 0;
  let skipped = 0;

  for (const rt of activeRecurring as any[]) {
    if (!activeClientIds.has(rt.clientId)) { skipped++; continue; }

    // Respeita a periodicidade (anual só no mês certo, trimestral só no fim do trimestre)
    if (!shouldGenerateForCompetencia(rt, month)) { skipped++; continue; }

    // Evita duplicatas
    const exists = await taskExistsByRecurringAndCompetencia(rt.id, competencia);
    if (exists) { skipped++; continue; }
    const existsByTitle = (await listTasks({ clientId: rt.clientId, competencia }))
      .some((t) => t.title === rt.title);
    if (existsByTitle) { skipped++; continue; }

    const dueDate = calcDueDate(month, year, rt);

    await createTask({
      clientId: rt.clientId,
      recurringTaskId: rt.id,
      title: rt.title,
      description: rt.description ?? undefined,
      taskType: rt.taskType,
      department: rt.department ?? "Geral",
      sendToClient: rt.sendToClient ?? true,
      competencia,
      dueDate,
      status: "PENDENTE",
    });
    created++;
  }

  return { created, skipped };
}

/**
 * Geração automática: garante que existam tarefas geradas para os próximos
 * N meses de competência (a partir do mês atual). Roda no scheduler.
 * Assim, quando vira o mês, o próximo mês de competência é gerado sozinho.
 */
export async function ensureUpcomingTasksGenerated(monthsAhead = 3): Promise<GenResult> {
  const now = new Date();
  let totalCreated = 0;
  let totalSkipped = 0;

  // Gera da competência do mês atual até monthsAhead à frente
  for (let i = 0; i <= monthsAhead; i++) {
    const target = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const month = target.getMonth() + 1; // 1-based
    const year = target.getFullYear();
    const result = await generateTasksForCompetencia(month, year);
    totalCreated += result.created;
    totalSkipped += result.skipped;
  }

  if (totalCreated > 0) {
    console.log(`[AutoGen] ${totalCreated} tarefa(s) gerada(s) automaticamente (${monthsAhead} meses à frente)`);
  }
  return { created: totalCreated, skipped: totalSkipped };
}
