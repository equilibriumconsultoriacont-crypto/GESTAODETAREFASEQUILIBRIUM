import { useState } from "react";

const STEPS_IOS = [
  { t: "Abra pelo Safari", d: "Só funciona no Safari (o app de bússola azul). Pelo Chrome ou dentro do e-mail a opção não aparece." },
  { t: "Toque em Compartilhar", d: "O quadradinho com uma seta para cima, na barra de baixo do Safari (no centro)." },
  { t: 'Role e toque em "Adicionar à Tela de Início"', d: "Deslize a lista para baixo — a opção fica no meio, depois dos apps. Se não achar, vá em \u201cEditar Ações\u201d no fim." },
  { t: 'Toque em "Adicionar"', d: "No canto superior direito. Pronto! O atalho vira um ícone na sua tela, como um app." },
];
const STEPS_ANDROID = [
  { t: "Abra pelo Chrome", d: "Use o Chrome. Se abriu pelo e-mail, toque em ⋮ e escolha \u201cAbrir no Chrome\u201d." },
  { t: "Toque no menu ⋮", d: "Os três pontinhos no canto superior direito da tela." },
  { t: 'Toque em "Adicionar à tela inicial"', d: "Fica perto do fim da lista. Em alguns aparelhos aparece como \u201cInstalar app\u201d — é a mesma coisa." },
  { t: 'Toque em "Adicionar"', d: "Confirme no botão. O ícone aparece na sua tela inicial." },
];

function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const apps = /(FBAN|FBAV|FB_IAB|Instagram|Line|Twitter|Snapchat|WhatsApp|MicroMessenger|GSA|; wv|WebView)/i;
  const iosInApp = /(iPhone|iPod|iPad)/i.test(ua) && !/Safari/i.test(ua);
  return apps.test(ua) || iosInApp;
}

