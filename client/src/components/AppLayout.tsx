import {
  BarChart3,
  BookOpen,
  Package,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  CloudUpload,
  KeyRound,
  LogOut,
  Menu,
  RefreshCw,
  SendHorizonal,
  Settings,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

// Dashboard fica solto no topo; o resto é agrupado por assunto
const dashboardItem = { href: "/painel", label: "Dashboard", icon: BarChart3 };

const menuGroups = [
  {
    id: "operacao",
    label: "Operação",
    items: [
      { href: "/tarefas", label: "Tarefas", icon: CheckSquare },
      { href: "/calendario", label: "Calendário", icon: CalendarClock },
      { href: "/upload-inteligente", label: "Upload Guias", icon: CloudUpload },
      { href: "/pendentes-envio", label: "Pendentes Envio", icon: SendHorizonal },
      { href: "/painel-mensal", label: "Painel Mensal", icon: CalendarDays, adminOnly: true },
    ],
  },
  {
    id: "cadastros",
    label: "Cadastros",
    items: [
      { href: "/clientes", label: "Clientes", icon: Building2 },
      { href: "/catalogo", label: "Tarefas Base", icon: BookOpen, adminOnly: true },
      { href: "/catalogos", label: "Catálogos", icon: Package, adminOnly: true },
      { href: "/recorrentes", label: "Recorrentes", icon: RefreshCw, adminOnly: true },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    items: [
      { href: "/acessos-clientes", label: "Portal Clientes", icon: KeyRound, adminOnly: true },
      { href: "/configuracoes", label: "Configurações", icon: Settings, adminOnly: true },
    ],
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();

  const isAdmin = user?.role === "admin";

  // Grupos com itens filtrados por permissão; esconde grupos que ficaram vazios
  const visibleGroups = menuGroups
    .map((g) => ({ ...g, items: g.items.filter((it) => !(it as any).adminOnly || isAdmin) }))
    .filter((g) => g.items.length > 0);

  // Controle de expansão dos grupos (retraídos por padrão; expandem ao clicar)
  // Exceção: o grupo que contém a rota atual começa aberto, para orientação
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const g of menuGroups) {
      const hasActive = g.items.some((it) => location.startsWith(it.href) && it.href !== "/");
      initial[g.id] = !hasActive; // recolhido, exceto se tiver a rota ativa
    }
    return initial;
  });
  const toggleGroup = (id: string) => setCollapsedGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="min-h-screen flex" style={{ background: "#0a0a0a" }}>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={`fixed top-0 left-0 h-full z-50 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ width: 240, background: "#0d1f22", borderRight: "1px solid #1e4f5c" }}
      >
        <div className="flex items-center justify-between px-5 py-5" style={{ borderBottom: "1px solid #1e4f5c" }}>
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer" title="Voltar à plataforma">
              <img src="/logo.png" alt="Equilíbrio" className="w-9 h-9 object-contain" />
              <div>
                <p className="font-semibold text-sm leading-tight" style={{ color: "#e5e5e5" }}>Equilíbrio</p>
                <p className="text-xs" style={{ color: "#9fd4dc" }}>Gestão de Tarefas</p>
              </div>
            </div>
          </Link>
          <button className="lg:hidden" onClick={() => setMobileOpen(false)} style={{ color: "#a1a1aa" }}>
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {/* Dashboard solto no topo */}
          {(() => {
            const isActive = location === "/painel";
            const Icon = dashboardItem.icon;
            return (
              <Link href={dashboardItem.href} onClick={() => setMobileOpen(false)}>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all"
                  style={isActive
                    ? { background: "rgba(36,100,108,0.25)", color: "#9fd4dc", borderLeft: "3px solid #24646c", paddingLeft: "9px" }
                    : { color: "#a1a1aa" }}>
                  <Icon size={17} />
                  <span>{dashboardItem.label}</span>
                  {isActive && <ChevronRight size={14} className="ml-auto" />}
                </div>
              </Link>
            );
          })()}

          {/* Grupos recolhíveis */}
          {visibleGroups.map((group) => {
            const collapsed = collapsedGroups[group.id];
            // Um grupo está "ativo" se a rota atual pertence a ele
            const hasActive = group.items.some((it) => location.startsWith(it.href) && it.href !== "/");
            return (
              <div key={group.id} className="pt-3">
                <button onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors"
                  style={{ color: hasActive ? "#9fd4dc" : "#52525b" }}>
                  <span>{group.label}</span>
                  {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                </button>
                {!collapsed && (
                  <div className="space-y-1 mt-1">
                    {group.items.map(({ href, label, icon: Icon }) => {
                      const isActive = location.startsWith(href) && href !== "/";
                      return (
                        <Link key={href} href={href} onClick={() => setMobileOpen(false)}>
                          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all"
                            style={isActive
                              ? { background: "rgba(36,100,108,0.25)", color: "#9fd4dc", borderLeft: "3px solid #24646c", paddingLeft: "9px" }
                              : { color: "#a1a1aa" }}>
                            <Icon size={17} />
                            <span>{label}</span>
                            {isActive && <ChevronRight size={14} className="ml-auto" />}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="px-3 py-4 space-y-2" style={{ borderTop: "1px solid #1e4f5c" }}>
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: "rgba(36,100,108,0.1)" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "#24646c", color: "#fff" }}>
              {(user?.name ?? "EQ").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: "#e5e5e5" }}>{user?.name ?? "Usuário"}</p>
              <p className="text-xs truncate" style={{ color: "#a1a1aa" }}>
                {user?.role === "admin" ? "Administrador" : "Colaborador"}
              </p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-red-900/20"
            style={{ color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}
          >
            <LogOut size={14} /> Sair da conta
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 sticky top-0 z-30" style={{ background: "#0d1f22", borderBottom: "1px solid #1e4f5c" }}>
          <button onClick={() => setMobileOpen(true)} style={{ color: "#a1a1aa" }}>
            <Menu size={20} />
          </button>
          <img src="/logo.png" alt="Equilíbrio" className="w-7 h-7 object-contain" />
          <span className="font-semibold text-sm flex-1" style={{ color: "#e5e5e5" }}>Equilíbrio</span>
          <button onClick={() => logout()} className="flex items-center gap-1 text-xs" style={{ color: "#f87171" }} title="Sair">
            <LogOut size={16} />
          </button>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
