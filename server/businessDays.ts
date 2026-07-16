/**
 * Cálculo de dias úteis e feriados bancários (nacionais + estaduais SP).
 *
 * Usado para ajustar o vencimento das obrigações quando cai em dia não útil.
 * Regras por imposto (definidas no gerador / template):
 *   - PROXIMO_DIA_UTIL (prorroga): DAS, ICMS-SP  → avança para o próximo dia útil
 *   - DIA_UTIL_ANTERIOR (antecipa): PIS, COFINS   → recua para o dia útil anterior
 *   - NENHUM: mantém a data exata
 *
 * Todas as datas são tratadas em UTC (o banco guarda vencimento em UTC meia-noite).
 */

export type DueAdjust = "PROXIMO_DIA_UTIL" | "DIA_UTIL_ANTERIOR" | "NENHUM";

// Domingo de Páscoa (algoritmo de Meeus/Butcher) — base dos feriados móveis.
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = março, 4 = abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

// Feriados fixos [mês, dia] — nacionais + estadual de SP (09/07).
const FIXED_HOLIDAYS: [number, number][] = [
  [1, 1], // Confraternização Universal
  [4, 21], // Tiradentes
  [5, 1], // Dia do Trabalho
  [7, 9], // Revolução Constitucionalista (SP)
  [9, 7], // Independência
  [10, 12], // N. Sra. Aparecida
  [11, 2], // Finados
  [11, 15], // Proclamação da República
  [11, 20], // Consciência Negra (feriado nacional desde 2024 — Lei 14.759/2023)
  [12, 25], // Natal
];

// Feriados municipais de Rio Claro [mês, dia].
// Deixe para completar conforme a legislação municipal (afeta principalmente
// o ISSQN local). Ex.: aniversário do município. Confirme as datas antes de habilitar.
const MUNICIPAL_HOLIDAYS: [number, number][] = [];

function holidaysForYear(year: number): Set<string> {
  const set = new Set<string>();
  for (const [m, d] of [...FIXED_HOLIDAYS, ...MUNICIPAL_HOLIDAYS]) {
    set.add(ymd(new Date(Date.UTC(year, m - 1, d))));
  }
  // Feriados bancários móveis (não há expediente bancário → contam para vencimento)
  const easter = easterSunday(year);
  set.add(ymd(addDays(easter, -48))); // Carnaval (segunda)
  set.add(ymd(addDays(easter, -47))); // Carnaval (terça)
  set.add(ymd(addDays(easter, -2))); // Sexta-feira Santa
  set.add(ymd(addDays(easter, 60))); // Corpus Christi
  return set;
}

const holidayCache = new Map<number, Set<string>>();
function getHolidays(year: number): Set<string> {
  let h = holidayCache.get(year);
  if (!h) {
    h = holidaysForYear(year);
    holidayCache.set(year, h);
  }
  return h;
}

/** Dia útil = não é sábado, domingo nem feriado bancário. */
export function isBusinessDay(date: Date): boolean {
  const dow = date.getUTCDay(); // 0 = domingo, 6 = sábado
  if (dow === 0 || dow === 6) return false;
  return !getHolidays(date.getUTCFullYear()).has(ymd(date));
}

/**
 * Ajusta a data para um dia útil, conforme a regra do imposto.
 *   PROXIMO_DIA_UTIL → avança (prorroga);  DIA_UTIL_ANTERIOR → recua (antecipa).
 * Se já for dia útil, retorna a própria data.
 */
export function adjustToBusinessDay(date: Date, mode: DueAdjust = "PROXIMO_DIA_UTIL"): Date {
  if (mode === "NENHUM") return date;
  const step = mode === "DIA_UTIL_ANTERIOR" ? -1 : 1;
  let d = new Date(date.getTime());
  let guard = 0;
  while (!isBusinessDay(d) && guard < 31) {
    d = addDays(d, step);
    guard++;
  }
  return d;
}
