import {
  BarChart3,
  BookOpen,
  Package,
  Building2,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  CloudUpload,
  KeyRound,
  Menu,
  RefreshCw,
  SendHorizonal,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/clientes", label: "Clientes", icon: Building2 },
  { href: "/tarefas", label: "Tarefas", icon: CheckSquare },
  { href: "/upload-inteligente", label: "Upload Guias", icon: CloudUpload },
  { href: "/pendentes-envio", label: "Pendentes Envio", icon: SendHorizonal },
  { href: "/catalogos", label: "Catálogos", icon: Package },
  { href: "/catalogo", label: "Tarefas Base", icon: BookOpen },
  { href: "/painel-mensal", label: "Painel Mensal", icon: CalendarDays },
  { href: "/recorrentes", label: "Recorrentes", icon: RefreshCw },
  { href: "/acessos-clientes", label: "Portal Clientes", icon: KeyRound },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

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
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm" style={{ background: "#24646c", color: "#fff" }}>
              EQ
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight" style={{ color: "#e5e5e5" }}>Equilibrium</p>
              <p className="text-xs" style={{ color: "#a1a1aa" }}>Consultoria</p>
            </div>
          </div>
          <button className="lg:hidden" onClick={() => setMobileOpen(false)} style={{ color: "#a1a1aa" }}>
            <X size={18} />
          </button>
        </div>

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

        <div className="px-3 py-4" style={{ borderTop: "1px solid #1e4f5c" }}>
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: "rgba(36,100,108,0.1)" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "#24646c", color: "#fff" }}>
              EQ
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: "#e5e5e5" }}>Administrador</p>
              <p className="text-xs" style={{ color: "#a1a1aa" }}>Equilibrium</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 sticky top-0 z-30" style={{ background: "#0d1f22", borderBottom: "1px solid #1e4f5c" }}>
          <button onClick={() => setMobileOpen(true)} style={{ color: "#a1a1aa" }}>
            <Menu size={20} />
          </button>
          <span className="font-semibold text-sm" style={{ color: "#e5e5e5" }}>Equilibrium</span>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
