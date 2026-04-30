type TaskStatus = "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA" | "VENCIDA";
type TaskType = "DAS" | "NFS" | "DCTF" | "SPED" | "OUTROS";

const statusConfig: Record<TaskStatus, { label: string; bg: string; color: string; border: string }> = {
  PENDENTE: { label: "Pendente", bg: "rgba(234,179,8,0.12)", color: "#facc15", border: "rgba(234,179,8,0.3)" },
  EM_ANDAMENTO: { label: "Em Andamento", bg: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "rgba(59,130,246,0.3)" },
  CONCLUIDA: { label: "Concluída", bg: "rgba(34,197,94,0.12)", color: "#4ade80", border: "rgba(34,197,94,0.3)" },
  VENCIDA: { label: "Vencida", bg: "rgba(239,68,68,0.12)", color: "#f87171", border: "rgba(239,68,68,0.3)" },
};

const typeConfig: Record<TaskType, { bg: string; color: string; border: string }> = {
  DAS: { bg: "rgba(36,100,108,0.2)", color: "#9fd4dc", border: "rgba(36,100,108,0.4)" },
  NFS: { bg: "rgba(40,124,144,0.2)", color: "#c5e4ea", border: "rgba(40,124,144,0.4)" },
  DCTF: { bg: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "rgba(99,102,241,0.3)" },
  SPED: { bg: "rgba(168,85,247,0.15)", color: "#c4b5fd", border: "rgba(168,85,247,0.3)" },
  OUTROS: { bg: "rgba(82,82,91,0.2)", color: "#a1a1aa", border: "rgba(82,82,91,0.4)" },
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const cfg = statusConfig[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      {cfg.label}
    </span>
  );
}

export function TaskTypeBadge({ type }: { type: TaskType }) {
  const cfg = typeConfig[type];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      {type}
    </span>
  );
}
