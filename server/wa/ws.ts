// Servidor WebSocket do painel. O navegador manda o cookie de sessão no handshake,
// então autenticamos com o mesmo authenticateRequest do resto do sistema.
// Cada agente conectado recebe os eventos emitidos por waEvents (mensagens novas etc.).

import { WebSocketServer } from "ws";
import type { Server } from "http";
import { waEvents } from "./events";

export function setupWaWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/api/wa/ws" });

  wss.on("connection", async (ws, req) => {
    let user: any = null;
    try {
      const { sdk } = await import("../_core/sdk");
      user = await sdk.authenticateRequest(req as any);
    } catch {}
    if (!user || (user.role !== "admin" && user.role !== "user")) {
      try { ws.close(4001, "não autorizado"); } catch {}
      return;
    }

    const listener = (ev: any) => {
      try { ws.send(JSON.stringify(ev)); } catch {}
    };
    waEvents.on("wa", listener);

    const cleanup = () => waEvents.off("wa", listener);
    ws.on("close", cleanup);
    ws.on("error", cleanup);

    try { ws.send(JSON.stringify({ kind: "connected" })); } catch {}
  });

  console.log("[WA] WebSocket ativo em /api/wa/ws");
}
