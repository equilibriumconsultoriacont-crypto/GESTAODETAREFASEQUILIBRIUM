import AppLayout from "@/components/AppLayout";
import { DepartmentBadge, PriorityBadge, StatusBadge, TaskTypeBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckSquare, Clock, Filter, PlusCircle, RefreshCw, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "ALL", label: "Todos os status" },
  { value: "PENDENTE", label: "⏳ Pendente" },
  { value: "EM_ANDAMENTO", label: "🔄 Em Andamento" },
  { value: "AGUARDANDO_CLIENTE", label: "🕐 Aguardando Cliente" },
  { value: "EM_REVISAO", label: "🔍 Em Revisão" },
  { value: "CONCLUIDA", label: "✅ Concluída" },
  { value: "CANCELADA", label: "🚫 Cancelada" },
  { value: "VENCIDA", label: "🚨 Vencida" },
];

const DEPT_OPTIONS = [
  { value: "ALL", label: "Todos os departamentos" },
  { value: "FISCAL", label: "Fiscal" },
  { value: "CONTABIL", label: "Contábil" },
  { value: "DP", label: "DP" },
  { value: "SOCIETARIO", label: "Societário" },
  { value: "FINANCEIRO", label: "Financeiro" },
  { value: "GERAL", label: "Geral" },
];

const TYPE_OPTIONS = ["DAS","NFS","DCTF","SPED","OUTROS"];

