import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, ChevronLeft, Send, QrCode, Search, Sun, Moon, RotateCw, Check, CheckCheck, Clock, MessageSquare,
} from "lucide-react";

/* ── Temas ─────────────────────────────────────────────────────────────────── */
type Theme = {
  name: "dark" | "light";
  bg: string; surface: string; surfaceHi: string; surfaceActive: string;
  border: string; borderHi: string;
  text: string; textMuted: string; textFaint: string;
  accent: string; accentText: string; accentSoft: string;
  bubbleMe: string; bubbleThem: string;
  danger: string; dangerSoft: string; dangerBorder: string;
  ok: string; warn: string; off: string;
  shadow: string; scrollThumb: string;
};
const THEMES: Record<"dark" | "light", Theme> = {
  dark: {
    name: "dark",
    bg: "#081311", surface: "#0d1917", surfaceHi: "#122220", surfaceActive: "#123029",
    border: "#1d302d", borderHi: "#294640",
    text: "#e6edeb", textMuted: "#8ba09b", textFaint: "#566a66",
    accent: "#33a2b8", accentText: "#03211f", accentSoft: "rgba(51,162,184,.13)",
    bubbleMe: "#104043", bubbleThem: "#17221f",
    danger: "#f87171", dangerSoft: "rgba(248,113,113,.10)", dangerBorder: "rgba(248,113,113,.25)",
    ok: "#33c98f", warn: "#e0a458", off: "#ef4444",
    shadow: "none", scrollThumb: "#24383300",
  },
  light: {
    name: "light",
    bg: "#e8edec", surface: "#ffffff", surfaceHi: "#f4f8f7", surfaceActive: "#e6f1f0",
    border: "#e0e7e5", borderHi: "#c9d6d3",
    text: "#132220", textMuted: "#5a6a67", textFaint: "#94a3a0",
    accent: "#1c6675", accentText: "#ffffff", accentSoft: "rgba(28,102,117,.10)",
    bubbleMe: "#cfe9ec", bubbleThem: "#ffffff",
    danger: "#dc2626", dangerSoft: "rgba(220,38,38,.06)", dangerBorder: "rgba(220,38,38,.20)",
    ok: "#12a06b", warn: "#c07c2b", off: "#e0483a",
    shadow: "0 1px 2px rgba(16,64,64,.06)", scrollThumb: "#c9d4d1",
  },
};

/* ── Tipos e util ──────────────────────────────────────────────────────────── */
type Conv = {
  id: number; status: string; unreadCount: number; lastMessageAt: string;
  name: string | null; waNumber: string; lastMessage: string | null; lastFromMe: number;
};
type Msg = {
  id: number; senderType: string; fromMe: number | boolean; content: string | null;
  messageType: string; status: string; createdAt: string;
  agentName?: string | null; agentRole?: string | null;
};

const api = (path: string, opts?: RequestInit) =>
  fetch(path, { credentials: "include", ...opts }).then((r) => r.json());

