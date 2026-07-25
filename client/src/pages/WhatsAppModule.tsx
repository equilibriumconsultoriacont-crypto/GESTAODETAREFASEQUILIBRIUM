import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, MessageCircle, Send, QrCode, Circle, RefreshCw, Search } from "lucide-react";

const C = {
  bg: "#0a0a0a", panel: "#0d1f22", line: "#1e4f5c", line2: "#2b5f69",
  txt: "#f4f4f5", txt2: "#9fd4dc", txt3: "#71717a", teal: "#3E9AA6", green: "#4ade80",
  bubbleMe: "#134e4a", bubbleThem: "#16383f", warn: "#E0A458",
};

type Conv = {
  id: number; status: string; unreadCount: number; lastMessageAt: string;
  name: string | null; waNumber: string; lastMessage: string | null; lastFromMe: number;
};
type Msg = {
  id: number; senderType: string; fromMe: number | boolean; content: string | null;
  messageType: string; status: string; createdAt: string;
};

const api = (path: string, opts?: RequestInit) =>
  fetch(path, { credentials: "include", ...opts }).then((r) => r.json());

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}
function fmtNumber(n: string) {
  const d = (n || "").replace(/\D/g, "");
  if (d.length >= 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  return n;
}

export default function WhatsAppModule() {
  const [conn, setConn] = useState<{ status: string; qr: string | null }>({ status: "closed", qr: null });
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
    const t = setInterval(loadConn, conn.status === "open" ? 20000 : 4000);
    return () => clearInterval(t);
  }, [loadConn, conn.status]);

  useEffect(() => { loadConvs(); }, [loadConvs]);

  useEffect(() => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${proto}://${location.host}/api/wa/ws`);
    } catch { return; }
    ws.onmessage = (e) => {
      let ev: any;
      try { ev = JSON.parse(e.data); } catch { return; }
      if (ev.kind === "message") {
        loadConvs();
        const a = activeRef.current;
        if (a && ev.conversationId === a.id) loadMsgs(a.id);
      } else if (ev.kind === "status") {
        setConn((c) => ({ ...c, status: ev.status }));
        if (ev.status === "qr" || ev.status === "open") loadConn();
      } else if (ev.kind === "conversation") {
        loadConvs();
      }
    };
    return () => { try { ws.close(); } catch {} };
  }, [loadConvs, loadMsgs, loadConn]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs]);

  const openConv = (c: Conv) => {
    setActive(c);
    loadMsgs(c.id);
    if (c.unreadCount > 0) {
      api(`/api/wa/conversations/${c.id}/read`, { method: "POST" }).catch(() => {});
      setConvs((cs) => cs.map((x) => (x.id === c.id ? { ...x, unreadCount: 0 } : x)));
    }
  };

  const send = async () => {
    const t = text.trim();
    if (!t || !active || sending) return;
    setSending(true);
    const r = await api(`/api/wa/conversations/${active.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t }),
    }).catch(() => ({ error: "Sem conexão" }));
    setSending(false);
    if (r?.ok) { setText(""); loadMsgs(active.id); loadConvs(); }
    else alert(r?.error || "Falha ao enviar. O WhatsApp está conectado?");
  };

  const setConvStatus = async (st: string) => {
    if (!active) return;
    await api(`/api/wa/conversations/${active.id}/status`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: st }),
    }).catch(() => {});
    setActive({ ...active, status: st });
    loadConvs();
  };

  const connect = () => api("/api/wa/start", { method: "POST" }).then(() => setTimeout(loadConn, 1500)).catch(() => {});

  const shown = convs.filter((c) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (c.name || "").toLowerCase().includes(s) || c.waNumber.includes(s.replace(/\D/g, ""));
  });

  const statusDot: Record<string, string> = { open: C.green, connecting: C.warn, qr: C.warn, closed: "#ef4444" };
  const statusLabel: Record<string, string> = { open: "Conectado", connecting: "Conectando…", qr: "Escaneie o QR", closed: "Desconectado" };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: C.bg, color: C.txt }}>
      <header style={{ borderBottom: `1px solid ${C.line}`, background: C.panel, flex: "none" }}>
        <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/">
            <button style={btn(C.line)}><ArrowLeft size={15} /> Plataforma</button>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(74,222,128,0.15)", display: "grid", placeItems: "center" }}>
              <MessageCircle size={18} style={{ color: C.green }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Atendimento WhatsApp</div>
              <div style={{ fontSize: 11, color: C.txt3 }}>Central multi-atendente</div>
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.txt2 }}>
            <Circle size={9} fill={statusDot[conn.status] || C.txt3} color={statusDot[conn.status] || C.txt3} />
            {statusLabel[conn.status] || conn.status}
            <button onClick={loadConn} style={{ ...btn(C.line), padding: "5px 8px" }} title="Atualizar"><RefreshCw size={13} /></button>
          </div>
        </div>
      </header>

      {conn.status !== "open" && (
        <div style={{ background: "#111", borderBottom: `1px solid ${C.line}`, padding: "16px 20px", display: "flex", alignItems: "center", gap: 20, flex: "none" }}>
          {conn.status === "qr" && conn.qr ? (
            <>
              <img src={conn.qr} alt="QR" style={{ width: 148, height: 148, borderRadius: 10, background: "#fff", padding: 6 }} />
              <div style={{ fontSize: 13, color: C.txt2, maxWidth: 420, lineHeight: 1.6 }}>
                <b style={{ color: C.txt }}>Escaneie para conectar.</b><br />
                No celular do número de atendimento: WhatsApp → <b>Aparelhos conectados</b> → <b>Conectar um aparelho</b> → aponte para este QR.
              </div>
            </>
          ) : (
            <>
              <div style={{ width: 52, height: 52, borderRadius: 12, background: "rgba(224,164,88,.15)", display: "grid", placeItems: "center" }}>
                <QrCode size={26} style={{ color: C.warn }} />
              </div>
              <div style={{ fontSize: 13, color: C.txt2, flex: 1 }}>
                {conn.status === "connecting" ? "Conectando ao WhatsApp…" : "O WhatsApp não está conectado."}
              </div>
              {conn.status !== "connecting" && (
                <button onClick={connect} style={{ ...btn(C.teal), background: C.teal, color: "#04231f", fontWeight: 600 }}>
                  <QrCode size={15} /> Conectar
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <aside style={{ width: 320, flex: "none", borderRight: `1px solid ${C.line}`, background: C.panel, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 10, borderBottom: `1px solid ${C.line}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 9px" }}>
              <Search size={14} color={C.txt3} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar conversa…"
                style={{ background: "none", border: "none", color: C.txt, outline: "none", fontSize: 13, width: "100%" }} />
            </div>
            <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
              {([["all", "Todas"], ["open", "Abertas"], ["pending", "Pendentes"], ["closed", "Fechadas"]] as const).map(([k, lb]) => (
                <button key={k} onClick={() => setFilter(k)} style={chip(filter === k)}>{lb}</button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {shown.length === 0 && (
              <div style={{ padding: 24, textAlign: "center", color: C.txt3, fontSize: 13 }}>Nenhuma conversa.</div>
            )}
            {shown.map((c) => (
              <button key={c.id} onClick={() => openConv(c)}
                style={{ width: "100%", textAlign: "left", padding: "11px 13px", background: active?.id === c.id ? C.bg : "transparent",
                  border: "none", borderBottom: `1px solid ${C.line}`, borderLeft: active?.id === c.id ? `2px solid ${C.teal}` : "2px solid transparent",
                  cursor: "pointer", display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", flex: "none", background: C.line, display: "grid", placeItems: "center", color: C.txt2, fontWeight: 600, fontSize: 14 }}>
                  {(c.name || c.waNumber).slice(0, 1).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: C.txt, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.name || fmtNumber(c.waNumber)}
                    </span>
                    <span style={{ fontSize: 11, color: C.txt3, flex: "none" }}>{fmtTime(c.lastMessageAt)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 12, color: C.txt3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.lastFromMe ? "Você: " : ""}{c.lastMessage || "—"}
                    </span>
                    {c.unreadCount > 0 && (
                      <span style={{ flex: "none", background: C.green, color: "#04231f", borderRadius: 10, fontSize: 11, fontWeight: 700, padding: "1px 7px" }}>
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: C.bg }}>
          {!active ? (
            <div style={{ margin: "auto", textAlign: "center", color: C.txt3 }}>
              <MessageCircle size={40} style={{ color: C.line2, marginBottom: 10 }} />
              <div style={{ fontSize: 14 }}>Selecione uma conversa para começar.</div>
            </div>
          ) : (
            <>
              <div style={{ padding: "11px 18px", borderBottom: `1px solid ${C.line}`, background: C.panel, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{active.name || fmtNumber(active.waNumber)}</div>
                  <div style={{ fontSize: 11.5, color: C.txt3 }}>{fmtNumber(active.waNumber)}</div>
                </div>
                <select value={active.status} onChange={(e) => setConvStatus(e.target.value)}
                  style={{ background: C.bg, color: C.txt2, border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 9px", fontSize: 12.5, cursor: "pointer" }}>
                  <option value="open">Aberta</option>
                  <option value="pending">Pendente</option>
                  <option value="closed">Fechada</option>
                </select>
              </div>

              <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
                {msgs.map((m) => {
                  const me = !!m.fromMe;
                  return (
                    <div key={m.id} style={{ alignSelf: me ? "flex-end" : "flex-start", maxWidth: "72%" }}>
                      <div style={{ background: me ? C.bubbleMe : C.bubbleThem, borderRadius: 12, padding: "8px 12px", fontSize: 13.5, lineHeight: 1.5, color: C.txt, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {m.messageType !== "text" && m.messageType !== "template" && (
                          <span style={{ color: C.txt2, fontStyle: "italic" }}>[{m.messageType}] </span>
                        )}
                        {m.content || (m.messageType !== "text" ? "" : "—")}
                      </div>
                      <div style={{ fontSize: 10.5, color: C.txt3, textAlign: me ? "right" : "left", marginTop: 2 }}>
                        {fmtTime(m.createdAt)}{me && m.status ? ` · ${m.status}` : ""}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ padding: 12, borderTop: `1px solid ${C.line}`, background: C.panel, display: "flex", gap: 8 }}>
                <textarea value={text} onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={conn.status === "open" ? "Escreva uma mensagem… (Enter envia)" : "Conecte o WhatsApp para enviar"}
                  disabled={conn.status !== "open"} rows={1}
                  style={{ flex: 1, resize: "none", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", color: C.txt, outline: "none", fontSize: 13.5, fontFamily: "inherit", maxHeight: 120 }} />
                <button onClick={send} disabled={sending || conn.status !== "open" || !text.trim()}
                  style={{ ...btn(C.teal), background: text.trim() && conn.status === "open" ? C.teal : C.line, color: text.trim() && conn.status === "open" ? "#04231f" : C.txt3, padding: "0 16px", cursor: text.trim() && conn.status === "open" ? "pointer" : "default" }}>
                  <Send size={16} />
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function btn(border: string): React.CSSProperties {
  return { display: "flex", alignItems: "center", gap: 6, background: "none", border: `1px solid ${border}`, borderRadius: 8, padding: "8px 12px", color: C.txt2, cursor: "pointer", fontSize: 13 };
}
function chip(on: boolean): React.CSSProperties {
  return { flex: 1, padding: "5px 0", fontSize: 11.5, borderRadius: 7, cursor: "pointer",
    background: on ? C.teal : C.bg, color: on ? "#04231f" : C.txt3, border: `1px solid ${on ? C.teal : C.line}`, fontWeight: on ? 600 : 400 };
}
