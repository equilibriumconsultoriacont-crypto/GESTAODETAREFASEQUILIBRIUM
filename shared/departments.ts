// Fonte única de verdade para departamentos.
//
// Histórico: o sistema nasceu com CÓDIGOS em maiúsculo (FISCAL, CONTABIL, DP, ...)
// e depois passou a usar uma tabela `departments` com NOMES capitalizados
// (Fiscal, Contábil, Pessoal, ...). Ficaram os dois formatos convivendo no banco:
// tarefas criadas manualmente guardavam o código; tarefas geradas guardavam o nome.
// Isso quebrava o filtro de visibilidade por departamento e o badge (que caía no
// default "Geral"). Este normalizador aceita QUALQUER um dos formatos e devolve o
// NOME canônico, para que filtro, badge e RBAC funcionem independ
// do que está gravado. Também aceita departamentos customizados (nome livre).

// Nome canônico → cor. Bate com o seed da tabela `departments`.
export const DEPARTMENT_COLORS: Record<string, string> = {
  "Fiscal": "#9fd4dc",
  "Contábil": "#c084fc",
  "Pessoal": "#fb923c",
  "Societário": "#4ade80",
  "Financeiro": "#facc15",
  "Geral": "#a1a1aa",
};

// Código legado (maiúsculo, sem acento) → nome canônico.
const LEGACY_CODE_TO_NAME: Record<string, string> = {
  "FISCAL": "Fiscal",
  "CONTABIL": "Contábil",
  "DP": "Pessoal",
  "SOCIETARIO": "Societário",
  "FINANCEIRO": "Financeiro",
  "GERAL": "Geral",
};

const DEFAULT_DEPARTMENT = "Geral";
const DEFAULT_COLOR = "#a1a1aa";

/**
 * Devolve o NOME canônico do departamento, aceitando código legado ou nome.
 * Vazio/desconhecido → "Geral". Nome customizado é preservado como veio.
 */
export function normalizeDepartment(raw?: string | null): string {
  if (!raw) return DEFAULT_DEPARTMENT;
  const trimmed = String(raw).trim();
  if (!trimmed) return DEFAULT_DEPARTMENT;
  const legacy = LEGACY_CODE_TO_NAME[trimmed.toUpperCase()];
  if (legacy) return legacy;
  return trimmed;
}

/** Cor do departamento (aceita código ou nome). Departamento desconhecido → cinza neutro. */
export function departmentColor(raw?: string | null): string {
  return DEPARTMENT_COLORS[normalizeDepartment(raw)] ?? DEFAULT_COLOR;
}
