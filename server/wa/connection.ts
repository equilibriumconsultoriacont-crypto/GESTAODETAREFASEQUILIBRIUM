// Gerenciador da conexão com o WhatsApp via Baileys.
// Conecta usando a sessão salva no banco; se não houver, gera QR. Reconecta sozinho
// quando a conexão cai (exceto em logout explícito, que exige novo QR).

import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion } from "baileys";
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

function setStatus(s: typeof status) {
  status = s;
  waEvents.emit("wa", { kind: "status", status: s });
}

export async function startWhatsApp(): Promise<void> {
  if (starting || status === "open") return;
  starting = true;
  try {
    const { state, saveCreds } = await useMySQLAuthState(SESSION);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: "silent" }) as any,
      browser: ["Equilíbrio Atendimento", "Chrome", "1.0.0"],
      markOnlineOnConnect: false, // não marca "online" no celular do cliente
    });
    setStatus("connecting");

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (u) => {
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
        if (code === DisconnectReason.loggedOut) {
          console.warn("[WA] logout — limpando sessão, novo QR será necessário");
          await clearMySQLAuthState(SESSION);
          setTimeout(() => startWhatsApp().catch(() => {}), 1500);
        } else {
          console.warn("[WA] conexão caiu, reconectando…", code);
          setTimeout(() => startWhatsApp().catch(() => {}), 3000);
        }
      }
    });

    sock.ev.on("messages.upsert", (m) => {
      handleIncomingMessages(sock!, m).catch((e) => console.error("[WA] upsert", e?.message));
    });
  } catch (e: any) {
    console.error("[WA] falha ao iniciar:", e?.message);
    setStatus("closed");
    setTimeout(() => startWhatsApp().catch(() => {}), 5000);
  } finally {
    starting = false;
  }
}

export function getWAStatus() {
  return { status, qr: status === "qr" ? currentQR : null };
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
