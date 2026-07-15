import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Building2, Check, Key, Pencil, PlusCircle, Shield, Trash2, UserCog, Users } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

const COLORS = ["#9fd4dc", "#c084fc", "#fb923c", "#4ade80", "#facc15", "#f87171", "#60a5fa", "#a1a1aa"];

export default function AdminSettingsPage() {
  const [tab, setTab] = useState<"departments" | "users">("departments");

  return (
    <AppLayout>
      <div className="max-w-4xl space-y-5">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#e5e5e5" }}>Configurações</h1>
          <p className="text-sm mt-0.5" style={{ color: "#a1a1aa" }}>Gerencie departamentos e usuários do sistema</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b" style={{ borderColor: "#1e4f5c" }}>
          <button onClick={() => setTab("departments")}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors"
            style={{ color: tab === "departments" ? "#9fd4dc" : "#52525b", borderBottom: tab === "departments" ? "2px solid #9fd4dc" : "2px solid transparent" }}>
            <Building2 size={15} /> Departamentos
          </button>
          <button onClick={() => setTab("users")}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors"
            style={{ color: tab === "users" ? "#9fd4dc" : "#52525b", borderBottom: tab === "users" ? "2px solid #9fd4dc" : "2px solid transparent" }}>
            <Users size={15} /> Usuários
          </button>
        </div>

        {tab === "departments" ? <DepartmentsTab /> : <UsersTab />}
      </div>
    </AppLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ABA DEPARTAMENTOS
// ═══════════════════════════════════════════════════════════════════
function DepartmentsTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", color: COLORS[0] });

  const { data: departments = [], refetch } = trpc.departments.listAll.useQuery();
  const createMutation = trpc.departments.create.useMutation();
  const updateMutation = trpc.departments.update.useMutation();
  const deleteMutation = trpc.departments.delete.useMutation();

  const openCreate = () => { setEditing(null); setForm({ name: "", color: COLORS[0] }); setDialogOpen(true); };
  const openEdit = (dept: any) => { setEditing(dept); setForm({ name: dept.name, color: dept.color }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Informe o nome do departamento"); return; }
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, name: form.name, color: form.color });
        toast.success("Departamento atualizado!");
      } else {
        await createMutation.mutateAsync({ name: form.name, color: form.color });
        toast.success("Departamento criado!");
      }
      setDialogOpen(false);
      refetch();
    } catch (err: any) { toast.error(err?.message ?? "Erro ao salvar"); }
  };

  const handleDelete = async (dept: any) => {
    if (!confirm(`Excluir o departamento "${dept.name}"?\n\nUsuários vinculados perderão esse departamento.`)) return;
    try {
      await deleteMutation.mutateAsync({ id: dept.id });
      toast.success("Departamento excluído");
      refetch();
    } catch (err: any) { toast.error(err?.message ?? "Erro ao excluir"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="gap-2" style={{ background: "#24646c", color: "#fff" }}>
          <PlusCircle size={15} /> Novo Departamento
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {departments.map((dept) => (
          <div key={dept.id} className="flex items-center justify-between rounded-xl border p-4" style={{ background: "#111", borderColor: "#1e4f5c" }}>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ background: dept.color }} />
              <span className="text-sm font-medium" style={{ color: "#e5e5e5" }}>{dept.name}</span>
              {!dept.active && <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(82,82,91,0.2)", color: "#52525b" }}>inativo</span>}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => openEdit(dept)} className="p-1.5 rounded hover:bg-white/5" style={{ color: "#9fd4dc" }} title="Editar">
                <Pencil size={13} />
              </button>
              <button onClick={() => handleDelete(dept)} className="p-1.5 rounded hover:bg-red-900/30" style={{ color: "#f87171" }} title="Excluir">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {departments.length === 0 && (
        <div className="text-center py-12 rounded-xl border" style={{ borderColor: "#1e4f5c", background: "#111" }}>
          <Building2 size={32} className="mx-auto mb-2" style={{ color: "#52525b" }} />
          <p className="text-sm" style={{ color: "#a1a1aa" }}>Nenhum departamento. Crie o primeiro!</p>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent style={{ background: "#111", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
          <DialogHeader><DialogTitle style={{ color: "#e5e5e5" }}>{editing ? "Editar" : "Novo"} Departamento</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label style={{ color: "#a1a1aa" }}>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1"
                placeholder="Ex: Fiscal, Societário, Trabalhista..."
                style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }} />
            </div>
            <div>
              <Label style={{ color: "#a1a1aa" }}>Cor</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setForm({ ...form, color: c })}
                    className="w-8 h-8 rounded-full transition-transform"
                    style={{ background: c, transform: form.color === c ? "scale(1.2)" : "scale(1)", border: form.color === c ? "2px solid #fff" : "2px solid transparent" }} />
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1" style={{ borderColor: "#1e4f5c", color: "#a1a1aa" }}>Cancelar</Button>
              <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="flex-1" style={{ background: "#24646c", color: "#fff" }}>
                {editing ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ABA USUÁRIOS
// ═══════════════════════════════════════════════════════════════════
// Definição dos módulos da plataforma e os níveis de cada um
const PLATFORM_MODULES = [
  {
    id: "tarefas", name: "Gestão de Tarefas", color: "#24646c",
    levels: [
      { value: "colaborador", label: "Colaborador" },
      { value: "admin", label: "Administrador" },
    ],
    hasDataScope: true, // tem limite de departamento/empresas
  },
  {
    id: "propostas", name: "Gerador de Propostas", color: "#c084fc",
    levels: [
      { value: "leitor", label: "Leitor (só visualiza)" },
      { value: "editor", label: "Editor (cria/edita as próprias)" },
      { value: "admin", label: "Administrador (vê todas)" },
    ],
    hasDataScope: false,
  },
  {
    id: "whatsapp", name: "Atendimento WhatsApp", color: "#4ade80",
    levels: [
      { value: "atendente", label: "Atendente" },
      { value: "admin", label: "Administrador" },
    ],
    hasDataScope: false,
    disabled: true, // em preparação
  },
];

function UsersTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<{
    name: string; email: string; password: string; role: "admin" | "user";
    departmentIds: number[]; clientIds: number[];
    modules: { module: string; level: string }[];
  }>({ name: "", email: "", password: "", role: "user", departmentIds: [], clientIds: [], modules: [] });

  const { data: users = [], refetch } = trpc.usersAdmin.list.useQuery();
  const { data: departments = [] } = trpc.departments.list.useQuery();
  const { data: clients = [] } = trpc.clients.list.useQuery({ includeInactive: false });

  const createMutation = trpc.usersAdmin.create.useMutation();
  const updateMutation = trpc.usersAdmin.update.useMutation();
  const deleteMutation = trpc.usersAdmin.delete.useMutation();

  const deptMap = new Map(departments.map((d) => [d.id, d]));
  const clientMap = new Map(clients.map((c) => [c.id, c]));

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", email: "", password: "", role: "user", departmentIds: [], clientIds: [], modules: [] });
    setDialogOpen(true);
  };
  const openEdit = (user: any) => {
    setEditing(user);
    setForm({
      name: user.name ?? "", email: user.email, password: "",
      role: user.role === "admin" ? "admin" : "user",
      departmentIds: user.departmentIds ?? [], clientIds: user.clientIds ?? [],
      modules: user.modules ?? [],
    });
    setDialogOpen(true);
  };

  // Módulos: liga/desliga um módulo e define o nível
  const isModuleOn = (moduleId: string) => form.modules.some((m) => m.module === moduleId);
  const getModuleLevel = (moduleId: string) => form.modules.find((m) => m.module === moduleId)?.level ?? "";
  const toggleModule = (moduleId: string, defaultLevel: string) => {
    setForm((f) => ({
      ...f,
      modules: isModuleOn(moduleId)
        ? f.modules.filter((m) => m.module !== moduleId)
        : [...f.modules, { module: moduleId, level: defaultLevel }],
    }));
  };
  const setModuleLevel = (moduleId: string, level: string) => {
    setForm((f) => ({
      ...f,
      modules: f.modules.map((m) => (m.module === moduleId ? { ...m, level } : m)),
    }));
  };

  const toggleDept = (id: number) => {
    setForm((f) => ({ ...f, departmentIds: f.departmentIds.includes(id) ? f.departmentIds.filter((x) => x !== id) : [...f.departmentIds, id] }));
  };
  const toggleClient = (id: number) => {
    setForm((f) => ({ ...f, clientIds: f.clientIds.includes(id) ? f.clientIds.filter((x) => x !== id) : [...f.clientIds, id] }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Informe o nome"); return; }
    if (!form.email.trim()) { toast.error("Informe o e-mail"); return; }
    if (!editing && form.password.length < 6) { toast.error("Senha de no mínimo 6 caracteres"); return; }
    try {
      if (editing) {
        const payload: any = { id: editing.id, name: form.name, email: form.email, role: form.role, departmentIds: form.departmentIds, clientIds: form.clientIds, modules: form.modules };
        if (form.password) payload.password = form.password;
        await updateMutation.mutateAsync(payload);
        toast.success("Usuário atualizado!");
      } else {
        await createMutation.mutateAsync(form);
        toast.success("Usuário criado!");
      }
      setDialogOpen(false);
      refetch();
    } catch (err: any) { toast.error(err?.message ?? "Erro ao salvar"); }
  };

  const handleDelete = async (user: any) => {
    if (!confirm(`Excluir o usuário "${user.name}"?`)) return;
    try {
      await deleteMutation.mutateAsync({ id: user.id });
      toast.success("Usuário excluído");
      refetch();
    } catch (err: any) { toast.error(err?.message ?? "Erro ao excluir"); }
  };

  return (
    <div className="space-y-4">
      {/* Aviso: onde criar acesso de cliente */}
      <div className="rounded-xl border p-3 flex items-start gap-2.5" style={{ background: "rgba(36,100,108,0.08)", borderColor: "rgba(36,100,108,0.3)" }}>
        <Key size={15} className="mt-0.5 shrink-0" style={{ color: "#9fd4dc" }} />
        <div className="text-xs" style={{ color: "#a1a1aa" }}>
          Esta aba cria usuários da <strong style={{ color: "#e5e5e5" }}>equipe</strong> (administradores e colaboradores).
          Para dar acesso a um <strong style={{ color: "#e5e5e5" }}>cliente</strong> (portal com calendário de vencimentos e download de guias da empresa dele),
          use o menu <Link href="/acessos-clientes"><span className="underline cursor-pointer" style={{ color: "#9fd4dc" }}>Portal Clientes</span></Link>.
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={openCreate} className="gap-2" style={{ background: "#24646c", color: "#fff" }}>
          <PlusCircle size={15} /> Novo Usuário
        </Button>
      </div>

      <div className="space-y-3">
        {users.map((user) => (
          <div key={user.id} className="rounded-xl border p-4" style={{ background: "#111", borderColor: "#1e4f5c" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "#24646c", color: "#fff" }}>
                  {(user.name ?? "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: "#e5e5e5" }}>{user.name}</span>
                    {user.role === "admin" && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded" style={{ background: "rgba(192,132,252,0.15)", color: "#c084fc" }}>
                        <Shield size={10} /> Admin
                      </span>
                    )}
                  </div>
                  <span className="text-xs" style={{ color: "#52525b" }}>{user.email}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(user)} className="p-1.5 rounded hover:bg-white/5" style={{ color: "#9fd4dc" }} title="Editar">
                  <Pencil size={13} />
                </button>
                <button onClick={() => handleDelete(user)} className="p-1.5 rounded hover:bg-red-900/30" style={{ color: "#f87171" }} title="Excluir">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Módulos do usuário (para todos) */}
            <div className="mt-3 pl-12">
              <div className="flex items-start gap-2">
                <span className="text-xs shrink-0 mt-0.5" style={{ color: "#52525b" }}>Módulos:</span>
                <div className="flex gap-1 flex-wrap">
                  {(user.modules ?? []).length === 0 ? (
                    <span className="text-xs" style={{ color: "#52525b" }}>nenhum</span>
                  ) : (user.modules ?? []).map((m: any) => {
                    const modDef = PLATFORM_MODULES.find((pm) => pm.id === m.module);
                    const label = modDef?.name ?? m.module;
                    const color = modDef?.color ?? "#9fd4dc";
                    const levelLabel = modDef?.levels.find((l) => l.value === m.level)?.label ?? m.level;
                    return (
                      <span key={m.module} className="text-xs px-2 py-0.5 rounded" style={{ background: `${color}22`, color }}>
                        {label} · {levelLabel}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {user.role !== "admin" && (
              <div className="mt-2 pl-12 space-y-1.5">
                <div className="flex items-start gap-2">
                  <span className="text-xs shrink-0 mt-0.5" style={{ color: "#52525b" }}>Departamentos:</span>
                  <div className="flex gap-1 flex-wrap">
                    {(user.departmentIds ?? []).length === 0 ? (
                      <span className="text-xs" style={{ color: "#52525b" }}>nenhum</span>
                    ) : (user.departmentIds ?? []).map((id: number) => {
                      const d = deptMap.get(id);
                      return d ? <span key={id} className="text-xs px-2 py-0.5 rounded" style={{ background: `${d.color}22`, color: d.color }}>{d.name}</span> : null;
                    })}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-xs shrink-0 mt-0.5" style={{ color: "#52525b" }}>Empresas:</span>
                  <div className="flex gap-1 flex-wrap">
                    {(user.clientIds ?? []).length === 0 ? (
                      <span className="text-xs" style={{ color: "#52525b" }}>nenhuma</span>
                    ) : (user.clientIds ?? []).map((id: number) => {
                      const c = clientMap.get(id);
                      return c ? <span key={id} className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(36,100,108,0.2)", color: "#9fd4dc" }}>{c.name}</span> : null;
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Dialog criar/editar usuário */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto" style={{ background: "#111", borderColor: "#1e4f5c", color: "#e5e5e5" }}>
          <DialogHeader><DialogTitle style={{ color: "#e5e5e5" }}>{editing ? "Editar" : "Novo"} Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label style={{ color: "#a1a1aa" }}>Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }} />
              </div>
              <div>
                <Label style={{ color: "#a1a1aa" }}>Perfil</Label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "user" })} className="w-full rounded-md px-3 py-2 text-sm mt-1" style={{ background: "#0d1f22", border: "1px solid #1e4f5c", color: "#e5e5e5", outline: "none" }}>
                  <option value="user">Colaborador</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>
            <div>
              <Label style={{ color: "#a1a1aa" }}>E-mail *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }} />
            </div>
            <div>
              <Label style={{ color: "#a1a1aa" }}>{editing ? "Nova senha (deixe vazio p/ manter)" : "Senha *"}</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1" placeholder={editing ? "••••••" : "Mínimo 6 caracteres"} style={{ background: "#0d1f22", borderColor: "#1e4f5c", color: "#e5e5e5" }} />
            </div>

            {/* Camada 1 + 2 + 3: Módulos, níveis e escopo de dados */}
            <div>
              <Label style={{ color: "#a1a1aa" }}>Módulos e permissões</Label>
              <p className="text-xs mb-3 mt-0.5" style={{ color: "#52525b" }}>
                Escolha quais módulos este usuário acessa e o nível dele em cada um.
              </p>
              <div className="space-y-2.5">
                {PLATFORM_MODULES.map((mod) => {
                  const on = isModuleOn(mod.id);
                  const level = getModuleLevel(mod.id);
                  return (
                    <div key={mod.id} className="rounded-xl border overflow-hidden" style={{ borderColor: on ? `${mod.color}55` : "#1e4f5c", background: on ? `${mod.color}0d` : "#0d1f22" }}>
                      {/* Cabeçalho do módulo: toggle + nível */}
                      <div className="flex items-center justify-between p-3">
                        <button type="button" disabled={mod.disabled}
                          onClick={() => toggleModule(mod.id, mod.levels[0].value)}
                          className="flex items-center gap-2.5"
                          style={{ cursor: mod.disabled ? "not-allowed" : "pointer", opacity: mod.disabled ? 0.5 : 1 }}>
                          <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ border: `1px solid ${on ? mod.color : "#52525b"}`, background: on ? mod.color : "transparent" }}>
                            {on && <Check size={13} style={{ color: "#0d1f22" }} />}
                          </div>
                          <div className="text-left">
                            <span className="text-sm font-medium" style={{ color: on ? "#f4f4f5" : "#a1a1aa" }}>{mod.name}</span>
                            {mod.disabled && <span className="text-xs ml-2" style={{ color: "#52525b" }}>(em breve)</span>}
                          </div>
                        </button>
                        {on && !mod.disabled && (
                          <select value={level} onChange={(e) => setModuleLevel(mod.id, e.target.value)}
                            className="rounded-md px-2 py-1 text-xs" style={{ background: "#0d1f22", border: `1px solid ${mod.color}55`, color: mod.color, outline: "none" }}>
                            {mod.levels.map((lv) => <option key={lv.value} value={lv.value} style={{ background: "#0d1f22", color: "#e5e5e5" }}>{lv.label}</option>)}
                          </select>
                        )}
                      </div>

                      {/* Camada 3: escopo de dados (só para o módulo Tarefas, quando ativo e nível colaborador) */}
                      {on && mod.hasDataScope && level !== "admin" && (
                        <div className="px-3 pb-3 pt-1 space-y-3" style={{ borderTop: "1px solid rgba(30,79,92,0.4)" }}>
                          <p className="text-xs pt-2" style={{ color: "#71717a" }}>
                            Limite o que este colaborador vê dentro do módulo de Tarefas:
                          </p>
                          <div>
                            <span className="text-xs" style={{ color: "#a1a1aa" }}>Departamentos</span>
                            <div className="flex gap-2 flex-wrap mt-1.5">
                              {departments.map((d) => {
                                const active = form.departmentIds.includes(d.id);
                                return (
                                  <button key={d.id} type="button" onClick={() => toggleDept(d.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                                    style={{ background: active ? `${d.color}22` : "rgba(255,255,255,0.04)", color: active ? d.color : "#52525b", border: `1px solid ${active ? d.color + "55" : "rgba(255,255,255,0.08)"}` }}>
                                    {active && <Check size={11} />} {d.name}
                                  </button>
                                );
                              })}
                            </div>
                            {departments.length === 0 && <p className="text-xs mt-1" style={{ color: "#52525b" }}>Crie departamentos na aba Departamentos primeiro</p>}
                          </div>
                          <div>
                            <span className="text-xs" style={{ color: "#a1a1aa" }}>Empresas</span>
                            <div className="mt-1.5 max-h-40 overflow-y-auto rounded-lg border p-2 space-y-1" style={{ borderColor: "#1e4f5c", background: "#0d1f22" }}>
                              {clients.map((c) => {
                                const active = form.clientIds.includes(c.id);
                                return (
                                  <button key={c.id} type="button" onClick={() => toggleClient(c.id)}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors hover:bg-white/5"
                                    style={{ color: active ? "#9fd4dc" : "#a1a1aa" }}>
                                    <div className="w-4 h-4 rounded flex items-center justify-center shrink-0" style={{ border: `1px solid ${active ? "#9fd4dc" : "#52525b"}`, background: active ? "#9fd4dc" : "transparent" }}>
                                      {active && <Check size={10} style={{ color: "#0d1f22" }} />}
                                    </div>
                                    {c.name}
                                  </button>
                                );
                              })}
                              {clients.length === 0 && <p className="text-xs p-2" style={{ color: "#52525b" }}>Nenhuma empresa cadastrada</p>}
                            </div>
                            <p className="text-xs mt-1" style={{ color: "#52525b" }}>
                              Verá apenas tarefas das empresas E departamentos marcados. Como administrador do módulo, veria tudo.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1" style={{ borderColor: "#1e4f5c", color: "#a1a1aa" }}>Cancelar</Button>
              <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="flex-1" style={{ background: "#24646c", color: "#fff" }}>
                {editing ? "Salvar" : "Criar Usuário"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
