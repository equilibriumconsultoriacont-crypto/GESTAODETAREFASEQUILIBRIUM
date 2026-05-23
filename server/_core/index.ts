import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

async function startServer() {
  const app = express();

  app.set("trust proxy", 1);

  // ── Security headers ──────────────────────────────────────────────────────
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  // ── Upload ANTES do body parser (busboy precisa do stream raw) ────────────
  app.post("/api/upload", async (req, res) => {
    try {
      const { sdk } = await import("./sdk");
      let user: any = null;
      try { user = await sdk.authenticateRequest(req); } catch {}
      if (!user) return res.status(401).json({ error: "Não autenticado" });

      const busboyModule = await import("busboy");
      const busboy = busboyModule.default ?? busboyModule;
      const bb = busboy({ headers: req.headers, limits: { fileSize: 20 * 1024 * 1024 } });

      const fields: Record<string, string> = {};
      let fileBuffer: Buffer | null = null;
      let fileOriginalname = "arquivo";
      let fileMimetype = "application/pdf";
      let fileSize = 0;

      await new Promise<void>((resolve, reject) => {
        bb.on("field", (name, val) => { fields[name] = val; });
        bb.on("file", (_fieldname, stream, info) => {
          fileOriginalname = info.filename || "arquivo";
          fileMimetype = info.mimeType || "application/pdf";
          const chunks: Buffer[] = [];
          stream.on("data", (chunk: Buffer) => { chunks.push(chunk); fileSize += chunk.length; });
          stream.on("end", () => { fileBuffer = Buffer.concat(chunks); });
          stream.on("error", reject);
        });
        bb.on("finish", resolve);
        bb.on("error", reject);
        req.pipe(bb);
      });

      if (!fileBuffer) return res.status(400).json({ error: "Nenhum arquivo enviado" });

      const taskId = Number(fields.taskId);
      const clientId = Number(fields.clientId);
      if (!taskId || !clientId) return res.status(400).json({ error: "taskId e clientId são obrigatórios" });

      const { storagePut } = await import("../storage");
      const { createTaskFile } = await import("../db");

      const filename = fileOriginalname.replace(/[^a-zA-Z0-9._\-]/g, "_").slice(0, 255);
      const fileKey = `tasks/${taskId}/${Date.now()}-${filename}`;
      const { url } = await storagePut(fileKey, fileBuffer, fileMimetype);

      const id = await createTaskFile({
        taskId, clientId, filename, fileKey, fileUrl: url,
        mimeType: fileMimetype, fileSize, uploadedBy: user.id,
      });

      console.log(`[Upload] OK: task=${taskId} file=${filename} size=${fileSize}`);
      return res.json({ success: true, id, fileKey, fileUrl: url, filename });
    } catch (e: any) {
      console.error("[Upload] Error:", e);
      return res.status(500).json({ error: e?.message ?? "Erro interno no upload" });
    }
  });

  // ── Body parser (DEPOIS do upload route) ─────────────────────────────────
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ limit: "25mb", extended: true }));

  // ── Health ────────────────────────────────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime(), memory: process.memoryUsage().heapUsed, timestamp: new Date().toISOString() });
  });

  app.get("/health/db", async (_req, res) => {
    try {
      const { checkDbHealth } = await import("../db");
      const result = await checkDbHealth();
      res.status(result.ok ? 200 : 503).json(result);
    } catch (err: any) {
      res.status(503).json({ ok: false, error: err?.message });
    }
  });

  // ── Migration endpoint ────────────────────────────────────────────────────
  app.post("/admin/migrate", async (req, res) => {
    const secret = process.env.MIGRATE_SECRET || "equilibrium-migrate-2024";
    if (req.headers["x-migrate-secret"] !== secret) return res.status(403).json({ error: "Forbidden" });
    try {
      const mysql = await import("mysql2/promise");
      const { readFileSync } = await import("fs");
      const { join } = await import("path");
      const conn = await mysql.default.createConnection({ uri: process.env.DATABASE_URL! });
      const sqlPath = join(process.cwd(), "drizzle/migrations/fix_all_missing_columns.sql");
      const sql = readFileSync(sqlPath, "utf-8");
      const statements = sql.split(/;\s*\n/).map((s: string) => s.replace(/^--.*$/gm, "").trim()).filter((s: string) => s.length > 5);
      const results: string[] = [];
      for (const stmt of statements) {
        try { await conn.query(stmt); results.push("✓ OK"); }
        catch (err: any) {
          if (err.code === "ER_DUP_FIELDNAME" || err.code === "ER_TABLE_EXISTS_ERROR" || (err.message||"").includes("Duplicate column")) results.push("⚠ Já existe");
          else results.push(`✗ ${err.message?.slice(0, 100)}`);
        }
      }
      await conn.end();
      res.json({ success: true, statements: statements.length, results });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // ── Teste de SMTP ────────────────────────────────────────────────────────
  app.get("/admin/test-email", async (req, res) => {
    const secret = process.env.MIGRATE_SECRET || "equilibrium-migrate-2024";
    if (req.headers["x-migrate-secret"] !== secret && req.query.secret !== secret) {
      return res.status(403).json({ error: "Forbidden" });
    }
    // Testa Resend se configurado
    const resendKey = process.env.RESEND_API_KEY;
    const resendFrom = process.env.RESEND_FROM || "contato@equilibriumcont.com";
    if (resendKey) {
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `Equilibrium <${resendFrom}>`,
            to: [resendFrom],
            subject: "✅ Teste Resend — Equilibrium funcionando!",
            html: "<h1>Funcionando!</h1><p>E-mail via Resend configurado com sucesso.</p><p>Data: " + new Date().toISOString() + "</p>"
          })
        });
        const data = await r.json();
        if (r.ok) return res.json({ ok: true, method: "resend", from: resendFrom, id: data.id });
        return res.status(500).json({ ok: false, method: "resend", error: data, status: r.status });
      } catch (e: any) {
        return res.status(500).json({ ok: false, method: "resend", error: e.message });
      }
    }
    try {
      const nodemailer = await import("nodemailer");
      const dns = await import("dns/promises");
      const host = process.env.SMTP_HOST || "smtp.gmail.com";
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      if (!user || !pass) return res.status(500).json({ error: "SMTP_USER ou SMTP_PASS não configurados" });

      let ipv4Host = host;
      try { const a = await dns.resolve4(host); if (a[0]) ipv4Host = a[0]; } catch {}

      const results: Record<string, string> = {};
      let working: { port: number; transporter: any } | null = null;

      for (const port of [465, 587, 25]) {
        try {
          const t = nodemailer.default.createTransport({
            host: ipv4Host, port, secure: port === 465,
            auth: { user, pass },
            tls: { rejectUnauthorized: false, servername: host },
            connectionTimeout: 8000, greetingTimeout: 8000,
          });
          await t.verify();
          results[port] = "✅ OK";
          if (!working) working = { port, transporter: t };
        } catch (e: any) {
          results[port] = `❌ ${e.code ?? e.message}`;
        }
      }

      if (working) {
        await working.transporter.sendMail({
          from: `"Equilibrium" <${user}>`,
          to: user,
          subject: `✅ SMTP OK porta ${working.port}`,
          text: `Funcionando!\nHost: ${host} → ${ipv4Host}\nPorta: ${working.port}\nResultados: ${JSON.stringify(results)}`,
        });
        return res.json({ ok: true, host, ipv4Host, workingPort: working.port, results });
      }
      return res.status(500).json({ ok: false, host, ipv4Host, results, tip: "Railway bloqueia SMTP. Configure RESEND_API_KEY nas variáveis do Railway." });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message, code: e?.code });
    }
  });

  // ── tRPC ──────────────────────────────────────────────────────────────────
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError: ({ error, path }) => {
        if (error.code !== "UNAUTHORIZED" && error.code !== "FORBIDDEN") {
          console.error(`[tRPC] Error on ${path}:`, error.message);
        }
      },
    })
  );

  // ── Static / Vite ─────────────────────────────────────────────────────────
  if (process.env.NODE_ENV === "development") {
    const server = createServer(app);
    await setupVite(app, server);
    const port = parseInt(process.env.PORT || "8080");
    server.listen(port, () => console.log(`Server running on http://localhost:${port}/`));
  } else {
    serveStatic(app);
    const port = parseInt(process.env.PORT || "8080");
    app.listen(port, () => console.log(`Server running on http://localhost:${port}/`));
  }
}

startServer().catch((err) => {
  console.error("[Fatal] Server failed to start:", err);
  process.exit(1);
});
