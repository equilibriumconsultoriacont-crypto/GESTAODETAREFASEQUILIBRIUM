import AppLayout from "@/components/AppLayout";
import { StatusBadge, TaskTypeBadge } from "@/components/StatusBadge";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, XCircle } from "lucide-react";
import { Link } from "wouter";

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bg: string;
}) {
  return (
    <div
      className="rounded-xl p-5 flex items-center gap-4 border transition-all hover:border-opacity-80"
      style={{ background: "#111", borderColor: "#1e4f5c" }}
    >
      <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
        <Icon size={22} style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-bold" style={{ color: "#e5e5e5" }}>{value}</p>
        <p className="text-xs" style={{ color: "#a1a1aa" }}>{label}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = trpc.tasks.dashboard.useQuery();
  const { data: dueSoon, isLoading: dueSoonLoading } = trpc.tasks.dueSoon.useQuery({ days: 3 });
  const { data: allTasks, isLoading: tasksLoading } = trpc.tasks.list.useQuery({});
  const markOverdue = trpc.tasks.markOverdue.useMutation();
  const utils = trpc.useUtils();

  const recentTasks = allTasks?.slice(0, 8) ?? [];

  const handleMarkOverdue = async () => {
    await markOverdue.mutateAsync();
    utils.tasks.dashboard.invalidate();
    utils.tasks.list.invalidate();
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#e5e5e5" }}>Dashboard</h1>
            <p className="text-sm mt-0.5" style={{ color: "#a1a1aa" }}>Visão geral das obrigações fiscais</p>
          </div>
          <button
            onClick={handleMarkOverdue}
            disabled={markOverdue.isPending}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
            style={{ background: "rgba(36,100,108,0.2)", color: "#9fd4dc", border: "1px solid rgba(36,100,108,0.3)" }}
          >
            <RefreshCw size={13} className={markOverdue.isPending ? "animate-spin" : ""} />
            Atualizar vencidas
          </button>
        </div>

        {/* Stats */}
        {statsLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "#1a1a1a" }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <StatCard label="Pendentes" value={stats?.pendentes ?? 0} icon={Clock} color="#facc15" bg="rgba(234,179,8,0.12)" />
            <StatCard label="Em Andamento" value={stats?.emAndamento ?? 0} icon={RefreshCw} color="#60a5fa" bg="rgba(59,130,246,0.12)" />
            <StatCard label="Concluídas" value={stats?.concluidas ?? 0} icon={CheckCircle2} color="#4ade80" bg="rgba(34,197,94,0.12)" />
            <StatCard label="Vencidas" value={stats?.vencidas ?? 0} icon={XCircle} color="#f87171" bg="rgba(239,68,68,0.12)" />
            <StatCard label="Aguard. Cliente" value={stats?.aguardandoCliente ?? 0} icon={Clock} color="#fb923c" bg="rgba(251,146,60,0.12)" />
          </div>
        )}

        {/* Due soon alert */}
        {!dueSoonLoading && dueSoon && dueSoon.length > 0 && (
          <div className="rounded-xl p-4 border" style={{ background: "rgba(234,179,8,0.06)", borderColor: "rgba(234,179,8,0.25)" }}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} style={{ color: "#facc15" }} />
              <span className="text-sm font-semibold" style={{ color: "#facc15" }}>
                {dueSoon.length} tarefa{dueSoon.length > 1 ? "s" : ""} vence{dueSoon.length === 1 ? "" : "m"} nos próximos 3 dias
              </span>
            </div>
            <div className="space-y-2">
              {dueSoon.map((task) => (
                <Link key={task.id} href={`/tarefas/${task.id}`}>
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-2">
                      <TaskTypeBadge type={task.taskType} />
                      <span className="text-sm" style={{ color: "#e5e5e5" }}>{task.title}</span>
                      <span className="text-xs" style={{ color: "#a1a1aa" }}>— {task.competencia}</span>
                    </div>
                    <span className="text-xs font-medium" style={{ color: "#facc15" }}>
                      {new Date(task.dueDate).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recent tasks */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold" style={{ color: "#e5e5e5" }}>Tarefas Recentes</h2>
            <Link href="/tarefas">
              <span className="text-xs cursor-pointer hover:underline" style={{ color: "#9fd4dc" }}>Ver todas →</span>
            </Link>
          </div>

          {tasksLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 rounded-lg animate-pulse" style={{ background: "#1a1a1a" }} />
              ))}
            </div>
          ) : recentTasks.length === 0 ? (
            <div className="text-center py-12 rounded-xl border" style={{ borderColor: "#1e4f5c", background: "#111" }}>
              <CheckCircle2 size={32} className="mx-auto mb-2" style={{ color: "#52525b" }} />
              <p className="text-sm" style={{ color: "#a1a1aa" }}>Nenhuma tarefa cadastrada</p>
              <Link href="/tarefas">
                <span className="text-xs cursor-pointer hover:underline mt-1 block" style={{ color: "#9fd4dc" }}>Criar primeira tarefa</span>
              </Link>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#1e4f5c", background: "#111" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid #1e4f5c" }}>
                    <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "#a1a1aa" }}>Tarefa</th>
                    <th className="text-left px-4 py-3 text-xs font-medium hidden md:table-cell" style={{ color: "#a1a1aa" }}>Competência</th>
                    <th className="text-left px-4 py-3 text-xs font-medium hidden lg:table-cell" style={{ color: "#a1a1aa" }}>Vencimento</th>
                    <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "#a1a1aa" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTasks.map((task, idx) => (
                    <tr
                      key={task.id}
                      style={{ borderBottom: idx < recentTasks.length - 1 ? "1px solid rgba(30,79,92,0.5)" : "none" }}
                    >
                      <td className="px-4 py-3">
                        <Link href={`/tarefas/${task.id}`}>
                          <div className="flex items-center gap-2 cursor-pointer">
                            <TaskTypeBadge type={task.taskType} />
                            <span className="font-medium hover:text-teal-400 transition-colors" style={{ color: "#e5e5e5" }}>{task.title}</span>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell" style={{ color: "#a1a1aa" }}>{task.competencia}</td>
                      <td className="px-4 py-3 hidden lg:table-cell" style={{ color: "#a1a1aa" }}>
                        {new Date(task.dueDate).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={task.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
