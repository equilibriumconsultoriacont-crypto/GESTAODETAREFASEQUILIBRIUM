import AppLayout from "@/components/AppLayout";
import { TaskTypeBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { CalendarClock, PlusCircle, RefreshCw, ToggleLeft, ToggleRight, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const TYPE_OPTIONS = [
  { value: "DAS", label: "DAS — Simples Nacional" },
  { value: "NFS", label: "NFS — Nota Fiscal de Serviço" },
  { value: "DCTF", label: "DCTF" },
  { value: "SPED", label: "SPED" },
  { value: "OUTROS", label: "Outros" },
];

export default function RecurringTasksPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [clientFilter, setClientFilter] = useState("ALL");
  const [form, setForm] = useState({ clientId: "", title: "", taskType: "DAS", dueDayOfMonth: "20", description: "" });
  const [generateForm, setGenerateForm] = useState({ month: String(new Date().getMonth() + 1), year: String(new Date().getFullYear()) });

  const { data: clients = [] } = trpc.clients.list.useQuery({ includeInactive: false });
  const { data: recurring = [], isLoading, refetch } = trpc.recurringTasks.list.useQuery({
    clientId: clientFilter !== "ALL" ? Number(clientFilter) : undefined,
  });
  const createMutation = trpc.recurringTasks.create.useMutation();
  const toggleMutation = trpc.recurringTasks.toggle.useMutation();
  const generateMutation = trpc.tasks.generateMonthly.useMutation();
  const utils = trpc.useUtils();

  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync({
        clientId: Number(form.clientId),
        title: form.title,
        taskType: form.taskType as "DAS" | "NFS" | "DCTF" | "SPED" | "OUTROS",
        dueDayOfMonth: Number(form.dueDayOfMonth),
        description: form.description || undefined,
      });
      toast.success("Tarefa recorrente criada!");
      setDialogOpen(false);
      utils.recurringTasks.list.invalidate();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar");
    }
  };

  const handleToggle = async (id: number, active: boolean) => {
    await toggleMutation.mutateAsync({ id, active: !active });
    toast.success(active ? "Tarefa recorrente desativada" : "Tarefa recorrente reativada");
    utils.recurringTasks.list.invalidate();
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await generateMutation.mutateAsync({
        month: Number(generateForm.month),
        year: Number(generateForm.year),
      });
      toast.success(`${result.created} tarefa(s) gerada(s), ${result.skipped} ignorada(s)`);
      setGenerateDialogOpen(false);
      utils.tasks.list.invalidate();
      utils.tasks.dashboard.invalidate();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar tarefas");
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#e5e5e5" }}>Tarefas Recorrentes</h1>
            <p className="text-sm mt-0.5" style={{ color: "#a1a1aa" }}>Modelos de obrigações mensais por cliente</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setGenerateDialogOpen(true)}
              className="gap-2 text-xs"
              style={{ background: "rgba(36,100,108,0.2)", color: "#9fd4dc", border: "1px solid rgba(36,100,108,0.3)" }}
            >
              <Zap size={13} /> Gerar Tarefas do Mês
            </Button>
            <Button onClick={() => setDialogOpen(true)} className="gap-2" style={{ background: "#24646c", color: "#fff" }}>
              <PlusCircle size={15} /> Nova Recorrente
            </Button>
          </div>
        </div>

        {/* Info box */}
        <div className="p-4 rounded-xl text-sm" style={{ background: "rgba(36,100,108,0.08)", border: "1px solid rgba(36,100,108,0.2)", color: "#9fd4dc" }}>
          <CalendarClock size={15} className="inline mr-2" />
          As tarefas recorrentes ativas geram automaticamente uma instância mensal para cada cliente ativo. Use o botão <strong>"Gerar Tarefas do Mês"</strong> para criar as tarefas de uma competência específica.
        </div>

        {/* Filter */}
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-56 text-sm" style={{ background: "#111", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
            <SelectValue placeholder="Todos os clientes" />
          </SelectTrigger>
          <SelectContent style={{ background: "#111", borderColor: "#1e4f5c" }}>
            <SelectItem value="ALL" style={{ color: "#e5e5e5" }}>Todos os clientes</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={String(c.id)} style={{ color: "#e5e5e5" }}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* List */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-lg animate-pulse" style={{ background: "#1a1a1a" }} />)}
          </div>
        ) : recurring.length === 0 ? (
          <div className="text-center py-16 rounded-xl border" style={{ borderColor: "#1e4f5c", background: "#111" }}>
            <RefreshCw size={36} className="mx-auto mb-3" style={{ color: "#52525b" }} />
            <p className="text-sm" style={{ color: "#a1a1aa" }}>Nenhuma tarefa recorrente configurada</p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#1e4f5c", background: "#111" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #1e4f5c" }}>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "#a1a1aa" }}>Tarefa</th>
                  <th className="text-left px-4 py-3 text-xs font-medium hidden md:table-cell" style={{ color: "#a1a1aa" }}>Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-medium hidden md:table-cell" style={{ color: "#a1a1aa" }}>Vence dia</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "#a1a1aa" }}>Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: "#a1a1aa" }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {recurring.map((rt, idx) => (
                  <tr key={rt.id} style={{ borderBottom: idx < recurring.length - 1 ? "1px solid rgba(30,79,92,0.4)" : "none" }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <TaskTypeBadge type={rt.taskType} />
                        <span className="font-medium" style={{ color: "#e5e5e5" }}>{rt.title}</span>
                      </div>
                      {rt.description && <p className="text-xs mt-0.5" style={{ color: "#52525b" }}>{rt.description}</p>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs" style={{ color: "#a1a1aa" }}>
                      {clientMap.get(rt.clientId) ?? "—"}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs font-medium" style={{ color: "#9fd4dc" }}>
                      Dia {rt.dueDayOfMonth}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        style={rt.active
                          ? { background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }
                          : { background: "rgba(82,82,91,0.2)", color: "#a1a1aa", border: "1px solid rgba(82,82,91,0.4)" }}
                      >
                        {rt.active ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleToggle(rt.id, rt.active)}
                        className="p-1.5 rounded hover:bg-white/5 transition-colors"
                        style={{ color: rt.active ? "#f87171" : "#4ade80" }}
                        title={rt.active ? "Desativar" : "Reativar"}
                      >
                        {rt.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      </button>
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
        <DialogContent className="max-h-[85vh] overflow-y-auto" style={{ background: "#111", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#e5e5e5" }}>Nova Tarefa Recorrente</DialogTitle>
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
                <Label style={{ color: "#a1a1aa" }}>Vence no dia *</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={form.dueDayOfMonth}
                  onChange={(e) => setForm({ ...form, dueDayOfMonth: e.target.value })}
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
              <Label style={{ color: "#a1a1aa" }}>Descrição</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1" style={{ borderColor: "#1e4f5c", color: "#a1a1aa" }}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending} className="flex-1" style={{ background: "#24646c", color: "#fff" }}>
                {createMutation.isPending ? "Criando..." : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Generate Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto" style={{ background: "#111", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#e5e5e5" }}>Gerar Tarefas do Mês</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleGenerate} className="space-y-4 mt-2">
            <p className="text-sm" style={{ color: "#a1a1aa" }}>
              Gera instâncias de todas as tarefas recorrentes ativas para a competência selecionada. Tarefas já existentes serão ignoradas.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label style={{ color: "#a1a1aa" }}>Mês *</Label>
                <Select value={generateForm.month} onValueChange={(v) => setGenerateForm({ ...generateForm, month: v })}>
                  <SelectTrigger style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "#111", borderColor: "#1e4f5c" }}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={String(m)} style={{ color: "#e5e5e5" }}>
                        {new Date(2024, m - 1, 1).toLocaleString("pt-BR", { month: "long" })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label style={{ color: "#a1a1aa" }}>Ano *</Label>
                <Input
                  type="number"
                  value={generateForm.year}
                  onChange={(e) => setGenerateForm({ ...generateForm, year: e.target.value })}
                  required
                  style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setGenerateDialogOpen(false)} className="flex-1" style={{ borderColor: "#1e4f5c", color: "#a1a1aa" }}>Cancelar</Button>
              <Button type="submit" disabled={generateMutation.isPending} className="flex-1 gap-2" style={{ background: "#24646c", color: "#fff" }}>
                <Zap size={13} />
                {generateMutation.isPending ? "Gerando..." : "Gerar Tarefas"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
