// Destinatários de guias/avisos: junta o contato PRINCIPAL do cliente com os ADICIONAIS
// (ccEmails/ccPhones — parceiros, ou vários contatos), separados por vírgula, ";" ou linha.

export function splitMulti(v?: string | null): string[] {
  if (!v) return [];
  return v
    .split(/[,;\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** E-mails do cliente: principal + adicionais, deduplicados (case-insensitive) e válidos. */
export function allEmails(primary?: string | null, cc?: string | null): string[] {
  const list = [primary || "", ...splitMulti(cc)].map((e) => e.trim()).filter((e) => EMAIL_RE.test(e));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of list) {
    const k = e.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(e); }
  }
  return out;
}

/** Normaliza um telefone BR para o padrão do WhatsApp (com DDI 55). "" se inválido. */
export function normalizeBRPhone(phone?: string | null): string {
  let d = (phone || "").replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) return d;
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d.length >= 12 ? d : "";
}

/** Telefones (WhatsApp) do cliente: principal + adicionais, normalizados e deduplicados. */
export function allPhones(primary?: string | null, cc?: string | null): string[] {
  const list = [primary || "", ...splitMulti(cc)]
    .map((p) => normalizeBRPhone(p))
    .filter((p) => p.length >= 12);
  return [...new Set(list)];
}
