// Token assinado por cobrança (título financeiro).
//
// As páginas públicas de cobrança (/cobranca/:id) identificavam a cobrança só
// pelo id sequencial — qualquer um podia adivinhar ids e ler dados ou enviar
// comprovantes em cobranças alheias (IDOR). Agora cada link carrega um token
// HMAC derivado do id + um segredo do servidor; sem o segredo não dá para
// forjar o token, então ids deixam de ser enumeráveis.
import { createHmac, timingSafeEqual } from "crypto";
import { ENV } from "./_core/env";

// Deriva um token curto e determinístico para o id da cobrança.
export function signCobranca(id: number | string): string {
  return createHmac("sha256", ENV.cookieSecret)
    .update(`cobranca:${id}`)
    .digest("base64url")
    .slice(0, 24);
}

// Confere o token em tempo constante. Vazio/errado → false.
export function verifyCobranca(id: number | string, token?: string | null): boolean {
  if (!token) return false;
  const expected = signCobranca(id);
  const a = Buffer.from(String(token));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