export default function Tasks() {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [clientFilter, setClientFilter] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    clientId: "", title: "", taskType: "DAS", competencia: "",
    dueDate: "", description: "", notes: "",
    department: "GERAL", priority: "NORMAL",
  });

  const { data: clients = [] } = trpc.clients.list.useQuery({ includeInactive: false });
  const { data: tasks = [], isLoading } = trpc.tasks.list.useQuery({
    status: statusFilter !== "ALL" ? statusFilter as any : undefined,
    clientId: clientFilter !== "ALL" ? Number(clientFilter) : undefined,
  });
  const { data: opStats } = (trpc as any).operational?.stats?.useQuery?.() ?? { data: null };
  const createMutation = trpc.tasks.create.useMutation();
  const utils = trpc.useUtils();

  const filteredTasks = deptFilter !== "ALL"
    ? tasks.filter((t) => (t as any).department === deptFilter)
    : tasks;

  const clientMap = new Map(clients.map((c) => [c.id, c]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync({
        clientId: Number(form.clientId),
        title: form.title,
        taskType: form.taskType as any,
        competencia: form.competencia,
        dueDate: new Date(form.dueDate).toISOString(),
        description: form.description || undefined,
        notes: form.notes || undefined,
      });
      toast.success("Tarefa criada!");
      setDialogOpen(false);
      setForm({ clientId: "", title: "", taskType: "DAS", competencia: "", dueDate: "", description: "", notes: "", department: "GERAL", priority: "NORMAL" });
      utils.tasks.list.invalidate();
      utils.tasks.dashboard.invalidate();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao criar tarefa");
    }
  };

  const today = new Date();
  const vencendoHoje = tasks.filter((t) => new Date(t.dueDate).toDateString() === today.toDateString() && t.status !== "CONCLUIDA").length;
  const aguardandoCliente = tasks.filter((t) => t.status === "AGUARDANDO_CLIENTE").length;
  const vencidas = tasks.filter((t) => t.status === "VENCIDA").length;

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#e5e5e5" }}>Fila de Tarefas</h1>
            <p className="text-sm mt-0.5" style={{ color: "#a1a1aa" }}>{filteredTasks.length} tarefa(s)</p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2" style={{ background: "#24646c", color: "#fff" }}>
            <PlusCircle size={15} /> Nova Tarefa
          </Button>
        </div>

        {/* Operational alerts */}
        {(vencendoHoje > 0 || aguardandoCliente > 0 || vencidas > 0) && (
          <div className="grid grid-cols-3 gap-3">
            {vencendoHoje > 0 && (
              <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.3)" }}>
                <Clock size={18} style={{ color: "#fb923c" }} />
                <div>
                  <p className="text-lg font-bold" style={{ color: "#fb923c" }}>{vencendoHoje}</p>
                  <p className="text-xs" style={{ color: "#a1a1aa" }}>Vencem hoje</p>
                </div>
              </div>
            )}
            {aguardandoCliente > 0 && (
              <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.3)" }}>
                <Users size={18} style={{ color: "#fb923c" }} />
                <div>
                  <p className="text-lg font-bold" style={{ color: "#fb923c" }}>{aguardandoCliente}</p>
                  <p className="text-xs" style={{ color: "#a1a1aa" }}>Aguardando cliente</p>
                </div>
              </div>
            )}
            {vencidas > 0 && (
              <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
                <AlertCircle size={18} style={{ color: "#f87171" }} />
                <div>
                  <p className="text-lg font-bold" style={{ color: "#f87171" }}>{vencidas}</p>
                  <p className="text-xs" style={{ color: "#a1a1aa" }}>Vencidas</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-52" style={{ background: "#111", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
              <Filter size={13} className="mr-1" /><SelectValue />
            </SelectTrigger>
            <SelectContent style={{ background: "#111", borderColor: "#1e4f5c" }}>
              {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} style={{ color: "#e5e5e5" }}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-48" style={{ background: "#111", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent style={{ background: "#111", borderColor: "#1e4f5c" }}>
              {DEPT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} style={{ color: "#e5e5e5" }}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-52" style={{ background: "#111", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
              <SelectValue placeholder="Todos os clientes" />
            </SelectTrigger>
            <SelectContent style={{ background: "#111", borderColor: "#1e4f5c" }}>
              <SelectItem value="ALL" style={{ color: "#e5e5e5" }}>Todos os clientes</SelectItem>
              {clients.map((c) => <SelectItem key={c.id} value={String(c.id)} style={{ color: "#e5e5e5" }}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Task list */}
        {isLoading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "#1a1a1a" }} />)}</div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-16 rounded-xl border" style={{ borderColor: "#1e4f5c", background: "#111" }}>
            <CheckSquare size={36} className="mx-auto mb-3" style={{ color: "#52525b" }} />
            <p className="text-sm font-medium" style={{ color: "#a1a1aa" }}>Nenhuma tarefa encontrada</p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#1e4f5c", background: "#111" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #1e4f5c" }}>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "#a1a1aa" }}>Tarefa</th>
                  <th className="text-left px-4 py-3 text-xs font-medium hidden md:table-cell" style={{ color: "#a1a1aa" }}>Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-medium hidden lg:table-cell" style={{ color: "#a1a1aa" }}>Depto</th>
                  <th className="text-left px-4 py-3 text-xs font-medium hidden sm:table-cell" style={{ color: "#a1a1aa" }}>Vencimento</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "#a1a1aa" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task, idx) => {
                  const client = clientMap.get(task.clientId);
                  const due = new Date(task.dueDate);
                  const isOverdue = due < today && task.status !== "CONCLUIDA" && task.status !== "CANCELADA";
                  const isDueToday = due.toDateString() === today.toDateString();
                  return (
                    <tr key={task.id} style={{ borderBottom: idx < filteredTasks.length - 1 ? "1px solid rgba(30,79,92,0.4)" : "none" }}>
                      <td className="px-4 py-3">
                        <Link href={`/tarefas/${task.id}`}>
                          <div className="flex items-center gap-2 cursor-pointer">
                            <TaskTypeBadge type={task.taskType} />
                            <span className="hover:underline font-medium" style={{ color: "#e5e5e5" }}>{task.title}</span>
                            {(task as any).priority === "URGENTE" && <span style={{ color: "#f87171", fontSize: 10 }}>🚨</span>}
                            {(task as any).priority === "ALTA" && <span style={{ color: "#fb923c", fontSize: 10 }}>⚠️</span>}
                          </div>
                          <p className="text-xs mt-0.5 ml-9" style={{ color: "#52525b" }}>{task.competencia}</p>
                        </Link>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="text-xs" style={{ color: "#a1a1aa" }}>{client?.name ?? "—"}</p>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <DepartmentBadge department={(task as any).department ?? "GERAL"} />
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-xs" style={{ color: isOverdue ? "#f87171" : isDueToday ? "#fb923c" : "#a1a1aa", fontWeight: (isOverdue || isDueToday) ? 600 : 400 }}>
                          {isDueToday ? "⚡ Hoje" : due.toLocaleDateString("pt-BR")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={task.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create task dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent style={{ background: "#111", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
          <DialogHeader><DialogTitle style={{ color: "#e5e5e5" }}>Nova Tarefa</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3 mt-2">
            <div>
              <Label style={{ color: "#a1a1aa" }}>Cliente *</Label>
              <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required
                className="w-full rounded-md px-3 py-2 text-sm mt-1"
                style={{ background: "#0d1f22", border: "1px solid #1e4f5c", color: "#e5e5e5", outline: "none" }}>
                <option value="">Selecione...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label style={{ color: "#a1a1aa" }}>Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="mt-1"
                style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label style={{ color: "#a1a1aa" }}>Tipo *</Label>
                <select value={form.taskType} onChange={(e) => setForm({ ...form, taskType: e.target.value })} required
                  className="w-full rounded-md px-3 py-2 text-sm mt-1"
                  style={{ background: "#0d1f22", border: "1px solid #1e4f5c", color: "#e5e5e5", outline: "none" }}>
                  {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Label style={{ color: "#a1a1aa" }}>Departamento</Label>
                <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="w-full rounded-md px-3 py-2 text-sm mt-1"
                  style={{ background: "#0d1f22", border: "1px solid #1e4f5c", color: "#e5e5e5", outline: "none" }}>
                  {DEPT_OPTIONS.filter(d => d.value !== "ALL").map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label style={{ color: "#a1a1aa" }}>Competência *</Label>
                <Input value={form.competencia} onChange={(e) => setForm({ ...form, competencia: e.target.value })}
                  placeholder="MM/YYYY" required className="mt-1"
                  style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }} />
              </div>
              <div>
                <Label style={{ color: "#a1a1aa" }}>Vencimento *</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required className="mt-1"
                  style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }} />
              </div>
            </div>
            <div>
              <Label style={{ color: "#a1a1aa" }}>Prioridade</Label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full rounded-md px-3 py-2 text-sm mt-1"
                style={{ background: "#0d1f22", border: "1px solid #1e4f5c", color: "#e5e5e5", outline: "none" }}>
                <option value="BAIXA">Baixa</option>
                <option value="NORMAL">Normal</option>
                <option value="ALTA">Alta</option>
                <option value="URGENTE">🚨 Urgente</option>
              </select>
            </div>
            <div>
              <Label style={{ color: "#a1a1aa" }}>Observações</Label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                className="w-full rounded-md px-3 py-2 text-sm mt-1 resize-none"
                style={{ background: "#0d1f22", border: "1px solid #1e4f5c", color: "#e5e5e5", outline: "none" }} />
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1"
                style={{ borderColor: "#1e4f5c", color: "#a1a1aa" }}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending} className="flex-1"
                style={{ background: "#24646c", color: "#fff" }}>
                {createMutation.isPending ? "Criando..." : "Criar Tarefa"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
