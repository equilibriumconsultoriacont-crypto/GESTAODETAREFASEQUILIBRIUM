import AppLayout from "@/components/AppLayout";
import { StatusBadge, TaskTypeBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft, BookOpen, Building2, Calendar, FileText,
  Ban, Check, Mail, Package, Phone, PlusCircle, RefreshCw, Send, Trash2, Upload, X, Zap
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Link, useParams } from "wouter";

const MONTHS = [
  { v: "01", l: "Janeiro" }, { v: "02", l: "Fevereiro" }, { v: "03", l: "Março" },
  { v: "04", l: "Abril" }, { v: "05", l: "Maio" }, { v: "06", l: "Junho" },
  { v: "07", l: "Julho" }, { v: "08", l: "Agosto" }, { v: "09", l: "Setembro" },
  { v: "10", l: "Outubro" }, { v: "11", l: "Novembro" }, { v: "12", l: "Dezembro" },
];
const currentYear = new Date().getFullYear();
const YEARS = [currentYear - 1, currentYear, currentYear + 1];

export default function ClientDetail() {
  const params = useParams<{ id: string }>();
  const clientId = Number(params.id);

  const now = new Date();
  const [genMonth, setGenMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [genYear, setGenYear] = useState(String(now.getFullYear()));
  const [genOpen, setGenOpen] = useState(false);

  const [addTemplateOpen, setAddTemplateOpen] = useState(false);
  const [applyCatalogOpen, setApplyCatalogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [selectedTaskTitle, setSelectedTaskTitle] = useState("");
  const [selectedFileId, setSelectedFileId] = useState<number | undefined>();
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: clients = [] } = trpc.clients.list.useQuery({ includeInactive: true });
  const { data: tasks = [], isLoading: tasksLoading, refetch: refetchTasks } = trpc.tasks.list.useQuery({ clientId });
  const { data: emailLogs = [], refetch: refetchEmailLogs } = trpc.email.logs.useQuery({ clientId });
  const { data: recurring = [] } = trpc.recurringTasks.list.useQuery({ clientId });
  const { data: clientTemplates = [] } = trpc.clientTemplates.listByClient.useQuery({ clientId });
  const { data: allTemplates = [] } = trpc.taskTemplates.list.useQuery({ activeOnly: true });
  const { data: catalogs = [] } = trpc.taskCatalogs.list.useQuery({ activeOnly: true });
  const { data: taskFiles = [], refetch: refetchTaskFiles } = trpc.files.listByTask.useQuery(
    { taskId: selectedTaskId! },
    { enabled: !!selectedTaskId }
  );

  const addTemplateMutation = trpc.clientTemplates.add.useMutation();
  const removeTemplateMutation = trpc.clientTemplates.remove.useMutation();
  const applyCatalogMutation = trpc.taskCatalogs.applyToClient.useMutation();
  const uploadMutation = trpc.files.upload.useMutation();
  const sendEmailMutation = trpc.email.sendGuia.useMutation();
  const generateMonthly = trpc.tasks.generateMonthly.useMutation();
  const deleteTaskMutation = trpc.tasks.delete.useMutation();
  const updateStatusMutation = trpc.tasks.updateStatus.useMutation();
  const utils = trpc.useUtils();

  const client = clients.find((c) => c.id === clientId);
  const templateMap = new Map(allTemplates.map((t) => [t.id, t]));
  const assignedIds = new Set(clientTemplates.map((ct) => ct.taskTemplateId));
  const availableTemplates = allTemplates.filter((t) => !assignedIds.has(t.id));

  // ── Gerar tarefas ────────────────────────────────────────────────────────
  const handleGenerateTasks = async () => {
    try {
      const result = await generateMonthly.mutateAsync({
        month: Number(genMonth),
        year: Number(genYear),
        clientId,
      });
      if (result.created === 0 && result.skipped > 0) {
        toast.info(`Todas as tarefas de ${genMonth}/${genYear} já existem (${result.skipped} encontradas)`);
      } else {
        toast.success(`${result.created} tarefa(s) gerada(s) para ${genMonth}/${genYear}!`);
      }
      setGenOpen(false);
      refetchTasks();
      utils.tasks.dashboard.invalidate();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao gerar tarefas");
    }
  };

  // ── Templates ────────────────────────────────────────────────────────────
  const handleAddTemplate = async (templateId: number) => {
    try {
      await addTemplateMutation.mutateAsync({ clientId, taskTemplateId: templateId });
      toast.success("Obrigação adicionada! Gere as tarefas do mês para criar as instâncias.");
      utils.clientTemplates.listByClient.invalidate();
      utils.recurringTasks.list.invalidate();
      setAddTemplateOpen(false);
    } catch (err: any) { toast.error(err?.message ?? "Erro ao adicionar"); }
  };

  const handleRemoveTemplate = async (id: number) => {
    if (!confirm("Remover esta obrigação do cliente? As tarefas já geradas não serão apagadas.")) return;
    try {
      await removeTemplateMutation.mutateAsync({ id });
      toast.success("Obrigação removida");
      utils.clientTemplates.listByClient.invalidate();
    } catch (err: any) { toast.error(err?.message ?? "Erro ao remover"); }
  };

  const handleApplyCatalog = async (catalogId: number) => {
    try {
      const result = await applyCatalogMutation.mutateAsync({ clientId, catalogId });
      toast.success(`${result.added} obrigação(ões) adicionada(s)! Agora gere as tarefas do mês.`);
      utils.clientTemplates.listByClient.invalidate();
      utils.recurringTasks.list.invalidate();
      setApplyCatalogOpen(false);
    } catch (err: any) { toast.error(err?.message ?? "Erro ao aplicar catálogo"); }
  };

  const handleDeleteTask = async (taskId: number, taskTitle: string) => {
    if (!confirm(`Excluir a tarefa "${taskTitle}"?\n\nEssa ação também remove os arquivos vinculados e não pode ser desfeita.`)) return;
    try {
      await deleteTaskMutation.mutateAsync({ id: taskId });
      toast.success("Tarefa excluída!");
      refetchTasks();
      utils.tasks.dashboard.invalidate();
    } catch (err: any) { toast.error(err?.message ?? "Erro ao excluir tarefa"); }
  };

  const handleCompleteTask = async (taskId: number, taskTitle: string) => {
    try {
      await updateStatusMutation.mutateAsync({ id: taskId, status: "CONCLUIDA" });
      toast.success(`"${taskTitle}" concluída!`);
      refetchTasks();
      utils.tasks.dashboard.invalidate();
    } catch (err: any) { toast.error(err?.message ?? "Erro ao concluir"); }
  };

  const handleDismissTask = async (taskId: number, taskTitle: string) => {
    if (!confirm(`Desconsiderar a tarefa "${taskTitle}"?\n\nEla será marcada como cancelada (use para tarefas que não se aplicam neste mês).`)) return;
    try {
      await updateStatusMutation.mutateAsync({ id: taskId, status: "CANCELADA" });
      toast.success(`"${taskTitle}" desconsiderada`);
      refetchTasks();
      utils.tasks.dashboard.invalidate();
    } catch (err: any) { toast.error(err?.message ?? "Erro ao desconsiderar"); }
  };
  const openUpload = (taskId: number, taskTitle: string) => {
    setSelectedTaskId(taskId);
    setSelectedTaskTitle(taskTitle);
    setSelectedFile(null);
    setUploadDialogOpen(true);
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedTaskId) return;
    setIsUploading(true);
    try {
      // Converter arquivo para base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]!);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      await uploadMutation.mutateAsync({
        taskId: selectedTaskId,
        clientId,
        filename: selectedFile.name,
        mimeType: selectedFile.type || "application/pdf",
        fileSize: selectedFile.size,
        base64,
      });

      toast.success(`Arquivo "${selectedFile.name}" anexado com sucesso!`);
      setUploadDialogOpen(false);
      setSelectedFile(null);
      utils.files.listByTask.invalidate({ taskId: selectedTaskId });
      refetchTaskFiles();
    } catch (err: any) {
      toast.error("Falha no upload: " + (err?.message ?? "Erro desconhecido"));
    } finally {
      setIsUploading(false);
    }
  };

  // ── Email ────────────────────────────────────────────────────────────────
  const openEmail = (taskId: number, taskTitle: string) => {
    setSelectedTaskId(taskId);
    setSelectedTaskTitle(taskTitle);
    setSelectedFileId(undefined);
    setEmailTo(client?.email ?? "");
    setEmailSubject("");
    setEmailDialogOpen(true);
    // Carrega arquivos desta tarefa
    utils.files.listByTask.invalidate({ taskId });
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId || !client) return;
    try {
      await sendEmailMutation.mutateAsync({
        taskId: selectedTaskId,
        taskFileId: selectedFileId,
        recipientEmail: emailTo || client.email,
        clientName: client.name,
        subject: emailSubject || undefined,
      });
      toast.success("E-mail enviado com sucesso! ✉️");
      setEmailDialogOpen(false);
      refetchEmailLogs();
    } catch (err: any) {
      toast.error("Falha ao enviar: " + (err?.message ?? "Erro desconhecido"));
    }
  };

  if (!client) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <Building2 size={36} className="mx-auto mb-3" style={{ color: "#52525b" }} />
          <p style={{ color: "#a1a1aa" }}>Cliente não encontrado</p>
          <Link href="/clientes"><span className="text-xs cursor-pointer hover:underline mt-2 block" style={{ color: "#9fd4dc" }}>← Voltar</span></Link>
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

        {/* ── Cabeçalho do cliente ── */}
        <div className="rounded-xl p-5 border" style={{ background: "#111", borderColor: "#1e4f5c" }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mb-2"
                style={client.active
                  ? { background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }
                  : { background: "rgba(82,82,91,0.2)", color: "#a1a1aa", border: "1px solid rgba(82,82,91,0.4)" }}>
                {client.active ? "Ativo" : "Inativo"}
              </span>
              <h1 className="text-lg font-bold" style={{ color: "#e5e5e5" }}>{client.name}</h1>
              <p className="text-sm font-mono mt-1" style={{ color: "#a1a1aa" }}>{client.cnpj}</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm" style={{ color: "#a1a1aa" }}>
                <Mail size={13} style={{ color: "#9fd4dc" }} /><span>{client.email}</span>
              </div>
              {client.phone && (
                <div className="flex items-center gap-2 text-sm" style={{ color: "#a1a1aa" }}>
                  <Phone size={13} style={{ color: "#9fd4dc" }} /><span>{client.phone}</span>
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
          {/* Botão gerar tarefas — visível logo no topo do perfil */}
          <div className="mt-4 pt-4 flex justify-end" style={{ borderTop: "1px solid #1e4f5c" }}>
            <Button
              onClick={() => setGenOpen(true)}
              className="gap-2"
              style={{ background: "#24646c", color: "#fff" }}
            >
              <Zap size={14} /> Gerar tarefas do mês
            </Button>
          </div>
        </div>

        {/* ── Obrigações ── */}
        <div className="rounded-xl border" style={{ background: "#111", borderColor: "#1e4f5c" }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #1e4f5c" }}>
            <div className="flex items-center gap-2">
              <BookOpen size={15} style={{ color: "#9fd4dc" }} />
              <span className="text-sm font-medium" style={{ color: "#e5e5e5" }}>Obrigações ({clientTemplates.length})</span>
            </div>
            <div className="flex gap-2">
              {catalogs.length > 0 && (
                <Button onClick={() => setApplyCatalogOpen(true)} className="gap-1.5 text-xs h-7 px-3"
                  style={{ background: "rgba(36,100,108,0.1)", color: "#9fd4dc", border: "1px solid rgba(36,100,108,0.2)" }}>
                  <Package size={12} /> Catálogo
                </Button>
              )}
              <Button onClick={() => setAddTemplateOpen(true)} className="gap-1.5 text-xs h-7 px-3"
                style={{ background: "rgba(36,100,108,0.2)", color: "#9fd4dc", border: "1px solid rgba(36,100,108,0.3)" }}>
                <PlusCircle size={12} /> Adicionar
              </Button>
            </div>
          </div>
          {clientTemplates.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: "#a1a1aa" }}>Nenhuma obrigação vinculada</p>
              <p className="text-xs mt-1" style={{ color: "#52525b" }}>Adicione obrigações para depois gerar as tarefas mensais</p>
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
                        <p className="text-sm" style={{ color: "#e5e5e5" }}>{tmpl?.title ?? `Obrigação #${ct.taskTemplateId}`}</p>
                        {tmpl && <p className="text-xs mt-0.5" style={{ color: "#52525b" }}>Vence dia {tmpl.dueDayOfMonth}</p>}
                      </div>
                    </div>
                    <button onClick={() => handleRemoveTemplate(ct.id)}
                      className="p-1.5 rounded hover:bg-white/5" style={{ color: "#f87171" }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Tarefas ── */}
        <div className="rounded-xl border" style={{ background: "#111", borderColor: "#1e4f5c" }}>
          <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-2" style={{ borderBottom: "1px solid #1e4f5c" }}>
            <span className="text-sm font-medium" style={{ color: "#e5e5e5" }}>Tarefas ({tasks.length})</span>
            <Button onClick={() => setGenOpen(true)} className="gap-1.5 text-xs h-8 px-3"
              style={{ background: "#24646c", color: "#fff" }}>
              <Zap size={12} /> Gerar tarefas do mês
            </Button>
          </div>

          {tasksLoading ? (
            <div className="p-5 space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded animate-pulse" style={{ background: "#1a1a1a" }} />)}</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-10">
              <FileText size={28} className="mx-auto mb-2" style={{ color: "#52525b" }} />
              <p className="text-sm" style={{ color: "#a1a1aa" }}>Nenhuma tarefa registrada</p>
              <p className="text-xs mt-1 mb-4" style={{ color: "#52525b" }}>
                {clientTemplates.length === 0
                  ? "Primeiro adicione obrigações acima, depois gere as tarefas do mês"
                  : "Clique em \"Gerar tarefas do mês\" para criar as tarefas deste cliente"}
              </p>
              <Button onClick={() => setGenOpen(true)} className="gap-2"
                style={{ background: "#24646c", color: "#fff" }}>
                <Zap size={13} /> Gerar tarefas do mês
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(30,79,92,0.5)" }}>
                    <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "#a1a1aa" }}>Tarefa</th>
                    <th className="text-left px-4 py-3 text-xs font-medium hidden sm:table-cell" style={{ color: "#a1a1aa" }}>Competência</th>
                    <th className="text-left px-4 py-3 text-xs font-medium hidden md:table-cell" style={{ color: "#a1a1aa" }}>Vencimento</th>
                    <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "#a1a1aa" }}>Status</th>
                    <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: "#a1a1aa" }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task, idx) => (
                    <tr key={task.id} style={{ borderBottom: idx < tasks.length - 1 ? "1px solid rgba(30,79,92,0.3)" : "none" }}>
                      <td className="px-4 py-3">
                        <Link href={`/tarefas/${task.id}`}>
                          <div className="flex items-center gap-2 cursor-pointer">
                            <TaskTypeBadge type={task.taskType} />
                            <span className="hover:underline" style={{ color: "#e5e5e5" }}>{task.title}</span>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-xs" style={{ color: "#a1a1aa" }}>{task.competencia}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs" style={{ color: "#a1a1aa" }}>
                        {new Date(task.dueDate).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={task.status} dueDate={task.dueDate} completedAt={(task as any).completedAt} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {task.status !== "CONCLUIDA" && task.status !== "CANCELADA" && (
                            <>
                              <button
                                onClick={() => handleCompleteTask(task.id, task.title)}
                                className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors hover:bg-green-900/30"
                                style={{ color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}
                                title="Marcar como concluída"
                              >
                                <Check size={11} /> Concluir
                              </button>
                              <button
                                onClick={() => handleDismissTask(task.id, task.title)}
                                className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors hover:bg-zinc-700/30"
                                style={{ color: "#a1a1aa", border: "1px solid rgba(82,82,91,0.4)" }}
                                title="Desconsiderar (não se aplica este mês)"
                              >
                                <Ban size={11} /> Dispensar
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => openUpload(task.id, task.title)}
                            className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors hover:bg-teal-900/30"
                            style={{ color: "#9fd4dc", border: "1px solid rgba(36,100,108,0.4)" }}
                            title="Anexar arquivo à tarefa"
                          >
                            <Upload size={11} /> Anexar
                          </button>
                          <button
                            onClick={() => openEmail(task.id, task.title)}
                            className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors hover:bg-teal-900/30"
                            style={{ color: "#9fd4dc", border: "1px solid rgba(36,100,108,0.4)" }}
                            title="Enviar guia por e-mail"
                          >
                            <Mail size={11} /> Enviar
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id, task.title)}
                            className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors hover:bg-red-900/30"
                            style={{ color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}
                            title="Excluir tarefa"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Recorrentes ── */}
        {recurring.length > 0 && (
          <div className="rounded-xl border" style={{ background: "#111", borderColor: "#1e4f5c" }}>
            <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid #1e4f5c" }}>
              <RefreshCw size={15} style={{ color: "#9fd4dc" }} />
              <span className="text-sm font-medium" style={{ color: "#e5e5e5" }}>Recorrentes ({recurring.length})</span>
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
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs"
                      style={rt.active
                        ? { background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }
                        : { background: "rgba(82,82,91,0.2)", color: "#a1a1aa", border: "1px solid rgba(82,82,91,0.4)" }}>
                      {rt.active ? "Ativa" : "Inativa"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Histórico e-mails ── */}
        {emailLogs.length > 0 && (
          <div className="rounded-xl border" style={{ background: "#111", borderColor: "#1e4f5c" }}>
            <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid #1e4f5c" }}>
              <Mail size={15} style={{ color: "#9fd4dc" }} />
              <span className="text-sm font-medium" style={{ color: "#e5e5e5" }}>Histórico de E-mails ({emailLogs.length})</span>
            </div>
            <div className="divide-y" style={{ borderColor: "rgba(30,79,92,0.4)" }}>
              {emailLogs.slice(0, 15).map((log) => (
                <div key={log.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm" style={{ color: "#e5e5e5" }}>{log.subject}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#a1a1aa" }}>{log.recipientEmail}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs"
                      style={log.status === "ENVIADO"
                        ? { background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }
                        : { background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
                      {log.status === "ENVIADO" ? "✓ Enviado" : "✗ Falhou"}
                    </span>
                    <p className="text-xs mt-1" style={{ color: "#52525b" }}>
                      {new Date(log.sentAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══ DIALOGS ═══ */}

      {/* Gerar tarefas do mês */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent style={{ background: "#111", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#e5e5e5" }}>
              <div className="flex items-center gap-2"><Calendar size={16} style={{ color: "#9fd4dc" }} /> Gerar Tarefas do Mês</div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm" style={{ color: "#a1a1aa" }}>
              Vai gerar uma tarefa para cada obrigação recorrente ativa de <strong style={{ color: "#e5e5e5" }}>{client.name}</strong>.
            </p>
            <div>
              <Label style={{ color: "#a1a1aa" }}>Competência</Label>
              <div className="flex gap-2 mt-1">
                <select value={genMonth} onChange={(e) => setGenMonth(e.target.value)}
                  className="flex-1 rounded-md px-3 py-2 text-sm"
                  style={{ background: "#0d1f22", border: "1px solid #1e4f5c", color: "#e5e5e5", outline: "none" }}>
                  {MONTHS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
                </select>
                <select value={genYear} onChange={(e) => setGenYear(e.target.value)}
                  className="w-28 rounded-md px-3 py-2 text-sm"
                  style={{ background: "#0d1f22", border: "1px solid #1e4f5c", color: "#e5e5e5", outline: "none" }}>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            {recurring.filter(r => r.active).length === 0 && (
              <div className="p-3 rounded-lg text-xs" style={{ background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.3)", color: "#fb923c" }}>
                ⚠️ Este cliente não tem obrigações recorrentes ativas. Adicione obrigações primeiro.
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setGenOpen(false)} className="flex-1"
                style={{ borderColor: "#1e4f5c", color: "#a1a1aa" }}>Cancelar</Button>
              <Button onClick={handleGenerateTasks} disabled={generateMonthly.isPending || recurring.filter(r => r.active).length === 0}
                className="flex-1 gap-2" style={{ background: "#24646c", color: "#fff" }}>
                <Zap size={13} />
                {generateMonthly.isPending ? "Gerando..." : `Gerar ${genMonth}/${genYear}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Aplicar Catálogo */}
      <Dialog open={applyCatalogOpen} onOpenChange={setApplyCatalogOpen}>
        <DialogContent style={{ background: "#111", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
          <DialogHeader><DialogTitle style={{ color: "#e5e5e5" }}>Aplicar Catálogo</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto mt-2">
            {catalogs.map((cat) => (
              <button key={cat.id} onClick={() => handleApplyCatalog(cat.id)} disabled={applyCatalogMutation.isPending}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-left hover:bg-white/5 transition-colors"
                style={{ border: "1px solid rgba(30,79,92,0.5)" }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: "#e5e5e5" }}>{cat.name}</p>
                  {cat.description && <p className="text-xs mt-0.5" style={{ color: "#52525b" }}>{cat.description}</p>}
                </div>
                <Package size={14} style={{ color: "#9fd4dc" }} />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Adicionar Obrigação */}
      <Dialog open={addTemplateOpen} onOpenChange={setAddTemplateOpen}>
        <DialogContent style={{ background: "#111", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
          <DialogHeader><DialogTitle style={{ color: "#e5e5e5" }}>Adicionar Obrigação</DialogTitle></DialogHeader>
          <div className="space-y-2 mt-2 max-h-96 overflow-y-auto">
            {availableTemplates.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: "#a1a1aa" }}>Todas as obrigações já estão adicionadas.</p>
            ) : availableTemplates.map((t) => (
              <button key={t.id} onClick={() => handleAddTemplate(t.id)} disabled={addTemplateMutation.isPending}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-left hover:bg-white/5 transition-colors"
                style={{ border: "1px solid rgba(30,79,92,0.5)" }}>
                <div className="flex items-center gap-3">
                  <TaskTypeBadge type={t.taskType} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: "#e5e5e5" }}>{t.title}</p>
                    {t.description && <p className="text-xs" style={{ color: "#52525b" }}>{t.description}</p>}
                  </div>
                </div>
                <span className="text-xs shrink-0" style={{ color: "#9fd4dc" }}>Dia {t.dueDayOfMonth}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload de arquivo */}
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => { setUploadDialogOpen(open); if (!open) setSelectedFile(null); }}>
        <DialogContent style={{ background: "#111", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#e5e5e5" }}>
              Anexar Arquivo
              {selectedTaskTitle && <span className="text-xs font-normal ml-2" style={{ color: "#a1a1aa" }}>— {selectedTaskTitle}</span>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) setSelectedFile(f); }}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all"
              style={{ borderColor: isDragging ? "#9fd4dc" : "#1e4f5c", background: isDragging ? "rgba(36,100,108,0.1)" : "transparent" }}
            >
              <Upload size={28} className="mx-auto mb-3" style={{ color: isDragging ? "#9fd4dc" : "#52525b" }} />
              {selectedFile ? (
                <div>
                  <p className="text-sm font-medium" style={{ color: "#9fd4dc" }}>{selectedFile.name}</p>
                  <p className="text-xs mt-1" style={{ color: "#a1a1aa" }}>{(selectedFile.size / 1024).toFixed(0)} KB — {selectedFile.type || "arquivo"}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                    className="mt-2 text-xs hover:underline" style={{ color: "#f87171" }}>
                    <X size={11} className="inline mr-1" />Remover
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm" style={{ color: "#a1a1aa" }}>Arraste o arquivo aqui ou clique para selecionar</p>
                  <p className="text-xs mt-1" style={{ color: "#52525b" }}>PDF, PNG, JPG • Máximo 15MB</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && setSelectedFile(e.target.files[0])}
              />
            </div>

            {selectedFile && (
              <div className="p-3 rounded-lg text-xs" style={{ background: "rgba(36,100,108,0.1)", color: "#9fd4dc", border: "1px solid rgba(36,100,108,0.2)" }}>
                Após o upload, use o botão <strong>Enviar</strong> na tarefa para enviar por e-mail ao cliente.
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setUploadDialogOpen(false); setSelectedFile(null); }} className="flex-1"
                style={{ borderColor: "#1e4f5c", color: "#a1a1aa" }}>Cancelar</Button>
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className="flex-1 gap-2"
                style={{ background: "#24646c", color: "#fff" }}
              >
                <Upload size={13} />
                {isUploading ? "Enviando..." : "Fazer Upload"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Enviar por e-mail */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent style={{ background: "#111", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#e5e5e5" }}>
              Enviar por E-mail
              {selectedTaskTitle && <span className="text-xs font-normal ml-2" style={{ color: "#a1a1aa" }}>— {selectedTaskTitle}</span>}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSendEmail} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label style={{ color: "#a1a1aa" }}>Destinatário *</Label>
              <Input
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder={client?.email}
                required
                style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }}
              />
            </div>
            <div className="space-y-1.5">
              <Label style={{ color: "#a1a1aa" }}>Assunto (opcional)</Label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Ex: Guia DAS — Abril/2026"
                style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }}
              />
            </div>
            <div className="space-y-1.5">
              <Label style={{ color: "#a1a1aa" }}>Arquivo para anexar</Label>
              {taskFiles.length === 0 ? (
                <div className="p-3 rounded-lg text-xs" style={{ background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.3)", color: "#fb923c" }}>
                  Nenhum arquivo anexado a esta tarefa.{" "}
                  <button
                    type="button"
                    onClick={() => { setEmailDialogOpen(false); if (selectedTaskId) openUpload(selectedTaskId, selectedTaskTitle); }}
                    className="underline font-medium">
                    Clique para anexar um arquivo primeiro.
                  </button>
                </div>
              ) : (
                <Select
                  value={selectedFileId ? String(selectedFileId) : "none"}
                  onValueChange={(v) => setSelectedFileId(v !== "none" ? Number(v) : undefined)}
                >
                  <SelectTrigger style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
                    <SelectValue placeholder="Selecione um arquivo (opcional)" />
                  </SelectTrigger>
                  <SelectContent style={{ background: "#111", borderColor: "#1e4f5c" }}>
                    <SelectItem value="none" style={{ color: "#a1a1aa" }}>Enviar sem anexo</SelectItem>
                    {taskFiles.map((f) => (
                      <SelectItem key={f.id} value={String(f.id)} style={{ color: "#e5e5e5" }}>
                        {f.filename}
                        {f.fileSize ? ` (${(f.fileSize / 1024).toFixed(0)} KB)` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="p-3 rounded-lg text-xs" style={{ background: "rgba(36,100,108,0.08)", color: "#9fd4dc", border: "1px solid rgba(36,100,108,0.15)" }}>
              O e-mail será enviado com o template Equilibrium com os dados da tarefa.
              {client?.phone && " Uma notificação WhatsApp também será enviada."}
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setEmailDialogOpen(false)} className="flex-1"
                style={{ borderColor: "#1e4f5c", color: "#a1a1aa" }}>Cancelar</Button>
              <Button type="submit" disabled={sendEmailMutation.isPending} className="flex-1 gap-2"
                style={{ background: "#24646c", color: "#fff" }}>
                <Send size={13} />
                {sendEmailMutation.isPending ? "Enviando..." : "Enviar E-mail"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
