import { useState, useEffect, useRef, useCallback } from "react";
import { CalendarView } from "./Calendar";
import { Link } from "wouter";
import {
  ArrowLeft, ChevronLeft, Send, QrCode, Search, Sun, Moon, RotateCw, Check, CheckCheck, Clock, MessageSquare,
  Paperclip, Mic, Square, Image as ImageIcon, FileText, Pencil, Trash2, UserPlus, Building2, ChevronDown, BarChart3, Reply, X as XIcon, CalendarDays, CheckSquare,
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
    accent: "#2f8fbd", accentText: "#ffffff", accentSoft: "rgba(47,143,189,.16)",
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
  assignedAgentId?: number | null; assignedAgentName?: string | null;
  contactId?: number; clientId?: number | null; clientName?: string | null; clientPhone?: string | null; lid?: string | null;
};
type Msg = {
  id: number; senderType: string; fromMe: number | boolean; content: string | null;
  messageType: string; status: string; createdAt: string;
  agentName?: string | null; agentRole?: string | null;
  waMessageId?: string | null; replyTo?: string | null;
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

// Um contato pode chegar identificado pelo LID (identificador interno do WhatsApp), que NÃO é
// telefone. Quando está vinculado a uma empresa, mostramos o telefone do cadastro (que dá para
// ligar). Caso contrário, se for um LID, avisamos em vez de mostrar um número falso.
const isLidNumber = (c: any) => {
  const d = (c?.waNumber || "").replace(/\D/g, "");
  return (!!c?.lid && c.waNumber === c.lid) || (d.length >= 12 && !d.startsWith("55"));
};
const contactPhone = (c: any) => {
  if (c?.clientPhone) return fmtNumber(c.clientPhone);
  if (isLidNumber(c)) return "identificador interno";
  return fmtNumber(c?.waNumber || "");
};
const contactName = (c: any) => c?.name || c?.clientName || contactPhone(c);
const hue = (s: string) => { let h = 0; for (const c of s || "?") h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const avaBg = (s: string, t: Theme) => t.name === "dark" ? `hsl(${hue(s)} 26% 20%)` : `hsl(${hue(s)} 42% 92%)`;
const avaFg = (s: string, t: Theme) => t.name === "dark" ? `hsl(${hue(s)} 45% 68%)` : `hsl(${hue(s)} 42% 36%)`;
const agentLabel = (m: Msg) => m.agentName || "Atendente";
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

  useEffect(() => { api("/api/wa/me").then(setMe).catch(() => {}); }, []);

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
  const [me, setMe] = useState<{ id: number; name: string; role: string } | null>(null);
  const [filter, setFilter] = useState("queue");
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Conv | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [agents, setAgents] = useState<{ id: number; name: string; email: string }[]>([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTo, setTransferTo] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [view, setView] = useState<"chats" | "contacts">("chats");
  const [contacts, setContacts] = useState<any[]>([]);
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [section, setSection] = useState<"dashboard" | "atendimento" | "agenda">("atendimento");
  // Admin abre no Painel; funcionário abre direto no Atendimento
  useEffect(() => { if (me?.role === "admin") setSection("dashboard"); }, [me?.role]);
  const [newNumber, setNewNumber] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<Conv | null>(null);
  activeRef.current = active;

  const loadConn = useCallback(() => api("/api/wa/status").then(setConn).catch(() => {}), []);
  const loadConvs = useCallback(
    () => api(`/api/wa/conversations?filter=${filter}`).then((r) => Array.isArray(r) && setConvs(r)).catch(() => {}),
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

  // Só "gruda" no final se o usuário já estava perto do final (não atrapalha quem rolou para
  // cima para ler mensagens antigas — antes, cada atualização por polling puxava para baixo).
  const stickToBottomRef = useRef(true);
  const onMsgsScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };
  useEffect(() => {
    if (scrollRef.current && stickToBottomRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, active]);

  const openConv = (c: Conv) => {
    stickToBottomRef.current = true;
    setActive(c);
    loadMsgs(c.id);
    loadScheduled(c.id);
    if (c.unreadCount > 0) {
      api(`/api/wa/conversations/${c.id}/read`, { method: "POST" }).catch(() => {});
      setConvs((cs) => cs.map((x) => (x.id === c.id ? { ...x, unreadCount: 0 } : x)));
    }
  };

  const send = async () => {
    stickToBottomRef.current = true;
    const body = text.trim();
    if (!body || !active || sending) return;
    setSending(true);
    setText("");
    // Otimista: mostra a mensagem na hora (o envio real leva 1-2s pelo WhatsApp)
    const tempId = -Date.now();
    const rep = replyingTo;
    setReplyingTo(null);
    const temp: Msg = {
      id: tempId, senderType: "agent", fromMe: 1, content: body, messageType: "text",
      status: "sending", createdAt: new Date().toISOString(), agentName: "Você",
      replyTo: rep?.content || null,
    };
    setMsgs((m) => [...m, temp]);
    // Enviar já assume o atendimento no backend se a conversa estava na fila/sem responsável.
    // Reflete isso na hora para o botão "Atender" sumir e o usuário não iniciar de novo por engano.
    setActive((a) => a && (a.status === "queue" || !a.assignedAgentId)
      ? { ...a, status: "active", assignedAgentId: me?.id ?? a.assignedAgentId, assignedAgentName: me?.name ?? a.assignedAgentName }
      : a);
    const r = await api(`/api/wa/conversations/${active.id}/send`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: body, ...(rep?.waMessageId ? { quotedId: rep.waMessageId, quotedText: rep.content || "" } : {}) }),
    }).catch(() => ({ error: "Sem conexão" }));
    setSending(false);
    if (r?.ok) { loadMsgs(active.id); loadConvs(); }
    else {
      setMsgs((m) => m.map((x) => (x.id === tempId ? { ...x, status: "failed" } : x)));
      alert(r?.error || "Não foi possível enviar. O WhatsApp está conectado?");
    }
  };

  const doAction = async (action: "assign" | "conclude" | "dismiss" | "reopen") => {
    if (!active) return;
    await api(`/api/wa/conversations/${active.id}/${action}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
    }).catch(() => {});
    const map: Record<string, string> = { assign: "active", conclude: "concluded", dismiss: "dismissed", reopen: "queue" };
    setActive({
      ...active, status: map[action],
      assignedAgentId: action === "assign" ? (me?.id ?? null) : action === "reopen" ? null : active.assignedAgentId,
      assignedAgentName: action === "assign" ? (me?.name ?? null) : action === "reopen" ? null : active.assignedAgentName,
    });
    loadConvs();
  };

  // Empresas para o seletor do formulário de contato (que abre de qualquer aba) — carrega no início
  useEffect(() => {
    api("/api/wa/clients").then((r) => Array.isArray(r) && setClientsList(r)).catch(() => {});
  }, []);

  useEffect(() => {
    if (view !== "contacts") return;
    api("/api/wa/contacts").then((r) => Array.isArray(r) && setContacts(r)).catch(() => {});
    api("/api/wa/clients").then((r) => Array.isArray(r) && setClientsList(r)).catch(() => {});
  }, [view]);

  const startConv = async (payload: any, displayName: string, displayNumber: string) => {
    const r = await api("/api/wa/start-conversation", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    }).catch(() => ({} as any));
    if (r?.conversationId) {
      setView("chats"); setFilter("mine");
      setActive({
        id: r.conversationId, status: "active", unreadCount: 0, lastMessageAt: new Date().toISOString(),
        name: displayName || null, waNumber: displayNumber, lastMessage: null, lastFromMe: 0,
        assignedAgentId: me?.id ?? null, assignedAgentName: me?.name ?? null,
      });
      loadMsgs(r.conversationId); loadConvs();
    } else alert(r?.error || "Não foi possível iniciar a conversa.");
  };

  const [contactForm, setContactForm] = useState<any>(null);
  const [replyingTo, setReplyingTo] = useState<Msg | null>(null);
  const [taskForm, setTaskForm] = useState<any>(null);
  const [scheduleForm, setScheduleForm] = useState<any>(null);
  const [scheduled, setScheduled] = useState<any[]>([]);
  const reloadContacts = () => api("/api/wa/contacts").then((r) => Array.isArray(r) && setContacts(r)).catch(() => {});
  const saveContact = async () => {
    const f = contactForm;
    if (!f) return;
    const body: any = { name: f.name, clientId: f.clientId || null };
    const url = f.id ? `/api/wa/contacts/${f.id}/edit` : "/api/wa/contacts";
    if (!f.id || me?.role === "admin") body.number = f.number;
    const r = await api(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).catch(() => ({ error: "falha" } as any));
    if (r?.ok || r?.id) {
      // se estava editando o contato da conversa aberta, reflete empresa/telefone na hora
      if (f.id && active?.contactId === f.id) {
        const cl = clientsList.find((c: any) => String(c.id) === String(f.clientId));
        setActive((a: any) => a ? { ...a, name: f.name || a.name, clientId: f.clientId || null, clientName: cl?.name || null, clientPhone: cl?.phone || null } : a);
      }
      setContactForm(null); reloadContacts(); loadConvs();
    } else alert(r?.error || "Não foi possível salvar o contato.");
  };

  const submitTask = async () => {
    const f = taskForm;
    if (!f || !active) return;
    const r = await api(`/api/wa/conversations/${active.id}/create-task`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: f.title, taskType: f.taskType, competencia: f.competencia, dueDate: f.dueDate, description: f.description }),
    }).catch(() => ({ error: "falha" } as any));
    if (r?.ok) { setTaskForm(null); loadMsgs(active.id); }
    else alert(r?.error || "Não foi possível criar a tarefa.");
  };

  const loadScheduled = (convId: number) =>
    api(`/api/wa/conversations/${convId}/scheduled`).then((r) => Array.isArray(r) && setScheduled(r)).catch(() => {});

  const submitSchedule = async () => {
    const f = scheduleForm;
    if (!f || !active || !f.date || !f.time) return;
    const sendAt = new Date(`${f.date}T${f.time}:00`);
    const r = await api(`/api/wa/conversations/${active.id}/schedule`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: f.text, sendAt: sendAt.toISOString() }),
    }).catch(() => ({ error: "falha" } as any));
    if (r?.ok) { setScheduleForm(null); setText(""); loadMsgs(active.id); loadScheduled(active.id); }
    else alert(r?.error || "Não foi possível agendar.");
  };

  const cancelScheduled = async (id: number) => {
    const r = await api(`/api/wa/scheduled/${id}/cancel`, { method: "POST" }).catch(() => ({ error: "falha" } as any));
    if (r?.ok && active) { loadScheduled(active.id); loadMsgs(active.id); }
    else alert(r?.error || "Não foi possível cancelar.");
  };

  const openTransfer = () => {
    if (!agents.length) api("/api/wa/agents").then((r) => Array.isArray(r) && setAgents(r)).catch(() => {});
    setTransferTo(""); setTransferNote(""); setTransferOpen(true);
  };
  const doTransfer = async () => {
    if (!active || !transferTo) return;
    await api(`/api/wa/conversations/${active.id}/transfer`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: parseInt(transferTo), note: transferNote.trim() }),
    }).catch(() => {});
    setTransferOpen(false);
    setActive({ ...active, status: "active", assignedAgentId: parseInt(transferTo) });
    loadConvs(); loadMsgs(active.id);
  };

  const connect = async () => {
    setConn((c) => ({ ...c, lastError: null }));
    const r = await api("/api/wa/start", { method: "POST" }).catch(() => ({ error: "Sem conexão com o servidor." }));
    if (r?.error) { setConn((c) => ({ ...c, lastError: r.error })); return; }
    setTimeout(loadConn, 1200);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [recording, setRecording] = useState(false);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const fileToBase64 = (file: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const sendMediaFile = async (file: File | Blob, type: string, fileName?: string, caption?: string) => {
    if (!active) return;
    try {
      const dataBase64 = await fileToBase64(file);
      const r = await api(`/api/wa/conversations/${active.id}/send-media`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, dataBase64, mimetype: (file as any).type || undefined, fileName, caption }),
      }).catch(() => ({ error: "falha" } as any));
      if (r?.ok) {
        setActive((a) => a && (a.status === "queue" || !a.assignedAgentId)
          ? { ...a, status: "active", assignedAgentId: me?.id ?? a.assignedAgentId, assignedAgentName: me?.name ?? a.assignedAgentName }
          : a);
        loadMsgs(active.id); loadConvs();
      }
      else alert(r?.error || "Não foi possível enviar o arquivo.");
    } catch { alert("Não foi possível ler o arquivo."); }
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const type = file.type.startsWith("image/") ? "image"
      : file.type.startsWith("video/") ? "video"
      : file.type.startsWith("audio/") ? "audio" : "document";
    await sendMediaFile(file, type, file.name);
  };

  const toggleRecord = async () => {
    if (recording) { mediaRecRef.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus") ? "audio/ogg;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => { if (ev.data.size) chunksRef.current.push(ev.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((tk) => tk.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: mime || "audio/ogg" });
        if (blob.size > 0) await sendMediaFile(blob, "audio", "audio.ogg");
      };
      mediaRecRef.current = rec;
      rec.start();
      setRecording(true);
    } catch { alert("Não foi possível acessar o microfone."); }
  };

  const deleteMsg = async (m: Msg) => {
    if (!active || !confirm("Apagar esta mensagem para todos?")) return;
    const r = await api(`/api/wa/conversations/${active.id}/messages/${m.id}/delete`, { method: "POST" }).catch(() => ({ error: "falha" } as any));
    if (r?.ok) loadMsgs(active.id); else alert(r?.error || "Não foi possível apagar.");
  };
  const editMsg = async (m: Msg) => {
    const text = prompt("Editar mensagem:", m.content || "");
    if (text === null || !text.trim() || !active) return;
    const r = await api(`/api/wa/conversations/${active.id}/messages/${m.id}/edit`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text.trim() }),
    }).catch(() => ({ error: "falha" } as any));
    if (r?.ok) loadMsgs(active.id); else alert(r?.error || "Não foi possível editar.");
  };


  // Badge de não lidas no ícone do app instalado (PWA) — total real de TODAS as conversas
  const [totalUnread, setTotalUnread] = useState(0);
  useEffect(() => {
    const load = () => api("/api/wa/unread").then((d) => setTotalUnread(d?.count || 0)).catch(() => {});
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, []);
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
  const tabs: [string, string][] = me?.role === "admin"
    ? [["queue", "Fila"], ["active", "Todos"], ["mine", "Meus"], ["concluded", "Concluídos"]]
    : [["queue", "Fila"], ["mine", "Meus"], ["concluded", "Concluídos"]];

  const showList = !isMobile || !active;
  const showChat = !isMobile || !!active;
  const showBanner = conn.status !== "open" && !(isMobile && active);

  return (
    <div style={{ height: "100dvh", width: "100%", maxWidth: "100vw", overflow: "hidden", display: "flex", flexDirection: "column", background: t.bg, color: t.text,
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
        @keyframes waRecBlink { 0%,100% { opacity: 1; } 50% { opacity: .25; } }
        .wa-rec-dot { animation: waRecBlink 1s ease-in-out infinite; }
        .wa-msg-actions { transition: opacity .12s; }
        @media (hover: hover) { .wa-msg-actions { opacity: 0; } .wa-msg:hover .wa-msg-actions { opacity: 1; } }
        @media (hover: none) { .wa-msg-actions { opacity: .45; } }
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
              {isMobile && active ? contactName(active) : "Atendimento"}
            </div>
            <div style={{ fontSize: 11.5, color: t.textFaint, display: "flex", alignItems: "center", gap: 5 }}>
              {isMobile && active ? contactPhone(active) : (
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
        <nav style={{ flex: "none", width: isMobile ? 58 : 78, background: t.surface, borderRight: `1px solid ${t.border}`,
          display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0", gap: 6,
          transition: "background .25s, border-color .25s" }}>
          {(([
            ...(me?.role === "admin" ? [["dashboard", "Painel", BarChart3]] : []),
            ["atendimento", "Atendimento", MessageSquare],
            ["agenda", "Agenda", CalendarDays],
          ]) as [string, string, any][]).map(([key, label, Icon]) => {
            const on = section === key;
            return (
              <button key={key} onClick={() => { setSection(key as any); setActive(null); }} className="wa-tap" title={label}
                style={{ width: isMobile ? 46 : 62, padding: "9px 0", borderRadius: 12, border: "none", cursor: "pointer",
                  background: on ? t.accent : "transparent", color: on ? t.accentText : t.textMuted,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontSize: 9.5, fontWeight: 600, lineHeight: 1.1 }}>
                <Icon size={20} />
                {!isMobile && <span>{label}</span>}
              </button>
            );
          })}
        </nav>
        {section === "dashboard" && me?.role === "admin" ? (
          <ReportsDashboard t={t} />
        ) : section === "agenda" ? (
          // O calendário foi feito com texto claro fixo (herdado do módulo de Tarefas, que é
          // sempre escuro), então força fundo escuro aqui — no tema claro do Atendimento o
          // texto claro ficaria invisível sobre fundo claro.
          <div className="wa-scroll" style={{ flex: 1, overflowY: "auto", background: "#0a0a0a", padding: isMobile ? "12px" : "18px 22px" }}>
            <CalendarView />
          </div>
        ) : (
        <>
        {/* Lista */}
        {showList && (
          <aside style={{ flex: isMobile ? "1 1 0%" : "none", width: isMobile ? "auto" : 340, minWidth: 0, background: t.surface,
            borderRight: isMobile ? "none" : `1px solid ${t.border}`, display: "flex", flexDirection: "column",
            transition: "background .25s, border-color .25s" }}>
            <div style={{ padding: "12px 12px 10px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 4, background: t.surfaceHi, borderRadius: 11, padding: 3 }}>
                {(["chats", "contacts"] as const).map((v) => (
                  <button key={v} onClick={() => setView(v)} className="wa-tap"
                    style={{ flex: 1, padding: "7px 0", fontSize: 12.5, fontWeight: view === v ? 600 : 450, borderRadius: 8, cursor: "pointer", border: "none",
                      background: view === v ? t.surface : "transparent", color: view === v ? t.text : t.textMuted, boxShadow: view === v ? t.shadow : "none" }}>
                    {v === "chats" ? "Conversas" : "Contatos"}
                  </button>
                ))}
              </div>
              {view === "chats" ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: t.surfaceHi,
                    border: `1px solid ${t.border}`, borderRadius: 11, padding: "9px 12px" }}>
                    <Search size={15} color={t.textFaint} />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar conversa"
                      style={{ background: "none", border: "none", color: t.text, outline: "none", fontSize: 13.5, width: "100%" }} />
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {tabs.map(([k, lb]) => {
                      const on = filter === k;
                      return (
                        <button key={k} onClick={() => setFilter(k)} className="wa-tap"
                          style={{ flex: 1, padding: "7px 4px", fontSize: 11.5, borderRadius: 9, cursor: "pointer", fontWeight: on ? 600 : 450,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            background: on ? t.accent : "transparent", color: on ? t.accentText : t.textMuted,
                            border: `1px solid ${on ? t.accent : t.border}` }}>
                          {lb}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: t.surfaceHi,
                  border: `1px solid ${t.border}`, borderRadius: 11, padding: "9px 12px" }}>
                  <Search size={15} color={t.textFaint} />
                  <input value={newNumber} onChange={(e) => setNewNumber(e.target.value)} placeholder="Número com DDD"
                    onKeyDown={(e) => { if (e.key === "Enter" && newNumber.replace(/\D/g, "").length >= 10) startConv({ number: newNumber }, "", newNumber); }}
                    style={{ background: "none", border: "none", color: t.text, outline: "none", fontSize: 13.5, width: "100%" }} />
                  {newNumber.replace(/\D/g, "").length >= 10 && (
                    <button onClick={() => startConv({ number: newNumber }, "", newNumber)} className="wa-tap"
                      style={{ background: t.accent, color: t.accentText, border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                      Iniciar
                    </button>
                  )}
                </div>
                <button onClick={() => setContactForm({ name: "", number: "", clientId: "" })} className="wa-tap"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 12px", borderRadius: 11,
                    border: `1px dashed ${t.border}`, background: "transparent", color: t.accent, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                  <UserPlus size={15} /> Novo contato
                </button>
                </>
              )}
            </div>

            <div className="wa-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 8px 8px" }}>
              {view === "chats" && (<>
              {shown.length === 0 && (
                <div style={{ padding: "40px 20px", textAlign: "center", color: t.textFaint, fontSize: 13 }}>
                  Nenhuma conversa por aqui.
                </div>
              )}
              {shown.map((c) => {
                const on = active?.id === c.id;
                const display = contactName(c);
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
                      {c.assignedAgentName && c.status === "active" && (me?.role === "admin" || c.assignedAgentId !== me?.id) && (
                        <div style={{ marginTop: 4 }}>
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: t.accent, background: t.accentSoft, padding: "1px 7px", borderRadius: 6 }}>
                            {c.assignedAgentName}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
              </>)}

              {view === "contacts" && (
                <div>
                  {contacts.length === 0 && clientsList.length === 0 && (
                    <div style={{ padding: "40px 20px", textAlign: "center", color: t.textFaint, fontSize: 13 }}>
                      Nenhum contato ainda. Digite um número acima para iniciar.
                    </div>
                  )}
                  {contacts.length > 0 && (
                    <div style={{ fontSize: 11, fontWeight: 600, color: t.textFaint, textTransform: "uppercase", letterSpacing: ".04em", padding: "10px 8px 4px" }}>Contatos</div>
                  )}
                  {contacts.map((c) => (
                    <ContactRow key={"ct" + c.id}
                      name={c.name || fmtNumber(c.waNumber)}
                      sub={c.clientName ? `${fmtNumber(c.waNumber)} · ${c.clientName}` : fmtNumber(c.waNumber)}
                      linked={!!c.clientName}
                      onMessage={() => startConv({ number: c.waNumber }, c.name || "", c.waNumber)}
                      onEdit={() => setContactForm({ id: c.id, name: c.name || "", number: c.waNumber || "", clientId: c.clientId || "" })}
                      t={t} />
                  ))}
                  {clientsList.some((c) => (c.phone || "").replace(/\D/g, "").length >= 10) && (
                    <div style={{ fontSize: 11, fontWeight: 600, color: t.textFaint, textTransform: "uppercase", letterSpacing: ".04em", padding: "14px 8px 4px" }}>Clientes cadastrados</div>
                  )}
                  {clientsList.filter((c) => (c.phone || "").replace(/\D/g, "").length >= 10).map((c) => (
                    <ContactRow key={"cl" + c.id}
                      name={c.name}
                      sub={fmtNumber(c.phone)}
                      linked
                      onMessage={() => startConv({ clientId: c.id }, c.name, c.phone)}
                      t={t} />
                  ))}
                </div>
              )}
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
                      background: avaBg(contactName(active), t), color: avaFg(contactName(active), t),
                      display: "grid", placeItems: "center" }}>
                      {contactName(active).replace(/[^\p{L}\p{N}]/gu, "").slice(0, 1).toUpperCase() || "?"}
                    </div>
                    <button onClick={() => active.contactId && setContactForm({ id: active.contactId, name: active.name || "", number: active.waNumber || "", clientId: active.clientId || "" })}
                      className="wa-tap" title={active.contactId ? "Editar nome do contato" : undefined}
                      style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, cursor: active.contactId ? "pointer" : "default" }}>
                      <div style={{ fontSize: 14.5, fontWeight: 650, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{contactName(active)}</span>
                        {active.contactId && <Pencil size={12} style={{ color: t.textFaint, flex: "none", opacity: 0.7 }} />}
                      </div>
                      <div style={{ fontSize: 12, color: t.textFaint }}>{contactPhone(active)}</div>
                    </button>
                    {active.contactId ? (active.clientName ? (
                      <button onClick={() => setContactForm({ id: active.contactId, name: active.name || "", number: active.waNumber || "", clientId: active.clientId || "" })} className="wa-tap"
                        title={`Empresa: ${active.clientName}`}
                        style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 9, border: `1px solid ${t.border}`, background: t.accentSoft, color: t.accent, cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
                        <Building2 size={13} style={{ flex: "none" }} /> {active.clientName}
                      </button>
                    ) : (
                      <button onClick={() => setContactForm({ id: active.contactId, name: active.name || "", number: active.waNumber || "", clientId: "" })} className="wa-tap"
                        style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 9, border: `1px dashed ${t.border}`, background: "transparent", color: t.textMuted, cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                        <Building2 size={13} /> Vincular empresa
                      </button>
                    )) : null}
                    <WorkflowActions conv={active} me={me} t={t} onAction={doAction} onTransfer={openTransfer} />
                  </div>
                )}
                {isMobile && (
                  <div style={{ flex: "none", padding: "8px 14px", background: t.surface, borderBottom: `1px solid ${t.border}`,
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      {active.contactId ? (
                        <button onClick={() => setContactForm({ id: active.contactId, name: active.name || "", number: active.waNumber || "", clientId: active.clientId || "" })} className="wa-tap"
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, minWidth: 0,
                            border: `1px ${active.clientName ? "solid" : "dashed"} ${t.border}`, background: active.clientName ? t.accentSoft : "transparent",
                            color: active.clientName ? t.accent : t.textMuted, cursor: "pointer", fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          <Building2 size={12} style={{ flex: "none" }} /> {active.clientName || "Vincular empresa"}
                        </button>
                      ) : <span />}
                    </div>
                    <WorkflowActions conv={active} me={me} t={t} onAction={doAction} onTransfer={openTransfer} />
                  </div>
                )}

                {/* mensagens */}
                <div ref={scrollRef} className="wa-scroll" onScroll={onMsgsScroll}
                  style={{ flex: 1, overflowY: "auto", padding: "18px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {msgs.map((m, i) => {
                    if (m.senderType === "system") {
                      return (
                        <div key={m.id} style={{ alignSelf: "center", maxWidth: "85%", margin: "8px 0" }}>
                          <div style={{ background: t.surfaceHi, border: `1px solid ${t.border}`, borderRadius: 10, padding: "6px 12px", fontSize: 12, color: t.textMuted, textAlign: "center", whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
                            {m.content}
                          </div>
                        </div>
                      );
                    }
                    const me = !!m.fromMe;
                    const prev = msgs[i - 1];
                    const grouped = prev && !!prev.fromMe === me;
                    const label = me ? agentLabel(m) : null;
                    const prevLabel = prev && !!prev.fromMe ? agentLabel(prev) : null;
                    const showLabel = me && label !== prevLabel;
                    const nonText = m.messageType !== "text" && m.messageType !== "template";
                    return (
                      <div key={m.id} className="wa-msg" style={{ alignSelf: me ? "flex-end" : "flex-start", maxWidth: isMobile ? "90%" : "76%", marginTop: grouped && !showLabel ? 0 : 6, display: "flex", flexDirection: "column", alignItems: me ? "flex-end" : "flex-start" }}>
                        {showLabel && (
                          <div style={{ fontSize: 11, fontWeight: 600, color: t.accent, textAlign: "right", margin: "0 4px 3px 0" }}>
                            {label}
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: isMobile ? (me ? "flex-end" : "flex-start") : "center", gap: isMobile ? 3 : 6, maxWidth: "100%", flexDirection: isMobile ? "column" : (me ? "row" : "row-reverse") }}>
                          {m.content !== "🚫 Mensagem apagada" && (
                            <div className="wa-msg-actions" style={{ display: "flex", gap: 2, flex: "none" }}>
                              <button onClick={() => setReplyingTo(m)} className="wa-tap" aria-label="Responder" title="Responder"
                                style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: t.surfaceHi, color: t.textMuted, cursor: "pointer", display: "grid", placeItems: "center" }}>
                                <Reply size={13} />
                              </button>
                              {!!m.content && m.messageType === "text" && (
                                <button onClick={() => setTaskForm({
                                    title: m.content!.length > 80 ? m.content!.slice(0, 80) + "…" : m.content,
                                    taskType: "OUTROS",
                                    competencia: `${String(new Date().getMonth() + 1).padStart(2, "0")}/${new Date().getFullYear()}`,
                                    dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
                                    description: `Solicitado pelo cliente via WhatsApp:\n"${m.content}"`,
                                  })} className="wa-tap" aria-label="Criar tarefa" title="Criar tarefa a partir desta mensagem"
                                  style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: t.surfaceHi, color: t.textMuted, cursor: "pointer", display: "grid", placeItems: "center" }}>
                                  <CheckSquare size={13} />
                                </button>
                              )}
                              {me && m.messageType === "text" && !!m.content && (
                                <>
                                  <button onClick={() => editMsg(m)} className="wa-tap" aria-label="Editar" title="Editar"
                                    style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: t.surfaceHi, color: t.textMuted, cursor: "pointer", display: "grid", placeItems: "center" }}>
                                    <Pencil size={13} />
                                  </button>
                                  <button onClick={() => deleteMsg(m)} className="wa-tap" aria-label="Apagar" title="Apagar"
                                    style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: t.surfaceHi, color: t.danger, cursor: "pointer", display: "grid", placeItems: "center" }}>
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                          <div style={{ background: me ? t.bubbleMe : t.bubbleThem, color: t.text,
                          border: me ? "none" : `1px solid ${t.border}`, boxShadow: t.shadow,
                          borderRadius: 16, borderBottomRightRadius: me ? 5 : 16, borderBottomLeftRadius: me ? 16 : 5,
                          padding: "8px 12px 6px", fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
                          opacity: m.status === "sending" ? 0.72 : 1 }}>
                          {m.replyTo && (
                            <div style={{ borderLeft: `3px solid ${me ? "rgba(255,255,255,.55)" : t.accent}`, paddingLeft: 8, marginBottom: 5,
                              fontSize: 12.5, opacity: 0.78, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                              {m.replyTo.length > 120 ? m.replyTo.slice(0, 120) + "…" : m.replyTo}
                            </div>
                          )}
                          {nonText && ["image", "sticker"].includes(m.messageType) ? (
                            <a href={`/api/wa/media/${m.id}`} target="_blank" rel="noreferrer" style={{ display: "block", marginBottom: 2 }}>
                              <img src={`/api/wa/media/${m.id}`} alt="imagem" loading="lazy"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 10, display: "block", cursor: "pointer" }} />
                            </a>
                          ) : nonText && m.messageType === "audio" ? (
                            <audio controls preload="none" src={`/api/wa/media/${m.id}`} style={{ maxWidth: "100%", width: 248, height: 40 }} />
                          ) : nonText && m.messageType === "video" ? (
                            <video controls preload="none" src={`/api/wa/media/${m.id}`}
                              style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 10, display: "block" }} />
                          ) : nonText ? (
                            <a href={`/api/wa/media/${m.id}`} target="_blank" rel="noreferrer"
                              style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", fontWeight: 600, fontSize: 13,
                                color: me ? t.accentText : t.accent, background: me ? "rgba(255,255,255,.15)" : t.accentSoft,
                                padding: "6px 10px", borderRadius: 9 }}>
                              <FileText size={15} /> Abrir documento
                            </a>
                          ) : null}
                          {(() => {
                            const isMedia = nonText && ["image", "video", "audio", "document", "sticker"].includes(m.messageType);
                            const raw = (m.content || "").trim();
                            const isPlaceholder = /^\[(image|video|audio|document|sticker|imagem|vídeo|áudio|documento)\]$/i.test(raw);
                            const isBareFile = /^[\w\-.]+\.(ogg|opus|mp3|m4a|jpg|jpeg|png|webp|gif|mp4|mov|pdf|docx?|xlsx?)$/i.test(raw);
                            const caption = raw && !isPlaceholder && !isBareFile ? m.content : "";
                            if (isMedia) return caption ? <div style={{ marginTop: 5 }}>{caption}</div> : null;
                            return m.content || (nonText ? "" : "—");
                          })()}
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
                      </div>
                    );
                  })}
                </div>

                {/* mensagens agendadas pendentes */}
                {scheduled.length > 0 && (
                  <div style={{ flex: "none", padding: "8px 14px", background: t.surfaceHi, borderTop: `1px solid ${t.border}`, display: "flex", flexDirection: "column", gap: 6 }}>
                    {scheduled.map((s) => (
                      <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Clock size={13} style={{ color: t.accent, flex: "none" }} />
                        <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: t.textMuted }}>
                          <span style={{ fontWeight: 600, color: t.text }}>{new Date(s.sendAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                          {" — "}
                          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.content}</span>
                        </div>
                        <button onClick={() => cancelScheduled(s.id)} className="wa-tap" aria-label="Cancelar"
                          style={{ width: 24, height: 24, flex: "none", borderRadius: 6, border: "none", background: "transparent", color: t.danger, cursor: "pointer", display: "grid", placeItems: "center" }}>
                          <XIcon size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {/* barra de citação ao responder */}
                {replyingTo && (
                  <div style={{ flex: "none", padding: "8px 14px", background: t.surfaceHi, borderTop: `1px solid ${t.border}`,
                    display: "flex", alignItems: "center", gap: 10 }}>
                    <Reply size={16} style={{ color: t.accent, flex: "none" }} />
                    <div style={{ borderLeft: `3px solid ${t.accent}`, paddingLeft: 8, flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: t.accent }}>Respondendo</div>
                      <div style={{ fontSize: 12.5, color: t.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {replyingTo.content || "(mídia)"}
                      </div>
                    </div>
                    <button onClick={() => setReplyingTo(null)} className="wa-tap" aria-label="Cancelar resposta"
                      style={{ width: 30, height: 30, flex: "none", borderRadius: 8, border: "none", background: "transparent", color: t.textMuted, cursor: "pointer", display: "grid", placeItems: "center" }}>
                      <XIcon size={16} />
                    </button>
                  </div>
                )}
                {/* composer */}
                <div style={{ flex: "none", padding: 12, background: t.surface, borderTop: replyingTo ? "none" : `1px solid ${t.border}`,
                  display: "flex", gap: 8, alignItems: "flex-end", transition: "background .25s, border-color .25s" }}>
                  <input type="file" ref={fileInputRef} onChange={onPickFile} style={{ display: "none" }}
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip" />
                  {!recording && (
                    <button onClick={() => fileInputRef.current?.click()} disabled={conn.status !== "open"} className="wa-tap" aria-label="Anexar"
                      style={{ width: 44, height: 44, flex: "none", borderRadius: "50%", border: "none", display: "grid", placeItems: "center",
                        background: t.surfaceHi, color: conn.status === "open" ? t.textMuted : t.textFaint,
                        cursor: conn.status === "open" ? "pointer" : "default" }}>
                      <Paperclip size={18} />
                    </button>
                  )}
                  {recording ? (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: t.surfaceHi,
                      border: `1px solid ${t.dangerBorder}`, borderRadius: 22, padding: "12px 16px" }}>
                      <span className="wa-rec-dot" style={{ width: 10, height: 10, borderRadius: "50%", background: t.danger, flex: "none" }} />
                      <span style={{ color: t.text, fontSize: 14 }}>Gravando áudio… toque em parar para enviar</span>
                    </div>
                  ) : (
                    <textarea value={text} onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        // No celular não há "Shift" fácil no teclado virtual: Enter sempre quebra
                        // linha lá, e o envio é só pelo botão. No computador, Enter envia e
                        // Shift+Enter quebra linha (convenção padrão).
                        if (!isMobile && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                      }}
                      placeholder={conn.status === "open" ? "Mensagem" : "Conecte o WhatsApp para enviar"}
                      disabled={conn.status !== "open"} rows={1}
                      style={{ flex: 1, resize: "none", background: t.surfaceHi, border: `1px solid ${t.border}`,
                        borderRadius: 22, padding: "11px 16px", color: t.text, outline: "none", fontSize: 14,
                        maxHeight: 120, lineHeight: 1.4 }} />
                  )}
                  {text.trim() && !recording ? (
                    <>
                      <button onClick={() => setScheduleForm({ text: text.trim(), date: "", time: "" })} disabled={conn.status !== "open"} className="wa-tap" aria-label="Agendar envio" title="Agendar para depois"
                        style={{ width: 44, height: 44, flex: "none", borderRadius: "50%", border: `1px solid ${t.border}`, display: "grid", placeItems: "center",
                          background: "transparent", color: conn.status === "open" ? t.textMuted : t.textFaint,
                          cursor: conn.status === "open" ? "pointer" : "default" }}>
                        <Clock size={17} />
                      </button>
                      <button onClick={send} disabled={sending || conn.status !== "open"} className="wa-tap" aria-label="Enviar"
                        style={{ width: 44, height: 44, flex: "none", borderRadius: "50%", border: "none", display: "grid", placeItems: "center",
                          background: conn.status === "open" ? t.accent : t.surfaceHi,
                          color: conn.status === "open" ? t.accentText : t.textFaint,
                          cursor: conn.status === "open" ? "pointer" : "default" }}>
                        <Send size={18} />
                      </button>
                    </>
                  ) : (
                    <button onClick={toggleRecord} disabled={conn.status !== "open"} className="wa-tap"
                      aria-label={recording ? "Parar e enviar" : "Gravar áudio"}
                      style={{ width: 44, height: 44, flex: "none", borderRadius: "50%", border: "none", display: "grid", placeItems: "center",
                        background: recording ? t.danger : conn.status === "open" ? t.accent : t.surfaceHi,
                        color: recording ? "#fff" : conn.status === "open" ? t.accentText : t.textFaint,
                        cursor: conn.status === "open" ? "pointer" : "default" }}>
                      {recording ? <Square size={16} /> : <Mic size={18} />}
                    </button>
                  )}
                </div>
              </>
            )}
          </main>
        )}
        </>
        )}
      </div>

      {/* Modal de transferência */}
      {transferOpen && (
        <div onClick={() => setTransferOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "grid", placeItems: "center", zIndex: 50, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 400, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: 20, boxShadow: "0 12px 40px rgba(0,0,0,.35)" }}>
            <div style={{ fontSize: 15, fontWeight: 650, marginBottom: 4 }}>Transferir atendimento</div>
            <div style={{ fontSize: 12.5, color: t.textFaint, marginBottom: 16 }}>O comentário é interno — o cliente não vê.</div>
            <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: "block", marginBottom: 6 }}>Para o atendente</label>
            <select value={transferTo} onChange={(e) => setTransferTo(e.target.value)}
              style={{ width: "100%", background: t.surfaceHi, color: t.text, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 13.5, marginBottom: 14, cursor: "pointer" }}>
              <option value="">Selecione…</option>
              {agents.filter((a) => a.id !== me?.id).map((a) => (
                <option key={a.id} value={a.id}>{a.name || a.email}</option>
              ))}
            </select>
            <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: "block", marginBottom: 6 }}>Motivo (interno)</label>
            <textarea value={transferNote} onChange={(e) => setTransferNote(e.target.value)} rows={3}
              placeholder="Ex.: cliente quer saber sobre folha de pagamento"
              style={{ width: "100%", resize: "none", background: t.surfaceHi, color: t.text, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 13.5, outline: "none", marginBottom: 18 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setTransferOpen(false)} className="wa-tap"
                style={{ height: 38, padding: "0 16px", borderRadius: 10, border: `1px solid ${t.border}`, background: "transparent", color: t.textMuted, cursor: "pointer", fontSize: 13.5 }}>
                Cancelar
              </button>
              <button onClick={doTransfer} disabled={!transferTo} className="wa-tap"
                style={{ height: 38, padding: "0 18px", borderRadius: 10, border: "none", cursor: transferTo ? "pointer" : "default", fontSize: 13.5, fontWeight: 600,
                  background: transferTo ? t.accent : t.surfaceHi, color: transferTo ? t.accentText : t.textFaint }}>
                Transferir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal criar/editar contato */}
      {contactForm && (
        <div onClick={() => setContactForm(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "grid", placeItems: "center", zIndex: 50, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 400, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: 20, boxShadow: "0 12px 40px rgba(0,0,0,.35)" }}>
            <div style={{ fontSize: 15, fontWeight: 650, marginBottom: 16 }}>{contactForm.id ? "Editar contato" : "Novo contato"}</div>

            <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: "block", marginBottom: 6 }}>Nome</label>
            <input value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} placeholder="Nome do contato"
              style={{ width: "100%", background: t.surfaceHi, color: t.text, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 13.5, outline: "none", marginBottom: 14 }} />

            <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: "block", marginBottom: 6 }}>Número (com DDD)</label>
            <input value={contactForm.number} onChange={(e) => setContactForm({ ...contactForm, number: e.target.value })}
              disabled={!!contactForm.id && me?.role !== "admin"} placeholder="(19) 99999-9999"
              style={{ width: "100%", background: !!contactForm.id && me?.role !== "admin" ? t.surface : t.surfaceHi, color: !!contactForm.id && me?.role !== "admin" ? t.textFaint : t.text, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 13.5, outline: "none", marginBottom: !!contactForm.id && me?.role !== "admin" ? 4 : 14 }} />
            {!!contactForm.id && me?.role !== "admin" && (
              <div style={{ fontSize: 11.5, color: t.textFaint, marginBottom: 14 }}>Só administradores podem alterar o número.</div>
            )}

            <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: "block", marginBottom: 6 }}>Empresa (opcional)</label>
            <div style={{ marginBottom: 18 }}>
              <CompanyPicker clients={clientsList} value={contactForm.clientId}
                onChange={(id) => setContactForm({ ...contactForm, clientId: id })} t={t} />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setContactForm(null)} className="wa-tap"
                style={{ height: 38, padding: "0 16px", borderRadius: 10, border: `1px solid ${t.border}`, background: "transparent", color: t.textMuted, cursor: "pointer", fontSize: 13.5 }}>
                Cancelar
              </button>
              <button onClick={saveContact} disabled={!contactForm.id && contactForm.number.replace(/\D/g, "").length < 10} className="wa-tap"
                style={{ height: 38, padding: "0 18px", borderRadius: 10, border: "none", fontSize: 13.5, fontWeight: 600,
                  cursor: !contactForm.id && contactForm.number.replace(/\D/g, "").length < 10 ? "default" : "pointer",
                  background: !contactForm.id && contactForm.number.replace(/\D/g, "").length < 10 ? t.surfaceHi : t.accent,
                  color: !contactForm.id && contactForm.number.replace(/\D/g, "").length < 10 ? t.textFaint : t.accentText }}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal criar tarefa a partir de uma mensagem */}
      {taskForm && (
        <div onClick={() => setTaskForm(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "grid", placeItems: "center", zIndex: 50, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 440, maxHeight: "88vh", overflowY: "auto", background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: 20, boxShadow: "0 12px 40px rgba(0,0,0,.35)" }}>
            <div style={{ fontSize: 15, fontWeight: 650, marginBottom: 4 }}>Criar tarefa</div>
            <div style={{ fontSize: 12.5, color: t.textFaint, marginBottom: 16 }}>
              Tarefa única — não se repete nos próximos meses.
            </div>

            {!active?.clientId ? (
              <div style={{ background: t.dangerSoft, border: `1px solid ${t.dangerBorder}`, borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 12.5, color: t.text }}>
                Este contato ainda não está vinculado a uma empresa. Vincule antes de criar a tarefa.
                <button onClick={() => { setTaskForm(null); setContactForm({ id: active?.contactId, name: active?.name || "", number: active?.waNumber || "", clientId: "" }); }}
                  className="wa-tap" style={{ display: "block", marginTop: 8, background: t.accent, color: t.accentText, border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                  Vincular empresa
                </button>
              </div>
            ) : null}

            <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: "block", marginBottom: 6 }}>Título</label>
            <input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Ex.: Declaração de faturamento"
              style={{ width: "100%", background: t.surfaceHi, color: t.text, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 13.5, outline: "none", marginBottom: 14 }} />

            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: "block", marginBottom: 6 }}>Tipo</label>
                <select value={taskForm.taskType} onChange={(e) => setTaskForm({ ...taskForm, taskType: e.target.value })}
                  style={{ width: "100%", background: t.surfaceHi, color: t.text, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 13.5, cursor: "pointer" }}>
                  {["OUTROS", "DAS", "NFS", "DCTF", "SPED", "PIS", "COFINS", "ICMS", "ISSQN", "PGDAS"].map((tp) => (<option key={tp} value={tp}>{tp}</option>))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: "block", marginBottom: 6 }}>Competência</label>
                <input value={taskForm.competencia} onChange={(e) => setTaskForm({ ...taskForm, competencia: e.target.value })} placeholder="MM/AAAA"
                  style={{ width: "100%", background: t.surfaceHi, color: t.text, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 13.5, outline: "none" }} />
              </div>
            </div>

            <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: "block", marginBottom: 6 }}>Vencimento</label>
            <input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
              style={{ width: "100%", background: t.surfaceHi, color: t.text, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 13.5, outline: "none", marginBottom: 14, colorScheme: t.name === "dark" ? "dark" : "light" }} />

            <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: "block", marginBottom: 6 }}>Descrição</label>
            <textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} rows={4}
              style={{ width: "100%", background: t.surfaceHi, color: t.text, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, outline: "none", marginBottom: 18, resize: "vertical", fontFamily: "inherit" }} />

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setTaskForm(null)} className="wa-tap"
                style={{ height: 38, padding: "0 16px", borderRadius: 10, border: `1px solid ${t.border}`, background: "transparent", color: t.textMuted, cursor: "pointer", fontSize: 13.5 }}>
                Cancelar
              </button>
              <button onClick={submitTask} disabled={!active?.clientId || !taskForm.title.trim()} className="wa-tap"
                style={{ height: 38, padding: "0 18px", borderRadius: 10, border: "none", fontSize: 13.5, fontWeight: 600,
                  cursor: !active?.clientId || !taskForm.title.trim() ? "default" : "pointer",
                  background: !active?.clientId || !taskForm.title.trim() ? t.surfaceHi : t.accent,
                  color: !active?.clientId || !taskForm.title.trim() ? t.textFaint : t.accentText }}>
                Criar tarefa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal agendar mensagem */}
      {scheduleForm && (
        <div onClick={() => setScheduleForm(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "grid", placeItems: "center", zIndex: 50, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 400, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: 20, boxShadow: "0 12px 40px rgba(0,0,0,.35)" }}>
            <div style={{ fontSize: 15, fontWeight: 650, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={17} style={{ color: t.accent }} /> Agendar mensagem
            </div>
            <div style={{ fontSize: 12.5, color: t.textFaint, marginBottom: 16 }}>
              Fica salva e é enviada automaticamente na data e hora escolhidas.
            </div>

            <div style={{ background: t.surfaceHi, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: t.textMuted, marginBottom: 14, maxHeight: 90, overflowY: "auto", whiteSpace: "pre-wrap" }}>
              {scheduleForm.text}
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: "block", marginBottom: 6 }}>Data</label>
                <input type="date" value={scheduleForm.date} min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, date: e.target.value })}
                  style={{ width: "100%", background: t.surfaceHi, color: t.text, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 13.5, outline: "none", colorScheme: t.name === "dark" ? "dark" : "light" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: "block", marginBottom: 6 }}>Hora</label>
                <input type="time" value={scheduleForm.time}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, time: e.target.value })}
                  style={{ width: "100%", background: t.surfaceHi, color: t.text, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 13.5, outline: "none", colorScheme: t.name === "dark" ? "dark" : "light" }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setScheduleForm(null)} className="wa-tap"
                style={{ height: 38, padding: "0 16px", borderRadius: 10, border: `1px solid ${t.border}`, background: "transparent", color: t.textMuted, cursor: "pointer", fontSize: 13.5 }}>
                Cancelar
              </button>
              <button onClick={submitSchedule} disabled={!scheduleForm.date || !scheduleForm.time} className="wa-tap"
                style={{ height: 38, padding: "0 18px", borderRadius: 10, border: "none", fontSize: 13.5, fontWeight: 600,
                  cursor: !scheduleForm.date || !scheduleForm.time ? "default" : "pointer",
                  background: !scheduleForm.date || !scheduleForm.time ? t.surfaceHi : t.accent,
                  color: !scheduleForm.date || !scheduleForm.time ? t.textFaint : t.accentText }}>
                Agendar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Peças ─────────────────────────────────────────────────────────────────── */
// Formata segundos em algo legível (min/h)
function secToHuman(s: number): string {
  s = Math.round(Number(s) || 0);
  if (s <= 0) return "—";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), sec = s % 60;
  if (m < 60) return sec ? `${m}min ${sec}s` : `${m}min`;
  const h = Math.floor(m / 60), min = m % 60;
  return min ? `${h}h ${min}min` : `${h}h`;
}

// Dashboard de relatórios do atendimento (só administrador)
function ReportsDashboard({ t }: { t: Theme }) {
  const [period, setPeriod] = useState("7d");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    api(`/api/wa/reports?period=${period}`)
      .then((d) => { setData(d && !d.error ? d : {}); setLoading(false); })
      .catch(() => setLoading(false));
  }, [period]);

  const agora = data?.agora || {};
  const per = data?.periodo || {};
  const msg = data?.mensagens || {};
  const atendentes: any[] = data?.atendentes || [];
  const diario: any[] = data?.diario || [];
  const maxDay = Math.max(1, ...diario.map((d) => Number(d.total) || 0));
  const periods: [string, string][] = [["today", "Hoje"], ["7d", "7 dias"], ["30d", "30 dias"]];

  const Card = ({ label, value, sub }: { label: string; value: any; sub?: string }) => (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, padding: "15px 17px", minWidth: 0 }}>
      <div style={{ fontSize: 11.5, color: t.textMuted, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 25, fontWeight: 700, marginTop: 5, color: t.text, lineHeight: 1.1 }}>{value}</div>
      {sub ? <div style={{ fontSize: 11, color: t.textFaint, marginTop: 3 }}>{sub}</div> : null}
    </div>
  );

  return (
    <div style={{ flex: 1, minWidth: 0, background: t.bg, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flex: "none", padding: "13px 18px", background: t.surface, borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 700, flex: 1, minWidth: 120 }}>Relatórios de atendimento</div>
        <div style={{ display: "flex", gap: 4, background: t.surfaceHi, borderRadius: 10, padding: 3 }}>
          {periods.map(([k, lbl]) => (
            <button key={k} onClick={() => setPeriod(k)} className="wa-tap"
              style={{ padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                background: period === k ? t.accent : "transparent", color: period === k ? t.accentText : t.textMuted }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <div className="wa-scroll" style={{ flex: 1, overflowY: "auto", padding: 18 }}>
        {loading ? (
          <div style={{ color: t.textFaint, textAlign: "center", padding: 40 }}>Carregando…</div>
        ) : (
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
              <Card label="Na fila agora" value={agora.fila ?? 0} sub={Number(agora.esperaMaisAntigo) > 0 ? `mais antigo: ${secToHuman(agora.esperaMaisAntigo)}` : "fila vazia"} />
              <Card label="Em atendimento" value={agora.ativo ?? 0} />
              <Card label="Concluídos no período" value={per.concluidas ?? 0} />
              <Card label="Tempo médio de espera" value={secToHuman(per.esperaMedia)} sub="da fila até atender" />
              <Card label="Tempo médio de atendimento" value={secToHuman(per.duracaoMedia)} sub="de atender até concluir" />
              <Card label="Novas conversas" value={per.novas ?? 0} sub="no período" />
              <Card label="Mensagens (rec./env.)" value={`${msg.recebidas ?? 0} / ${msg.enviadas ?? 0}`} sub="recebidas / enviadas" />
            </div>

            <div style={{ marginTop: 20, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Conversas por dia (últimos 14 dias)</div>
              {diario.length === 0 ? (
                <div style={{ color: t.textFaint, fontSize: 12.5 }}>Sem dados ainda.</div>
              ) : (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 150 }}>
                  {diario.map((d, i) => {
                    const v = Number(d.total) || 0;
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0 }}>
                        <div style={{ fontSize: 10, color: t.textFaint }}>{v || ""}</div>
                        <div title={`${d.dia}: ${v}`} style={{ width: "100%", maxWidth: 34, height: `${Math.max(4, (v / maxDay) * 112)}px`, background: t.accent, borderRadius: "5px 5px 0 0", transition: "height .3s" }} />
                        <div style={{ fontSize: 9.5, color: t.textFaint, whiteSpace: "nowrap" }}>{d.dia}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ marginTop: 20, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Por atendente</div>
              {atendentes.length === 0 ? (
                <div style={{ color: t.textFaint, fontSize: 12.5, marginTop: 10 }}>Nenhum atendimento no período.</div>
              ) : (
                <div style={{ overflowX: "auto", marginTop: 10 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ color: t.textMuted }}>
                        <th style={{ padding: "8px 6px", fontWeight: 600, textAlign: "left" }}>Atendente</th>
                        <th style={{ padding: "8px 6px", fontWeight: 600, textAlign: "center" }}>Em atendimento</th>
                        <th style={{ padding: "8px 6px", fontWeight: 600, textAlign: "center" }}>Concluídos</th>
                        <th style={{ padding: "8px 6px", fontWeight: 600, textAlign: "center" }}>Tempo médio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {atendentes.map((a, i) => (
                        <tr key={i} style={{ borderTop: `1px solid ${t.border}` }}>
                          <td style={{ padding: "9px 6px", fontWeight: 600 }}>{a.nome || "—"}</td>
                          <td style={{ padding: "9px 6px", textAlign: "center" }}>{a.ativas ?? 0}</td>
                          <td style={{ padding: "9px 6px", textAlign: "center" }}>{a.concluidas ?? 0}</td>
                          <td style={{ padding: "9px 6px", textAlign: "center" }}>{secToHuman(a.duracaoMedia)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Seletor de empresa com busca — mostra a empresa escolhida; ao abrir, tem uma barra de
// busca e a lista filtrada por nome. Substitui o <select> nativo (ruim com muitas empresas).
function CompanyPicker({ clients, value, onChange, t }: { clients: any[]; value: string; onChange: (id: string) => void; t: Theme }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = clients.find((c) => String(c.id) === String(value));
  const term = q.trim().toLowerCase();
  const filtered = term ? clients.filter((c) => (c.name || "").toLowerCase().includes(term)) : clients;
  const optStyle = (active: boolean): React.CSSProperties => ({
    width: "100%", textAlign: "left", padding: "9px 12px", border: "none", cursor: "pointer", fontSize: 13,
    background: active ? t.accentSoft : "transparent", color: active ? t.accent : t.text,
    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
  });
  return (
    <div style={{ position: "relative" }}>
      <button type="button" onClick={() => { setOpen((o) => !o); setQ(""); }} className="wa-tap"
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          background: t.surfaceHi, color: selected ? t.text : t.textFaint, border: `1px solid ${t.border}`,
          borderRadius: 10, padding: "10px 12px", fontSize: 13.5, cursor: "pointer", textAlign: "left" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected ? selected.name : "Nenhuma"}</span>
        <ChevronDown size={16} style={{ flex: "none", color: t.textFaint, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 1 }} />
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 2, background: t.surface,
            border: `1px solid ${t.border}`, borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,.3)", overflow: "hidden" }}>
            <div style={{ padding: 8, borderBottom: `1px solid ${t.border}` }}>
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar empresa…"
                style={{ width: "100%", background: t.surfaceHi, color: t.text, border: `1px solid ${t.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, outline: "none" }} />
            </div>
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              <button type="button" className="wa-tap" onClick={() => { onChange(""); setOpen(false); }} style={optStyle(!value)}>Nenhuma</button>
              {filtered.map((c) => (
                <button key={c.id} type="button" className="wa-tap" onClick={() => { onChange(String(c.id)); setOpen(false); }} style={optStyle(String(c.id) === String(value))}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                  {c.phone ? <span style={{ color: t.textFaint, fontSize: 11, flex: "none" }}>{fmtNumber(c.phone)}</span> : null}
                </button>
              ))}
              {filtered.length === 0 && (
                <div style={{ padding: "10px 12px", color: t.textFaint, fontSize: 12.5 }}>Nenhuma empresa encontrada</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ContactRow({ name, sub, linked, onMessage, onEdit, t }: { name: string; sub: string; linked?: boolean; onMessage: () => void; onEdit?: () => void; t: Theme }) {
  return (
    <div className="wa-row" style={{ display: "flex", gap: 11, alignItems: "center", padding: "10px 11px", borderRadius: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", flex: "none", fontWeight: 600, fontSize: 15,
        background: avaBg(name, t), color: avaFg(name, t), display: "grid", placeItems: "center" }}>
        {name.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 1).toUpperCase() || "?"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
        <div style={{ fontSize: 12, color: t.textFaint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {linked && <span style={{ color: t.accent }}>● </span>}{sub}
        </div>
      </div>
      {onEdit && (
        <button onClick={onEdit} className="wa-tap" aria-label="Editar contato"
          style={{ width: 34, height: 34, flex: "none", borderRadius: 9, border: `1px solid ${t.border}`, background: "transparent", color: t.textMuted, cursor: "pointer", display: "grid", placeItems: "center" }}>
          <Pencil size={14} />
        </button>
      )}
      <button onClick={onMessage} className="wa-tap" aria-label="Enviar mensagem"
        style={{ width: 34, height: 34, flex: "none", borderRadius: 9, border: `1px solid ${t.border}`, background: "transparent", color: t.accent, cursor: "pointer", display: "grid", placeItems: "center" }}>
        <Send size={15} />
      </button>
    </div>
  );
}
function iconBtn(t: Theme): React.CSSProperties {
  return { width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center", cursor: "pointer",
    background: t.surfaceHi, border: `1px solid ${t.border}`, color: t.textMuted };
}
function WorkflowActions({ conv, me, t, onAction, onTransfer }: {
  conv: Conv; me: { id: number; role: string } | null; t: Theme;
  onAction: (a: "assign" | "conclude" | "dismiss" | "reopen") => void;
  onTransfer: () => void;
}) {
  const isMine = conv.assignedAgentId === me?.id;
  const isAdmin = me?.role === "admin";
  const btn = (label: string, action: "assign" | "conclude" | "dismiss" | "reopen", kind: "primary" | "ghost" | "danger") => (
    <button onClick={() => onAction(action)} className="wa-tap"
      style={{ height: 34, padding: "0 13px", borderRadius: 9, cursor: "pointer", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap",
        border: `1px solid ${kind === "danger" ? t.dangerBorder : kind === "primary" ? t.accent : t.border}`,
        background: kind === "primary" ? t.accent : "transparent",
        color: kind === "danger" ? t.danger : kind === "primary" ? t.accentText : t.textMuted }}>
      {label}
    </button>
  );
  if (conv.status === "queue") {
    return <div style={{ display: "flex", gap: 6 }}>{btn("Atender", "assign", "primary")}{btn("Desconsiderar", "dismiss", "danger")}</div>;
  }
  if (conv.status === "active") {
    if (isMine || isAdmin) {
      return (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {!isMine && conv.assignedAgentName && (
            <span style={{ fontSize: 12, color: t.textFaint, marginRight: 2 }}>{conv.assignedAgentName}</span>
          )}
          {btn("Concluir", "conclude", "primary")}
          <button onClick={onTransfer} className="wa-tap"
            style={{ height: 34, padding: "0 13px", borderRadius: 9, cursor: "pointer", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap",
              border: `1px solid ${t.border}`, background: "transparent", color: t.textMuted }}>
            Transferir
          </button>
          {btn("Devolver", "reopen", "ghost")}
        </div>
      );
    }
    return <span style={{ fontSize: 12, color: t.textFaint }}>Em atendimento{conv.assignedAgentName ? ` · ${conv.assignedAgentName}` : ""}</span>;
  }
  // concluído / desconsiderado
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <span style={{ fontSize: 12, color: t.textFaint }}>{conv.status === "concluded" ? "Concluído" : "Desconsiderado"}</span>
      {btn("Reabrir", "assign", "ghost")}
    </div>
  );
}
