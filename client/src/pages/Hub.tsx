import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { CheckSquare, FileText, LogOut, MessageCircle, ExternalLink } from "lucide-react";

// Definição dos módulos da plataforma
const MODULES = [
  {
    id: "tarefas",
    name: "Gestão de Tarefas",
    description: "Obrigações contábeis, prazos, guias e acompanhamento de clientes.",
    icon: CheckSquare,
    color: "#24646c",
    path: "/painel",
    available: true,
  },
  {
    id: "propostas",
    name: "Gerador de Propostas",
    description: "Crie propostas comerciais uniformes e profissionais rapidamente.",
    icon: FileText,
    color: "#c084fc",
    path: "/propostas",
    available: true,
  },
  {
    id: "whatsapp",
    name: "Atendimento WhatsApp",
    description: "Central de atendimento multi-atendente. Em breve.",
    icon: MessageCircle,
    color: "#4ade80",
    path: "/whatsapp",
    available: false, // placeholder — será ativado no futuro
  },
];

export default function Hub() {
  const { user, logout } = useAuth();
  const { data: myModules = [] } = trpc.modules.mine.useQuery();

  const firstName = (user?.name ?? "").split(" ")[0] || "";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  // Módulos que o usuário tem acesso
  const allowedIds = new Set(myModules.map((m: any) => m.module));
  const visibleModules = MODULES.filter((m) => allowedIds.has(m.id));

  const openModule = (mod: typeof MODULES[0]) => {
    if (!mod.available) return;
    // Abre em nova aba (o usuário pode fechar a aba do módulo sem fechar o Hub)
    window.open(mod.path, "_blank", "noopener");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid #1e4f5c", background: "#0d1f22" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/logo.png" alt="Equilíbrio" style={{ width: 36, height: 36, objectFit: "contain" }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#f4f4f5" }}>Equilíbrio</div>
              <div style={{ fontSize: 12, color: "#71717a" }}>Plataforma Contábil</div>
            </div>
          </div>
          <button onClick={() => logout()} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid #1e4f5c", borderRadius: 8, padding: "8px 12px", color: "#f87171", cursor: "pointer", fontSize: 13 }}>
            <LogOut size={15} /> Sair
          </button>
        </div>
      </header>

      {/* Conteúdo */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 15, color: "#71717a", marginBottom: 4 }}>{greeting}{firstName ? `, ${firstName}` : ""} 👋</p>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#f4f4f5", marginBottom: 8 }}>Selecione um módulo</h1>
          <p style={{ fontSize: 14, color: "#71717a" }}>Cada módulo abre em uma nova aba. Você pode fechar a aba do módulo sem sair da plataforma.</p>
        </div>

        {visibleModules.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", border: "1px dashed #1e4f5c", borderRadius: 16 }}>
            <p style={{ color: "#a1a1aa", fontSize: 15 }}>Você ainda não tem acesso a nenhum módulo.</p>
            <p style={{ color: "#52525b", fontSize: 13, marginTop: 8 }}>Peça a um administrador para liberar seus acessos.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
            {visibleModules.map((mod) => {
              const Icon = mod.icon;
              return (
                <button
                  key={mod.id}
                  onClick={() => openModule(mod)}
                  disabled={!mod.available}
                  style={{
                    position: "relative",
                    textAlign: "left",
                    background: "#111",
                    border: "1px solid #1e4f5c",
                    borderRadius: 16,
                    padding: 24,
                    cursor: mod.available ? "pointer" : "not-allowed",
                    opacity: mod.available ? 1 : 0.55,
                    transition: "all 0.2s",
                    overflow: "hidden",
                  }}
                  onMouseEnter={(e) => { if (mod.available) { e.currentTarget.style.borderColor = mod.color; e.currentTarget.style.transform = "translateY(-2px)"; } }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1e4f5c"; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  {/* Halo de cor */}
                  <div style={{ position: "absolute", top: -30, right: -30, width: 100, height: 100, borderRadius: "50%", background: mod.color, opacity: 0.08, filter: "blur(20px)" }} />

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, position: "relative" }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: `${mod.color}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon size={24} style={{ color: mod.color }} />
                    </div>
                    {mod.available ? (
                      <ExternalLink size={16} style={{ color: "#52525b" }} />
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 600, color: mod.color, background: `${mod.color}18`, padding: "3px 8px", borderRadius: 6 }}>EM BREVE</span>
                    )}
                  </div>

                  <h3 style={{ fontSize: 17, fontWeight: 600, color: "#f4f4f5", marginBottom: 6, position: "relative" }}>{mod.name}</h3>
                  <p style={{ fontSize: 13, color: "#71717a", lineHeight: 1.5, position: "relative" }}>{mod.description}</p>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
