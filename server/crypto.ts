// ─────────────────────────────────────────────────────────────────────────────
// Criptografia de CAMPOS sensíveis em repouso (LGPD) — AES-256-GCM autenticado.
//
// À prova de quebra e retrocompatível (essencial p/ "não quebrar / não dar erro"):
//   • encField(txt): sem chave (DATA_ENC_KEY ausente) → devolve o texto EM CLARO (no-op).
//     Com chave → "enc:1:<base64(iv|tag|ciphertext)>".
//   • decField(val): começa com "enc:1:" → decifra; senão devolve como está (legado em claro).
//
// Consequências (de propósito):
//   • Dados antigos em texto continuam legíveis — não precisa migração.
//   • Se a chave faltar, nada quebra (só não cifra).
//   • NUNCA cifrar campos PESQUISADOS/ÚNICOS (CNPJ, e-mail, CPF) — quebraria busca/login/OCR.
//     Este helper é só para campos exibidos, não filtrados no SQL (notas, conteúdo, anexos).
//
// A chave vem de DATA_ENC_KEY (32 bytes em hex/base64; qualquer outro texto é derivado por
// SHA-256, de forma estável). Guardar no Render como env — perder a chave = perder o que foi
// cifrado, então faça backup dela.
// ─────────────────────────────────────────────────────────────────────────────
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const PREFIX = "enc:1:";
let keyCache: Buffer | null | undefined;

function getKey(): Buffer | null {
  if (keyCache !== undefined) return keyCache;
  const raw = process.env.DATA_ENC_KEY;
  if (!raw) { keyCache = null; return null; }
  let key: Buffer | null = null;
  try {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) key = Buffer.from(raw, "hex");
    else { const b = Buffer.from(raw, "base64"); if (b.length === 32) key = b; }
  } catch { /* ignore */ }
  if (!key) key = createHash("sha256").update(raw).digest(); // 32 bytes determinísticos
  keyCache = key;
  return key;
}

/** true se há chave configurada (para diagnóstico). */
export function encryptionEnabled(): boolean {
  return getKey() !== null;
}

/** Cifra um texto para gravar. No-op seguro sem chave ou em erro (nunca perde o dado). */
export function encField<T extends string | null | undefined>(plain: T): T {
  if (plain == null || plain === "" || typeof plain !== "string") return plain;
  if (plain.startsWith(PREFIX)) return plain; // já cifrado
  const key = getKey();
  if (!key) return plain; // sem chave → mantém em claro
  try {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return (PREFIX + Buffer.concat([iv, tag, ct]).toString("base64")) as T;
  } catch {
    return plain; // em falha, grava em claro (melhor que perder)
  }
}

/** Decifra um valor lido. Devolve legado em claro como está; nunca lança. */
export function decField<T extends string | null | undefined>(value: T): T {
  if (value == null || typeof value !== "string" || !value.startsWith(PREFIX)) return value;
  const key = getKey();
  if (!key) return value; // sem chave não dá pra ler; devolve como está (não quebra o fluxo)
  try {
    const buf = Buffer.from(value.slice(PREFIX.length), "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8") as T;
  } catch {
    return value;
  }
}
