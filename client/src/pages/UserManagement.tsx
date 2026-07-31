import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, Users, Building2, KeyRound, Wrench, PlusCircle, Pencil, Trash2,
  Search, Shield, Mail, RotateCw, Send, Check, X, Clock, Lock,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

// Definição dos módulos da plataforma e os níveis de acesso de cada um.
// (Mesma fonte usada no cadastro antigo — mantida idêntica para não mudar o contrato.)
const PLATFORM_MODULES: Array<{
  id: string; name: string; color: string;
  levels: { value: string; label: string }[];
  hasDataScope: boolean;
}> = [
  {
    id: "tarefas", name: "Gestão de Tarefas", color: "#24646c",
    levels: [
      { value: "colaborador", label: "Colaborador" },
      { value: "admin", label: "Administrador" },
    ],
    hasDataScope: true,
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
  },
];

const C = {
  bg: "#0a0f0e",
  panel: "#0f1a19",
  panelHi: "#132321",
  border: "#1e3a37",
  borderHi: "#2b5551",
  text: "#e8f0ef",
  textMuted: "#8fa5a1",
  textFaint: "#5c716d",
  brand: "#2f8f9e",
  brandSoft: "rgba(47,143,158,.14)",
  brandText: "#a9dbe3",
  danger: "#f87171",
  dangerSoft: "rgba(248,113,113,.12)",
  ok: "#34d399",
};

type TabKey = "staff" | "clients" | "tools";

export default function UserManagementPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<TabKey>("staff");

  // Proteção: só administrador acessa este módulo.
  if (loading) {
    return <div style={{ minHeight: "100dvh", background: C.bg, display: "grid", placeItems: "center", color: C.textMuted }}>Carregando…</div>;
  }
  if (!user || (user as any).role !== "admin") {
    return (
      <div style={{ minHeight: "100dvh", background: C.bg, display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 380 }}>
          <Lock size={40} style={{ color: C.textFaint, margin: "0 auto 14px" }} />
          <div style={{ color: C.text, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Acesso restrito</div>
          <div style={{ color: C.textMuted, fontSize: 14, marginBottom: 18 }}>Só administradores podem gerenciar usuários.</div>
          <button onClick={() => setLocation("/")} style={{ background: C.brand, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, cursor: "pointer" }}>Voltar à Plataforma</button>
        </div>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: "staff", label: "Funcionários", icon: Users },
    { key: "clients", label: "Clientes", icon: KeyRound },
    { key: "tools", label: "Ferramentas", icon: Wrench },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, color: C.text, fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>
      {/* Cabeçalho */}
      <header style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(10,15,14,.86)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/">
            <button style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.panelHi, border: `1px solid ${C.border}`, color: C.textMuted, borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              <ArrowLeft size={15} /> Plataforma
            </button>
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: C.brandSoft, display: "grid", placeItems: "center", flex: "none" }}>
                <Users size={17} style={{ color: C.brandText }} />
              </div>
              <h1 style={{ fontSize: 18, fontWeight: 750, letterSpacing: "-0.01em" }}>Gerenciamento de Usuários</h1>
            </div>
          </div>
        </div>
        {/* Abas */}
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 20px 12px", display: "flex", gap: 6, overflowX: "auto" }}>
          {tabs.map(({ key, label, icon: Icon }) => {
            const on = tab === key;
            return (
              <button key={key} onClick={() => setTab(key)}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 999, whiteSpace: "nowrap",
                  border: `1px solid ${on ? C.brand : C.border}`, background: on ? C.brand : "transparent",
                  color: on ? "#04211f" : C.textMuted, fontSize: 13, fontWeight: 650, cursor: "pointer", transition: "all .15s" }}>
                <Icon size={15} /> {label}
              </button>
            );
          })}
        </div>
      </header>

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "22px 20px 60px" }}>
        {tab === "staff" && <StaffTab />}
        {tab === "clients" && <ClientsTab />}
        {tab === "tools" && <ToolsTab />}
      </main>
    </div>
  );
}

