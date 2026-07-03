import AppLayout from "@/components/AppLayout";
import { DepartmentBadge, StatusBadge, TaskTypeBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckSquare, ChevronDown, ChevronUp, Eye, EyeOff, Filter, PlusCircle, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const TYPE_OPTIONS = ["DAS", "NFS", "DCTF", "SPED", "OUTROS"];
const DEPT_OPTIONS = [
  { value: "ALL", label: "Todos os departamentos" },
  { value: "FISCAL", label: "Fiscal" }, { value: "CONTABIL", label: "Contábil" },
  { value: "DP", label: "DP" }, { value: "SOCIETARIO", label: "Societário" },
  { value: "FINANCEIRO", label: "Financeiro" }, { value: "GERAL", label: "Geral" },
];

const now = new Date();
const currentYear = now.getFullYear();
const YEARS = [currentYear - 1, currentYear, currentYear + 1].map(String);
const MONTHS = [
  { v: "01", l: "Janeiro" }, { v: "02", l: "Fevereiro" }, { v: "03", l: "Março" },
  { v: "04", l: "Abril" }, { v: "05", l: "Maio" }, { v: "06", l: "Junho" },
  { v: "07", l: "Julho" }, { v: "08", l: "Agosto" }, { v: "09", l: "Setembro" },
  { v: "10", l: "Outubro" }, { v: "11", l: "Novembro" }, { v: "12", l: "Dezembro" },
];

// Competência padrão = mês anterior (escritório trabalha na competência do mês passado)
function defaultCompetencia() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return {
    mm: String(d.getMonth() + 1).padStart(2, "0"),
    yyyy: String(d.getFullYear()),
  };
}

const STATUS_FILTER_OPTIONS = [
  { value: "ALL",     label: "Todos",           color: "#a1a1aa" },
  { value: "ACTIVE",  label: "Em aberto",       color: "#60a5fa" },
  { value: "PENDENTE",         label: "Pendente",          color: "#facc15" },
  { value: "EM_ANDAMENTO",     label: "Em Andamento",      color: "#60a5fa" },
  { value: "AGUARDANDO_CLIENTE", label: "Aguard. Cliente", color: "#fb923c" },
  { value: "VENCIDA",          label: "Vencidas",          color: "#f87171" },
  { value: "CONCLUIDA",        label: "Concluídas",        color: "#4ade80" },
  { value: "CANCELADA",        label: "Canceladas",        color: "#a1a1aa" },
];

