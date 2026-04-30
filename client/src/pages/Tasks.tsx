import AppLayout from "@/components/AppLayout";
import { StatusBadge, TaskTypeBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { CheckSquare, Filter, PlusCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "ALL", label: "Todos os status" },
  { value: "PENDENTE", label: "Pendente" },
  { value: "EM_ANDAMENTO", label: "Em Andamento" },
  { value: "CONCLUIDA", label: "Concluída" },
  { value: "VENCIDA", label: "Vencida" },
];

const TYPE_OPTIONS = [
  { value: "DAS", label: "DAS" },
  { value: "NFS", label: "NFS" },
  { value: "DCTF", label: "DCTF" },
  { value: "SPED", label: "SPED" },
  { value: "OUTROS", label: "Outros" },
];

export default function Tasks() {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [clientFilter, setClientFilter] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    clientId: "",
    title: "",
    taskType: "DAS",
    competencia: "",
    dueDate: "",
    description: "",
    notes: "",
  });

  const { data: clients = [] } = trpc.clients.list.useQuery({ includeInactive: false });
  const { data: tasks = [], isLoading } = trpc.tasks.list.useQuery({
    status: statusFilter !== "ALL" ? (statusFilter as "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA" | "VENCIDA") : undefined,
    clientId: clientFilter !== "ALL" ? Number(clientFilter) : undefined,
  });
  const createMutation = trpc.tasks.create.useMutation();
  const utils = trpc.useUtils();

  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync({
        clientId: Number(form.clientId),
        title: form.title,
        taskType: form.taskType as "DAS" | "NFS" | "DCTF" | "SPED" | "OUTROS",
        competencia: form.competencia,
        dueDate: form.dueDate,
        description: form.description || undefined,
        notes: form.notes || undefined,
      });
      toast.success("Tarefa criada com sucesso");
      setDialogOpen(false);
      utils.tasks.list.invalidate();
      utils.tasks.dashboard.invalidate();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar tarefa");
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#e5e5e5" }}>Tarefas</h1>
            <p className="text-sm mt-0.5" style={{ color: "#a1a1aa" }}>{tasks.length} tarefa{tasks.length !== 1 ? "s" : ""}</p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2" style={{ background: "#24646c", color: "#fff" }}>
            <PlusCircle size={15} />
            Nova Tarefa
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap items-center">
          <Filter size={14} style={{ color: "#52525b" }} />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 text-sm" style={{ background: "#111", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent style={{ background: "#111", borderColor: "#1e4f5c" }}>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} style={{ color: "#e5e5e5" }}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-52 text-sm" style={{ background: "#111", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
              <SelectValue placeholder="Todos os clientes" />
            </SelectTrigger>
            <SelectContent style={{ background: "#111", borderColor: "#1e4f5c" }}>
              <SelectItem value="ALL" style={{ color: "#e5e5e5" }}>Todos os clientes</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={String(c.id)} style={{ color: "#e5e5e5" }}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-lg animate-pulse" style={{ background: "#1a1a1a" }} />)}
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16 rounded-xl border" style={{ borderColor: "#1e4f5c", background: "#111" }}>
            <CheckSquare size={36} className="mx-auto mb-3" style={{ color: "#52525b" }} />
            <p className="text-sm" style={{ color: "#a1a1aa" }}>Nenhuma tarefa encontrada</p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#1e4f5c", background: "#111" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #1e4f5c" }}>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "#a1a1aa" }}>Tarefa</th>
                  <th className="text-left px-4 py-3 text-xs font-medium hidden md:table-cell" style={{ color: "#a1a1aa" }}>Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-medium hidden md:table-cell" style={{ color: "#a1a1aa" }}>Competência</th>
                  <th className="text-left px-4 py-3 text-xs font-medium hidden lg:table-cell" style={{ color: "#a1a1aa" }}>Vencimento</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "#a1a1aa" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task, idx) => (
                  <tr key={task.id} style={{ borderBottom: idx < tasks.length - 1 ? "1px solid rgba(30,79,92,0.4)" : "none" }}>
                    <td className="px-4 py-3">
                      <Link href={`/tarefas/${task.id}`}>
                        <div className="flex items-center gap-2 cursor-pointer">
                          <TaskTypeBadge type={task.taskType} />
                          <span className="font-medium hover:text-teal-400 transition-colors" style={{ color: "#e5e5e5" }}>{task.title}</span>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs" style={{ color: "#a1a1aa" }}>
                      {clientMap.get(task.clientId) ?? "—"}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs" style={{ color: "#a1a1aa" }}>{task.competencia}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs" style={{ color: "#a1a1aa" }}>
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

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent style={{ background: "#111", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#e5e5e5" }}>Nova Tarefa</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label style={{ color: "#a1a1aa" }}>Cliente *</Label>
              <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                <SelectTrigger style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent style={{ background: "#111", borderColor: "#1e4f5c" }}>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)} style={{ color: "#e5e5e5" }}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label style={{ color: "#a1a1aa" }}>Tipo *</Label>
                <Select value={form.taskType} onValueChange={(v) => setForm({ ...form, taskType: v })}>
                  <SelectTrigger style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "#111", borderColor: "#1e4f5c" }}>
                    {TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value} style={{ color: "#e5e5e5" }}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label style={{ color: "#a1a1aa" }}>Competência *</Label>
                <Input
                  value={form.competencia}
                  onChange={(e) => setForm({ ...form, competencia: e.target.value })}
                  placeholder="MM/AAAA"
                  required
                  style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label style={{ color: "#a1a1aa" }}>Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }} />
            </div>
            <div className="space-y-1.5">
              <Label style={{ color: "#a1a1aa" }}>Data de Vencimento *</Label>
              <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }} />
            </div>
            <div className="space-y-1.5">
              <Label style={{ color: "#a1a1aa" }}>Observações</Label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full rounded-md px-3 py-2 text-sm resize-none"
                style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5", border: "1px solid #1e4f5c", outline: "none" }}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1" style={{ borderColor: "#1e4f5c", color: "#a1a1aa" }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending} className="flex-1" style={{ background: "#24646c", color: "#fff" }}>
                {createMutation.isPending ? "Criando..." : "Criar Tarefa"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
