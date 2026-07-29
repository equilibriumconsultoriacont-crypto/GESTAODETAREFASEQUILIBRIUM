// Gerenciador da conexão com o WhatsApp via Baileys.
// Conecta usando a sessão salva no banco; se não houver, gera QR. Reconecta sozinho
// quando a conexão cai (exceto em logout explícito, que exige novo QR).

import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, Browsers } from "baileys";
import type { WASocket } from "baileys";
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";
import pino from "pino";
import { useMySQLAuthState, clearMySQLAuthState } from "./authState";
import { handleIncomingMessages } from "./handlers";
import { waEvents } from "./events";

const SESSION = process.env.WA_SESSION_NAME || "atendimento_principal";

let sock: WASocket | null = null;
let currentQR: string | null = null;
let status: "closed" | "connecting" | "qr" | "open" = "closed";
let starting = false;
let lastError: string | null = null;

function setStatus(s: typeof status) {
  status = s;
  waEvents.emit("wa", { kind: "status", status: s });
}

export async function startWhatsApp(): Promise<void> {
  if (starting || status === "open") return;
  starting = true;
  try {
    if (sock) {
      try { sock.ev.removeAllListeners("connection.update"); sock.end(undefined); } catch {}
      sock = null;
    }
    const { state, saveCreds } = await useMySQLAuthState(SESSION);
    let waVersion: [number, number, number] | undefined;
    try {
      const r = await fetchLatestBaileysVersion();
      waVersion = r.version as any;
    } catch {
      // se falhar, o Baileys usa a versão padrão embutida
    }

    sock = makeWASocket({
      ...(waVersion ? { version: waVersion } : {}),
      auth: state,
      logger: pino({ level: "silent" }) as any,
      browser: Browsers.ubuntu("Chrome"),
      markOnlineOnConnect: false, // não marca "online" no celular do cliente
      qrTimeout: 60_000,
      connectTimeoutMs: 60_000,
    });
    setStatus("connecting");
    lastError = null;

    // Salva credenciais no banco a cada rotação de chave. Protegido: se a gravação
    // falhar (blip no banco), registra e segue — nunca derruba o processo.
    sock.ev.on("creds.update", () => {
      Promise.resolve(saveCreds()).catch((e: any) => console.error("[WA] saveCreds:", e?.message));
    });

    sock.ev.on("connection.update", async (u) => {
     try {
      const { connection, lastDisconnect, qr } = u;
      if (qr) {
        currentQR = await QRCode.toDataURL(qr);
        setStatus("qr");
      }
      if (connection === "open") {
        currentQR = null;
        setStatus("open");
        console.log("[WA] conectado");
      }
      if (connection === "close") {
        sock = null;
        setStatus("closed");
        const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
        lastError = "Conexão fechada" + (code ? ` (código ${code})` : "") +
          (lastDisconnect?.error?.message ? ": " + lastDisconnect.error.message : "");
        if (code === DisconnectReason.restartRequired) {
          // 515: normal logo após parear — reinicia JÁ com as credenciais salvas
          console.log("[WA] 515 restart required — reconectando imediatamente");
          setTimeout(() => startWhatsApp().catch(() => {}), 300);
        } else if (code === DisconnectReason.loggedOut) {
          console.warn("[WA] logout — limpando sessão, novo QR será necessário");
          await clearMySQLAuthState(SESSION);
          setTimeout(() => startWhatsApp().catch(() => {}), 1500);
        } else {
          console.warn("[WA] conexão caiu, reconectando…", code);
          setTimeout(() => startWhatsApp().catch(() => {}), 3000);
        }
      }
     } catch (e: any) {
       console.error("[WA] connection.update:", e?.message);
     }
    });

    sock.ev.on("messages.upsert", (m) => {
      handleIncomingMessages(sock!, m).catch((e) => console.error("[WA] upsert", e?.message));
    });
  } catch (e: any) {
    lastError = e?.message || String(e);
    console.error("[WA] falha ao iniciar:", lastError);
    setStatus("closed");
    setTimeout(() => startWhatsApp().catch(() => {}), 8000);
  } finally {
    starting = false;
  }
}

export function getWAStatus() {
  return { status, qr: status === "qr" ? currentQR : null, lastError };
}

export function getSock() {
  return sock;
}

export function jidFromNumber(num: string) {
  const clean = String(num).replace(/\D/g, "");
  return `${clean}@s.whatsapp.net`;
}

export async function sendText(number: string, text: string) {
  if (!sock || status !== "open") throw new Error("WhatsApp não está conectado.");
  return sock.sendMessage(jidFromNumber(number), { text });
}

// Envia para o jid EXATO recebido (telefone @s.whatsapp.net ou LID @lid). Preferir isto
// ao reconstruir a partir do numero: contatos por LID nao teem telefone valido.
export async function sendToJid(jid: string, text: string, quoted?: any) {
  if (!sock || status !== "open") throw new Error("WhatsApp não está conectado.");
  return sock.sendMessage(jid, { text }, quoted ? { quoted } : undefined);
}

export async function sendMedia(jid: string, opts: { type: string; data: Buffer; mimetype?: string; fileName?: string; caption?: string; ptt?: boolean }) {
  if (!sock || status !== "open") throw new Error("WhatsApp não está conectado.");
  let content: any;
  if (opts.type === "image") content = { image: opts.data, caption: opts.caption || undefined };
  else if (opts.type === "video") content = { video: opts.data, caption: opts.caption || undefined };
  else if (opts.type === "audio") content = { audio: opts.data, mimetype: opts.mimetype || "audio/ogg; codecs=opus", ptt: opts.ptt ?? true };
  else content = { document: opts.data, mimetype: opts.mimetype || "application/octet-stream", fileName: opts.fileName || "arquivo" };
  return sock.sendMessage(jid, content);
}

export async function deleteMessage(jid: string, key: any) {
  if (!sock || status !== "open") throw new Error("WhatsApp não está conectado.");
  return sock.sendMessage(jid, { delete: key });
}

export async function editMessage(jid: string, key: any, text: string) {
  if (!sock || status !== "open") throw new Error("WhatsApp não está conectado.");
  return sock.sendMessage(jid, { text, edit: key });
}

export async function markRead(number: string, messageId: string) {
  if (!sock || status !== "open") return;
  try {
    await sock.readMessages([
      { remoteJid: jidFromNumber(number), id: messageId, participant: undefined },
    ]);
  } catch {}
}

export async function logoutWhatsApp() {
  try {
    await sock?.logout();
  } catch {}
  await clearMySQLAuthState(SESSION);
  sock = null;
  setStatus("closed");
  currentQR = null;
}
