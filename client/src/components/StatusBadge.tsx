export type TaskStatus =
  | "PENDENTE"
  | "EM_ANDAMENTO"
  | "AGUARDANDO_CLIENTE"
  | "EM_REVISAO"
  | "CONCLUIDA"
  | "CANCELADA"
  | "VENCIDA";

export type TaskType = "DAS" | "NFS" | "DCTF" | "SPED" | "OUTROS" | "PIS" | "COFINS" | "ICMS" | "ISSQN";
export type Department = "FISCAL" | "CONTABIL" | "DP" | "SOCIETARIO" | "FINANCEIRO" | "GERAL";
export type Priority = "BAIXA" | "NORMAL" | "ALTA" | "URGENTE";

export const STATUS_CONFIG: Record<TaskStatus, { label: string; bg: string; color: string; border: string; emoji: string }> = {
  PENDENTE:           { label: "Pendente",          bg: "rgba(234,179,8,0.12)",  color: "#facc15", border: "rgba(234,179,8,0.3)",  emoji: "⏳" },
  EM_ANDAMENTO:       { label: "Em Andamento",       bg: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "rgba(59,130,246,0.3)", emoji: "🔄" },
  AGUARDANDO_CLIENTE: { label: "Aguard. Cliente",    bg: "rgba(251,146,60,0.12)", color: "#fb923c", border: "rgba(251,146,60,0.3)", emoji: "🕐" },
  EM_REVISAO:         { label: "Em Revisão",         bg: "rgba(168,85,247,0.12)", color: "#c084fc", border: "rgba(168,85,247,0.3)", emoji: "🔍" },
  CONCLUIDA:          { label: "Concluída",          bg: "rgba(34,197,94,0.12)",  color: "#4ade80", border: "rgba(34,197,94,0.3)",  emoji: "✅" },
  CANCELADA:          { label: "Cancelada",          bg: "rgba(82,82,91,0.15)",   color: "#a1a1aa", border: "rgba(82,82,91,0.3)",   emoji: "🚫" },
  VENCIDA:            { label: "Vencida",            bg: "rgba(239,68,68,0.12)",  color: "#f87171", border: "rgba(239,68,68,0.3)",  emoji: "🚨" },
};

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string }> = {
  BAIXA:   { label: "Baixa",   color: "#a1a1aa", bg: "rgba(82,82,91,0.15)"   },
  NORMAL:  { label: "Normal",  color: "#60a5fa", bg: "rgba(59,130,246,0.1)"  },
  ALTA:    { label: "Alta",    color: "#fb923c", bg: "rgba(251,146,60,0.1)"  },
  URGENTE: { label: "Urgente", color: "#f87171", bg: "rgba(239,68,68,0.12)"  },
};

export const DEPARTMENT_CONFIG: Record<Department, { label: string; color: string }> = {
  FISCAL:     { label: "Fiscal",     color: "#9fd4dc" },
  CONTABIL:   { label: "Contábil",   color: "#c084fc" },
  DP:         { label: "DP",         color: "#fb923c" },
  SOCIETARIO: { label: "Societário", color: "#4ade80" },
  FINANCEIRO: { label: "Financeiro", color: "#facc15" },
  GERAL:      { label: "Geral",      color: "#a1a1aa" },
};

const typeConfig: Record<TaskType, { bg: string; color: string; border: string }> = {
  DAS:    { bg: "rgba(36,100,108,0.2)",  color: "#9fd4dc", border: "rgba(36,100,108,0.4)"  },
  NFS:    { bg: "rgba(40,124,144,0.2)",  color: "#c5e4ea", border: "rgba(40,124,144,0.4)"  },
  DCTF:   { bg: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "rgba(99,102,241,0.3)"  },
  SPED:   { bg: "rgba(168,85,247,0.15)", color: "#c4b5fd", border: "rgba(168,85,247,0.3)"  },
  OUTROS: { bg: "rgba(82,82,91,0.2)",    color: "#a1a1aa", border: "rgba(82,82,91,0.4)"    },
  PIS:    { bg: "rgba(245,158,11,0.15)", color: "#fcd34d", border: "rgba(245,158,11,0.3)"  },
  COFINS: { bg: "rgba(234,88,12,0.15)",  color: "#fdba74", border: "rgba(234,88,12,0.3)"   },
  ICMS:   { bg: "rgba(34,197,94,0.15)",  color: "#86efac", border: "rgba(34,197,94,0.3)"   },
  ISSQN:  { bg: "rgba(14,165,233,0.15)", color: "#7dd3fc", border: "rgba(14,165,233,0.3)"  },
};

