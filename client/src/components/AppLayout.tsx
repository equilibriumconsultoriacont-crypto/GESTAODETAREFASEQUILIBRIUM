import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  BarChart3,
  Building2,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  LogOut,
  Menu,
  RefreshCw,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/clientes", label: "Clientes", icon: Building2 },
  { href: "/tarefas", label: "Tarefas", icon: CheckSquare },
  { href: "/recorrentes", label: "Recorrentes", icon: RefreshCw },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#24646c", borderTopColor: "transparent" }} />
          <span className="text-sm" style={{ color: "#a1a1aa" }}>Carregando...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a" }}>
        <div className="text-center p-8 rounded-xl border max-w-sm w-full" style={{ background: "#111", borderColor: "#1e4f5c" }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(36,100,108,0.2)" }}>
            <ClipboardList size={28} style={{ color: "#9fd4dc" }} />
          </div>
          <h1 className="text-xl font-bold mb-1" style={{ color: "#e5e5e5" }}>Equilíbrio</h1>
          <p className="text-sm mb-6" style={{ color: "#a1a1aa" }}>Gestão de Tarefas Contábeis</p>
          <a
            href={getLoginUrl()}
            className="block w-full py-2.5 px-4 rounded-lg text-sm font-medium text-center transition-opacity hover:opacity-90"
            style={{ background: "#24646c", color: "#fff" }}
          >
            Entrar no sistema
          </a>
        </div>
      </div>
    );
  }

  const initials = user?.name
    ? user.name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
    : "EQ";

  return (
    <div className="min-h-screen flex" style={{ background: "#0a0a0a" }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full z-50 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ width: 240, background: "#0d1f22", borderRight: "1px solid #1e4f5c" }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5" style={{ borderBottom: "1px solid #1e4f5c" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm" style={{ background: "#24646c", color: "#fff" }}>
              EQ
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight" style={{ color: "#e5e5e5" }}>Equilíbrio</p>
              <p className="text-xs" style={{ color: "#a1a1aa" }}>Consultoria</p>
            </div>
          </div>
          <button className="lg:hidden" onClick={() => setMobileOpen(false)} style={{ color: "#a1a1aa" }}>
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link key={href} href={href} onClick={() => setMobileOpen(false)}>
                <div
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all"
                  style={
                    isActive
                      ? { background: "rgba(36,100,108,0.25)", color: "#9fd4dc", borderLeft: "3px solid #24646c", paddingLeft: "9px" }
                      : { color: "#a1a1aa" }
                  }
                >
                  <Icon size={17} />
                  <span>{label}</span>
                  {isActive && <ChevronRight size={14} className="ml-auto" />}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-3 py-4" style={{ borderTop: "1px solid #1e4f5c" }}>
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: "rgba(36,100,108,0.1)" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "#24646c", color: "#fff" }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: "#e5e5e5" }}>{user?.name || "Usuário"}</p>
              <p className="text-xs truncate" style={{ color: "#a1a1aa" }}>{user?.role === "admin" ? "Administrador" : "Colaborador"}</p>
            </div>
            <button
              onClick={() => logout()}
              className="flex-shrink-0 p-1 rounded transition-colors hover:text-red-400"
              style={{ color: "#52525b" }}
              title="Sair"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 sticky top-0 z-30" style={{ background: "#0d1f22", borderBottom: "1px solid #1e4f5c" }}>
          <button onClick={() => setMobileOpen(true)} style={{ color: "#a1a1aa" }}>
            <Menu size={20} />
          </button>
          <span className="font-semibold text-sm" style={{ color: "#e5e5e5" }}>Equilíbrio</span>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
