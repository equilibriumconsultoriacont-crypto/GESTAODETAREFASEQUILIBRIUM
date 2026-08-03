import type { Express } from "express";
import { eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { financialTitulos, financialPayments, financialConfig, clients } from "../drizzle/schema";
import { buildPixBRCode, pixQrPngBuffer } from "./pix";

// Rotas PÚBLICAS do financeiro (o cliente acessa pelo link do e-mail de cobrança, sem login).
// Observação: identificam a cobrança pelo id do título. Numa evolução, dá para usar um token
// assinado por cobrança para evitar adivinhação de ids — por ora atende a fase de teste.
export function registerFinanceiroRoutes(app: Express) {
  // Contagem de comprovantes aguardando conferência (para o badge/notificação, estilo WhatsApp)
  app.get("/api/financeiro/pendencias", async (_req, res) => {
    const db = await getDb();
    if (!db) return res.json({ count: 0 });
    try {
      const [r]: any = await db.select({ n: sql`count(*)` }).from(financialPayments).where(eq(financialPayments.status, "aguardando_conferencia"));
      res.json({ count: Number(r?.n ?? 0) });
    } catch {
      res.json({ count: 0 });
    }
  });

  // Dados da cobrança para a página pública de pagamento
  app.get("/api/financeiro/cobranca/:id", async (req, res) => {
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "sem banco" });
    const id = parseInt(req.params.id);
    const row = (await db
      .select({ id: financialTitulos.id, description: financialTitulos.description, amount: financialTitulos.amount, competencia: financialTitulos.competencia, dueDate: financialTitulos.dueDate, status: financialTitulos.status, clientName: clients.name })
      .from(financialTitulos).leftJoin(clients, eq(clients.id, financialTitulos.clientId)).where(eq(financialTitulos.id, id)).limit(1))[0];
    if (!row) return res.status(404).json({ error: "cobrança não encontrada" });
    const cfg = (await db.select().from(financialConfig).where(eq(financialConfig.id, 1)).limit(1))[0];
    let pixCopiaCola: string | null = null;
    if (cfg?.active && cfg?.pixKey) {
      try {
        pixCopiaCola = buildPixBRCode({ key: cfg.pixKey, keyType: cfg.pixKeyType || undefined, name: cfg.beneficiaryName || "Equilibrium", city: "Rio Claro", amount: row.amount, txid: `T${row.id}` });
      } catch { pixCopiaCola = null; }
    }
    res.json({ ...row, pixCopiaCola, beneficiaryName: cfg?.beneficiaryName || null, pixKey: cfg?.active ? cfg?.pixKey : null, pixKeyType: cfg?.pixKeyType || null, pixActive: !!cfg?.active });
  });

  // Imagem PNG do QR Code PIX da cobrança (usada como <img> no e-mail e na página)
  app.get("/api/financeiro/pix-qr/:id.png", async (req, res) => {
    const db = await getDb();
    if (!db) return res.status(500).end();
    const id = parseInt((req.params as any).id);
    const row = (await db.select({ amount: financialTitulos.amount }).from(financialTitulos).where(eq(financialTitulos.id, id)).limit(1))[0];
    const cfg = (await db.select().from(financialConfig).where(eq(financialConfig.id, 1)).limit(1))[0];
    if (!row || !cfg?.active || !cfg?.pixKey) return res.status(404).end();
    try {
      const brcode = buildPixBRCode({ key: cfg.pixKey, keyType: cfg.pixKeyType || undefined, name: cfg.beneficiaryName || "Equilibrium", city: "Rio Claro", amount: row.amount, txid: `T${id}` });
      const png = await pixQrPngBuffer(brcode);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.end(png);
    } catch (e: any) {
      console.warn("[Financeiro] pix-qr:", e?.message);
      res.status(500).end();
    }
  });

  // Cliente envia o comprovante -> cria pagamento "aguardando conferência" (NÃO dá baixa sozinho)
  app.post("/api/financeiro/cobranca/:id/comprovante", async (req, res) => {
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "sem banco" });
    const id = parseInt(req.params.id);
    const dataBase64 = (req.body?.dataBase64 || "").toString();
    const amount = (req.body?.amount || "").toString().trim();
    const note = (req.body?.note || "").toString().slice(0, 500);
    if (!dataBase64 || !dataBase64.startsWith("data:")) return res.status(400).json({ error: "anexe o comprovante" });
    if (dataBase64.length > 8_000_000) return res.status(400).json({ error: "arquivo muito grande (máx ~6MB)" });
    try {
      const titulo = (await db.select().from(financialTitulos).where(eq(financialTitulos.id, id)).limit(1))[0];
      if (!titulo) return res.status(404).json({ error: "cobrança não encontrada" });
      if (titulo.status === "pago") return res.status(400).json({ error: "esta cobrança já está paga" });
      await db.insert(financialPayments).values({
        tituloId: id, comprovanteUrl: dataBase64, amount: amount || titulo.amount, paidDate: new Date(),
        method: "pix", status: "aguardando_conferencia", submittedByClient: true, note: note || "Comprovante enviado pelo cliente",
      } as any);
      await db.update(financialTitulos).set({ status: "em_conferencia", updatedAt: new Date() }).where(eq(financialTitulos.id, id));
      res.json({ ok: true });
    } catch (e: any) {
      console.warn("[Financeiro] comprovante:", e?.message);
      if (!res.headersSent) res.status(500).json({ error: "falha ao enviar comprovante" });
    }
  });
}