/* ─────────────────────────── Peças de UI ─────────────────────────── */

function SectionHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h2>
        <p style={{ fontSize: 13, color: C.textMuted, marginTop: 3 }}>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function PrimaryBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: C.brand, color: "#04211f", border: "none", borderRadius: 10, padding: "9px 15px", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
      {children}
    </button>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div style={{ position: "relative", marginBottom: 14 }}>
      <Search size={16} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: C.textFaint }} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 11, padding: "11px 14px 11px 38px", color: C.text, fontSize: 14, outline: "none" }} />
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div style={{ textAlign: "center", padding: "44px 20px", color: C.textFaint }}>
      <Icon size={30} style={{ margin: "0 auto 10px", opacity: 0.7 }} />
      <div style={{ fontSize: 14 }}>{text}</div>
    </div>
  );
}

const fieldStyle: React.CSSProperties = { width: "100%", background: C.panelHi, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", color: C.text, fontSize: 14, outline: "none" };
const labelStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 6 };

/* ─────────────────────────── Funcionários ─────────────────────────── */

type StaffForm = {
  name: string; email: string; password: string; role: "admin" | "user";
  departmentIds: number[]; clientIds: number[];
  modules: { module: string; level: string }[];
};
const emptyStaff: StaffForm = { name: "", email: "", password: "", role: "user", departmentIds: [], clientIds: [], modules: [] };

