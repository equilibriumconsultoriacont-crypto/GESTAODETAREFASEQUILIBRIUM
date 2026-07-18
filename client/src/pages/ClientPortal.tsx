import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  LogOut,
  X,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Datas são armazenadas em UTC (meia-noite UTC no banco). Exibir e agrupar
// sempre em UTC — caso contrário o fuso do navegador (Brasil = UTC-3) empurra
// o dia para trás (ex.: vencimento dia 20 aparece como 19).
function formatBR(d: Date | string): string {
  const dt = new Date(d);
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${dt.getUTCFullYear()}`;
}

interface Task {
  id: number;
  title: string;
  taskType: string;
  status: string;
  dueDate: Date | string;
  competencia: string;
}

function TaskDrawer({ task, onClose, previewClientId }: { task: Task; onClose: () => void; previewClientId?: number }) {
  const { data: files = [], isLoading } = trpc.clientPortal.taskFiles.useQuery({ taskId: task.id, previewClientId });
  const due = new Date(task.dueDate);
  const isOverdue = due < new Date() && task.status !== "CONCLUIDA";

  const handleDownload = async (fileId: number, filename: string) => {
    try {
      // Open file URL directly
      window.open(`/api/portal/file/${task.id}/${fileId}`, "_blank");
    } catch {
      toast.error("Erro ao baixar arquivo");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="rounded-t-3xl p-6 space-y-5 max-h-[80vh] overflow-y-auto"
        style={{ background: "#111", borderTop: "1px solid #1e4f5c" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center -mt-2 mb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: "#3f3f46" }} />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: "#9fd4dc" }}>{task.taskType}</p>
            <h2 className="text-lg font-bold" style={{ color: "#e5e5e5" }}>{task.title}</h2>
            <p className="text-sm mt-1" style={{ color: "#a1a1aa" }}>Competência {task.competencia}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "#a1a1aa" }}>
            <X size={18} />
          </button>
        </div>

        {/* Status + Due date */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3 text-center" style={{ background: "rgba(36,100,108,0.1)", border: "1px solid rgba(36,100,108,0.2)" }}>
            <p className="text-xs mb-1" style={{ color: "#52525b" }}>Vencimento</p>
            <p className="text-sm font-semibold" style={{ color: isOverdue ? "#f87171" : "#e5e5e5" }}>
              {formatBR(due)}
            </p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: "rgba(36,100,108,0.1)", border: "1px solid rgba(36,100,108,0.2)" }}>
            <p className="text-xs mb-1" style={{ color: "#52525b" }}>Situação</p>
            <p
              className="text-sm font-semibold"
              style={{
                color: task.status === "CONCLUIDA" ? "#4ade80"
                  : task.status === "VENCIDA" ? "#f87171"
                  : task.status === "EM_ANDAMENTO" ? "#60a5fa"
                  : "#facc15",
              }}
            >
              {task.status === "CONCLUIDA" ? "Concluída"
                : task.status === "VENCIDA" ? "Vencida"
                : task.status === "EM_ANDAMENTO" ? "Em andamento"
                : "Pendente"}
            </p>
          </div>
        </div>

        {/* Files */}
        <div>
          <p className="text-sm font-medium mb-3" style={{ color: "#e5e5e5" }}>
            Documentos disponíveis
          </p>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(2)].map((_, i) => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: "#1a1a1a" }} />)}
            </div>
          ) : files.length === 0 ? (
            <div
              className="rounded-xl p-5 text-center"
              style={{ background: "rgba(82,82,91,0.1)", border: "1px dashed #3f3f46" }}
            >
              <FileText size={24} className="mx-auto mb-2" style={{ color: "#52525b" }} />
              <p className="text-sm" style={{ color: "#a1a1aa" }}>Nenhum documento disponível ainda</p>
              <p className="text-xs mt-1" style={{ color: "#52525b" }}>
                O documento será disponibilizado em breve
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <a
                  key={file.id}
                  href={file.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-xl active:opacity-70 transition-opacity"
                  style={{ background: "rgba(36,100,108,0.1)", border: "1px solid rgba(36,100,108,0.25)" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(36,100,108,0.3)" }}>
                      <FileText size={16} style={{ color: "#9fd4dc" }} />
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "#e5e5e5" }}>{file.filename}</p>
                      <p className="text-xs" style={{ color: "#52525b" }}>
                        {file.fileSize ? `${(file.fileSize / 1024).toFixed(0)} KB` : "PDF"}
                      </p>
                    </div>
                  </div>
                  <Download size={16} style={{ color: "#9fd4dc" }} />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FinancialsView({ month, year, previewClientId }: { month: number; year: number; previewClientId?: number }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.clientPortal.financials.useQuery({ month, year, previewClientId });
  const setRevenue = (trpc.clientPortal as any).setRevenue.useMutation({
    onSuccess: () => utils.clientPortal.financials.invalidate(),
  });
  const isStaff = !!previewClientId; // em pré-visualização, a equipe pode lançar o faturamento
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");

  const fmt = (v: string | null | undefined) => {
    if (v === null || v === undefined || v === "") return "—";
    const n = Number(v);
    if (isNaN(n)) return String(v);
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const taxes = data?.taxes ?? [];
  const totalImpostos = taxes.reduce((s: number, t: any) => s + (Number(t.valor) || 0), 0);

  return (
    <div className="px-2 pb-6 space-y-4">
      {/* Faturamento */}
      <div className="rounded-2xl p-4" style={{ background: "#111", border: "1px solid #1e4f5c" }}>
        <p className="text-xs" style={{ color: "#9fd4dc" }}>Faturamento do mês</p>
        {isStaff && editing ? (
          <div className="flex gap-2 mt-2">
            <input
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder="0,00"
              style={{ flex: 1, background: "#0d1f22", border: "1px solid #1e4f5c", borderRadius: 8, color: "#e5e5e5", padding: "8px 10px", outline: "none" }}
            />
            <button
              onClick={async () => { try { await setRevenue.mutateAsync({ clientId: previewClientId!, year, month, valor: val }); setEditing(false); } catch { /* */ } }}
              disabled={setRevenue.isPending}
              style={{ background: "#24646c", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 13 }}
            >Salvar</button>
          </div>
        ) : (
          <div className="flex items-center justify-between mt-1">
            <p className="text-2xl font-bold" style={{ color: "#e5e5e5" }}>{fmt(data?.revenue)}</p>
            {isStaff && (
              <button onClick={() => { setVal(data?.revenue ?? ""); setEditing(true); }}
                style={{ color: "#9fd4dc", border: "1px solid rgba(36,100,108,0.3)", borderRadius: 6, padding: "4px 10px", fontSize: 12 }}>Lançar</button>
            )}
          </div>
        )}
      </div>

      {/* Impostos */}
      <div className="rounded-2xl p-4" style={{ background: "#111", border: "1px solid #1e4f5c" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs" style={{ color: "#9fd4dc" }}>Impostos do mês</p>
          <p className="text-sm font-bold" style={{ color: "#e5e5e5" }}>{fmt(String(totalImpostos))}</p>
        </div>
        {isLoading ? (
          <p className="text-sm" style={{ color: "#52525b" }}>Carregando...</p>
        ) : taxes.length === 0 ? (
          <p className="text-sm" style={{ color: "#52525b" }}>Nenhuma guia disparada este mês.</p>
        ) : (
          <div className="space-y-1">
            {taxes.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid rgba(30,79,92,0.3)" }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: "#e5e5e5" }}>{t.title}</p>
                  <p className="text-xs" style={{ color: "#52525b" }}>{t.taskType}</p>
                </div>
                <p className="text-sm font-semibold" style={{ color: t.valor ? "#e5e5e5" : "#52525b" }}>{fmt(t.valor)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClientPortal({ previewClientId }: { previewClientId?: number }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [view, setView] = useState<"calendar" | "financials">("calendar");
  const [, navigate] = useLocation();

  const { data: tasks = [], isLoading } = trpc.clientPortal.calendar.useQuery({ month, year, previewClientId });
  const { data: user } = trpc.auth.me.useQuery();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => navigate("/login"),
  });

  const prevMonth = () => {
    setSelectedDay(null);
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    setSelectedDay(null);
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();

  // Map tasks by day of month
  const tasksByDay = new Map<number, Task[]>();
  tasks.forEach((task) => {
    const due = new Date(task.dueDate);
    const day = due.getUTCDate();
    if (!tasksByDay.has(day)) tasksByDay.set(day, []);
    tasksByDay.get(day)!.push(task as Task);
  });

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0a0a0a", maxWidth: 480, margin: "0 auto" }}>
      {previewClientId && (
        <div style={{ background: "#24646c", color: "#fff", textAlign: "center", padding: "6px 12px", fontSize: 12, fontWeight: 600 }}>
          Pré-visualização — você está vendo o portal como o cliente
        </div>
      )}
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-safe-top" style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Equilíbrio" className="w-8 h-8 object-contain" />
            <div>
              <p className="text-sm font-semibold" style={{ color: "#e5e5e5" }}>Portal do Cliente</p>
              <p className="text-xs" style={{ color: "#52525b" }}>{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => logoutMutation.mutate()}
            className="p-2 rounded-full"
            style={{ background: "rgba(255,255,255,0.05)", color: "#a1a1aa" }}
          >
            <LogOut size={16} />
          </button>
        </div>

        {/* Month navigator */}
        <div className="flex items-center justify-between pb-4">
          <button onClick={prevMonth} className="p-2 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "#9fd4dc" }}>
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <p className="text-base font-bold" style={{ color: "#e5e5e5" }}>{MONTHS[month - 1]} {year}</p>
            <p className="text-xs" style={{ color: "#52525b" }}>
              {tasks.length} obrigaç{tasks.length !== 1 ? "ões" : "ão"} neste mês
            </p>
          </div>
          <button onClick={nextMonth} className="p-2 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "#9fd4dc" }}>
            <ChevronRight size={18} />
          </button>
        </div>

        {/* View switcher */}
        <div className="flex gap-2 pb-3">
          <button onClick={() => setView("calendar")} className="flex-1 py-2 rounded-lg text-xs font-semibold" style={{ background: view === "calendar" ? "#24646c" : "rgba(255,255,255,0.05)", color: view === "calendar" ? "#fff" : "#a1a1aa" }}>Calendário</button>
          <button onClick={() => setView("financials")} className="flex-1 py-2 rounded-lg text-xs font-semibold" style={{ background: view === "financials" ? "#24646c" : "rgba(255,255,255,0.05)", color: view === "financials" ? "#fff" : "#a1a1aa" }}>Faturamento e Imposto</button>
        </div>

        {/* Weekday headers */}
        {view === "calendar" && (
        <div className="grid grid-cols-7 pb-2">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-center text-xs font-medium py-1" style={{ color: "#52525b" }}>{d}</div>
          ))}
        </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 px-2 pb-6">
        {view === "financials" ? (
          <FinancialsView month={month} year={year} previewClientId={previewClientId} />
        ) : (
          <>
        {isLoading ? (
          <div className="grid grid-cols-7 gap-1 p-2">
            {Array(35).fill(0).map((_, i) => (
              <div key={i} className="aspect-square rounded-xl animate-pulse" style={{ background: "#1a1a1a" }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1 p-2">
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} />;

              const dayTasks = tasksByDay.get(day) ?? [];
              const isToday = day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();

              const hasOverdue = dayTasks.some((t) => t.status === "VENCIDA" || (new Date(t.dueDate) < today && t.status !== "CONCLUIDA"));
              const hasActive = dayTasks.some((t) => !hasOverdue && (t.status === "PENDENTE" || t.status === "EM_ANDAMENTO"));
              const allDone = dayTasks.length > 0 && dayTasks.every((t) => t.status === "CONCLUIDA");

              const dotColor = hasOverdue ? "#f87171" : allDone ? "#4ade80" : hasActive ? "#60a5fa" : null;

              return (
                <button
                  key={idx}
                  onClick={() => dayTasks.length > 0 && setSelectedDay(selectedDay === day ? null : day)}
                  className="flex flex-col items-center justify-center aspect-square rounded-xl relative transition-all active:scale-95"
                  style={{
                    background: selectedDay === day
                      ? "rgba(36,100,108,0.35)"
                      : isToday
                      ? "rgba(36,100,108,0.25)"
                      : dayTasks.length > 0
                      ? "rgba(255,255,255,0.03)"
                      : "transparent",
                    border: (selectedDay === day || isToday) ? "1px solid rgba(36,100,108,0.5)" : "1px solid transparent",
                    cursor: dayTasks.length > 0 ? "pointer" : "default",
                  }}
                >
                  <span
                    className="text-sm font-medium"
                    style={{
                      color: isToday ? "#9fd4dc" : dayTasks.length > 0 ? "#e5e5e5" : "#3f3f46",
                    }}
                  >
                    {day}
                  </span>
                  {dotColor && (
                    <div className="flex gap-0.5 mt-0.5">
                      {dayTasks.slice(0, 3).map((_, i) => (
                        <div
                          key={i}
                          className="rounded-full"
                          style={{
                            width: 4,
                            height: 4,
                            background: dotColor,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-2 px-4">
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
        </div>

        {/* Task list — do dia selecionado ou do mês inteiro */}
        {tasks.length > 0 && (() => {
          const listTasks = selectedDay
            ? tasks.filter((t) => new Date(t.dueDate).getUTCDate() === selectedDay)
            : tasks;
          return (
          <div className="mt-6 px-2 space-y-2">
            <div className="flex items-center justify-between px-1 mb-3">
              <p className="text-xs font-medium" style={{ color: "#a1a1aa" }}>
                {selectedDay
                  ? `OBRIGAÇÕES DO DIA ${String(selectedDay).padStart(2, "0")}/${String(month).padStart(2, "0")}`
                  : `OBRIGAÇÕES DE ${MONTHS[month - 1].toUpperCase()}`}
              </p>
              {selectedDay && (
                <button onClick={() => setSelectedDay(null)} className="text-xs px-2 py-1 rounded-lg" style={{ color: "#9fd4dc", background: "rgba(36,100,108,0.15)" }}>
                  Ver o mês todo
                </button>
              )}
            </div>
            {listTasks.map((task) => {
              const due = new Date(task.dueDate);
              const isOverdue = due < today && task.status !== "CONCLUIDA";
              const StatusIcon = task.status === "CONCLUIDA" ? CheckCircle2
                : isOverdue ? AlertCircle
                : Clock;
              const statusColor = task.status === "CONCLUIDA" ? "#4ade80"
                : isOverdue ? "#f87171"
                : task.status === "EM_ANDAMENTO" ? "#60a5fa"
                : "#facc15";

              return (
                <button
                  key={task.id}
                  onClick={() => setSelectedTask(task as Task)}
                  className="w-full flex items-center justify-between p-4 rounded-2xl text-left active:scale-98 transition-transform"
                  style={{ background: "#111", border: "1px solid #1a1a1a" }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${statusColor}15` }}
                    >
                      <StatusIcon size={18} style={{ color: statusColor }} />
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "#e5e5e5" }}>{task.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#52525b" }}>
                        Vence {formatBR(due)}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: "#3f3f46" }} />
                </button>
              );
            })}
          </div>
          );
        })()}

        {!isLoading && tasks.length === 0 && (
          <div className="text-center py-16 px-6">
            <CalendarDays size={40} className="mx-auto mb-3" style={{ color: "#1e4f5c" }} />
            <p className="text-sm font-medium" style={{ color: "#a1a1aa" }}>Nenhuma obrigação este mês</p>
            <p className="text-xs mt-1" style={{ color: "#52525b" }}>Navegue pelos meses para ver suas guias</p>
          </div>
        )}
          </>
        )}
      </div>

      {/* Task drawer */}
      {selectedTask && (
        <TaskDrawer task={selectedTask} previewClientId={previewClientId} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}
