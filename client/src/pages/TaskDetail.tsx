import AppLayout from "@/components/AppLayout";
import { StatusBadge, TaskTypeBadge } from "@/components/StatusBadge";
import { TaskTimeline } from "@/components/TaskTimeline";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock,
  Download,
  FilePlus,
  FileText,
  Mail,
  PlusCircle,
  Trash2,
  Paperclip,
  Send,
  Upload,
  XCircle,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

export default function TaskDetail() {
  const params = useParams<{ id: string }>();
  const taskId = Number(params.id);

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<number | undefined>();
  const [emailForm, setEmailForm] = useState({ to: "", subject: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: task, isLoading, refetch } = trpc.tasks.getById.useQuery({ id: taskId });
  const { data: files = [], refetch: refetchFiles } = trpc.files.listByTask.useQuery({ taskId });
  const { data: emailLogs = [] } = trpc.email.logs.useQuery({ taskId });
  const { data: history = [], refetch: refetchHistory } = trpc.tasks.history.useQuery({ id: taskId });
  const { data: clients = [] } = trpc.clients.list.useQuery({ includeInactive: true });

  const uploadMutation = trpc.files.upload.useMutation(); // kept for type compat
  const deleteFileMutation = trpc.files.delete.useMutation();
  const [isUploading, setIsUploading] = useState(false);

  const handleDeleteFile = async (fileId: number, filename: string) => {
    if (!confirm(`Remover o arquivo "${filename}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteFileMutation.mutateAsync({ fileId });
      toast.success("Arquivo removido com sucesso");
      refetchFiles();
      refetchHistory();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao remover arquivo");
    }
  };
  const sendEmailMutation = trpc.email.sendGuia.useMutation();
  const updateStatusMutation = trpc.tasks.updateStatus.useMutation();
  const utils = trpc.useUtils();

  const client = clients.find((c) => c.id === task?.clientId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !task) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("taskId", String(task.id));
      formData.append("clientId", String(task.clientId));

      const res = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro no upload");

      toast.success("Arquivo enviado com sucesso");
      setUploadDialogOpen(false);
      setSelectedFile(null);
      refetchFiles();
      refetchHistory();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao fazer upload");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !client) return;
    try {
      await sendEmailMutation.mutateAsync({
        taskId: task.id,
        taskFileId: selectedFileId,
        recipientEmail: emailForm.to || client.email,
        clientName: client.name,
        subject: emailForm.subject || undefined,
      });
      toast.success("E-mail enviado com sucesso!");
      setEmailDialogOpen(false);
      utils.email.logs.invalidate({ taskId });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar e-mail");
    }
  };

  const handleStatusChange = async (status: "PENDENTE" | "EM_ANDAMENTO" | "AGUARDANDO_CLIENTE" | "EM_REVISAO" | "CONCLUIDA" | "CANCELADA" | "VENCIDA") => {
    if (!task) return;
    await updateStatusMutation.mutateAsync({ id: task.id, status });
    toast.success("Status atualizado");
    refetch();
    refetchHistory();
    utils.tasks.dashboard.invalidate();
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-lg animate-pulse" style={{ background: "#1a1a1a" }} />)}
        </div>
      </AppLayout>
    );
  }

  if (!task) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <XCircle size={36} className="mx-auto mb-3" style={{ color: "#52525b" }} />
          <p style={{ color: "#a1a1aa" }}>Tarefa não encontrada</p>
          <Link href="/tarefas"><span className="text-xs cursor-pointer hover:underline mt-2 block" style={{ color: "#9fd4dc" }}>← Voltar</span></Link>
        </div>
      </AppLayout>
    );
  }

  const isOverdue = new Date(task.dueDate) < new Date() && task.status !== "CONCLUIDA" && task.status !== "CANCELADA" && task.status !== "VENCIDA";

  return (
    <AppLayout>
      <div className="max-w-3xl space-y-6">
        {/* Back */}
        <Link href="/tarefas">
          <div className="flex items-center gap-2 text-sm cursor-pointer hover:underline w-fit" style={{ color: "#9fd4dc" }}>
            <ArrowLeft size={14} /> Voltar para Tarefas
          </div>
        </Link>

        {/* Header card */}
        <div className="rounded-xl p-5 border" style={{ background: "#111", borderColor: "#1e4f5c" }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <TaskTypeBadge type={task.taskType} />
                <StatusBadge status={task.status} dueDate={task.dueDate} completedAt={task.completedAt} />
              </div>
              <h1 className="text-lg font-bold" style={{ color: "#e5e5e5" }}>{task.title}</h1>
              {client && (
                <Link href={`/clientes/${client.id}`}>
                  <p className="text-sm mt-1 cursor-pointer hover:underline" style={{ color: "#9fd4dc" }}>{client.name}</p>
                </Link>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs" style={{ color: "#a1a1aa" }}>Competência</p>
              <p className="text-base font-semibold" style={{ color: "#e5e5e5" }}>{task.competencia}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4 pt-4" style={{ borderTop: "1px solid #1e4f5c" }}>
            <div>
              <p className="text-xs mb-1" style={{ color: "#a1a1aa" }}>Vencimento</p>
              <p className={`text-sm font-medium ${isOverdue ? "text-red-400" : ""}`} style={isOverdue ? {} : { color: "#e5e5e5" }}>
                {new Date(task.dueDate).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: "#a1a1aa" }}>Criada em</p>
              <p className="text-sm" style={{ color: "#e5e5e5" }}>{new Date(task.createdAt).toLocaleDateString("pt-BR")}</p>
            </div>
            {task.completedAt && (
              <div>
                <p className="text-xs mb-1" style={{ color: "#a1a1aa" }}>Concluída em</p>
                <p className="text-sm" style={{ color: "#4ade80" }}>{new Date(task.completedAt).toLocaleDateString("pt-BR")}</p>
              </div>
            )}
          </div>

          {task.notes && (
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid #1e4f5c" }}>
              <p className="text-xs mb-1" style={{ color: "#a1a1aa" }}>Observações</p>
              <p className="text-sm" style={{ color: "#e5e5e5" }}>{task.notes}</p>
            </div>
          )}
        </div>

        {/* Status actions */}
        <div className="rounded-xl p-4 border" style={{ background: "#111", borderColor: "#1e4f5c" }}>
          <p className="text-xs font-medium mb-3" style={{ color: "#a1a1aa" }}>ALTERAR STATUS</p>
          <div className="flex gap-2 flex-wrap">
            {([
              { value: "PENDENTE",           label: "⏳ Pendente" },
              { value: "EM_ANDAMENTO",       label: "🔄 Em Andamento" },
              { value: "AGUARDANDO_CLIENTE", label: "🕐 Aguard. Cliente" },
              { value: "EM_REVISAO",         label: "🔍 Em Revisão" },
              { value: "CONCLUIDA",          label: "✅ Concluída" },
              { value: "CANCELADA",          label: "🚫 Cancelada" },
              { value: "VENCIDA",            label: "🚨 Vencida" },
            ] as const).map((s) => (
              <button
                key={s.value}
                onClick={() => handleStatusChange(s.value as any)}
                disabled={task.status === s.value || updateStatusMutation.isPending}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
                style={task.status === s.value
                  ? { background: "rgba(36,100,108,0.3)", color: "#9fd4dc", border: "1px solid #24646c" }
                  : { background: "rgba(255,255,255,0.04)", color: "#a1a1aa", border: "1px solid #1e4f5c" }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Files */}
        <div className="rounded-xl border" style={{ background: "#111", borderColor: "#1e4f5c" }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #1e4f5c" }}>
            <div className="flex items-center gap-2">
              <Paperclip size={15} style={{ color: "#9fd4dc" }} />
              <span className="text-sm font-medium" style={{ color: "#e5e5e5" }}>Arquivos ({files.length})</span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => { setSelectedFileId(undefined); setEmailForm({ to: client?.email ?? "", subject: "" }); setEmailDialogOpen(true); }}
                className="gap-1.5 text-xs"
                style={{ background: "rgba(36,100,108,0.2)", color: "#9fd4dc", border: "1px solid rgba(36,100,108,0.3)" }}
              >
                <Send size={12} /> Enviar por E-mail
              </Button>
              <Button size="sm" onClick={() => setUploadDialogOpen(true)} className="gap-1.5 text-xs" style={{ background: "#24646c", color: "#fff" }}>
                <Upload size={12} /> Upload
              </Button>
            </div>
          </div>
          {files.length === 0 ? (
            <div className="text-center py-10">
              <FileText size={28} className="mx-auto mb-2" style={{ color: "#52525b" }} />
              <p className="text-sm" style={{ color: "#a1a1aa" }}>Nenhum arquivo anexado</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "rgba(30,79,92,0.4)" }}>
              {files.map((file) => (
                <div key={file.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <FileText size={16} style={{ color: "#9fd4dc" }} />
                    <div>
                      <p className="text-sm font-medium" style={{ color: "#e5e5e5" }}>{file.filename}</p>
                      <p className="text-xs" style={{ color: "#a1a1aa" }}>
                        {new Date(file.uploadedAt).toLocaleDateString("pt-BR")}
                        {file.fileSize ? ` · ${(file.fileSize / 1024).toFixed(0)} KB` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setSelectedFileId(file.id); setEmailForm({ to: client?.email ?? "", subject: "" }); setEmailDialogOpen(true); }}
                      className="p-1.5 rounded hover:bg-white/5 transition-colors"
                      style={{ color: "#9fd4dc" }}
                      title="Enviar por e-mail"
                    >
                      <Mail size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteFile(file.id, file.filename)}
                      className="p-1.5 rounded hover:bg-white/5 transition-colors"
                      style={{ color: "#f87171" }}
                      title="Remover arquivo"
                    >
                      <Trash2 size={14} />
                    </button>
                    <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-white/5 transition-colors" style={{ color: "#a1a1aa" }} title="Baixar">
                      <Download size={14} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Histórico unificado (timeline) */}
        <div className="rounded-xl border" style={{ background: "#111", borderColor: "#1e4f5c" }}>
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid #1e4f5c" }}>
            <Clock size={15} style={{ color: "#9fd4dc" }} />
            <span className="text-sm font-medium" style={{ color: "#e5e5e5" }}>Histórico da Tarefa ({history.length})</span>
          </div>
          {history.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: "#a1a1aa" }}>Nenhum evento registrado ainda</p>
            </div>
          ) : (
            <div className="p-5">
              <TaskTimeline history={history} />
            </div>
          )}
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent style={{ background: "#111", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#e5e5e5" }}>Upload de Arquivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-teal-500/50 transition-colors"
              style={{ borderColor: "#1e4f5c" }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={28} className="mx-auto mb-3" style={{ color: "#52525b" }} />
              {selectedFile ? (
                <div>
                  <p className="text-sm font-medium" style={{ color: "#9fd4dc" }}>{selectedFile.name}</p>
                  <p className="text-xs mt-1" style={{ color: "#a1a1aa" }}>{(selectedFile.size / 1024).toFixed(0)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm" style={{ color: "#a1a1aa" }}>Clique para selecionar o arquivo</p>
                  <p className="text-xs mt-1" style={{ color: "#52525b" }}>PDF, imagens até 10MB</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleFileChange} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setUploadDialogOpen(false)} className="flex-1" style={{ borderColor: "#1e4f5c", color: "#a1a1aa" }}>Cancelar</Button>
              <Button onClick={handleUpload} disabled={!selectedFile || isUploading} className="flex-1" style={{ background: "#24646c", color: "#fff" }}>
                {isUploading ? "Enviando..." : "Fazer Upload"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent style={{ background: "#111", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#e5e5e5" }}>Enviar Guia por E-mail</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSendEmail} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label style={{ color: "#a1a1aa" }}>Destinatário *</Label>
              <Input
                type="email"
                value={emailForm.to}
                onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })}
                placeholder={client?.email}
                style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }}
              />
            </div>
            <div className="space-y-1.5">
              <Label style={{ color: "#a1a1aa" }}>Assunto (opcional)</Label>
              <Input
                value={emailForm.subject}
                onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                placeholder={`Guia ${task?.taskType} — ${task?.competencia}`}
                style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }}
              />
            </div>
            {files.length > 0 && (
              <div className="space-y-1.5">
                <Label style={{ color: "#a1a1aa" }}>Anexar arquivo</Label>
                <Select value={selectedFileId ? String(selectedFileId) : "none"} onValueChange={(v) => setSelectedFileId(v !== "none" ? Number(v) : undefined)}>
                  <SelectTrigger style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
                    <SelectValue placeholder="Sem anexo" />
                  </SelectTrigger>
                  <SelectContent style={{ background: "#111", borderColor: "#1e4f5c" }}>
                    <SelectItem value="none" style={{ color: "#a1a1aa" }}>Sem anexo</SelectItem>
                    {files.map((f) => (
                      <SelectItem key={f.id} value={String(f.id)} style={{ color: "#e5e5e5" }}>{f.filename}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="p-3 rounded-lg text-xs" style={{ background: "rgba(36,100,108,0.1)", color: "#9fd4dc", border: "1px solid rgba(36,100,108,0.2)" }}>
              O e-mail será enviado com o template padrão do escritório Equilibrium com os dados da tarefa.
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setEmailDialogOpen(false)} className="flex-1" style={{ borderColor: "#1e4f5c", color: "#a1a1aa" }}>Cancelar</Button>
              <Button type="submit" disabled={sendEmailMutation.isPending} className="flex-1 gap-2" style={{ background: "#24646c", color: "#fff" }}>
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

// Small inline icon component to avoid import issues
function RefreshCwIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline' }}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Item da linha do tempo (histórico unificado)
// ═══════════════════════════════════════════════════════════════════
