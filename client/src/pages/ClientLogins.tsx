import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Eye, EyeOff, KeyRound, PlusCircle, RefreshCw, Trash2, User, ExternalLink, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ClientLoginsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState<{ id: number; email: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [form, setForm] = useState({ clientId: "", email: "", password: "" });
  const [newPassword, setNewPassword] = useState("");

  const { data: clients = [] } = trpc.clients.list.useQuery({ includeInactive: false });
  const { data: logins = [], refetch } = trpc.clientAccess.listLogins.useQuery();
  const createMutation = trpc.clientAccess.createLogin.useMutation();
  const deleteMutation = trpc.clientAccess.deleteLogin.useMutation();
  const resetMutation = trpc.clientAccess.resetClientPassword.useMutation();
  const resendMutation = (trpc.clientAccess as any).resendClientAccess.useMutation();

  const clientMap = new Map(clients.map((c) => [c.id, c]));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await createMutation.mutateAsync({
        clientId: Number(form.clientId),
        email: form.email,
        password: form.password,
      });
      toast.success(result.action === "created" ? "Acesso criado!" : "Senha atualizada!");
      setCreateOpen(false);
      setForm({ clientId: "", email: "", password: "" });
      refetch();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao criar acesso");
    }
  };

  const handleDelete = async (id: number, email: string) => {
    if (!confirm(`Remover acesso de ${email}?`)) return;
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("Acesso removido");
      refetch();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao remover");
    }
  };

  const handleResend = async (clientId: number, name: string) => {
    if (!confirm(`Enviar um novo acesso para ${name}? Uma nova senha será gerada e enviada por e-mail (junto com o tutorial). A senha atual deixa de valer.`)) return;
    try {
      await resendMutation.mutateAsync({ clientId });
      toast.success("Acesso enviado por e-mail com a nova senha.");
      refetch();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao reenviar acesso");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetOpen) return;
    try {
      await resetMutation.mutateAsync({ id: resetOpen.id, newPassword });
      toast.success("Senha alterada com sucesso!");
      setResetOpen(null);
      setNewPassword("");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao alterar senha");
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#e5e5e5" }}>Acessos do Portal</h1>
            <p className="text-sm mt-0.5" style={{ color: "#a1a1aa" }}>Gerencie os logins dos clientes para o portal mobile</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2" style={{ background: "#24646c", color: "#fff" }}>
            <PlusCircle size={15} /> Criar Acesso
          </Button>
        </div>

        {/* Info */}
        <div className="p-4 rounded-xl flex gap-3 items-start text-sm" style={{ background: "rgba(36,100,108,0.08)", border: "1px solid rgba(36,100,108,0.2)", color: "#9fd4dc" }}>
          <KeyRound size={15} className="mt-0.5 shrink-0" />
          <div className="text-xs" style={{ color: "#a1a1aa" }}>
            O cliente acessa o portal com o e-mail e senha criados aqui. No portal ele vê apenas as próprias guias e vencimentos em um calendário mobile.
          </div>
        </div>

        {/* List */}
        {logins.length === 0 ? (
          <div className="text-center py-16 rounded-xl border" style={{ borderColor: "#1e4f5c", background: "#111" }}>
            <KeyRound size={36} className="mx-auto mb-3" style={{ color: "#52525b" }} />
            <p className="text-sm font-medium" style={{ color: "#a1a1aa" }}>Nenhum acesso criado</p>
            <Button onClick={() => setCreateOpen(true)} className="mt-4 gap-2 text-sm" style={{ background: "#24646c", color: "#fff" }}>
              <PlusCircle size={13} /> Criar primeiro acesso
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {Array.from(logins.reduce((m: Map<number, any[]>, l: any) => {
              const k = l.clientId ?? 0;
              if (!m.has(k)) m.set(k, []);
              m.get(k)!.push(l);
              return m;
            }, new Map<number, any[]>()).entries()).map(([cid, accesses]) => {
              const client = cid ? clientMap.get(cid) : undefined;
              return (
                <div key={cid} className="rounded-xl border overflow-hidden" style={{ borderColor: "#1e4f5c", background: "#111" }}>
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid #1e4f5c", background: "rgba(0,0,0,0.2)" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(36,100,108,0.2)", color: "#9fd4dc" }}>
                        {client?.name?.charAt(0).toUpperCase() ?? <User size={14} />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "#e5e5e5" }}>{client?.name ?? `Cliente #${cid}`}</p>
                        <p className="text-xs" style={{ color: "#52525b" }}>{accesses.length} e-mail{accesses.length !== 1 ? "s" : ""} de acesso</p>
                      </div>
                    </div>
                    {cid ? (
                      <button onClick={() => window.open(`/portal-cliente/${cid}`, "_blank")} className="text-xs flex items-center gap-1 shrink-0" style={{ color: "#9fd4dc", border: "1px solid rgba(36,100,108,0.3)", padding: "4px 8px", borderRadius: "6px" }} title="Abrir o portal como o cliente vê">
                        <ExternalLink size={12} /> Ver portal
                      </button>
                    ) : null}
                  </div>
                  <div className="divide-y" style={{ borderColor: "rgba(30,79,92,0.4)" }}>
                    {accesses.map((login: any) => (
                      <div key={login.id} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium" style={{ color: "#e5e5e5" }}>{login.email}</p>
                          {login.mustChangePassword ? (
                            <span style={{ display: "inline-block", marginTop: 4, fontSize: 11, fontWeight: 600, color: "#fcd34d", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 6, padding: "1px 7px" }}>Pendente — não definiu senha</span>
                          ) : (
                            <span style={{ display: "inline-block", marginTop: 4, fontSize: 11, fontWeight: 600, color: "#86efac", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 6, padding: "1px 7px" }}>Ativo</span>
                          )}
                          <p className="text-xs mt-0.5" style={{ color: "#52525b" }}>Último acesso: {new Date(login.lastSignedIn).toLocaleDateString("pt-BR")}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                          {login.clientId && (
                            <button onClick={() => handleResend(login.clientId!, client?.name ?? "o cliente")} disabled={resendMutation.isPending} className="text-xs flex items-center gap-1" style={{ color: "#86efac", border: "1px solid rgba(34,197,94,0.3)", padding: "4px 8px", borderRadius: "6px" }} title="Gerar nova senha e enviar por e-mail, com o tutorial de instalação">
                              <Mail size={12} /> Reenviar
                            </button>
                          )}
                          <button onClick={() => setResetOpen({ id: login.id, email: login.email })} className="text-xs flex items-center gap-1" style={{ color: "#9fd4dc", border: "1px solid rgba(36,100,108,0.3)", padding: "4px 8px", borderRadius: "6px" }} title="Alterar senha">
                            <RefreshCw size={12} /> Senha
                          </button>
                          <button onClick={() => handleDelete(login.id, login.email)} className="p-1.5 rounded hover:bg-white/5 transition-colors" style={{ color: "#f87171" }} title="Remover acesso">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto" style={{ background: "#111", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#e5e5e5" }}>Criar Acesso ao Portal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div style={{ background: "rgba(36,100,108,0.1)", border: "1px solid rgba(36,100,108,0.3)", borderRadius: 8, padding: "10px 12px" }}>
              <p style={{ fontSize: 12, color: "#9fd4dc", margin: 0, lineHeight: 1.5 }}>
                Uma mesma empresa pode ter <strong>vários e-mails de acesso</strong>. Todos apontando para a <strong>mesma empresa</strong> veem os <strong>mesmos dados</strong> (guias, vencimentos e faturamento). Para adicionar outro e-mail, escolha a <strong>mesma empresa</strong> e troque só o e-mail.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label style={{ color: "#a1a1aa" }}>Empresa (cliente) *</Label>
              <select
                value={form.clientId}
                onChange={(e) => {
                  const client = clients.find((c) => c.id === Number(e.target.value));
                  setForm({ ...form, clientId: e.target.value, email: client?.email ?? form.email });
                }}
                required
                className="w-full rounded-md px-3 py-2 text-sm"
                style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5", border: "1px solid #1e4f5c", outline: "none" }}
              >
                <option value="">Selecione o cliente...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label style={{ color: "#a1a1aa" }}>E-mail de acesso *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required
                style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }} />
            </div>
            <div className="space-y-1.5">
              <Label style={{ color: "#a1a1aa" }}>Senha (opcional)</Label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Deixe em branco para gerar automática" minLength={6} className="pr-10"
                  style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#52525b" }}>
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <p style={{ fontSize: 11, color: "#52525b", margin: "4px 0 0" }}>Deixe em branco e depois clique em <strong style={{ color: "#86efac" }}>Reenviar</strong> para enviar a senha + tutorial por e-mail.</p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="flex-1"
                style={{ borderColor: "#1e4f5c", color: "#a1a1aa" }}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending} className="flex-1"
                style={{ background: "#24646c", color: "#fff" }}>
                {createMutation.isPending ? "Criando..." : "Criar Acesso"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetOpen} onOpenChange={() => setResetOpen(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto" style={{ background: "#111", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#e5e5e5" }}>Alterar Senha</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4 mt-2">
            <p className="text-sm" style={{ color: "#a1a1aa" }}>
              Alterando senha de: <strong style={{ color: "#e5e5e5" }}>{resetOpen?.email}</strong>
            </p>
            <div className="space-y-1.5">
              <Label style={{ color: "#a1a1aa" }}>Nova Senha *</Label>
              <div className="relative">
                <Input type={showNewPassword ? "text" : "password"} value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres" required minLength={6} className="pr-10"
                  style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }} />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#52525b" }}>
                  {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setResetOpen(null)} className="flex-1"
                style={{ borderColor: "#1e4f5c", color: "#a1a1aa" }}>Cancelar</Button>
              <Button type="submit" disabled={resetMutation.isPending} className="flex-1"
                style={{ background: "#24646c", color: "#fff" }}>
                {resetMutation.isPending ? "Salvando..." : "Salvar Nova Senha"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
