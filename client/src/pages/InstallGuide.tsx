import { useState } from "react";

const STEPS_IOS = [
  { t: "Abra o portal no Safari", d: "Use o navegador Safari do iPhone (não funciona por outros navegadores)." },
  { t: "Toque em Compartilhar", d: "O ícone de um quadrado com uma seta para cima, na barra inferior." },
  { t: 'Escolha "Adicionar à Tela de Início"', d: "Role a lista de opções para baixo até encontrar." },
  { t: 'Toque em "Adicionar"', d: "Pronto! O atalho aparece como um app na sua tela." },
];
const STEPS_ANDROID = [
  { t: "Abra o portal no Chrome", d: "Use o navegador Chrome do Android." },
  { t: "Toque no menu ⋮", d: "Os três pontinhos no canto superior direito." },
  { t: 'Escolha "Adicionar à tela inicial"', d: 'Em alguns aparelhos aparece como "Instalar app".' },
  { t: 'Toque em "Adicionar"', d: "Pronto! O atalho aparece na sua tela inicial." },
];

function PhoneMockup({ platform }: { platform: "ios" | "android" }) {
  const teal = "#24646c";
  return (
    <div style={{ position: "relative", width: 210, height: 424, borderRadius: 34, background: "#1a1a1a", border: "6px solid #2a2a2a", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", overflow: "hidden", flexShrink: 0 }}>
      {/* tela / mini-site */}
      <div style={{ position: "absolute", inset: 0, background: "#0d0d0d", display: "flex", flexDirection: "column" }}>
        {/* barra do Android (topo) */}
        {platform === "android" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", background: "#161616", borderBottom: "1px solid #222" }}>
            <div style={{ flex: 1, height: 20, borderRadius: 10, background: "#222", display: "flex", alignItems: "center", paddingLeft: 8 }}>
              <span style={{ fontSize: 8, color: "#71717a" }}>gestaodetarefas…onrender.com</span>
            </div>
            <div className="eq-target" style={{ position: "relative", width: 22, height: 22, borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
              <span style={{ width: 3, height: 3, borderRadius: 3, background: "#e5e5e5" }} />
              <span style={{ width: 3, height: 3, borderRadius: 3, background: "#e5e5e5" }} />
              <span style={{ width: 3, height: 3, borderRadius: 3, background: "#e5e5e5" }} />
              <span className="eq-ring" />
              <span className="eq-tap" />
            </div>
          </div>
        )}

        {/* conteúdo do portal (simplificado) */}
        <div style={{ flex: 1, padding: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: teal, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 10 }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>E</span>
          </div>
          <p style={{ color: "#e5e5e5", fontSize: 11, fontWeight: 600, margin: 0 }}>Portal do Cliente</p>
          <div style={{ width: "100%", height: 40, borderRadius: 10, background: "#141414", border: "1px solid #222" }} />
          <div style={{ width: "100%", height: 40, borderRadius: 10, background: "#141414", border: "1px solid #222" }} />
          <div style={{ width: "100%", height: 40, borderRadius: 10, background: "#141414", border: "1px solid #222" }} />
        </div>

        {/* barra do iOS (base) com botão compartilhar */}
        {platform === "ios" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", padding: "10px 8px", background: "#161616", borderTop: "1px solid #222" }}>
            <span style={{ color: "#3f3f46", fontSize: 16 }}>‹</span>
            <span style={{ color: "#3f3f46", fontSize: 16 }}>›</span>
            <div className="eq-target" style={{ position: "relative", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {/* ícone compartilhar */}
              <div style={{ position: "relative", width: 12, height: 15, border: "1.6px solid #e5e5e5", borderTop: "none", borderRadius: 2 }}>
                <div style={{ position: "absolute", left: "50%", top: -9, transform: "translateX(-50%)", width: 1.6, height: 9, background: "#e5e5e5" }} />
                <div style={{ position: "absolute", left: "50%", top: -9, transform: "translateX(-50%) rotate(-45deg)", transformOrigin: "top", width: 1.6, height: 5, background: "#e5e5e5" }} />
                <div style={{ position: "absolute", left: "50%", top: -9, transform: "translateX(-50%) rotate(45deg)", transformOrigin: "top", width: 1.6, height: 5, background: "#e5e5e5" }} />
              </div>
              <span className="eq-ring" />
              <span className="eq-tap" />
            </div>
            <span style={{ color: "#3f3f46", fontSize: 16 }}>⤢</span>
          </div>
        )}
      </div>

      {/* folha "Adicionar à tela inicial" que sobe */}
      <div className="eq-sheet" style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "#1e1e1e", borderTop: "1px solid #333", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 10 }}>
        <div style={{ width: 32, height: 4, borderRadius: 4, background: "#3f3f46", margin: "0 auto 10px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, background: "rgba(36,100,108,0.25)", border: "1px solid rgba(36,100,108,0.6)" }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: "#24646c", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 15, fontWeight: 700 }}>＋</div>
          <span style={{ color: "#e5e5e5", fontSize: 10, fontWeight: 600 }}>Adicionar à Tela de Início</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", marginTop: 6, opacity: 0.4 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: "#2a2a2a" }} />
          <span style={{ color: "#a1a1aa", fontSize: 10 }}>Adicionar aos Favoritos</span>
        </div>
      </div>
    </div>
  );
}

export default function InstallGuide() {
  const [platform, setPlatform] = useState<"ios" | "android">(
    typeof navigator !== "undefined" && /android/i.test(navigator.userAgent) ? "android" : "ios"
  );
  const steps = platform === "ios" ? STEPS_IOS : STEPS_ANDROID;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
    border: "1px solid " + (active ? "rgba(36,100,108,0.6)" : "#2a2a2a"),
    background: active ? "#24646c" : "rgba(255,255,255,0.04)",
    color: active ? "#fff" : "#a1a1aa",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e5e5e5", padding: "28px 18px 48px" }}>
      <style>{`
        @keyframes eqRing { 0%,70% { transform: scale(0.6); opacity: 0; } 15% { opacity: 0.9; } 45% { transform: scale(1.9); opacity: 0; } }
        @keyframes eqTap { 0%,72% { transform: scale(0); opacity: 0; } 10% { transform: scale(1); opacity: 0.5; } 30% { transform: scale(1); opacity: 0; } }
        @keyframes eqSheet { 0%,55% { transform: translateY(110%); } 70%,95% { transform: translateY(0); } 100% { transform: translateY(110%); } }
        .eq-ring { position: absolute; width: 26px; height: 26px; border-radius: 50%; border: 2px solid #4ade80; animation: eqRing 3.6s ease-out infinite; }
        .eq-tap { position: absolute; width: 30px; height: 30px; border-radius: 50%; background: rgba(74,222,128,0.5); animation: eqTap 3.6s ease-out infinite; }
        .eq-sheet { animation: eqSheet 3.6s ease-in-out infinite; }
        .eq-target { }
      `}</style>

      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        {/* Cabeçalho */}
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "#24646c", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 26 }}>E</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Deixe o portal na tela inicial</h1>
          <p style={{ color: "#a1a1aa", fontSize: 14, margin: 0, lineHeight: 1.5 }}>
            Adicione um atalho e abra com um toque, como se fosse um aplicativo.
          </p>
        </div>

        {/* Seletor de plataforma */}
        <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
          <button onClick={() => setPlatform("ios")} style={tabStyle(platform === "ios")}>iPhone (Safari)</button>
          <button onClick={() => setPlatform("android")} style={tabStyle(platform === "android")}>Android (Chrome)</button>
        </div>

        {/* Demonstração animada */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}>
          <PhoneMockup key={platform} platform={platform} />
        </div>

        {/* Passos */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 12, padding: 14, borderRadius: 14, background: "#111", border: "1px solid #1e4f5c" }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#24646c", color: "#fff", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {i + 1}
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "#e5e5e5" }}>{s.t}</p>
                <p style={{ fontSize: 13, margin: "3px 0 0", color: "#a1a1aa", lineHeight: 1.45 }}>{s.d}</p>
              </div>
            </div>
          ))}
        </div>

        <p style={{ textAlign: "center", color: "#52525b", fontSize: 12, marginTop: 24 }}>
          Ficou com dúvida? É só responder ao e-mail ou falar com o escritório.
        </p>
      </div>
    </div>
  );
}
