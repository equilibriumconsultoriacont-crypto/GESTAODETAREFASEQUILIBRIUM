import AppLayout from "@/components/AppLayout";
import { TaskTypeBadge, StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, RefreshCw, Zap, AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  PENDENTE:     { label: "Pendente",     color: "#facc15", bg: "rgba(250,204,21,0.1)",  border: "rgba(250,204,21,0.3)",  icon: Clock },
  EM_ANDAMENTO: { label: "Em andamento", color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.3)",  icon: RefreshCw },
  CONCLUIDA:    { label: "Concluída",    color: "#4ade80", bg: "rgba(74,222,128,0.1)",  border: "rgba(74,222,128,0.3)",  icon: CheckCircle2 },
  VENCIDA:      { label: "Vencida",      color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)", icon: AlertCircle },
};

export default function MonthlyPanelPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: panel = [], isLoading, refetch } = trpc.monthlyPanel.get.useQuery({ month, year });
  const generateMutation = trpc.tasks.generateMonthly.useMutation();
  const utils = trpc.useUtils();

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const handleGenerate = async () => {
    try {
      const result = await generateMutation.mutateAsync({ month, year });
      toast.success(`${result.created} tarefa(s) gerada(s), ${result.skipped} ignorada(s)`);
      utils.monthlyPanel.get.invalidate();
      utils.tasks.dashboard.invalidate();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao gerar tarefas");
    }
  };

  const competencia = `${String(month).padStart(2, "0")}/${year}`;

  // Aggregate stats
  const allTasks = panel.flatMap((c) => c.tasks);
  const stats = {
    total: allTasks.length,
    pendente: allTasks.filter((t) => t.status === "PENDENTE").length,
    emAndamento: allTasks.filter((t) => t.status === "EM_ANDAMENTO").length,
    concluida: allTasks.filter((t) => t.status === "CONCLUIDA").length,
    vencida: allTasks.filter((t) => t.status === "VENCIDA").length,
  };

  const completionPct = stats.total > 0 ? Math.round((stats.concluida / stats.total) * 100) : 0;

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#e5e5e5" }}>Painel Mensal</h1>
            <p className="text-sm mt-0.5" style={{ color: "#a1a1aa" }}>
              Visão consolidada de todas as obrigações por competência
            </p>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="gap-2 text-sm"
            style={{ background: "rgba(36,100,108,0.2)", color: "#9fd4dc", border: "1px solid rgba(36,100,108,0.3)" }}
          >
            <Zap size={13} />
            {generateMutation.isPending ? "Gerando..." : "Gerar tarefas do mês"}
          </Button>
        </div>

        {/* Month navigator */}
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            style={{ border: "1px solid #1e4f5c", color: "#9fd4dc" }}
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex-1 text-center">
            <span className="text-lg font-bold" style={{ color: "#e5e5e5" }}>
              {MONTHS[month - 1]} {year}
            </span>
            <span className="ml-3 text-xs font-mono" style={{ color: "#a1a1aa" }}>{competencia}</span>
          </div>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            style={{ border: "1px solid #1e4f5c", color: "#9fd4dc" }}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Stats */}
        {!isLoading && stats.total > 0 && (
          <div className="rounded-xl border p-4 space-y-3" style={{ background: "#111", borderColor: "#1e4f5c" }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: "#e5e5e5" }}>
                Progresso — {stats.concluida}/{stats.total} concluídas
              </span>
              <span className="text-sm font-bold" style={{ color: completionPct === 100 ? "#4ade80" : "#9fd4dc" }}>
                {completionPct}%
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${completionPct}%`,
                  background: completionPct === 100 ? "#4ade80" : "linear-gradient(90deg, #24646c, #9fd4dc)",
                }}
              />
            </div>
            <div className="grid grid-cols-4 gap-2 pt-1">
              {[
                { label: "Pendentes", value: stats.pendente, color: "#facc15" },
                { label: "Em andamento", value: stats.emAndamento, color: "#60a5fa" },
                { label: "Concluídas", value: stats.concluida, color: "#4ade80" },
                { label: "Vencidas", value: stats.vencida, color: "#f87171" },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs" style={{ color: "#52525b" }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Panel */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "#1a1a1a" }} />
            ))}
          </div>
        ) : panel.length === 0 ? (
          <div className="text-center py-16 rounded-xl border" style={{ borderColor: "#1e4f5c", background: "#111" }}>
            <CalendarDays size={36} className="mx-auto mb-3" style={{ color: "#52525b" }} />
            <p className="text-sm font-medium" style={{ color: "#a1a1aa" }}>
              Nenhuma tarefa para {MONTHS[month - 1]} {year}
            </p>
            <p className="text-xs mt-1" style={{ color: "#52525b" }}>
              Use o botão "Gerar tarefas do mês" para criar as obrigações desta competência
            </p>
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="mt-4 gap-2 text-sm"
              style={{ background: "#24646c", color: "#fff" }}
            >
              <Zap size={13} />
              {generateMutation.isPending ? "Gerando..." : "Gerar agora"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {panel.map((client) => {
              const clientStats = {
                total: client.tasks.length,
                concluida: client.tasks.filter((t) => t.status === "CONCLUIDA").length,
                vencida: client.tasks.filter((t) => t.status === "VENCIDA").length,
              };
              const allDone = clientStats.concluida === clientStats.total;
              const hasOverdue = clientStats.vencida > 0;

              return (
                <div
                  key={client.clientId}
                  className="rounded-xl border overflow-hidden"
                  style={{
                    background: "#111",
                    borderColor: hasOverdue ? "rgba(248,113,113,0.4)" : allDone ? "rgba(74,222,128,0.3)" : "#1e4f5c",
                  }}
                >
                  {/* Client header */}
                  <div
                    className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: "1px solid rgba(30,79,92,0.4)", background: "rgba(0,0,0,0.2)" }}
                  >
                    <div className="flex items-center gap-2">
                      <Link href={`/clientes/${client.clientId}`}>
                        <span
                          className="font-semibold text-sm cursor-pointer hover:underline"
                          style={{ color: "#e5e5e5" }}
                        >
                          {client.clientName}
                        </span>
                      </Link>
                      {allDone && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}>
                          ✓ Tudo concluído
                        </span>
                      )}
                      {hasOverdue && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}>
                          {clientStats.vencida} vencida(s)
                        </span>
                      )}
                    </div>
                    <span className="text-xs" style={{ color: "#52525b" }}>
                      {clientStats.concluida}/{clientStats.total}
                    </span>
                  </div>

                  {/* Tasks */}
                  <div className="divide-y" style={{ borderColor: "rgba(30,79,92,0.2)" }}>
                    {client.tasks.map((task) => {
                      const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.PENDENTE;
                      const Icon = cfg.icon;
                      const due = new Date(task.dueDate);
                      const duePast = due < new Date() && task.status !== "CONCLUIDA";

                      return (
                        <Link key={task.taskId} href={`/tarefas/${task.taskId}`}>
                          <div
                            className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-white/3 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <Icon size={13} style={{ color: cfg.color }} />
                              <TaskTypeBadge type={task.taskType} />
                              <span className="text-sm" style={{ color: "#e5e5e5" }}>{task.title}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span
                                className="text-xs"
                                style={{ color: duePast ? "#f87171" : "#52525b" }}
                              >
                                Vence {due.toLocaleDateString("pt-BR")}
                              </span>
                              <span
                                className="text-xs px-2 py-0.5 rounded"
                                style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                              >
                                {cfg.label}
                              </span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
