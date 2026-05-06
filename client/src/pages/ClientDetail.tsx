import AppLayout from "@/components/AppLayout";
import { StatusBadge, TaskTypeBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, BookOpen, Building2, Mail, Phone, PlusCircle, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useParams } from "wouter";

export default function ClientDetail() {
  const params = useParams<{ id: string }>();
  const clientId = Number(params.id);
  const [addTemplateOpen, setAddTemplateOpen] = useState(false);

  const { data: clients = [] } = trpc.clients.list.useQuery({ includeInactive: true });
  const { data: tasks = [], isLoading } = trpc.tasks.list.useQuery({ clientId });
  const { data: emailLogs = [] } = trpc.email.logs.useQuery({ clientId });
  const { data: recurring = [] } = trpc.recurringTasks.list.useQuery({ clientId });
  const { data: clientTemplates = [] } = trpc.clientTemplates.listByClient.useQuery({ clientId });
  const { data: allTemplates = [] } = trpc.taskTemplates.list.useQuery({ activeOnly: true });

  const addTemplateMutation = trpc.clientTemplates.add.useMutation();
  const removeTemplateMutation = trpc.clientTemplates.remove.useMutation();
  const utils = trpc.useUtils();

  const client = clients.find((c) => c.id === clientId);
  const assignedTemplateIds = new Set(clientTemplates.map((ct) => ct.taskTemplateId));
  const availableTemplates = allTemplates.filter((t) => !assignedTemplateIds.has(t.id));
  const templateMap = new Map(allTemplates.map((t) => [t.id, t]));

  const handleAddTemplate = async (templateId: number) => {
    try {
      await addTemplateMutation.mutateAsync({ clientId, taskTemplateId: templateId });
      toast.success("Tarefa adicionada ao cliente!");
      utils.clientTemplates.listByClient.invalidate();
      utils.recurringTasks.list.invalidate();
      setAddTemplateOpen(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao adicionar tarefa");
    }
  };

  const handleRemoveTemplate = async (id: number) => {
    try {
      await removeTemplateMutation.mutateAsync({ id });
      toast.success("Tarefa removida do cliente");
      utils.clientTemplates.listByClient.invalidate();
      utils.recurringTasks.list.invalidate();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao remover");
    }
  };

  if (!client) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <Building2 size={36} className="mx-auto mb-3" style={{ color: "#52525b" }} />
          <p style={{ color: "#a1a1aa" }}>Cliente não encontrado</p>
          <Link href="/clientes">
            <span className="text-xs cursor-pointer hover:underline mt-2 block" style={{ color: "#9fd4dc" }}>← Voltar</span>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const stats = {
    total: tasks.length,
    pendente: tasks.filter((t) => t.status === "PENDENTE").length,
    concluida: tasks.filter((t) => t.status === "CONCLUIDA").length,
    vencida: tasks.filter((t) => t.status === "VENCIDA").length,
  };

  return (
    <AppLayout>
      <div className="max-w-4xl space-y-6">
        <Link href="/clientes">
          <div className="flex items-center gap-2 text-sm cursor-pointer hover:underline w-fit" style={{ color: "#9fd4dc" }}>
            <ArrowLeft size={14} /> Voltar para Clientes
          </div>
        </Link>

        {/* Client card */}
        <div className="rounded-xl p-5 border" style={{ background: "#111", borderColor: "#1e4f5c" }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                  style={client.active
                    ? { background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }
                    : { background: "rgba(82,82,91,0.2)", color: "#a1a1aa", border: "1px solid rgba(82,82,91,0.4)" }}
                >
                  {client.active ? "Ativo" : "Inativo"}
                </span>
              </div>
              <h1 className="text-lg font-bold" style={{ color: "#e5e5e5" }}>{client.name}</h1>
              <p className="text-sm font-mono mt-1" style={{ color: "#a1a1aa" }}>{client.cnpj}</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm" style={{ color: "#a1a1aa" }}>
                <Mail size={13} style={{ color: "#9fd4dc" }} />
                <span>{client.email}</span>
              </div>
              {client.phone && (
                <div className="flex items-center gap-2 text-sm" style={{ color: "#a1a1aa" }}>
                  <Phone size={13} style={{ color: "#9fd4dc" }} />
                  <span>{client.phone}</span>
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3 mt-5 pt-5" style={{ borderTop: "1px solid #1e4f5c" }}>
            {[
              { label: "Total", value: stats.total, color: "#9fd4dc" },
              { label: "Pendentes", value: stats.pendente, color: "#facc15" },
              { label: "Concluídas", value: stats.concluida, color: "#4ade80" },
              { label: "Vencidas", value: stats.vencida, color: "#f87171" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs" style={{ color: "#a1a1aa" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Obrigações do Cliente */}
        <div className="rounded-xl border" style={{ background: "#111", borderColor: "#1e4f5c" }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #1e4f5c" }}>
            <div className="flex items-center gap-2">
              <BookOpen size={15} style={{ color: "#9fd4dc" }} />
              <span className="text-sm font-medium" style={{ color: "#e5e5e5" }}>
                Obrigações do Cliente ({clientTemplates.length})
              </span>
            </div>
            {availableTemplates.length > 0 && (
              <Button
                onClick={() => setAddTemplateOpen(true)}
                className="gap-1.5 text-xs h-7 px-3"
                style={{ background: "rgba(36,100,108,0.2)", color: "#9fd4dc", border: "1px solid rgba(36,100,108,0.3)" }}
              >
                <PlusCircle size={12} /> Adicionar
              </Button>
            )}
          </div>
          {clientTemplates.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: "#a1a1aa" }}>Nenhuma obrigação vinculada</p>
              <p className="text-xs mt-1 mb-3" style={{ color: "#52525b" }}>
                Adicione as tarefas que este cliente possui
              </p>
              {availableTemplates.length > 0 && (
                <Button
                  onClick={() => setAddTemplateOpen(true)}
                  className="gap-2 text-xs"
                  style={{ background: "#24646c", color: "#fff" }}
                >
                  <PlusCircle size={12} /> Adicionar obrigação
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "rgba(30,79,92,0.3)" }}>
              {clientTemplates.map((ct) => {
                const tmpl = templateMap.get(ct.taskTemplateId ?? 0);
                return (
                  <div key={ct.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      {tmpl && <TaskTypeBadge type={tmpl.taskType} />}
                      <div>
                        <p className="text-sm" style={{ color: "#e5e5e5" }}>{tmpl?.title ?? `Template #${ct.taskTemplateId}`}</p>
                        {tmpl && <p className="text-xs mt-0.5" style={{ color: "#52525b" }}>Vence dia {tmpl.dueDayOfMonth}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={ct.active
                          ? { background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }
                          : { background: "rgba(82,82,91,0.2)", color: "#a1a1aa", border: "1px solid rgba(82,82,91,0.4)" }}
                      >
                        {ct.active ? "Ativa" : "Inativa"}
                      </span>
                      <button
                        onClick={() => handleRemoveTemplate(ct.id)}
                        className="p-1.5 rounded hover:bg-white/5 transition-colors"
                        style={{ color: "#f87171" }}
                        title="Remover"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recorrentes geradas */}
        {recurring.length > 0 && (
          <div className="rounded-xl border" style={{ background: "#111", borderColor: "#1e4f5c" }}>
            <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid #1e4f5c" }}>
              <RefreshCw size={15} style={{ color: "#9fd4dc" }} />
              <span className="text-sm font-medium" style={{ color: "#e5e5e5" }}>Recorrentes Geradas ({recurring.length})</span>
            </div>
            <div className="divide-y" style={{ borderColor: "rgba(30,79,92,0.4)" }}>
              {recurring.map((rt) => (
                <div key={rt.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-2">
                    <TaskTypeBadge type={rt.taskType} />
                    <span className="text-sm" style={{ color: "#e5e5e5" }}>{rt.title}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs" style={{ color: "#a1a1aa" }}>Vence dia {rt.dueDayOfMonth}</span>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                      style={rt.active
                        ? { background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }
                        : { background: "rgba(82,82,91,0.2)", color: "#a1a1aa", border: "1px solid rgba(82,82,91,0.4)" }}
                    >
                      {rt.active ? "Ativa" : "Inativa"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Histórico de Tarefas */}
        <div className="rounded-xl border" style={{ background: "#111", borderColor: "#1e4f5c" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid #1e4f5c" }}>
            <span className="text-sm font-medium" style={{ color: "#e5e5e5" }}>Histórico de Tarefas</span>
          </div>
          {isLoading ? (
            <div className="p-5 space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded animate-pulse" style={{ background: "#1a1a1a" }} />)}
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm" style={{ color: "#a1a1aa" }}>Nenhuma tarefa registrada</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(30,79,92,0.5)" }}>
                  <th className="text-left px-5 py-3 text-xs font-medium" style={{ color: "#a1a1aa" }}>Tarefa</th>
                  <th className="text-left px-5 py-3 text-xs font-medium hidden md:table-cell" style={{ color: "#a1a1aa" }}>Competência</th>
                  <th className="text-left px-5 py-3 text-xs font-medium hidden md:table-cell" style={{ color: "#a1a1aa" }}>Vencimento</th>
                  <th className="text-left px-5 py-3 text-xs font-medium" style={{ color: "#a1a1aa" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task, idx) => (
                  <tr key={task.id} style={{ borderBottom: idx < tasks.length - 1 ? "1px solid rgba(30,79,92,0.3)" : "none" }}>
                    <td className="px-5 py-3">
                      <Link href={`/tarefas/${task.id}`}>
                        <div className="flex items-center gap-2 cursor-pointer">
                          <TaskTypeBadge type={task.taskType} />
                          <span className="hover:underline" style={{ color: "#e5e5e5" }}>{task.title}</span>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell text-xs" style={{ color: "#a1a1aa" }}>{task.competencia}</td>
                    <td className="px-5 py-3 hidden md:table-cell text-xs" style={{ color: "#a1a1aa" }}>
                      {new Date(task.dueDate).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={task.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Email history */}
        {emailLogs.length > 0 && (
          <div className="rounded-xl border" style={{ background: "#111", borderColor: "#1e4f5c" }}>
            <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid #1e4f5c" }}>
              <Mail size={15} style={{ color: "#9fd4dc" }} />
              <span className="text-sm font-medium" style={{ color: "#e5e5e5" }}>Histórico de E-mails ({emailLogs.length})</span>
            </div>
            <div className="divide-y" style={{ borderColor: "rgba(30,79,92,0.4)" }}>
              {emailLogs.slice(0, 10).map((log) => (
                <div key={log.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm" style={{ color: "#e5e5e5" }}>{log.subject}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#a1a1aa" }}>{log.recipientEmail}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                      style={log.status === "ENVIADO"
                        ? { background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }
                        : { background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
                    >
                      {log.status === "ENVIADO" ? "Enviado" : "Falhou"}
                    </span>
                    <p className="text-xs mt-1" style={{ color: "#52525b" }}>{new Date(log.sentAt).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Template Dialog */}
      <Dialog open={addTemplateOpen} onOpenChange={setAddTemplateOpen}>
        <DialogContent style={{ background: "#111", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#e5e5e5" }}>Adicionar Obrigação ao Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2 max-h-96 overflow-y-auto">
            {availableTemplates.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: "#a1a1aa" }}>
                Todos os templates já foram adicionados a este cliente.
              </p>
            ) : (
              availableTemplates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleAddTemplate(t.id)}
                  disabled={addTemplateMutation.isPending}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-left hover:bg-white/5 transition-colors"
                  style={{ border: "1px solid rgba(30,79,92,0.5)" }}
                >
                  <div className="flex items-center gap-3">
                    <TaskTypeBadge type={t.taskType} />
                    <div>
                      <p className="text-sm font-medium" style={{ color: "#e5e5e5" }}>{t.title}</p>
                      {t.description && <p className="text-xs" style={{ color: "#52525b" }}>{t.description}</p>}
                    </div>
                  </div>
                  <span className="text-xs shrink-0" style={{ color: "#9fd4dc" }}>Dia {t.dueDayOfMonth}</span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
