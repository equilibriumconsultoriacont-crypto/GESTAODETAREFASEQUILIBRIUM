import { Link } from "wouter";
import { ArrowLeft, MessageCircle, Users, Inbox, Clock, CheckCheck, Zap } from "lucide-react";

// Placeholder do módulo WhatsApp — interface preparada para vincular no futuro
// (Evolution API + Chatwoot, ou API oficial da Meta). A UI abaixo é uma prévia
// da central de atendimento multi-atendente.
export default function WhatsAppModule() {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a" }}>
      <header style={{ borderBottom: "1px solid #1e4f5c", background: "#0d1f22" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/">
            <button style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid #1e4f5c", borderRadius: 8, padding: "8px 12px", color: "#9fd4dc", cursor: "pointer", fontSize: 13 }}>
              <ArrowLeft size={15} /> Plataforma
            </button>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(74,222,128,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MessageCircle size={20} style={{ color: "#4ade80" }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#f4f4f5" }}>Atendimento WhatsApp</div>
              <div style={{ fontSize: 12, color: "#71717a" }}>Central multi-atendente</div>
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        {/* Aviso de módulo em preparação */}
        <div style={{ textAlign: "center", padding: "40px 24px", background: "#111", border: "1px solid #1e4f5c", borderRadius: 20, marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "rgba(74,222,128,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <MessageCircle size={32} style={{ color: "#4ade80" }} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f4f4f5", marginBottom: 10 }}>Módulo em preparação</h1>
          <p style={{ fontSize: 14, color: "#a1a1aa", maxWidth: 560, margin: "0 auto", lineHeight: 1.6 }}>
            A central de atendimento via WhatsApp está com a interface pronta e aguardando a conexão
            com o motor de mensagens. Quando ativado, os dois sócios poderão atender o mesmo número
            simultaneamente, com caixa de entrada compartilhada, histórico e distribuição de conversas.
          </p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 20, padding: "6px 14px", borderRadius: 8, background: "rgba(74,222,128,0.1)", color: "#4ade80", fontSize: 12, fontWeight: 600 }}>
            <Zap size={13} /> Vinculação futura
          </div>
        </div>

        {/* Prévia das funcionalidades planejadas */}
        <p style={{ fontSize: 13, fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>
          O que este módulo vai oferecer
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {[
            { icon: Inbox, title: "Caixa compartilhada", desc: "Os dois sócios veem e respondem as mesmas conversas, sem disputar o celular." },
            { icon: Users, title: "Distribuição de conversas", desc: "Atribuição automática entre atendentes e detecção de colisão." },
            { icon: Clock, title: "Respostas rápidas", desc: "Mensagens prontas para as perguntas que mais se repetem." },
            { icon: CheckCheck, title: "Histórico completo", desc: "Todo o histórico do cliente registrado e pesquisável." },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} style={{ background: "#111", border: "1px solid #1e4f5c", borderRadius: 14, padding: 20, opacity: 0.75 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(74,222,128,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <Icon size={19} style={{ color: "#4ade80" }} />
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "#f4f4f5", marginBottom: 5 }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: "#71717a", lineHeight: 1.5 }}>{f.desc}</p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
