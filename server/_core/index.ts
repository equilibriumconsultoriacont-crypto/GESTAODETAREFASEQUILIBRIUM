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

  // ── Trust Railway's proxy ──────────────────────────────────────────────────
  app.set("trust proxy", 1);

  // ── Security headers ───────────────────────────────────────────────────────
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  // ── Body parser ────────────────────────────────────────────────────────────
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ limit: "25mb", extended: true }));

  // ── Health endpoints (no auth needed) ─────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      memory: process.memoryUsage().heapUsed,
      timestamp: new Date().toISOString(),
    });
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

  // ── Migration endpoint (protegido por MIGRATE_SECRET) ─────────────────────
  app.post("/admin/migrate", async (req, res) => {
    const secret = process.env.MIGRATE_SECRET || "equilibrium-migrate-2024";
    const authHeader = req.headers["x-migrate-secret"];
    if (authHeader !== secret) {
      return res.status(403).json({ error: "Forbidden" });
    }
    try {
      const mysql = await import("mysql2/promise");
      const { readFileSync } = await import("fs");
      const { join } = await import("path");
      const conn = await mysql.default.createConnection({ uri: process.env.DATABASE_URL! });
      const sqlPath = join(process.cwd(), "drizzle/migrations/fix_all_missing_columns.sql");
      const sql = readFileSync(sqlPath, "utf-8");
      const statements = sql
        .split(/;\s*\n/)
        .map((s: string) => s.replace(/^--.*$/gm, "").trim())
        .filter((s: string) => s.length > 5);
      const results: string[] = [];
      for (const stmt of statements) {
        try {
          await conn.query(stmt);
          results.push(`✓ OK`);
        } catch (err: any) {
          if (err.code === "ER_DUP_FIELDNAME" || err.code === "ER_TABLE_EXISTS_ERROR" || (err.message || "").includes("Duplicate column")) {
            results.push(`⚠ Já existe (ok)`);
          } else {
            results.push(`✗ ${err.message?.slice(0, 100)}`);
          }
        }
      }
      await conn.end();
      res.json({ success: true, statements: statements.length, results });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // ── Manus integrations (gracefully disabled if not configured) ─────────────
  try { registerStorageProxy(app); } catch {}
  try { registerOAuthRoutes(app); } catch {}

  // ── tRPC ───────────────────────────────────────────────────────────────────
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

  // ── Static / Vite ──────────────────────────────────────────────────────────
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
