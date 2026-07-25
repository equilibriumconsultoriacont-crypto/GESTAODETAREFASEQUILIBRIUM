// Auth state do Baileys persistido no MySQL (Aiven), não em arquivo local.
// O filesystem do Render é efêmero: a cada deploy/reinício ele some. Guardando as
// chaves no banco, a sessão sobrevive e o QR não precisa ser lido de novo.
// Segue a mesma estrutura do useMultiFileAuthState oficial, trocando arquivo por linha.

import { initAuthCreds, BufferJSON, proto } from "baileys";
import type { AuthenticationCreds, AuthenticationState, SignalDataTypeMap } from "baileys";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { waSessions } from "../../drizzle/schema";

export async function useMySQLAuthState(sessionName: string): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  const writeData = async (keyId: string, value: any) => {
    const db = await getDb();
    if (!db) return;
    const keyData = JSON.stringify(value, BufferJSON.replacer);
    await db
      .insert(waSessions)
      .values({ sessionName, keyId, keyData })
      .onDuplicateKeyUpdate({ set: { keyData } });
  };

  const readData = async (keyId: string): Promise<any | null> => {
    const db = await getDb();
    if (!db) return null;
    const rows = await db
      .select()
      .from(waSessions)
      .where(and(eq(waSessions.sessionName, sessionName), eq(waSessions.keyId, keyId)))
      .limit(1);
    if (!rows.length || !rows[0].keyData) return null;
    try {
      return JSON.parse(rows[0].keyData, BufferJSON.reviver);
    } catch {
      return null;
    }
  };

  const removeData = async (keyId: string) => {
    const db = await getDb();
    if (!db) return;
    await db
      .delete(waSessions)
      .where(and(eq(waSessions.sessionName, sessionName), eq(waSessions.keyId, keyId)));
  };

  const creds: AuthenticationCreds = (await readData("creds")) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: { [id: string]: SignalDataTypeMap[typeof type] } = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.create(value);
              }
              data[id] = value;
            }),
          );
          return data;
        },
        set: async (data) => {
          const tasks: Promise<void>[] = [];
          for (const category in data) {
            for (const id in (data as any)[category]) {
              const value = (data as any)[category][id];
              const keyId = `${category}-${id}`;
              tasks.push(value ? writeData(keyId, value) : removeData(keyId));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async () => {
      await writeData("creds", creds);
    },
  };
}

// Apaga toda a sessão (usado quando o WhatsApp faz logout explícito — aí precisa de novo QR).
export async function clearMySQLAuthState(sessionName: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(waSessions).where(eq(waSessions.sessionName, sessionName));
}
