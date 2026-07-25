import { EventEmitter } from "events";

// Ponte entre o Baileys/handlers e a camada de WebSocket do painel.
// Os handlers emitem aqui; o servidor WS (a ligar em seguida) escuta e repassa aos agentes.
export const waEvents = new EventEmitter();
waEvents.setMaxListeners(200);

export type WaEvent =
  | { kind: "message"; conversationId: number; contactId: number; number: string; fromMe: boolean; text: string; type: string }
  | { kind: "status"; status: string }
  | { kind: "conversation"; conversationId: number; action: string };
