import AppLayout from "@/components/AppLayout";
import { TaskTypeBadge, StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, RefreshCw, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const WEEKDAYS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

export default function MonthlyPanelPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const { data: panel = [], isLoading, refetch } = trpc.monthlyPanel.get.useQuery({ month, year });
  const generateMutation = trpc.tasks.generateMonthly.useMutation();
  const utils = trpc.useUtils();

  const prevMonth = () => { setSelectedDay(null); if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { setSelectedDay(null); if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const handleGenerate = async () => {
    try {
      const result = await generateMutation.mutateAsync({ month, year });
      toast.success(`${result.created} tarefa(s) gerada(s), ${result.skipped} já existiam`);
      utils.monthlyPanel.get.invalidate();
      utils.tasks.dashboard.invalidate();
      refetch();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao gerar tarefas");
    }
  };

  const allTasks = panel.flatMap((c) => c.tasks);
  const today = new Date();
  const competencia = `${String(month).padStart(2,"0")}/${year}`;

  // Stats
  const stats = {
    total: allTasks.length,
    pendente: allTasks.filter((t) => t.status === "PENDENTE").length,
    emAndamento: allTasks.filter((t) => t.status === "EM_ANDAMENTO").length,
    concluida: allTasks.filter((t) => t.status === "CONCLUIDA").length,
    vencida: allTasks.filter((t) => t.status === "VENCIDA").length,
  };
  const completionPct = stats.total > 0 ? Math.round((stats.concluida / stats.total) * 100) : 0;

  // Calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  // Map tasks by day
  // O servidor (Render) roda em UTC e salva o vencimento à meia-noite UTC
  // (ex: new Date(2026, 6, 20) → 2026-07-20T00:00:00Z). Por isso usamos
  // getUTCDate() para pegar o dia correto sem deslocamento de fuso.
  const tasksByDay = new Map<number, typeof allTasks>();
  allTasks.forEach((t) => {
    const d = new Date(t.dueDate).getUTCDate();
    if (!tasksByDay.has(d)) tasksByDay.set(d, []);
    tasksByDay.get(d)!.push(t);
  });

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  // Tarefas do dia selecionado — com nome do cliente
  const clientMap = new Map(panel.map((c) => [c.clientId, c.clientName]));
  const selectedDayTasks = selectedDay
    ? (tasksByDay.get(selectedDay) ?? []).map((t) => ({
        ...t,
        clientName: panel.find((c) => c.tasks.some((ct) => ct.taskId === t.taskId))?.clientName ?? "—",
      }))
    : [];

  const getDayColor = (dayTasks: typeof allTasks) => {
    if (!dayTasks.length) return null;
    if (dayTasks.some((t) => t.status === "VENCIDA" || (new Date(t.dueDate) < today && t.status !== "CONCLUIDA"))) return "#f87171";
    if (dayTasks.every((t) => t.status === "CONCLUIDA")) return "#4ade80";
    return "#60a5fa";
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#e5e5e5" }}>Painel Mensal</h1>
            <p className="text-sm mt-0.5" style={{ color: "#a1a1aa" }}>Visão consolidada de todas as obrigações</p>
          </div>
          <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="gap-2 text-sm"
            style={{ background: "rgba(36,100,108,0.2)", color: "#9fd4dc", border: "1px solid rgba(36,100,108,0.3)" }}>
            <Zap size={13} />
            {generateMutation.isPending ? "Gerando..." : "Gerar tarefas do mês"}
          </Button>
        </div>

        {/* Month navigator */}
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            style={{ border: "1px solid #1e4f5c", color: "#9fd4dc" }}>
            <ChevronLeft size={16} />
          </button>
          <div className="flex-1 text-center">
            <span className="text-lg font-bold" style={{ color: "#e5e5e5" }}>{MONTHS[month-1]} {year}</span>
            <span className="ml-3 text-xs font-mono" style={{ color: "#a1a1aa" }}>{competencia}</span>
          </div>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            style={{ border: "1px solid #1e4f5c", color: "#9fd4dc" }}>
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Calendar — always visible */}
        <div className="rounded-xl border overflow-hidden" style={{ background: "#111", borderColor: "#1e4f5c" }}>
          <div className="px-4 pt-4 pb-2">
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-center text-xs font-medium py-1" style={{ color: "#52525b" }}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, idx) => {
                if (!day) return <div key={idx} />;
                const dayTasks = tasksByDay.get(day) ?? [];
                const isToday = day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
                const dotColor = getDayColor(dayTasks);
                return (
                  <div key={idx} className="flex flex-col items-center justify-center rounded-lg py-1.5 cursor-pointer transition-all"
                    onClick={() => day && setSelectedDay(selectedDay === day ? null : day)}
                    style={{
                      background: selectedDay === day
                        ? "rgba(36,100,108,0.4)"
                        : isToday ? "rgba(36,100,108,0.25)" : "transparent",
                      border: selectedDay === day
                        ? "1px solid rgba(159,212,220,0.6)"
                        : isToday ? "1px solid rgba(36,100,108,0.5)" : "1px solid transparent",
                      minHeight: 44,
                    }}>
                    <span className="text-sm font-medium" style={{ color: isToday ? "#9fd4dc" : dayTasks.length > 0 ? "#e5e5e5" : "#3f3f46" }}>
                      {day}
                    </span>
                    {dotColor && (
                      <div className="flex gap-0.5 mt-0.5">
                        {dayTasks.slice(0, 3).map((_, i) => (
                          <div key={i} className="rounded-full" style={{ width: 4, height: 4, background: dotColor }} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Legend */}
          <div className="flex items-center justify-center gap-5 py-3 px-4" style={{ borderTop: "1px solid rgba(30,79,92,0.4)" }}>
            {[
              { color: "#60a5fa", label: "Pendente" },
              { color: "#f87171", label: "Vencida" },
              { color: "#4ade80", label: "Concluída" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
                <span className="text-xs" style={{ color: "#52525b" }}>{l.label}</span>
              </div>
            ))}
            {selectedDay && (
              <button onClick={() => setSelectedDay(null)} className="ml-4 text-xs hover:underline" style={{ color: "#52525b" }}>
                Limpar seleção
              </button>
            )}
          </div>
        </div>

        {/* Painel do dia selecionado */}
        {selectedDay && (
          <div className="rounded-xl border overflow-hidden" style={{ background: "#111", borderColor: "#9fd4dc" }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(159,212,220,0.2)", background: "rgba(36,100,108,0.15)" }}>
              <span className="text-sm font-semibold" style={{ color: "#9fd4dc" }}>
                📅 Dia {selectedDay} de {MONTHS[month - 1]} — {selectedDayTasks.length} tarefa{selectedDayTasks.length !== 1 ? "s" : ""}
              </span>
              <button onClick={() => setSelectedDay(null)} className="text-xs hover:underline" style={{ color: "#52525b" }}>Fechar ×</button>
            </div>
            {selectedDayTasks.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm" style={{ color: "#52525b" }}>Nenhuma tarefa neste dia</div>
            ) : (
              <div className="divide-y" style={{ borderColor: "rgba(30,79,92,0.3)" }}>
                {selectedDayTasks.map((task) => {
                  const due = new Date(task.dueDate);
                  const isOverdue = due < today && task.status !== "CONCLUIDA" && task.status !== "CANCELADA";
                  return (
                    <Link key={task.taskId} href={`/tarefas/${task.taskId}`}>
                      <div className="flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3">
                          <TaskTypeBadge type={task.taskType} />
                          <div>
                            <p className="text-sm font-medium" style={{ color: "#e5e5e5" }}>{task.title}</p>
                            <p className="text-xs mt-0.5" style={{ color: "#a1a1aa" }}>{task.clientName}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs" style={{ color: isOverdue ? "#f87171" : "#52525b" }}>
                            {due.toLocaleDateString("pt-BR")}
                          </span>
                          <StatusBadge status={task.status} dueDate={task.dueDate} />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}


        {/* Progress bar — only if tasks exist */}
        {stats.total > 0 && (
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
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${completionPct}%`, background: completionPct === 100 ? "#4ade80" : "linear-gradient(90deg,#24646c,#9fd4dc)" }} />
            </div>
            <div className="grid grid-cols-4 gap-2 pt-1">
              {[
                { label: "Pendentes", value: stats.pendente, color: "#facc15" },
                { label: "Andamento", value: stats.emAndamento, color: "#60a5fa" },
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

        {/* Clients panel */}
        {isLoading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "#1a1a1a" }} />)}</div>
        ) : panel.length === 0 ? (
          <div className="text-center py-10 rounded-xl border" style={{ borderColor: "#1e4f5c", background: "#111" }}>
            <CalendarDays size={32} className="mx-auto mb-3" style={{ color: "#52525b" }} />
            <p className="text-sm font-medium" style={{ color: "#a1a1aa" }}>Nenhuma tarefa para {MONTHS[month-1]} {year}</p>
            <p className="text-xs mt-1 mb-4" style={{ color: "#52525b" }}>Clique em "Gerar tarefas do mês" para criar as obrigações</p>
            <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="gap-2 text-sm"
              style={{ background: "#24646c", color: "#fff" }}>
              <Zap size={13} />{generateMutation.isPending ? "Gerando..." : "Gerar agora"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {panel.map((client) => {
              const cs = {
                total: client.tasks.length,
                concluida: client.tasks.filter((t) => t.status === "CONCLUIDA").length,
                vencida: client.tasks.filter((t) => t.status === "VENCIDA").length,
              };
              const allDone = cs.concluida === cs.total;
              return (
                <div key={client.clientId} className="rounded-xl border overflow-hidden"
                  style={{ background: "#111", borderColor: cs.vencida > 0 ? "rgba(248,113,113,0.4)" : allDone ? "rgba(74,222,128,0.3)" : "#1e4f5c" }}>
                  <div className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: "1px solid rgba(30,79,92,0.4)", background: "rgba(0,0,0,0.2)" }}>
                    <div className="flex items-center gap-2">
                      <Link href={`/clientes/${client.clientId}`}>
                        <span className="font-semibold text-sm cursor-pointer hover:underline" style={{ color: "#e5e5e5" }}>
                          {client.clientName}
                        </span>
                      </Link>
                      {allDone && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80" }}>✓ Tudo concluído</span>}
                      {cs.vencida > 0 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}>{cs.vencida} vencida(s)</span>}
                    </div>
                    <span className="text-xs" style={{ color: "#52525b" }}>{cs.concluida}/{cs.total}</span>
                  </div>
                  <div className="divide-y" style={{ borderColor: "rgba(30,79,92,0.2)" }}>
                    {client.tasks.map((task) => {
                      const due = new Date(task.dueDate);
                      const isOverdue = due < today && task.status !== "CONCLUIDA";
                      const StatusIcon = task.status === "CONCLUIDA" ? CheckCircle2 : isOverdue ? AlertCircle : Clock;
                      const statusColor = task.status === "CONCLUIDA" ? "#4ade80" : isOverdue ? "#f87171" : task.status === "EM_ANDAMENTO" ? "#60a5fa" : "#facc15";
                      return (
                        <Link key={task.taskId} href={`/tarefas/${task.taskId}`}>
                          <div className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-white/3 transition-colors">
                            <div className="flex items-center gap-3">
                              <StatusIcon size={13} style={{ color: statusColor }} />
                              <TaskTypeBadge type={task.taskType} />
                              <span className="text-sm" style={{ color: "#e5e5e5" }}>{task.title}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs" style={{ color: isOverdue ? "#f87171" : "#52525b" }}>
                                {due.toLocaleDateString("pt-BR")}
                              </span>
                              <StatusBadge status={task.status} dueDate={task.dueDate} />
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