export default function Tasks() {
  const def = defaultCompetencia();

  // Filtros
  const [compMm, setCompMm] = useState(def.mm);
  const [compYyyy, setCompYyyy] = useState(def.yyyy);
  const [statusFilter, setStatusFilter] = useState("ACTIVE"); // padrão: em aberto
  const [clientFilter, setClientFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [filterMode, setFilterMode] = useState<"competencia" | "vencimento">("competencia");
  const [showFilters, setShowFilters] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [form, setForm] = useState({
    clientId: "", title: "", taskType: "DAS",
    competenciaMm: def.mm, competenciaYyyy: def.yyyy,
    dueDate: "", description: "", notes: "",
    department: "GERAL", priority: "NORMAL",
  });

  const competenciaFilter = `${compMm}/${compYyyy}`;

  const { data: clients = [] } = trpc.clients.list.useQuery({ includeInactive: false });
  const { data: allTasks = [], isLoading } = trpc.tasks.list.useQuery(
    { clientId: clientFilter !== "ALL" ? Number(clientFilter) : undefined },
    { refetchInterval: 60_000 } // atualiza a cada minuto
  );
  const createMutation = trpc.tasks.create.useMutation();
  const utils = trpc.useUtils();

  const clientMap = new Map(clients.map((c) => [c.id, c]));

  // Filtra por competência OU por mês de vencimento, conforme o modo
  const tasksByComp = useMemo(() => {
    if (filterMode === "competencia") {
      return allTasks.filter((t) => t.competencia === competenciaFilter);
    }
    // Modo vencimento: tarefas cujo dueDate cai no mês/ano selecionado
    return allTasks.filter((t) => {
      const d = new Date(t.dueDate);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = String(d.getFullYear());
      return mm === compMm && yyyy === compYyyy;
    });
  }, [allTasks, competenciaFilter, filterMode, compMm, compYyyy]);

  // Aplica filtros de status e departamento
  const filteredTasks = useMemo(() => {
    let tasks = tasksByComp;

    if (statusFilter === "ACTIVE") {
      tasks = tasks.filter((t) => !["CONCLUIDA", "CANCELADA"].includes(t.status));
    } else if (statusFilter !== "ALL") {
      tasks = tasks.filter((t) => t.status === statusFilter);
    }

    if (deptFilter !== "ALL") {
      tasks = tasks.filter((t) => (t as any).department === deptFilter);
    }

    return tasks;
  }, [tasksByComp, statusFilter, deptFilter]);

  // Contagens para os badges dos filtros
  const counts = useMemo(() => ({
    all: tasksByComp.length,
    active: tasksByComp.filter((t) => !["CONCLUIDA", "CANCELADA"].includes(t.status)).length,
    PENDENTE: tasksByComp.filter((t) => t.status === "PENDENTE").length,
    EM_ANDAMENTO: tasksByComp.filter((t) => t.status === "EM_ANDAMENTO").length,
    AGUARDANDO_CLIENTE: tasksByComp.filter((t) => t.status === "AGUARDANDO_CLIENTE").length,
    VENCIDA: tasksByComp.filter((t) => t.status === "VENCIDA").length,
    CONCLUIDA: tasksByComp.filter((t) => t.status === "CONCLUIDA").length,
    CANCELADA: tasksByComp.filter((t) => t.status === "CANCELADA").length,
  }), [tasksByComp]);

  // Totais gerais (todos os meses, sem filtro de competência)
  const totalVencidas = allTasks.filter((t) => t.status === "VENCIDA").length;
  const totalHoje = allTasks.filter((t) => {
    const d = new Date(t.dueDate);
    const today = new Date();
    return d.toDateString() === today.toDateString() && !["CONCLUIDA", "CANCELADA"].includes(t.status);
  }).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId) { toast.error("Selecione um cliente"); return; }
    if (!form.dueDate) { toast.error("Informe a data de vencimento"); return; }
    try {
      await createMutation.mutateAsync({
        clientId: Number(form.clientId),
        title: form.title,
        taskType: form.taskType as any,
        competencia: `${form.competenciaMm}/${form.competenciaYyyy}`,
        dueDate: new Date(form.dueDate + "T12:00:00").toISOString(),
        description: form.description || undefined,
        notes: form.notes || undefined,
        department: form.department as any,
        priority: form.priority as any,
      });
      toast.success("Tarefa criada!");
      setDialogOpen(false);
      utils.tasks.list.invalidate();
      utils.tasks.dashboard.invalidate();
    } catch (err: any) { toast.error(err?.message ?? "Erro ao criar tarefa"); }
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#e5e5e5" }}>Fila de Tarefas</h1>
            <p className="text-sm mt-0.5" style={{ color: "#a1a1aa" }}>
              {filterMode === "competencia" ? "Competência" : "Vencimento em"} <strong style={{ color: "#9fd4dc" }}>{compMm}/{compYyyy}</strong> — {filteredTasks.length} tarefa(s)
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2" style={{ background: "#24646c", color: "#fff" }}>
            <PlusCircle size={15} /> Nova Tarefa
          </Button>
        </div>

        {/* Alertas globais (todos os meses) */}
        {(totalVencidas > 0 || totalHoje > 0) && (
          <div className="flex gap-3 flex-wrap">
            {totalVencidas > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
                onClick={() => { setCompMm("ALL" as any); setStatusFilter("VENCIDA"); }}>
                <AlertCircle size={14} />
                <span><strong>{totalVencidas}</strong> vencida{totalVencidas > 1 ? "s" : ""} no total</span>
              </div>
            )}
            {totalHoje > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                style={{ background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.3)", color: "#fb923c" }}>
                <AlertCircle size={14} />
                <span><strong>{totalHoje}</strong> vence hoje</span>
              </div>
            )}
          </div>
        )}

        {/* Filtro de competência + status */}
        <div className="rounded-xl border p-4 space-y-3" style={{ background: "#111", borderColor: "#1e4f5c" }}>
          {/* Linha 1: Competência + botão filtros */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Toggle: filtrar por competência ou por vencimento */}
              <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #1e4f5c" }}>
                <button onClick={() => setFilterMode("competencia")}
                  className="px-2.5 py-1 text-xs font-medium transition-colors"
                  style={{ background: filterMode === "competencia" ? "#24646c" : "transparent", color: filterMode === "competencia" ? "#fff" : "#52525b" }}>
                  Competência
                </button>
                <button onClick={() => setFilterMode("vencimento")}
                  className="px-2.5 py-1 text-xs font-medium transition-colors"
                  style={{ background: filterMode === "vencimento" ? "#24646c" : "transparent", color: filterMode === "vencimento" ? "#fff" : "#52525b" }}>
                  Vencimento
                </button>
              </div>
              <select value={compMm} onChange={(e) => setCompMm(e.target.value)}
                className="rounded px-2 py-1 text-sm"
                style={{ background: "#0d1f22", border: "1px solid #1e4f5c", color: "#e5e5e5", outline: "none" }}>
                {MONTHS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
              </select>
              <select value={compYyyy} onChange={(e) => setCompYyyy(e.target.value)}
                className="rounded px-2 py-1 text-sm w-24"
                style={{ background: "#0d1f22", border: "1px solid #1e4f5c", color: "#e5e5e5", outline: "none" }}>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(36,100,108,0.2)", color: "#9fd4dc" }}>
                {counts.all} total
              </span>
            </div>
            <button onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1.5 text-xs hover:opacity-80"
              style={{ color: showFilters ? "#9fd4dc" : "#52525b" }}>
              <Filter size={13} />
              {showFilters ? "Ocultar filtros" : "Mais filtros"}
              {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>

          {/* Filtros rápidos de status (chips) */}
          <div className="flex gap-2 flex-wrap">
            {STATUS_FILTER_OPTIONS.map((opt) => {
              const count = opt.value === "ALL" ? counts.all : opt.value === "ACTIVE" ? counts.active : counts[opt.value as keyof typeof counts] ?? 0;
              const isActive = statusFilter === opt.value;
              if (count === 0 && opt.value !== "ALL" && opt.value !== "ACTIVE") return null;
              return (
                <button key={opt.value} onClick={() => setStatusFilter(opt.value)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={{
                    background: isActive ? `${opt.color}22` : "rgba(255,255,255,0.04)",
                    color: isActive ? opt.color : "#52525b",
                    border: `1px solid ${isActive ? opt.color + "44" : "rgba(255,255,255,0.08)"}`,
                  }}>
                  {opt.label}
                  <span className="px-1.5 py-0.5 rounded-full text-xs"
                    style={{ background: isActive ? opt.color + "33" : "rgba(255,255,255,0.06)", color: isActive ? opt.color : "#a1a1aa" }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Filtros adicionais (expansível) */}
          {showFilters && (
            <div className="flex gap-3 flex-wrap pt-2" style={{ borderTop: "1px solid rgba(30,79,92,0.4)" }}>
              <div>
                <label className="text-xs block mb-1" style={{ color: "#52525b" }}>Cliente</label>
                <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}
                  className="rounded px-2 py-1.5 text-sm"
                  style={{ background: "#0d1f22", border: "1px solid #1e4f5c", color: "#e5e5e5", outline: "none" }}>
                  <option value="ALL">Todos os clientes</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: "#52525b" }}>Departamento</label>
                <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
                  className="rounded px-2 py-1.5 text-sm"
                  style={{ background: "#0d1f22", border: "1px solid #1e4f5c", color: "#e5e5e5", outline: "none" }}>
                  {DEPT_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              {(clientFilter !== "ALL" || deptFilter !== "ALL") && (
                <div className="flex items-end">
                  <button onClick={() => { setClientFilter("ALL"); setDeptFilter("ALL"); }}
                    className="px-2 py-1.5 text-xs rounded hover:opacity-80"
                    style={{ color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}>
                    Limpar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Lista de tarefas */}
        {isLoading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: "#1a1a1a" }} />)}</div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-16 rounded-xl border" style={{ borderColor: "#1e4f5c", background: "#111" }}>
            <CheckSquare size={36} className="mx-auto mb-3" style={{ color: "#52525b" }} />
            <p className="text-sm font-medium" style={{ color: "#a1a1aa" }}>
              {tasksByComp.length === 0
                ? `Nenhuma tarefa para competência ${compMm}/${compYyyy}`
                : "Nenhuma tarefa com esses filtros"}
            </p>
            {tasksByComp.length === 0 && (
              <p className="text-xs mt-1" style={{ color: "#52525b" }}>
                Gere as tarefas do mês pelo perfil do cliente ou pelo Painel Mensal
              </p>
            )}
            {tasksByComp.length > 0 && statusFilter !== "ALL" && (
              <button onClick={() => setStatusFilter("ALL")}
                className="mt-3 text-xs px-3 py-1.5 rounded hover:opacity-80"
                style={{ background: "rgba(36,100,108,0.2)", color: "#9fd4dc" }}>
                Ver todas as {tasksByComp.length} tarefas
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile: cards empilhados (evita corte da coluna Status) */}
            <div className="sm:hidden space-y-2">
              {filteredTasks.map((task) => {
                const client = clientMap.get(task.clientId);
                const due = new Date(task.dueDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
                const isOverdue = dueDay < today && !["CONCLUIDA", "CANCELADA", "VENCIDA"].includes(task.status);
                const isDueToday = dueDay.getTime() === today.getTime();
                return (
                  <Link key={task.id} href={`/tarefas/${task.id}`}>
                    <div className="rounded-xl border p-3 cursor-pointer" style={{ borderColor: "#1e4f5c", background: "#111" }}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <TaskTypeBadge type={task.taskType} />
                          <span className="font-medium text-sm truncate" style={{ color: "#e5e5e5" }}>{task.title}</span>
                        </div>
                        <StatusBadge status={task.status} dueDate={task.dueDate} completedAt={(task as any).completedAt} />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs truncate" style={{ color: "#9fd4dc" }}>{client?.name ?? "—"}</span>
                        <span className="text-xs shrink-0" style={{ color: isOverdue ? "#f87171" : isDueToday ? "#fb923c" : "#a1a1aa", fontWeight: (isOverdue || isDueToday) ? 600 : 400 }}>
                          {isDueToday ? "⚡ Hoje" : due.toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Desktop: tabela */}
            <div className="hidden sm:block rounded-xl border overflow-hidden" style={{ borderColor: "#1e4f5c", background: "#111" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid #1e4f5c" }}>
                    <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "#a1a1aa" }}>Tarefa</th>
                    <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "#a1a1aa" }}>Cliente</th>
                    <th className="text-left px-4 py-3 text-xs font-medium hidden lg:table-cell" style={{ color: "#a1a1aa" }}>Depto</th>
                    <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "#a1a1aa" }}>Vencimento</th>
                    <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "#a1a1aa" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task, idx) => {
                    const client = clientMap.get(task.clientId);
                    const due = new Date(task.dueDate);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
                    const isOverdue = dueDay < today && !["CONCLUIDA", "CANCELADA", "VENCIDA"].includes(task.status);
                    const isDueToday = dueDay.getTime() === today.getTime();
                    return (
                      <tr key={task.id} style={{ borderBottom: idx < filteredTasks.length - 1 ? "1px solid rgba(30,79,92,0.3)" : "none" }}>
                        <td className="px-4 py-3">
                          <Link href={`/tarefas/${task.id}`}>
                            <div className="flex items-center gap-2 cursor-pointer">
                              <TaskTypeBadge type={task.taskType} />
                              <span className="hover:underline font-medium" style={{ color: "#e5e5e5" }}>{task.title}</span>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/clientes/${task.clientId}`}>
                            <span className="text-xs hover:underline cursor-pointer" style={{ color: "#9fd4dc" }}>{client?.name ?? "—"}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <DepartmentBadge department={(task as any).department ?? "GERAL"} />
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs" style={{ color: isOverdue ? "#f87171" : isDueToday ? "#fb923c" : "#a1a1aa", fontWeight: (isOverdue || isDueToday) ? 600 : 400 }}>
                            {isDueToday ? "⚡ Hoje" : due.toLocaleDateString("pt-BR")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={task.status} dueDate={task.dueDate} completedAt={(task as any).completedAt} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Dialog Nova Tarefa */}
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
                <div className="flex gap-1 mt-1">
                  <select value={form.competenciaMm} onChange={(e) => setForm({ ...form, competenciaMm: e.target.value })}
                    className="w-1/2 rounded-md px-2 py-2 text-sm"
                    style={{ background: "#0d1f22", border: "1px solid #1e4f5c", color: "#e5e5e5", outline: "none" }}>
                    {MONTHS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
                  </select>
                  <select value={form.competenciaYyyy} onChange={(e) => setForm({ ...form, competenciaYyyy: e.target.value })}
                    className="w-1/2 rounded-md px-2 py-2 text-sm"
                    style={{ background: "#0d1f22", border: "1px solid #1e4f5c", color: "#e5e5e5", outline: "none" }}>
                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
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