function IPhoneMockup() {
  return (
    <div style={{ position: "relative", width: 220, height: 440, borderRadius: 38, background: "#000", border: "7px solid #2a2a2a", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", overflow: "hidden", flexShrink: 0 }}>
      {/* notch */}
      <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 90, height: 20, background: "#000", borderBottomLeftRadius: 12, borderBottomRightRadius: 12, zIndex: 5 }} />
      {/* conteúdo (mini portal) */}
      <div style={{ position: "absolute", inset: 0, background: "#0d0d0d", display: "flex", flexDirection: "column", paddingTop: 22 }}>
        <div style={{ flex: 1, padding: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 9 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "#24646c", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 6 }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>E</span>
          </div>
          <p style={{ color: "#e5e5e5", fontSize: 10, fontWeight: 600, margin: 0 }}>Portal do Cliente</p>
          <div style={{ width: "100%", height: 34, borderRadius: 9, background: "#141414", border: "1px solid #222" }} />
          <div style={{ width: "100%", height: 34, borderRadius: 9, background: "#141414", border: "1px solid #222" }} />
        </div>
        {/* barra Safari inferior */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 16px 12px", background: "#1c1c1e", borderTop: "1px solid #2a2a2a" }}>
          <span style={{ color: "#3f3f46", fontSize: 18 }}>‹</span>
          <span style={{ color: "#3f3f46", fontSize: 18 }}>›</span>
          {/* botão compartilhar em destaque */}
          <div style={{ position: "relative", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "relative", width: 13, height: 16, border: "2px solid #0a84ff", borderTop: "none", borderRadius: 2 }}>
              <div style={{ position: "absolute", left: "50%", top: -10, transform: "translateX(-50%)", width: 2, height: 10, background: "#0a84ff", borderRadius: 2 }} />
              <div style={{ position: "absolute", left: "50%", top: -10, transform: "translateX(-50%) rotate(-42deg)", transformOrigin: "top", width: 2, height: 6, background: "#0a84ff", borderRadius: 2 }} />
              <div style={{ position: "absolute", left: "50%", top: -10, transform: "translateX(-50%) rotate(42deg)", transformOrigin: "top", width: 2, height: 6, background: "#0a84ff", borderRadius: 2 }} />
            </div>
            <span className="eq-ring" style={{ borderColor: "#0a84ff" }} />
            <span className="eq-tap" style={{ background: "rgba(10,132,255,0.5)" }} />
          </div>
          <span style={{ color: "#3f3f46", fontSize: 16 }}>▢</span>
          <span style={{ color: "#3f3f46", fontSize: 18 }}>⧉</span>
        </div>
      </div>

      {/* share sheet subindo */}
      <div className="eq-sheet" style={{ position: "absolute", left: 6, right: 6, bottom: 6, background: "#1c1c1e", borderRadius: 16, padding: 10, boxShadow: "0 -10px 30px rgba(0,0,0,0.6)" }}>
        <div style={{ width: 34, height: 4, borderRadius: 4, background: "#48484a", margin: "0 auto 10px" }} />
        {/* apps (dim) */}
        <div style={{ display: "flex", gap: 12, padding: "2px 4px 12px", borderBottom: "1px solid #2a2a2a", opacity: 0.5 }}>
          {["#34c759", "#0a84ff", "#ff9500"].map((c, i) => (
            <div key={i} style={{ width: 30, height: 30, borderRadius: 9, background: c }} />
          ))}
        </div>
        {/* ações dim */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 6px", opacity: 0.45 }}>
          <span style={{ color: "#e5e5e5", fontSize: 11 }}>Copiar</span>
          <span style={{ color: "#8e8e93" }}>⧉</span>
        </div>
        {/* AÇÃO EM DESTAQUE */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 12px", marginTop: 4, borderRadius: 12, background: "rgba(74,222,128,0.16)", border: "2px solid #4ade80", boxShadow: "0 0 0 3px rgba(74,222,128,0.15)" }}>
          <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>Adicionar à Tela de Início</span>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "#4ade80", display: "flex", alignItems: "center", justifyContent: "center", color: "#0a0a0a", fontSize: 18, fontWeight: 800 }}>＋</div>
          <span className="eq-tap" style={{ right: 8, left: "auto", background: "rgba(74,222,128,0.55)" }} />
          <span className="eq-arrow">👆</span>
        </div>
      </div>
    </div>
  );
}

function AndroidMockup() {
  return (
    <div style={{ position: "relative", width: 220, height: 440, borderRadius: 30, background: "#000", border: "7px solid #2a2a2a", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", overflow: "hidden", flexShrink: 0 }}>
      <div style={{ position: "absolute", inset: 0, background: "#0d0d0d", display: "flex", flexDirection: "column" }}>
        {/* barra Chrome (topo) */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 10px", background: "#202124", borderBottom: "1px solid #2a2a2a" }}>
          <div style={{ flex: 1, height: 22, borderRadius: 11, background: "#2a2b2e", display: "flex", alignItems: "center", paddingLeft: 10 }}>
            <span style={{ fontSize: 8, color: "#9aa0a6" }}>gestaodetarefas…onrender.com</span>
          </div>
          <div style={{ position: "relative", width: 26, height: 26, borderRadius: 13, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
            <span style={{ width: 3.5, height: 3.5, borderRadius: 4, background: "#e8eaed" }} />
            <span style={{ width: 3.5, height: 3.5, borderRadius: 4, background: "#e8eaed" }} />
            <span style={{ width: 3.5, height: 3.5, borderRadius: 4, background: "#e8eaed" }} />
            <span className="eq-ring" style={{ borderColor: "#8ab4f8" }} />
            <span className="eq-tap" style={{ background: "rgba(138,180,248,0.5)" }} />
          </div>
        </div>
        {/* mini portal */}
        <div style={{ flex: 1, padding: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 9 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "#24646c", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 8 }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>E</span>
          </div>
          <p style={{ color: "#e5e5e5", fontSize: 10, fontWeight: 600, margin: 0 }}>Portal do Cliente</p>
          <div style={{ width: "100%", height: 34, borderRadius: 9, background: "#141414", border: "1px solid #222" }} />
          <div style={{ width: "100%", height: 34, borderRadius: 9, background: "#141414", border: "1px solid #222" }} />
        </div>
      </div>

      {/* menu dropdown descendo do topo direito */}
      <div className="eq-menu" style={{ position: "absolute", top: 44, right: 8, width: 168, background: "#2a2b2e", borderRadius: 10, padding: 6, boxShadow: "0 10px 30px rgba(0,0,0,0.6)" }}>
        {["Nova aba", "Favoritos", "Histórico"].map((it, i) => (
          <div key={i} style={{ padding: "8px 10px", color: "#e8eaed", fontSize: 11, opacity: 0.5 }}>{it}</div>
        ))}
        {/* item em destaque */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, padding: "11px 10px", marginTop: 2, borderRadius: 8, background: "rgba(74,222,128,0.16)", border: "2px solid #4ade80" }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: "#4ade80", display: "flex", alignItems: "center", justifyContent: "center", color: "#0a0a0a", fontSize: 15, fontWeight: 800 }}>＋</div>
          <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>Adicionar à tela inicial</span>
          <span className="eq-tap" style={{ right: 6, left: "auto", background: "rgba(74,222,128,0.55)" }} />
          <span className="eq-arrow" style={{ right: -4 }}>👆</span>
        </div>
      </div>
    </div>
  );
}

export default function InstallGuide() {
  const [platform, setPlatform] = useState<"ios" | "android">(
    typeof navigator !== "undefined" && /android/i.test(navigator.userAgent) ? "android" : "ios"
  );
  const [inApp] = useState(isInAppBrowser());
  const steps = platform === "ios" ? STEPS_IOS : STEPS_ANDROID;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
    border: "1px solid " + (active ? "rgba(36,100,108,0.6)" : "#2a2a2a"),
    background: active ? "#24646c" : "rgba(255,255,255,0.04)",
    color: active ? "#fff" : "#a1a1aa",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e5e5e5", padding: "24px 18px 48px" }}>
      <style>{`
        @keyframes eqRing { 0%,68% { transform: scale(0.6); opacity: 0; } 12% { opacity: 0.9; } 42% { transform: scale(2); opacity: 0; } }
        @keyframes eqTap { 0%,70% { transform: scale(0); opacity: 0; } 8% { transform: scale(1); opacity: 0.6; } 28% { transform: scale(1); opacity: 0; } }
        @keyframes eqSheet { 0%,50% { transform: translateY(115%); } 66%,96% { transform: translateY(0); } 100% { transform: translateY(115%); } }
        @keyframes eqMenu { 0%,50% { transform: scale(0.5) translateY(-20px); opacity: 0; transform-origin: top right; } 66%,96% { transform: scale(1) translateY(0); opacity: 1; } 100% { transform: scale(0.5) translateY(-20px); opacity: 0; } }
        @keyframes eqArrow { 0%,66% { opacity: 0; transform: translateY(6px); } 74% { opacity: 1; transform: translateY(0); } 88% { opacity: 1; } 96%,100% { opacity: 0; } }
        @keyframes eqPulseBox { 0%,66%,100% { box-shadow: 0 0 0 3px rgba(74,222,128,0.15); } 80% { box-shadow: 0 0 0 7px rgba(74,222,128,0.05); } }
        .eq-ring { position: absolute; width: 30px; height: 30px; border-radius: 50%; border: 2px solid #4ade80; animation: eqRing 4s ease-out infinite; }
        .eq-tap { position: absolute; width: 34px; height: 34px; border-radius: 50%; background: rgba(74,222,128,0.5); animation: eqTap 4s ease-out infinite; }
        .eq-sheet { animation: eqSheet 4s ease-in-out infinite; }
        .eq-menu { animation: eqMenu 4s ease-in-out infinite; }
        .eq-arrow { position: absolute; right: 44px; bottom: -22px; font-size: 20px; animation: eqArrow 4s ease-in-out infinite; }
      `}</style>

      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        {/* Cabeçalho */}
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ width: 52, height: 52, borderRadius: 15, background: "#24646c", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 24 }}>E</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Deixe o portal na tela do celular</h1>
          <p style={{ color: "#a1a1aa", fontSize: 14, margin: 0, lineHeight: 1.5 }}>
            Crie um atalho e abra com um toque, como se fosse um aplicativo.
          </p>
        </div>

        {/* Aviso: abrir no navegador */}
        {inApp ? (
          <div style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.45)", borderRadius: 12, padding: "12px 14px", marginBottom: 18 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fcd34d" }}>⚠️ Abra no navegador primeiro</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#e5c07b", lineHeight: 1.5 }}>
              Parece que você abriu por dentro de um app (e-mail/rede social) — assim a opção não aparece. Toque em {platform === "ios" ? "\u201ccompartilhar\u201d ou \u201c⋯\u201d e escolha \u201cAbrir no Safari\u201d" : "\u201c⋮\u201d e escolha \u201cAbrir no Chrome\u201d"}, depois volte aqui.
            </p>
          </div>
        ) : (
          <div style={{ background: "rgba(36,100,108,0.1)", border: "1px solid rgba(36,100,108,0.35)", borderRadius: 12, padding: "10px 14px", marginBottom: 18 }}>
            <p style={{ margin: 0, fontSize: 13, color: "#9fd4dc", lineHeight: 1.5 }}>
              <strong>Importante:</strong> faça pelo {platform === "ios" ? "Safari (iPhone)" : "Chrome (Android)"}. Se o link abrir dentro do e-mail, toque em {platform === "ios" ? "\u201c⋯\u201d" : "\u201c⋮\u201d"} e escolha \u201cAbrir no navegador\u201d.
            </p>
          </div>
        )}

        {/* Seletor de plataforma */}
        <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
          <button onClick={() => setPlatform("ios")} style={tabStyle(platform === "ios")}>iPhone (Safari)</button>
          <button onClick={() => setPlatform("android")} style={tabStyle(platform === "android")}>Android (Chrome)</button>
        </div>

        {/* Demonstração animada */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 30 }}>
          {platform === "ios" ? <IPhoneMockup /> : <AndroidMockup />}
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
