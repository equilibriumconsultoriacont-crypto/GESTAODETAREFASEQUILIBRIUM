import AppLayout from "@/components/AppLayout";
import { StatusBadge, TaskTypeBadge } from "@/components/StatusBadge";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckCircle2, Clock, Mail, RefreshCw, Send, Zap } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function PendingSendsPage() {
  const [running, setRunning] = useState(false);

  const { data: pending = [], isLoading, refetch } = trpc.autoSend.pendingGuias.useQuery(undefined, {
    refetchInterval: 60_000, // atualiza a cada 1 min
  });

  const sendGuiasMutation = trpc.autoSend.sendGuias.useMutation();
  const utils = trpc.useUtils();

  const handleRunNow = async () => {
    setRunning(true);
    try {
      const result = await sendGuiasMutation.mutateAsync();
      const { sent, failed } = result.guias;
      if (sent > 0) toast.success(`✅ ${sent} guia(s) enviada(s) com sucesso!`);
      if (failed > 0) toast.error(`❌ ${failed} falha(s) no envio`);
      if (sent === 0 && failed === 0) toast.info("Nenhum arquivo pendente de envio");
      refetch();
      utils.tasks.list.invalidate();
      utils.tasks.dashboard.invalidate();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao disparar envios");
    } finally {
      setRunning(false);
    }
  };

  // Agrupar por cliente
  const byClient = new Map<string, { clientId: number; clientName: string; clientEmail: string; tasks: any[] }>();
  for (const row of pending) {
    const key = String(row.clientId);
    if (!byClient.has(key)) {
      byClient.set(key, { clientId: row.clientId, clientName: row.clientName, clientEmail: row.clientEmail, tasks: [] });
    }
    byClient.get(key)!.tasks.push(row);
  }
  const grouped = Array.from(byClient.values());

  return (
    <AppLayout>
      <div className="max-w-4xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#e5e5e5" }}>Guias Pendentes de Envio</h1>
            <p className="text-sm mt-0.5" style={{ color: "#a1a1aa" }}>
              Arquivos anexados às tarefas que ainda não foram enviados por e-mail ao cliente.
              O sistema dispara automaticamente a cada 1 hora.
            </p>
          </div>
          <Button onClick={handleRunNow} disabled={running || sendGuiasMutation.isPending}
            className="gap-2" style={{ background: "#24646c", color: "#fff" }}>
            <Zap size={14} className={running ? "animate-pulse" : ""} />
            {running ? "Disparando..." : "Disparar agora"}
          </Button>
        </div>

        {/* Info box */}
        <div className="rounded-xl p-4 text-sm" style={{ background: "rgba(36,100,108,0.08)", border: "1px solid rgba(36,100,108,0.2)", color: "#9fd4dc" }}>
          <div className="flex items-start gap-2">
            <Clock size={15} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Envio automático ativo</p>
              <p className="text-xs mt-1" style={{ color: "#a1a1aa" }}>
                A cada 1 hora o sistema verifica tarefas com arquivo anexado e sem e-mail enviado,
                dispara automaticamente para o e-mail cadastrado no perfil do cliente e marca a tarefa como Concluída.
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl p-4 text-center border" style={{ background: "#111", borderColor: "#1e4f5c" }}>
            <p className="text-2xl font-bold" style={{ color: "#f87171" }}>{pending.length}</p>
            <p className="text-xs mt-1" style={{ color: "#a1a1aa" }}>Pendentes de envio</p>
          </div>
          <div className="rounded-xl p-4 text-center border" style={{ background: "#111", borderColor: "#1e4f5c" }}>
            <p className="text-2xl font-bold" style={{ color: "#facc15" }}>{grouped.length}</p>
            <p className="text-xs mt-1" style={{ color: "#a1a1aa" }}>Clientes afetados</p>
          </div>
          <div className="rounded-xl p-4 text-center border" style={{ background: "#111", borderColor: "#1e4f5c" }}>
            <p className="text-2xl font-bold" style={{ color: "#9fd4dc" }}>1h</p>
            <p className="text-xs mt-1" style={{ color: "#a1a1aa" }}>Ciclo automático</p>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "#1a1a1a" }} />)}
          </div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-16 rounded-xl border" style={{ borderColor: "#1e4f5c", background: "#111" }}>
            <CheckCircle2 size={36} className="mx-auto mb-3" style={{ color: "#4ade80" }} />
            <p className="text-sm font-medium" style={{ color: "#e5e5e5" }}>Tudo em dia!</p>
            <p className="text-xs mt-1" style={{ color: "#a1a1aa" }}>Nenhuma guia pendente de envio</p>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map((group) => (
              <div key={group.clientId} className="rounded-xl border overflow-hidden" style={{ background: "#111", borderColor: "#f87171" }}>
                {/* Client header */}
                <div className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: "1px solid rgba(248,113,113,0.2)", background: "rgba(248,113,113,0.06)" }}>
                  <div className="flex items-center gap-2">
                    <AlertCircle size={14} style={{ color: "#f87171" }} />
                    <Link href={`/clientes/${group.clientId}`}>
                      <span className="text-sm font-semibold hover:underline cursor-pointer" style={{ color: "#e5e5e5" }}>
                        {group.clientName}
                      </span>
                    </Link>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}>
                      {group.tasks.length} arquivo{group.tasks.length !== 1 ? "s" : ""} pendente{group.tasks.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs" style={{ color: "#a1a1aa" }}>
                    <Mail size={12} />
                    {group.clientEmail}
                  </div>
                </div>

                {/* Tasks */}
                <div className="divide-y" style={{ borderColor: "rgba(30,79,92,0.3)" }}>
                  {group.tasks.map((task: any) => {
                    const due = new Date(task.dueDate);
                    const isOverdue = due < new Date();
                    return (
                      <div key={task.taskId} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <TaskTypeBadge type={task.taskType} />
                          <div>
                            <Link href={`/tarefas/${task.taskId}`}>
                              <p className="text-sm font-medium hover:underline cursor-pointer" style={{ color: "#e5e5e5" }}>
                                {task.title}
                              </p>
                            </Link>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-xs" style={{ color: "#52525b" }}>{task.competencia}</span>
                              <span className="text-xs font-medium" style={{ color: isOverdue ? "#f87171" : "#facc15" }}>
                                {isOverdue ? "⚠ Venceu " : "Vence "}{due.toLocaleDateString("pt-BR")}
                              </span>
                              <span className="text-xs" style={{ color: "#52525b" }}>
                                📎 {task.filename}
                              </span>
                            </div>
                          </div>
                        </div>
                        <StatusBadge status={task.status} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