type BadgeStyle = { label: string; bg: string; color: string; border: string; emoji: string };

function resolveLabel(
  status: TaskStatus,
  dueDate?: string | Date | null,
  completedAt?: string | Date | null
): BadgeStyle {
  const base = STATUS_CONFIG[status];
  const active: TaskStatus[] = ["PENDENTE", "EM_ANDAMENTO", "AGUARDANDO_CLIENTE", "EM_REVISAO"];

  if (active.includes(status) && dueDate) {
    // Normaliza dueDate para meia-noite no horário local (evita problema de timezone)
    const rawDue = new Date(dueDate);
    const due = new Date(rawDue.getFullYear(), rawDue.getMonth(), rawDue.getDate());

    // Hoje à meia-noite (para comparação por dia, não por hora)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Já venceu (dia do vencimento já passou)
    if (due < today) {
      return {
        label: `${base.label} Vencida`,
        bg: "rgba(239,68,68,0.12)",
        color: "#f87171",
        border: "rgba(239,68,68,0.3)",
        emoji: "🚨",
      };
    }

    // Vence hoje
    if (due.getTime() === today.getTime()) {
      return {
        label: `${base.label} — Vence Hoje`,
        bg: "rgba(239,68,68,0.15)",
        color: "#f87171",
        border: "rgba(239,68,68,0.4)",
        emoji: "⚠️",
      };
    }

    // Próxima do vencimento (nos próximos 5 dias)
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 5) {
      return {
        label: `${base.label} — Vence em ${diffDays}d`,
        bg: "rgba(251,146,60,0.12)",
        color: "#fb923c",
        border: "rgba(251,146,60,0.3)",
        emoji: "⏰",
      };
    }
  }

  // Tarefa concluída — no prazo ou em atraso
  if (status === "CONCLUIDA" && dueDate) {
    const due = new Date(dueDate);
    const done = completedAt ? new Date(completedAt) : null;
    if (done && done <= due) {
      return { label: "Concluída no Prazo", bg: "rgba(34,197,94,0.15)",  color: "#4ade80", border: "rgba(34,197,94,0.4)",  emoji: "✅" };
    }
    if (done && done > due) {
      return { label: "Concluída em Atraso", bg: "rgba(234,179,8,0.12)", color: "#facc15", border: "rgba(234,179,8,0.3)",  emoji: "⚠️" };
    }
  }

  return base;
}

export function StatusBadge({
  status,
  dueDate,
  completedAt,
}: {
  status: TaskStatus | string;
  dueDate?: string | Date | null;
  completedAt?: string | Date | null;
}) {
  const s = (status as TaskStatus) in STATUS_CONFIG ? (status as TaskStatus) : "PENDENTE";
  const cfg = resolveLabel(s, dueDate, completedAt);
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      <span>{cfg.emoji}</span>{cfg.label}
    </span>
  );
}

export function TaskTypeBadge({ type }: { type: TaskType | string }) {
  const cfg = typeConfig[type as TaskType] ?? typeConfig.OUTROS;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {type}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority | string }) {
  const cfg = PRIORITY_CONFIG[priority as Priority] ?? PRIORITY_CONFIG.NORMAL;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

export function DepartmentBadge({ department }: { department: Department | string }) {
  const cfg = DEPARTMENT_CONFIG[department as Department] ?? DEPARTMENT_CONFIG.GERAL;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: "rgba(255,255,255,0.05)", color: cfg.color, border: "1px solid rgba(255,255,255,0.08)" }}>
      {cfg.label}
    </span>
  );
}