function StaffTab() {
  const { data: users = [], refetch, isLoading } = trpc.usersAdmin.list.useQuery();
  const { data: depts = [] } = trpc.departments.listAll.useQuery();
  const { data: clients = [] } = trpc.clients.list.useQuery({ includeInactive: false });
  const createMut = trpc.usersAdmin.create.useMutation();
  const updateMut = trpc.usersAdmin.update.useMutation();
  const deleteMut = trpc.usersAdmin.delete.useMutation();

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<StaffForm>(emptyStaff);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users as any[]).filter((u) => !q || (u.name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q));
  }, [users, query]);

  const openCreate = () => { setEditing(null); setForm(emptyStaff); setOpen(true); };
  const openEdit = (u: any) => {
    setEditing(u);
    setForm({
      name: u.name ?? "", email: u.email ?? "", password: "",
      role: u.role === "admin" ? "admin" : "user",
      departmentIds: u.departmentIds ?? [], clientIds: u.clientIds ?? [],
      modules: u.modules ?? [],
    });
    setOpen(true);
  };

  const isModuleOn = (id: string) => form.modules.some((m) => m.module === id);
  const toggleModule = (id: string, defaultLevel: string) =>
    setForm((f) => ({ ...f, modules: isModuleOn(id) ? f.modules.filter((m) => m.module !== id) : [...f.modules, { module: id, level: defaultLevel }] }));
  const setModuleLevel = (id: string, level: string) =>
    setForm((f) => ({ ...f, modules: f.modules.map((m) => (m.module === id ? { ...m, level } : m)) }));
  const toggleDept = (id: number) =>
    setForm((f) => ({ ...f, departmentIds: f.departmentIds.includes(id) ? f.departmentIds.filter((x) => x !== id) : [...f.departmentIds, id] }));
  const toggleClient = (id: number) =>
    setForm((f) => ({ ...f, clientIds: f.clientIds.includes(id) ? f.clientIds.filter((x) => x !== id) : [...f.clientIds, id] }));

  const save = async () => {
    if (!form.name.trim()) { toast.error("Informe o nome"); return; }
    if (!form.email.trim()) { toast.error("Informe o e-mail"); return; }
    if (!editing && form.password.length < 6) { toast.error("Senha de no mínimo 6 caracteres"); return; }
    try {
      if (editing) {
        const payload: any = { id: editing.id, name: form.name, email: form.email, role: form.role, departmentIds: form.departmentIds, clientIds: form.clientIds, modules: form.modules };
        if (form.password) payload.password = form.password;
        await updateMut.mutateAsync(payload);
        toast.success("Usuário atualizado");
      } else {
        await createMut.mutateAsync(form);
        toast.success("Usuário criado");
      }
      setOpen(false); refetch();
    } catch (e: any) { toast.error(e?.message || "Não foi possível salvar"); }
  };

  const remove = async (u: any) => {
    if (!confirm(`Excluir o usuário "${u.name}"? Esta ação não pode ser desfeita.`)) return;
    try { await deleteMut.mutateAsync({ id: u.id }); toast.success("Usuário excluído"); refetch(); }
    catch (e: any) { toast.error(e?.message || "Não foi possível excluir"); }
  };

  const moduleColor = (id: string) => PLATFORM_MODULES.find((m) => m.id === id)?.color || C.brand;
  const moduleName = (id: string) => PLATFORM_MODULES.find((m) => m.id === id)?.name || id;

  return (
    <div>
      <SectionHeader title="Funcionários e administradores" subtitle="Contas internas da equipe, com acesso e nível em cada módulo."
        action={<PrimaryBtn onClick={openCreate}><PlusCircle size={16} /> Novo usuário</PrimaryBtn>} />
      <SearchBox value={query} onChange={setQuery} placeholder="Buscar por nome ou e-mail…" />

      {isLoading ? <EmptyState icon={Users} text="Carregando…" />
        : filtered.length === 0 ? <EmptyState icon={Users} text={query ? "Nenhum usuário encontrado." : "Nenhum funcionário cadastrado ainda."} />
        : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((u: any) => (
              <div key={u.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: C.brandSoft, color: C.brandText, display: "grid", placeItems: "center", fontWeight: 700, fontSize: 16, flex: "none" }}>
                  {(u.name ?? "?").charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 650, fontSize: 14.5 }}>{u.name || "(sem nome)"}</span>
                    {u.role === "admin" && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: C.brandText, background: C.brandSoft, padding: "2px 8px", borderRadius: 6 }}>
                        <Shield size={11} /> Admin
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: C.textFaint, marginTop: 2 }}>{u.email}</div>
                  {(u.modules ?? []).length > 0 && (
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
                      {u.modules.map((m: any) => (
                        <span key={m.module} style={{ fontSize: 10.5, fontWeight: 600, color: moduleColor(m.module), background: `${moduleColor(m.module)}1a`, padding: "2px 7px", borderRadius: 5 }}>
                          {moduleName(m.module)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 4, flex: "none" }}>
                  <button onClick={() => openEdit(u)} title="Editar" style={iconBtn}>
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => remove(u)} title="Excluir" style={{ ...iconBtn, color: C.danger }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto" style={{ background: C.panel, borderColor: C.border, color: C.text }}>
          <DialogHeader><DialogTitle style={{ color: C.text }}>{editing ? "Editar usuário" : "Novo usuário"}</DialogTitle></DialogHeader>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Nome</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={fieldStyle} placeholder="Nome completo" />
              </div>
              <div style={{ width: 150, flex: "none" }}>
                <label style={labelStyle}>Perfil</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as any })} style={{ ...fieldStyle, cursor: "pointer" }}>
                  <option value="user">Funcionário</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>E-mail</label>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={fieldStyle} placeholder="email@empresa.com" />
            </div>
            <div>
              <label style={labelStyle}>{editing ? "Nova senha (deixe em branco para manter)" : "Senha"}</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={fieldStyle} placeholder="Mínimo 6 caracteres" />
            </div>

            {/* Módulos e permissões */}
            <div>
              <label style={labelStyle}>Módulos e nível de acesso</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {PLATFORM_MODULES.map((mod) => {
                  const on = isModuleOn(mod.id);
                  const current = form.modules.find((m) => m.module === mod.id)?.level || mod.levels[0].value;
                  return (
                    <div key={mod.id} style={{ background: C.panelHi, border: `1px solid ${on ? mod.color : C.border}`, borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, transition: "border-color .15s" }}>
                      <button onClick={() => toggleModule(mod.id, mod.levels[0].value)}
                        style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${on ? mod.color : C.borderHi}`, background: on ? mod.color : "transparent", display: "grid", placeItems: "center", cursor: "pointer", flex: "none" }}>
                        {on && <Check size={13} color="#04211f" />}
                      </button>
                      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: on ? C.text : C.textMuted }}>{mod.name}</span>
                      {on && (
                        <select value={current} onChange={(e) => setModuleLevel(mod.id, e.target.value)}
                          style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 8px", color: C.text, fontSize: 12.5, cursor: "pointer", maxWidth: 190 }}>
                          {mod.levels.map((lv) => (<option key={lv.value} value={lv.value}>{lv.label}</option>))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Departamentos */}
            {depts.length > 0 && (
              <div>
                <label style={labelStyle}>Departamentos (limita o que vê nas Tarefas)</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(depts as any[]).map((d) => {
                    const on = form.departmentIds.includes(d.id);
                    return (
                      <button key={d.id} onClick={() => toggleDept(d.id)}
                        style={{ padding: "6px 11px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                          border: `1px solid ${on ? C.brand : C.border}`, background: on ? C.brandSoft : "transparent", color: on ? C.brandText : C.textMuted }}>
                        {d.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empresas */}
            {clients.length > 0 && (
              <div>
                <label style={labelStyle}>Empresas específicas (opcional — vazio = conforme departamento)</label>
                <div style={{ maxHeight: 130, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, border: `1px solid ${C.border}`, borderRadius: 10, padding: 8 }}>
                  {(clients as any[]).map((c) => {
                    const on = form.clientIds.includes(c.id);
                    return (
                      <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 6px", borderRadius: 7, cursor: "pointer", background: on ? C.brandSoft : "transparent" }}>
                        <input type="checkbox" checked={on} onChange={() => toggleClient(c.id)} style={{ accentColor: C.brand }} />
                        <span style={{ fontSize: 13, color: on ? C.text : C.textMuted }}>{c.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
              <button onClick={() => setOpen(false)} style={ghostBtn}>Cancelar</button>
              <button onClick={save} disabled={createMut.isPending || updateMut.isPending}
                style={{ background: C.brand, color: "#04211f", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                {editing ? "Salvar alterações" : "Criar usuário"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─────────────────────────── Clientes ─────────────────────────── */

function ClientsTab() {
  const { data: clients = [] } = trpc.clients.list.useQuery({ includeInactive: false });
  const { data: logins = [], refetch } = trpc.clientAccess.listLogins.useQuery();
  const createMut = trpc.clientAccess.createLogin.useMutation();
  const deleteMut = trpc.clientAccess.deleteLogin.useMutation();
  const resetMut = trpc.clientAccess.resetClientPassword.useMutation();
  const resendMut = (trpc.clientAccess as any).resendClientAccess.useMutation();

  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ clientId: "", email: "", password: "" });
  const [resetFor, setResetFor] = useState<{ id: number; email: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const clientName = (id: number | null) => (clients as any[]).find((c) => c.id === id)?.name ?? "—";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (logins as any[]).filter((l) => !q || (l.email ?? "").toLowerCase().includes(q) || clientName(l.clientId).toLowerCase().includes(q));
  }, [logins, clients, query]);

  const create = async () => {
    if (!form.clientId) { toast.error("Escolha a empresa"); return; }
    if (!form.email.trim()) { toast.error("Informe o e-mail"); return; }
    try {
      const r: any = await createMut.mutateAsync({ clientId: Number(form.clientId), email: form.email.trim(), password: form.password || undefined });
      toast.success(r?.action === "linked" ? "E-mail vinculado à empresa" : "Acesso do cliente criado");
      setCreateOpen(false); setForm({ clientId: "", email: "", password: "" }); refetch();
    } catch (e: any) { toast.error(e?.message || "Não foi possível criar o acesso"); }
  };

  const remove = async (id: number) => {
    if (!confirm("Remover este acesso de cliente?")) return;
    try { await deleteMut.mutateAsync({ id }); toast.success("Acesso removido"); refetch(); }
    catch (e: any) { toast.error(e?.message || "Não foi possível remover"); }
  };

  const doReset = async () => {
    if (!resetFor || newPassword.length < 6) { toast.error("Senha de no mínimo 6 caracteres"); return; }
    try { await resetMut.mutateAsync({ id: resetFor.id, newPassword }); toast.success("Senha redefinida"); setResetFor(null); setNewPassword(""); }
    catch (e: any) { toast.error(e?.message || "Não foi possível redefinir"); }
  };

  const resend = async (email: string, clientId: number | null) => {
    try { await resendMut.mutateAsync({ email, clientId: clientId ?? undefined }); toast.success("Novo acesso enviado por e-mail"); refetch(); }
    catch (e: any) { toast.error(e?.message || "Não foi possível reenviar"); }
  };

  return (
    <div>
      <SectionHeader title="Acesso dos clientes ao portal" subtitle="Logins que os clientes usam para ver guias e obrigações. A senha é enviada por e-mail."
        action={<PrimaryBtn onClick={() => setCreateOpen(true)}><PlusCircle size={16} /> Novo acesso</PrimaryBtn>} />
      <SearchBox value={query} onChange={setQuery} placeholder="Buscar por e-mail ou empresa…" />

      {filtered.length === 0 ? <EmptyState icon={KeyRound} text={query ? "Nenhum acesso encontrado." : "Nenhum acesso de cliente ainda."} />
        : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((l: any) => (
              <div key={l.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(192,132,252,.14)", color: "#d8b4fe", display: "grid", placeItems: "center", flex: "none" }}>
                  <Building2 size={19} />
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 650, fontSize: 14.5 }}>{clientName(l.clientId)}</span>
                    {l.mustChangePassword && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: "#e0a458", background: "rgba(224,164,88,.14)", padding: "2px 7px", borderRadius: 6 }}>
                        <Clock size={10} /> aguarda 1º acesso
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: C.textFaint, marginTop: 2 }}>
                    {l.email}
                    {l.lastSignedIn && <span> · último acesso {new Date(l.lastSignedIn).toLocaleDateString("pt-BR")}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flex: "none", flexWrap: "wrap" }}>
                  <button onClick={() => resend(l.email, l.clientId ?? null)} disabled={resendMut.isPending} title="Gerar nova senha e enviar por e-mail com o tutorial" style={{ ...chipBtn, color: C.ok, borderColor: "rgba(52,211,153,.3)" }}>
                    <Send size={13} /> Reenviar
                  </button>
                  <button onClick={() => { setResetFor({ id: l.id, email: l.email }); setNewPassword(""); }} title="Definir uma senha manualmente" style={{ ...chipBtn, color: C.brandText, borderColor: C.borderHi }}>
                    <RotateCw size={13} /> Senha
                  </button>
                  <button onClick={() => remove(l.id)} title="Remover acesso" style={{ ...chipBtn, color: C.danger, borderColor: "rgba(248,113,113,.3)" }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      {/* Criar acesso */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md" style={{ background: C.panel, borderColor: C.border, color: C.text }}>
          <DialogHeader><DialogTitle style={{ color: C.text }}>Novo acesso de cliente</DialogTitle></DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
            <div>
              <label style={labelStyle}>Empresa</label>
              <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} style={{ ...fieldStyle, cursor: "pointer" }}>
                <option value="">Selecione…</option>
                {(clients as any[]).map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>E-mail do cliente</label>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={fieldStyle} placeholder="cliente@email.com" />
            </div>
            <div>
              <label style={labelStyle}>Senha (opcional — em branco gera uma e envia por e-mail)</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={fieldStyle} placeholder="Deixe em branco para gerar" />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setCreateOpen(false)} style={ghostBtn}>Cancelar</button>
              <button onClick={create} disabled={createMut.isPending} style={{ background: C.brand, color: "#04211f", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Criar acesso</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Redefinir senha */}
      <Dialog open={!!resetFor} onOpenChange={(v) => { if (!v) setResetFor(null); }}>
        <DialogContent className="max-w-md" style={{ background: C.panel, borderColor: C.border, color: C.text }}>
          <DialogHeader><DialogTitle style={{ color: C.text }}>Redefinir senha</DialogTitle></DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
            <p style={{ fontSize: 13, color: C.textMuted }}>Definindo nova senha para <strong style={{ color: C.text }}>{resetFor?.email}</strong>.</p>
            <div>
              <label style={labelStyle}>Nova senha</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={fieldStyle} placeholder="Mínimo 6 caracteres" />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setResetFor(null)} style={ghostBtn}>Cancelar</button>
              <button onClick={doReset} disabled={resetMut.isPending} style={{ background: C.brand, color: "#04211f", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Redefinir</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─────────────────────────── Ferramentas ─────────────────────────── */

function ToolsTab() {
  const testMut = (trpc.clientAccess as any).emailTest.useMutation();
  const [to, setTo] = useState("");
  const [result, setResult] = useState<any>(null);

  const runTest = async () => {
    if (!to.trim()) { toast.error("Informe um e-mail de destino"); return; }
    setResult(null);
    try { const r = await testMut.mutateAsync({ to: to.trim() }); setResult(r); toast.success("E-mail de teste enviado"); }
    catch (e: any) { setResult({ ok: false, error: e?.message }); toast.error(e?.message || "Falha no envio"); }
  };

  return (
    <div>
      <SectionHeader title="Ferramentas" subtitle="Utilitários de manutenção relacionados a usuários e comunicação." />
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, maxWidth: 520 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
          <Mail size={17} style={{ color: C.brandText }} />
          <span style={{ fontWeight: 650, fontSize: 15 }}>Testar envio de e-mail</span>
        </div>
        <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 14 }}>Verifica se o sistema consegue enviar e-mails (usado nos acessos e avisos aos clientes).</p>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="seu@email.com" style={{ ...fieldStyle, flex: 1 }} />
          <button onClick={runTest} disabled={testMut.isPending} style={{ background: C.brand, color: "#04211f", border: "none", borderRadius: 10, padding: "0 18px", fontWeight: 700, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" }}>
            {testMut.isPending ? "Enviando…" : "Enviar teste"}
          </button>
        </div>
        {result && (
          <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, fontSize: 13, display: "flex", alignItems: "center", gap: 8,
            background: result.ok ? "rgba(52,211,153,.1)" : C.dangerSoft, color: result.ok ? C.ok : C.danger, border: `1px solid ${result.ok ? "rgba(52,211,153,.25)" : "rgba(248,113,113,.25)"}` }}>
            {result.ok ? <Check size={15} /> : <X size={15} />}
            {result.ok ? "E-mail enviado com sucesso." : (result.error || "Falha ao enviar.")}
          </div>
        )}
      </div>
    </div>
  );
}

/* estilos compartilhados de botões */
const iconBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 9, border: `1px solid ${C.border}`, background: C.panelHi, color: C.textMuted, cursor: "pointer", display: "grid", placeItems: "center" };
const chipBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, padding: "6px 10px", borderRadius: 8, border: "1px solid", background: "transparent", cursor: "pointer" };
const ghostBtn: React.CSSProperties = { background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, borderRadius: 10, padding: "10px 16px", fontSize: 14, cursor: "pointer" };
