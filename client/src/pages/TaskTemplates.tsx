import AppLayout from "@/components/AppLayout";
import { TaskTypeBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { BookOpen, CalendarDays, FileText, PlusCircle, ToggleLeft, ToggleRight } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useState } from "react";
import { toast } from "sonner";

const TYPE_OPTIONS = [
  { value: "DAS", label: "DAS — Simples Nacional" },
  { value: "NFS", label: "NFS — Nota Fiscal de Serviço" },
  { value: "DCTF", label: "DCTF" },
  { value: "SPED", label: "SPED" },
  { value: "OUTROS", label: "Outros" },
  { value: "PIS", label: "PIS — regime normal" },
  { value: "COFINS", label: "COFINS — regime normal" },
  { value: "ICMS", label: "ICMS — regime normal" },
  { value: "ISSQN", label: "ISSQN — Rio Claro" },
];

const emptyForm = {
  title: "",
  taskType: "DAS",
  dueDayOfMonth: "20",
  description: "",
  ocrKeywords: "",
  department: "Geral",
  periodicity: "MENSAL",
  competenciaOffset: "1",
  annualMonth: "1",
  sendToClient: true,
  dueDateAdjust: "PROXIMO_DIA_UTIL",
};

export default function TaskTemplatesPage() {
  const isAdmin = useIsAdmin();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: templates = [], isLoading, refetch } = trpc.taskTemplates.list.useQuery({ activeOnly: false });
  const { data: departments = [] } = trpc.departments.list.useQuery();
  const createMutation = trpc.taskTemplates.create.useMutation();
  const updateMutation = trpc.taskTemplates.update.useMutation();
  const toggleMutation = trpc.taskTemplates.toggle.useMutation();
  const utils = trpc.useUtils();

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (t: typeof templates[0]) => {
    setEditTarget(t.id);
    setForm({
      title: t.title,
      taskType: t.taskType,
      dueDayOfMonth: String(t.dueDayOfMonth),
      description: t.description ?? "",
      ocrKeywords: t.ocrKeywords ?? "",
      department: (t as any).department ?? "Geral",
      periodicity: (t as any).periodicity ?? "MENSAL",
      competenciaOffset: String((t as any).competenciaOffset ?? 1),
      annualMonth: String((t as any).annualMonth ?? 1),
      sendToClient: (t as any).sendToClient ?? true,
      dueDateAdjust: (t as any).dueDateAdjust ?? "PROXIMO_DIA_UTIL",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editTarget) {
        await updateMutation.mutateAsync({
          id: editTarget,
          title: form.title,
          taskType: form.taskType as any,
          dueDayOfMonth: Number(form.dueDayOfMonth),
          description: form.description || undefined,
          ocrKeywords: form.ocrKeywords || undefined,
          department: form.department,
          periodicity: form.periodicity as any,
          competenciaOffset: Number(form.competenciaOffset),
          annualMonth: form.periodicity === "ANUAL" ? Number(form.annualMonth) : undefined,
          sendToClient: form.sendToClient,
          dueDateAdjust: form.dueDateAdjust as any,
        });
        toast.success("Template atualizado!");
      } else {
        await createMutation.mutateAsync({
          title: form.title,
          taskType: form.taskType as any,
          dueDayOfMonth: Number(form.dueDayOfMonth),
          description: form.description || undefined,
          ocrKeywords: form.ocrKeywords || undefined,
          department: form.department,
          periodicity: form.periodicity as any,
          competenciaOffset: Number(form.competenciaOffset),
          annualMonth: form.periodicity === "ANUAL" ? Number(form.annualMonth) : undefined,
          sendToClient: form.sendToClient,
          dueDateAdjust: form.dueDateAdjust as any,
        });
        toast.success("Template criado!");
      }
      setDialogOpen(false);
      utils.taskTemplates.list.invalidate();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao salvar");
    }
  };

  const handleToggle = async (id: number, active: boolean) => {
    await toggleMutation.mutateAsync({ id, active: !active });
    toast.success(active ? "Template desativado" : "Template reativado");
    utils.taskTemplates.list.invalidate();
  };

  const active = templates.filter((t) => t.active);
  const inactive = templates.filter((t) => !t.active);

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#e5e5e5" }}>Catálogo de Tarefas</h1>
            <p className="text-sm mt-0.5" style={{ color: "#a1a1aa" }}>
              Tarefas globais que podem ser atribuídas a qualquer cliente
            </p>
          </div>
          {isAdmin && (
            <Button onClick={openCreate} className="gap-2" style={{ background: "#24646c", color: "#fff" }}>
              <PlusCircle size={15} /> Nova Tarefa
            </Button>
          )}
        </div>

        {/* Info */}
        <div className="p-4 rounded-xl text-sm flex gap-3 items-start" style={{ background: "rgba(36,100,108,0.08)", border: "1px solid rgba(36,100,108,0.2)", color: "#9fd4dc" }}>
          <BookOpen size={15} className="mt-0.5 shrink-0" />
          <span>
            Aqui você cria o <strong>catálogo de obrigações</strong> da sua empresa — DAS, SPED, DCTF, etc.
            Depois, no cadastro de cada cliente, você seleciona quais dessas tarefas ele possui.
            O sistema gera automaticamente as instâncias mensais com as competências e vencimentos corretos.
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total de templates", value: templates.length, color: "#9fd4dc" },
            { label: "Ativos", value: active.length, color: "#4ade80" },
            { label: "Inativos", value: inactive.length, color: "#a1a1aa" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl p-4 border text-center" style={{ background: "#111", borderColor: "#1e4f5c" }}>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs mt-1" style={{ color: "#a1a1aa" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-lg animate-pulse" style={{ background: "#1a1a1a" }} />)}
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-16 rounded-xl border" style={{ borderColor: "#1e4f5c", background: "#111" }}>
            <FileText size={36} className="mx-auto mb-3" style={{ color: "#52525b" }} />
            <p className="text-sm" style={{ color: "#a1a1aa" }}>Nenhuma tarefa no catálogo ainda</p>
            <Button onClick={openCreate} className="mt-4 gap-2 text-sm" style={{ background: "#24646c", color: "#fff" }}>
              <PlusCircle size={13} /> Criar primeira tarefa
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#1e4f5c", background: "#111" }}>
            <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 480 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1e4f5c" }}>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "#a1a1aa" }}>Tarefa</th>
                  <th className="text-left px-4 py-3 text-xs font-medium hidden md:table-cell" style={{ color: "#a1a1aa" }}>Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium hidden md:table-cell" style={{ color: "#a1a1aa" }}>Vence dia</th>
                  <th className="text-left px-4 py-3 text-xs font-medium hidden lg:table-cell" style={{ color: "#a1a1aa" }}>OCR Keywords</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "#a1a1aa" }}>Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: "#a1a1aa" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t, idx) => (
                  <tr
                    key={t.id}
                    style={{
                      borderBottom: idx < templates.length - 1 ? "1px solid rgba(30,79,92,0.4)" : "none",
                      opacity: t.active ? 1 : 0.5,
                    }}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium" style={{ color: "#e5e5e5" }}>{t.title}</p>
                      {t.description && <p className="text-xs mt-0.5" style={{ color: "#52525b" }}>{t.description}</p>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <TaskTypeBadge type={t.taskType} />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: "#9fd4dc" }}>
                        <CalendarDays size={12} />
                        Dia {t.dueDayOfMonth}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {t.ocrKeywords ? (
                        <span className="text-xs font-mono" style={{ color: "#52525b" }}>{t.ocrKeywords}</span>
                      ) : (
                        <span className="text-xs" style={{ color: "#3f3f46" }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        style={t.active
                          ? { background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }
                          : { background: "rgba(82,82,91,0.2)", color: "#a1a1aa", border: "1px solid rgba(82,82,91,0.4)" }}
                      >
                        {t.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isAdmin ? (
                          <>
                            <button
                              onClick={() => openEdit(t)}
                              className="px-2.5 py-1 rounded text-xs hover:bg-white/5 transition-colors"
                              style={{ color: "#9fd4dc", border: "1px solid rgba(36,100,108,0.3)" }}
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleToggle(t.id, t.active)}
                              className="p-1.5 rounded hover:bg-white/5 transition-colors"
                              style={{ color: t.active ? "#f87171" : "#4ade80" }}
                              title={t.active ? "Desativar" : "Reativar"}
                            >
                              {t.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                            </button>
                          </>
                        ) : (
                          <span className="text-xs" style={{ color: "#52525b" }}>—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto" style={{ background: "#111", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#e5e5e5" }}>
              {editTarget ? "Editar Template" : "Nova Tarefa no Catálogo"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label style={{ color: "#a1a1aa" }}>Título *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                placeholder="Ex: DAS Simples Nacional, SPED Fiscal..."
                style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }}
              />
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
              <Label style={{ color: "#a1a1aa" }}>Departamento *</Label>
              <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                <SelectTrigger style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
                  <SelectValue placeholder="Selecione o departamento" />
                </SelectTrigger>
                <SelectContent style={{ background: "#111", borderColor: "#1e4f5c" }}>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.name} style={{ color: "#e5e5e5" }}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {departments.length === 0 && (
                <p className="text-xs" style={{ color: "#fb923c" }}>
                  Nenhum departamento cadastrado. Crie em Configurações → Departamentos.
                </p>
              )}
            </div>

            {/* Periodicidade e defasagem de competência */}
            <div className="rounded-lg border p-3 space-y-3" style={{ borderColor: "rgba(30,79,92,0.5)", background: "rgba(13,31,34,0.5)" }}>
              <div className="space-y-1.5">
                <Label style={{ color: "#a1a1aa" }}>Periodicidade *</Label>
                <Select value={form.periodicity} onValueChange={(v) => setForm({ ...form, periodicity: v })}>
                  <SelectTrigger style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "#111", borderColor: "#1e4f5c" }}>
                    <SelectItem value="MENSAL" style={{ color: "#e5e5e5" }}>Mensal</SelectItem>
                    <SelectItem value="TRIMESTRAL" style={{ color: "#e5e5e5" }}>Trimestral (mar/jun/set/dez)</SelectItem>
                    <SelectItem value="ANUAL" style={{ color: "#e5e5e5" }}>Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.periodicity === "ANUAL" ? (
                <div className="space-y-1.5">
                  <Label style={{ color: "#a1a1aa" }}>Mês de competência (quando é apurada) *</Label>
                  <Select value={form.annualMonth} onValueChange={(v) => setForm({ ...form, annualMonth: v })}>
                    <SelectTrigger style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent style={{ background: "#111", borderColor: "#1e4f5c" }}>
                      {[["1","Janeiro"],["2","Fevereiro"],["3","Março"],["4","Abril"],["5","Maio"],["6","Junho"],["7","Julho"],["8","Agosto"],["9","Setembro"],["10","Outubro"],["11","Novembro"],["12","Dezembro"]].map(([v, l]) => (
                        <SelectItem key={v} value={v} style={{ color: "#e5e5e5" }}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label style={{ color: "#a1a1aa" }}>Vencimento em relação à competência *</Label>
                <Select value={form.competenciaOffset} onValueChange={(v) => setForm({ ...form, competenciaOffset: v })}>
                  <SelectTrigger style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "#111", borderColor: "#1e4f5c" }}>
                    <SelectItem value="0" style={{ color: "#e5e5e5" }}>No mesmo mês da competência</SelectItem>
                    <SelectItem value="1" style={{ color: "#e5e5e5" }}>1 mês depois (ex: DAS)</SelectItem>
                    <SelectItem value="2" style={{ color: "#e5e5e5" }}>2 meses depois (ex: EFD Contribuições)</SelectItem>
                    <SelectItem value="3" style={{ color: "#e5e5e5" }}>3 meses depois</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs" style={{ color: "#52525b" }}>
                  Ex: competência 06/2026 + "1 mês depois" = vence em julho/2026
                </p>
              </div>

              <div className="space-y-1.5">
                <Label style={{ color: "#a1a1aa" }}>Regra de vencimento (dia não útil) *</Label>
                <Select value={form.dueDateAdjust} onValueChange={(v) => setForm({ ...form, dueDateAdjust: v })}>
                  <SelectTrigger style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "#111", borderColor: "#1e4f5c" }}>
                    <SelectItem value="PROXIMO_DIA_UTIL" style={{ color: "#e5e5e5" }}>Prorroga — próximo dia útil (DAS, ICMS)</SelectItem>
                    <SelectItem value="DIA_UTIL_ANTERIOR" style={{ color: "#e5e5e5" }}>Antecipa — dia útil anterior (PIS, COFINS)</SelectItem>
                    <SelectItem value="NENHUM" style={{ color: "#e5e5e5" }}>Manter a data exata</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs" style={{ color: "#52525b" }}>
                  Aplica quando o vencimento cai em fim de semana ou feriado.
                </p>
              </div>
            </div>

            {/* Envia para o cliente? */}
            <button
              type="button"
              onClick={() => setForm({ ...form, sendToClient: !form.sendToClient })}
              className="w-full flex items-center justify-between rounded-lg border p-3 transition-colors"
              style={{
                background: form.sendToClient ? "rgba(36,100,108,0.1)" : "rgba(82,82,91,0.08)",
                borderColor: form.sendToClient ? "rgba(36,100,108,0.4)" : "rgba(82,82,91,0.3)",
              }}
            >
              <div className="text-left">
                <div className="text-sm font-medium" style={{ color: "#e5e5e5" }}>Envia para o cliente</div>
                <div className="text-xs mt-0.5" style={{ color: "#52525b" }}>
                  {form.sendToClient
                    ? "Esta obrigação gera guia/documento que é enviado ao cliente"
                    : "Tarefa interna — não é enviada ao cliente (ex: conferência, lembrete)"}
                </div>
              </div>
              <div className="w-11 h-6 rounded-full relative transition-colors shrink-0 ml-3" style={{ background: form.sendToClient ? "#24646c" : "#3f3f46" }}>
                <div className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all" style={{ left: form.sendToClient ? "22px" : "2px" }} />
              </div>
            </button>
            <div className="space-y-1.5">
              <Label style={{ color: "#a1a1aa" }}>Descrição</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descrição opcional"
                style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }}
              />
            </div>
            <div className="space-y-1.5">
              <Label style={{ color: "#a1a1aa" }}>Keywords para OCR</Label>
              <Input
                value={form.ocrKeywords}
                onChange={(e) => setForm({ ...form, ocrKeywords: e.target.value })}
                placeholder="Ex: PGDAS, Simples Nacional, competência"
                style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }}
              />
              <p className="text-xs" style={{ color: "#52525b" }}>
                Palavras separadas por vírgula usadas no reconhecimento automático de documentos
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1" style={{ borderColor: "#1e4f5c", color: "#a1a1aa" }}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex-1"
                style={{ background: "#24646c", color: "#fff" }}
              >
                {createMutation.isPending || updateMutation.isPending ? "Salvando..." : editTarget ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