const fmtTime = (iso: string) => {
  try { return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
};
const fmtNumber = (n: string) => {
  const d = (n || "").replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  if (d.length > 13) return `ID ${d.slice(0, 6)}…`; // LID: não é telefone
  return n;
};
const hue = (s: string) => { let h = 0; for (const c of s || "?") h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const avaBg = (s: string, t: Theme) => t.name === "dark" ? `hsl(${hue(s)} 26% 20%)` : `hsl(${hue(s)} 42% 92%)`;
const avaFg = (s: string, t: Theme) => t.name === "dark" ? `hsl(${hue(s)} 45% 68%)` : `hsl(${hue(s)} 42% 36%)`;
const agentLabel = (m: Msg) =>
  m.agentName || (m.agentRole === "admin" ? "Administrador" : m.agentRole ? "Atendente" : "Atendimento");
function urlB64ToUint8(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/* ── Componente ────────────────────────────────────────────────────────────── */
export default function WhatsAppModule() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try { return (localStorage.getItem("wa_theme") as any) || "dark"; } catch { return "dark"; }
  });
  const t = THEMES[theme];
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem("wa_theme", next); } catch {}
  };

  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 760);
  useEffect(() => {
    const on = () => setIsMobile(window.innerWidth < 760);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  // Notificações push + service worker: recebe aviso com o app fechado e badge no ícone
  useEffect(() => {
    (async () => {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
        const reg = await navigator.serviceWorker.register("/sw.js");
        if (Notification.permission === "default") {
          const perm = await Notification.requestPermission().catch(() => "denied");
          if (perm !== "granted") return;
        }
        if (Notification.permission !== "granted") return;
        const r = await api("/api/wa/push/key").catch(() => ({ key: "" }));
        if (!r?.key) return;
        const existing = await reg.pushManager.getSubscription();
        const sub = existing || await reg.pushManager.subscribe({
          userVisibleOnly: true, applicationServerKey: urlB64ToUint8(r.key),
        });
        await api("/api/wa/push/subscribe", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub }),
        }).catch(() => {});
      } catch {}
    })();
  }, []);

  const [conn, setConn] = useState<{ status: string; qr: string | null; lastError?: string | null }>({ status: "closed", qr: null });
  const [convs, setConvs] = useState<Conv[]>([]);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Conv | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<Conv | null>(null);
  activeRef.current = active;

  const loadConn = useCallback(() => api("/api/wa/status").then(setConn).catch(() => {}), []);
  const loadConvs = useCallback(
    () => api(`/api/wa/conversations?status=${filter}`).then((r) => Array.isArray(r) && setConvs(r)).catch(() => {}),
    [filter],
  );
  const loadMsgs = useCallback(
    (id: number) => api(`/api/wa/conversations/${id}/messages`).then((r) => Array.isArray(r) && setMsgs(r)).catch(() => {}),
    [],
  );

  useEffect(() => {
    loadConn();
    const iv = setInterval(loadConn, conn.status === "open" ? 20000 : 4000);
    return () => clearInterval(iv);
  }, [loadConn, conn.status]);

  useEffect(() => { loadConvs(); }, [loadConvs]);

  // Tempo real via WebSocket — com reconexão automática se a conexão cair
  useEffect(() => {
    let ws: WebSocket | null = null;
    let stopped = false;
    let retry: any;
    const handle = (e: MessageEvent) => {
      let ev: any; try { ev = JSON.parse(e.data); } catch { return; }
      if (ev.kind === "message") {
        loadConvs();
        const a = activeRef.current;
        if (a && ev.conversationId === a.id) loadMsgs(a.id);
        if (!ev.fromMe) {
          try {
            if ("Notification" in window && Notification.permission === "granted" &&
                (document.hidden || !a || a.id !== ev.conversationId)) {
              const n = new Notification("Nova mensagem no WhatsApp", {
                body: ev.text || "Mensagem recebida", icon: "/logo.png", tag: `wa-${ev.conversationId}`,
              });
              n.onclick = () => { window.focus(); n.close(); };
            }
          } catch {}
        }
      } else if (ev.kind === "status") {
        setConn((c) => ({ ...c, status: ev.status }));
        if (ev.status === "qr" || ev.status === "open") loadConn();
      } else if (ev.kind === "conversation") { loadConvs(); }
    };
    const open = () => {
      if (stopped) return;
      const proto = location.protocol === "https:" ? "wss" : "ws";
      try { ws = new WebSocket(`${proto}://${location.host}/api/wa/ws`); }
      catch { retry = setTimeout(open, 4000); return; }
      ws.onmessage = handle;
      ws.onclose = () => { if (!stopped) { clearTimeout(retry); retry = setTimeout(open, 4000); } };
      ws.onerror = () => { try { ws?.close(); } catch {} };
    };
    open();
    return () => { stopped = true; clearTimeout(retry); try { ws?.close(); } catch {} };
  }, [loadConvs, loadMsgs, loadConn]);

  // Rede de segurança: se o WebSocket falhar, o polling garante que as mensagens apareçam
  useEffect(() => {
    const iv = setInterval(loadConvs, 5000);
    return () => clearInterval(iv);
  }, [loadConvs]);
  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => loadMsgs(active.id), 3500);
    return () => clearInterval(iv);
  }, [active, loadMsgs]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, active]);

  const openConv = (c: Conv) => {
    setActive(c);
    loadMsgs(c.id);
    if (c.unreadCount > 0) {
      api(`/api/wa/conversations/${c.id}/read`, { method: "POST" }).catch(() => {});
      setConvs((cs) => cs.map((x) => (x.id === c.id ? { ...x, unreadCount: 0 } : x)));
    }
  };

  const send = async () => {
    const body = text.trim();
    if (!body || !active || sending) return;
    setSending(true);
    setText("");
    // Otimista: mostra a mensagem na hora (o envio real leva 1-2s pelo WhatsApp)
    const tempId = -Date.now();
    const temp: Msg = {
      id: tempId, senderType: "agent", fromMe: 1, content: body, messageType: "text",
      status: "sending", createdAt: new Date().toISOString(), agentName: "Você",
    };
    setMsgs((m) => [...m, temp]);
    const r = await api(`/api/wa/conversations/${active.id}/send`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: body }),
    }).catch(() => ({ error: "Sem conexão" }));
    setSending(false);
    if (r?.ok) { loadMsgs(active.id); loadConvs(); }
    else {
      setMsgs((m) => m.map((x) => (x.id === tempId ? { ...x, status: "failed" } : x)));
      alert(r?.error || "Não foi possível enviar. O WhatsApp está conectado?");
    }
  };

  const setConvStatus = async (st: string) => {
    if (!active) return;
    await api(`/api/wa/conversations/${active.id}/status`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: st }),
    }).catch(() => {});
    setActive({ ...active, status: st });
    loadConvs();
  };

  const connect = async () => {
    setConn((c) => ({ ...c, lastError: null }));
    const r = await api("/api/wa/start", { method: "POST" }).catch(() => ({ error: "Sem conexão com o servidor." }));
    if (r?.error) { setConn((c) => ({ ...c, lastError: r.error })); return; }
    setTimeout(loadConn, 1200);
  };

  // Badge de não lidas no ícone do app instalado (PWA)
  const totalUnread = convs.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  useEffect(() => {
    try {
      const nav = navigator as any;
      if ("setAppBadge" in nav) {
        if (totalUnread > 0) nav.setAppBadge(totalUnread);
        else nav.clearAppBadge?.();
      }
      document.title = totalUnread > 0 ? `(${totalUnread}) Atendimento` : "Atendimento";
    } catch {}
  }, [totalUnread]);

  const shown = convs.filter((c) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (c.name || "").toLowerCase().includes(s) || c.waNumber.includes(s.replace(/\D/g, ""));
  });

  const connMeta: Record<string, { c: string; label: string }> = {
    open: { c: t.ok, label: "Conectado" },
    connecting: { c: t.warn, label: "Conectando" },
    qr: { c: t.warn, label: "Aguardando QR" },
    closed: { c: t.off, label: "Desconectado" },
  };
  const cm = connMeta[conn.status] || connMeta.closed;

  const showList = !isMobile || !active;
  const showChat = !isMobile || !!active;
  const showBanner = conn.status !== "open" && !(isMobile && active);

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: t.bg, color: t.text,
      fontFamily: "Inter, system-ui, -apple-system, sans-serif", transition: "background .25s, color .25s" }}>
      <style>{`
        * { box-sizing: border-box; }
        .wa-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .wa-scroll::-webkit-scrollbar-thumb { background: ${t.scrollThumb}; border-radius: 8px; }
        .wa-scroll::-webkit-scrollbar-track { background: transparent; }
        .wa-tap { transition: background .15s, border-color .15s, transform .05s, opacity .15s; }
        .wa-tap:active { transform: scale(.98); }
        .wa-row:hover { background: ${t.surfaceHi}; }
        textarea, input, button, select { font-family: inherit; }
        textarea:focus-visible, input:focus-visible, button:focus-visible, select:focus-visible {
          outline: 2px solid ${t.accent}; outline-offset: 1px;
        }
        @media (prefers-reduced-motion: reduce) { *, .wa-tap { transition: none !important; } }
        @keyframes waPulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
      `}</style>

      {/* ── Barra superior ── */}
      <header style={{ flex: "none", background: t.surface, borderBottom: `1px solid ${t.border}`,
        padding: isMobile ? "10px 14px" : "12px 20px", display: "flex", alignItems: "center", gap: 12,
        transition: "background .25s, border-color .25s" }}>
        {isMobile && active ? (
          <button onClick={() => setActive(null)} className="wa-tap" style={iconBtn(t)} aria-label="Voltar">
            <ChevronLeft size={19} />
          </button>
        ) : (
          <Link href="/">
            <button className="wa-tap" style={{ ...iconBtn(t), width: "auto", padding: "0 12px", gap: 6, fontSize: 13 }}>
              <ArrowLeft size={16} /> {!isMobile && "Plataforma"}
            </button>
          </Link>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, flex: "none", background: t.accentSoft,
            display: "grid", placeItems: "center" }}>
            <MessageSquare size={18} style={{ color: t.accent }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 650, letterSpacing: "-.01em", whiteSpace: "nowrap",
              overflow: "hidden", textOverflow: "ellipsis" }}>
              {isMobile && active ? (active.name || fmtNumber(active.waNumber)) : "Atendimento"}
            </div>
            <div style={{ fontSize: 11.5, color: t.textFaint, display: "flex", alignItems: "center", gap: 5 }}>
              {isMobile && active ? fmtNumber(active.waNumber) : (
                <>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: cm.c,
                    animation: conn.status === "open" ? "waPulse 2.4s ease-in-out infinite" : "none" }} />
                  {cm.label}
                </>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {!isMobile && conn.status === "open" && (
            <button onClick={loadConn} className="wa-tap" style={iconBtn(t)} aria-label="Atualizar" title="Atualizar">
              <RotateCw size={15} />
            </button>
          )}
          <button onClick={toggleTheme} className="wa-tap" style={iconBtn(t)}
            aria-label="Alternar tema" title={theme === "dark" ? "Tema claro" : "Tema escuro"}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* ── Faixa de conexão / QR ── */}
      {showBanner && (
        <div style={{ flex: "none", background: t.surfaceHi, borderBottom: `1px solid ${t.border}`,
          padding: isMobile ? "18px 16px" : "16px 20px", display: "flex", flexWrap: "wrap",
          alignItems: "center", justifyContent: isMobile ? "center" : "flex-start", gap: 18, textAlign: isMobile ? "center" : "left" }}>
          {conn.status === "qr" && conn.qr ? (
            <>
              <img src={conn.qr} alt="QR code" style={{ width: 156, height: 156, borderRadius: 14,
                background: "#fff", padding: 8, boxShadow: t.shadow }} />
              <div style={{ fontSize: 13.5, color: t.textMuted, maxWidth: 420, lineHeight: 1.6 }}>
                <div style={{ color: t.text, fontWeight: 600, marginBottom: 4 }}>Conecte o WhatsApp</div>
                No celular do atendimento: <b style={{ color: t.text }}>Aparelhos conectados → Conectar um aparelho</b> e aponte para o código.
              </div>
            </>
          ) : (
            <>
              <div style={{ width: 46, height: 46, borderRadius: 13, flex: "none",
                background: conn.status === "connecting" ? t.accentSoft : "rgba(224,164,88,.14)",
                display: "grid", placeItems: "center" }}>
                <QrCode size={22} style={{ color: conn.status === "connecting" ? t.accent : t.warn }} />
              </div>
              <div style={{ fontSize: 13.5, color: t.textMuted, flex: isMobile ? "none" : 1 }}>
                {conn.status === "connecting" ? "Conectando ao WhatsApp…" : "O WhatsApp não está conectado."}
              </div>
              {conn.status !== "connecting" && (
                <button onClick={connect} className="wa-tap"
                  style={{ height: 40, padding: "0 18px", borderRadius: 11, border: "none", cursor: "pointer",
                    background: t.accent, color: t.accentText, fontWeight: 600, fontSize: 13.5,
                    display: "flex", alignItems: "center", gap: 8 }}>
                  <QrCode size={16} /> Conectar
                </button>
              )}
            </>
          )}
          {conn.lastError && (
            <div style={{ width: "100%", fontSize: 12.5, color: t.danger, background: t.dangerSoft,
              border: `1px solid ${t.dangerBorder}`, borderRadius: 10, padding: "9px 12px", textAlign: "left" }}>
              <b>Erro:</b> {conn.lastError}
            </div>
          )}
        </div>
      )}

      {/* ── Corpo ── */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Lista */}
        {showList && (
          <aside style={{ width: isMobile ? "100%" : 340, flex: "none", background: t.surface,
            borderRight: isMobile ? "none" : `1px solid ${t.border}`, display: "flex", flexDirection: "column",
            transition: "background .25s, border-color .25s" }}>
            <div style={{ padding: "12px 12px 10px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: t.surfaceHi,
                border: `1px solid ${t.border}`, borderRadius: 11, padding: "9px 12px" }}>
                <Search size={15} color={t.textFaint} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar conversa"
                  style={{ background: "none", border: "none", color: t.text, outline: "none", fontSize: 13.5, width: "100%" }} />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {([["all", "Todas"], ["open", "Abertas"], ["pending", "Pendentes"], ["closed", "Fechadas"]] as const).map(([k, lb]) => {
                  const on = filter === k;
                  return (
                    <button key={k} onClick={() => setFilter(k)} className="wa-tap"
                      style={{ flex: 1, padding: "7px 0", fontSize: 12, borderRadius: 9, cursor: "pointer", fontWeight: on ? 600 : 450,
                        background: on ? t.accent : "transparent", color: on ? t.accentText : t.textMuted,
                        border: `1px solid ${on ? t.accent : t.border}` }}>
                      {lb}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="wa-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 8px 8px" }}>
              {shown.length === 0 && (
                <div style={{ padding: "40px 20px", textAlign: "center", color: t.textFaint, fontSize: 13 }}>
                  Nenhuma conversa por aqui.
                </div>
              )}
              {shown.map((c) => {
                const on = active?.id === c.id;
                const display = c.name || fmtNumber(c.waNumber);
                return (
                  <button key={c.id} onClick={() => openConv(c)} className="wa-tap wa-row"
                    style={{ width: "100%", textAlign: "left", padding: "10px 11px", marginTop: 2, borderRadius: 12,
                      background: on ? t.surfaceActive : "transparent", border: "none", cursor: "pointer",
                      display: "flex", gap: 11, alignItems: "center" }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", flex: "none", fontWeight: 600, fontSize: 16,
                      background: avaBg(display, t), color: avaFg(display, t), display: "grid", placeItems: "center" }}>
                      {display.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 1).toUpperCase() || "?"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: t.text, whiteSpace: "nowrap",
                          overflow: "hidden", textOverflow: "ellipsis" }}>{display}</span>
                        <span style={{ fontSize: 11, color: c.unreadCount > 0 ? t.accent : t.textFaint, flex: "none", fontWeight: c.unreadCount > 0 ? 600 : 400 }}>
                          {fmtTime(c.lastMessageAt)}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 3, alignItems: "center" }}>
                        <span style={{ fontSize: 12.5, color: t.textMuted, whiteSpace: "nowrap", overflow: "hidden",
                          textOverflow: "ellipsis" }}>
                          {c.lastFromMe ? <span style={{ color: t.textFaint }}>Você: </span> : ""}{c.lastMessage || "—"}
                        </span>
                        {c.unreadCount > 0 && (
                          <span style={{ flex: "none", minWidth: 20, height: 20, padding: "0 6px", borderRadius: 10,
                            background: t.accent, color: t.accentText, fontSize: 11.5, fontWeight: 700,
                            display: "grid", placeItems: "center" }}>{c.unreadCount}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>
        )}

        {/* Chat */}
        {showChat && (
          <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: t.bg }}>
            {!active ? (
              <div style={{ margin: "auto", textAlign: "center", color: t.textFaint, padding: 24 }}>
                <div style={{ width: 68, height: 68, borderRadius: 20, background: t.surfaceHi, display: "grid",
                  placeItems: "center", margin: "0 auto 14px" }}>
                  <MessageSquare size={30} style={{ color: t.textFaint }} />
                </div>
                <div style={{ fontSize: 14.5, color: t.textMuted }}>Selecione uma conversa</div>
                <div style={{ fontSize: 12.5, marginTop: 4 }}>As mensagens aparecem aqui em tempo real.</div>
              </div>
            ) : (
              <>
                {/* cabeçalho do chat (desktop) */}
                {!isMobile && (
                  <div style={{ flex: "none", padding: "12px 20px", background: t.surface,
                    borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 12,
                    transition: "background .25s, border-color .25s" }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", flex: "none", fontWeight: 600, fontSize: 15,
                      background: avaBg(active.name || active.waNumber, t), color: avaFg(active.name || active.waNumber, t),
                      display: "grid", placeItems: "center" }}>
                      {(active.name || active.waNumber).replace(/[^\p{L}\p{N}]/gu, "").slice(0, 1).toUpperCase() || "?"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 650 }}>{active.name || fmtNumber(active.waNumber)}</div>
                      <div style={{ fontSize: 12, color: t.textFaint }}>{fmtNumber(active.waNumber)}</div>
                    </div>
                    <StatusSelect value={active.status} onChange={setConvStatus} t={t} />
                  </div>
                )}
                {isMobile && (
                  <div style={{ flex: "none", padding: "8px 14px", background: t.surface, borderBottom: `1px solid ${t.border}`,
                    display: "flex", justifyContent: "flex-end" }}>
                    <StatusSelect value={active.status} onChange={setConvStatus} t={t} />
                  </div>
                )}

                {/* mensagens */}
                <div ref={scrollRef} className="wa-scroll"
                  style={{ flex: 1, overflowY: "auto", padding: "18px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {msgs.map((m, i) => {
                    const me = !!m.fromMe;
                    const prev = msgs[i - 1];
                    const grouped = prev && !!prev.fromMe === me;
                    const label = me ? agentLabel(m) : null;
                    const prevLabel = prev && !!prev.fromMe ? agentLabel(prev) : null;
                    const showLabel = me && label !== prevLabel;
                    const nonText = m.messageType !== "text" && m.messageType !== "template";
                    return (
                      <div key={m.id} style={{ alignSelf: me ? "flex-end" : "flex-start", maxWidth: "76%", marginTop: grouped && !showLabel ? 0 : 6 }}>
                        {showLabel && (
                          <div style={{ fontSize: 11, fontWeight: 600, color: t.accent, textAlign: "right", margin: "0 4px 3px 0" }}>
                            {label}
                          </div>
                        )}
                        <div style={{ background: me ? t.bubbleMe : t.bubbleThem, color: t.text,
                          border: me ? "none" : `1px solid ${t.border}`, boxShadow: t.shadow,
                          borderRadius: 16, borderBottomRightRadius: me ? 5 : 16, borderBottomLeftRadius: me ? 16 : 5,
                          padding: "8px 12px 6px", fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
                          opacity: m.status === "sending" ? 0.72 : 1 }}>
                          {nonText && <span style={{ color: t.textFaint, fontStyle: "italic" }}>[{m.messageType}] </span>}
                          {m.content || (nonText ? "" : "—")}
                          <span style={{ fontSize: 10, color: m.status === "failed" ? t.danger : t.textFaint, marginLeft: 8, float: "right",
                            position: "relative", top: 5, display: "inline-flex", alignItems: "center", gap: 3 }}>
                            {m.status === "failed" ? "falhou" : fmtTime(m.createdAt)}
                            {me && m.status !== "failed" && (m.status === "read" ? <CheckCheck size={13} style={{ color: t.accent }} />
                              : m.status === "delivered" ? <CheckCheck size={13} />
                              : m.status === "sending" ? <Clock size={12} />
                              : <Check size={13} />)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* composer */}
                <div style={{ flex: "none", padding: 12, background: t.surface, borderTop: `1px solid ${t.border}`,
                  display: "flex", gap: 10, alignItems: "flex-end", transition: "background .25s, border-color .25s" }}>
                  <textarea value={text} onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder={conn.status === "open" ? "Mensagem" : "Conecte o WhatsApp para enviar"}
                    disabled={conn.status !== "open"} rows={1}
                    style={{ flex: 1, resize: "none", background: t.surfaceHi, border: `1px solid ${t.border}`,
                      borderRadius: 22, padding: "11px 16px", color: t.text, outline: "none", fontSize: 14,
                      maxHeight: 120, lineHeight: 1.4 }} />
                  <button onClick={send} disabled={sending || conn.status !== "open" || !text.trim()} className="wa-tap"
                    aria-label="Enviar"
                    style={{ width: 44, height: 44, flex: "none", borderRadius: "50%", border: "none",
                      display: "grid", placeItems: "center",
                      background: text.trim() && conn.status === "open" ? t.accent : t.surfaceHi,
                      color: text.trim() && conn.status === "open" ? t.accentText : t.textFaint,
                      cursor: text.trim() && conn.status === "open" ? "pointer" : "default" }}>
                    <Send size={18} />
                  </button>
                </div>
              </>
            )}
          </main>
        )}
      </div>
    </div>
  );
}

/* ── Peças ─────────────────────────────────────────────────────────────────── */
function iconBtn(t: Theme): React.CSSProperties {
  return { width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center", cursor: "pointer",
    background: t.surfaceHi, border: `1px solid ${t.border}`, color: t.textMuted };
}
function StatusSelect({ value, onChange, t }: { value: string; onChange: (s: string) => void; t: Theme }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{ background: t.surfaceHi, color: t.textMuted, border: `1px solid ${t.border}`, borderRadius: 9,
        padding: "7px 10px", fontSize: 12.5, cursor: "pointer" }}>
      <option value="open">Aberta</option>
      <option value="pending">Pendente</option>
      <option value="closed">Fechada</option>
    </select>
  );
}
