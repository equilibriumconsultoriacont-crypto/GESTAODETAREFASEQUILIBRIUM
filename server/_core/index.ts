// Polyfill crypto para Node 18 (jose e outras libs esperam globalThis.crypto)
import { webcrypto } from "crypto";
if (!globalThis.crypto) {
  (globalThis as any).crypto = webcrypto;
}

import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

async function startServer() {
  const app = express();

  app.set("trust proxy", 1);

  // ── Security headers ──────────────────────────────────────────────────────
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    // SAMEORIGIN permite embutir páginas do próprio site em iframe (ex: módulo
    // de Propostas carrega /tools/gerador-propostas.html), mas continua
    // bloqueando que sites externos embutam o nosso (proteção anti-clickjacking).
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
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
      const conn = await mysql.default.createConnection({ uri: process.env.DATABASE_URL! });
      // SQL embutido diretamente (esbuild não inclui arquivos externos)
      const statements = [
        "ALTER TABLE `clients` ADD COLUMN IF NOT EXISTS `cpf` varchar(14)",
        "ALTER TABLE `clients` ADD COLUMN IF NOT EXISTS `documentType` enum('CNPJ','CPF') NOT NULL DEFAULT 'CNPJ'",
        "ALTER TABLE `tasks` ADD COLUMN IF NOT EXISTS `priority` enum('BAIXA','NORMAL','ALTA','URGENTE') NOT NULL DEFAULT 'NORMAL'",
        "ALTER TABLE `tasks` ADD COLUMN IF NOT EXISTS `department` enum('FISCAL','CONTABIL','DP','SOCIETARIO','FINANCEIRO','GERAL') NOT NULL DEFAULT 'GERAL'",
        "ALTER TABLE `tasks` ADD COLUMN IF NOT EXISTS `assignedTo` int",
        "ALTER TABLE `tasks` ADD COLUMN IF NOT EXISTS `completedAt` timestamp NULL",
        "ALTER TABLE `tasks` ADD COLUMN IF NOT EXISTS `internalDeadline` timestamp NULL",
        "ALTER TABLE `tasks` ADD COLUMN IF NOT EXISTS `waitingSince` timestamp NULL",
        "ALTER TABLE `tasks` ADD COLUMN IF NOT EXISTS `startedAt` timestamp NULL",
        "ALTER TABLE `tasks` MODIFY COLUMN `status` enum('PENDENTE','EM_ANDAMENTO','AGUARDANDO_CLIENTE','EM_REVISAO','CONCLUIDA','CANCELADA','VENCIDA') NOT NULL DEFAULT 'PENDENTE'",
        "ALTER TABLE `recurring_tasks` ADD COLUMN IF NOT EXISTS `taskTemplateId` int",
        "ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `clientId` int",
        "ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','client') NOT NULL DEFAULT 'user'",
        "ALTER TABLE `task_files` MODIFY COLUMN `fileUrl` mediumtext NOT NULL",
      ];
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

  // ── Setup inicial: cria TODAS as tabelas do zero + usuário admin ──────────
  // Usar quando o banco está vazio (ex: migração para novo provedor)
  // POST /admin/setup?secret=XXX&email=...&password=...&name=...
  app.post("/admin/setup", async (req, res) => {
    const secret = process.env.MIGRATE_SECRET || "equilibrium-migrate-2024";
    const provided = req.headers["x-migrate-secret"] || req.query.secret;
    if (provided !== secret) return res.status(403).json({ error: "Forbidden" });

    try {
      const mysql = await import("mysql2/promise");
      const conn = await mysql.default.createConnection({ uri: process.env.DATABASE_URL! });

      const createStatements = [
        "CREATE TABLE IF NOT EXISTS `users` (`id` int AUTO_INCREMENT NOT NULL, `openId` varchar(64), `name` text, `email` varchar(320) NOT NULL, `passwordHash` varchar(255), `loginMethod` varchar(64) NOT NULL DEFAULT 'local', `role` enum('user','admin','client') NOT NULL DEFAULT 'user', `clientId` int, `createdAt` timestamp NOT NULL DEFAULT (now()), `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, `lastSignedIn` timestamp NOT NULL DEFAULT (now()), CONSTRAINT `users_id` PRIMARY KEY(`id`), CONSTRAINT `users_openId_unique` UNIQUE(`openId`), CONSTRAINT `users_email_unique` UNIQUE(`email`))",
        "CREATE TABLE IF NOT EXISTS `clients` (`id` int AUTO_INCREMENT NOT NULL, `name` varchar(255) NOT NULL, `cnpj` varchar(18) NOT NULL, `cpf` varchar(14), `documentType` enum('CNPJ','CPF') NOT NULL DEFAULT 'CNPJ', `email` varchar(320) NOT NULL, `phone` varchar(20), `notes` text, `active` boolean NOT NULL DEFAULT true, `createdAt` timestamp NOT NULL DEFAULT (now()), `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT `clients_id` PRIMARY KEY(`id`), CONSTRAINT `clients_cnpj_unique` UNIQUE(`cnpj`))",
        "CREATE TABLE IF NOT EXISTS `task_catalogs` (`id` int AUTO_INCREMENT NOT NULL, `name` varchar(255) NOT NULL, `description` text, `active` boolean NOT NULL DEFAULT true, `createdAt` timestamp NOT NULL DEFAULT (now()), `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT `task_catalogs_id` PRIMARY KEY(`id`))",
        "CREATE TABLE IF NOT EXISTS `catalog_templates` (`id` int AUTO_INCREMENT NOT NULL, `catalogId` int NOT NULL, `taskTemplateId` int NOT NULL, `createdAt` timestamp NOT NULL DEFAULT (now()), CONSTRAINT `catalog_templates_id` PRIMARY KEY(`id`))",
        "CREATE TABLE IF NOT EXISTS `task_templates` (`id` int AUTO_INCREMENT NOT NULL, `title` varchar(255) NOT NULL, `description` text, `taskType` enum('DAS','NFS','DCTF','SPED','OUTROS') NOT NULL, `dueDayOfMonth` int NOT NULL, `ocrKeywords` text, `department` enum('FISCAL','CONTABIL','DP','SOCIETARIO','FINANCEIRO','GERAL') NOT NULL DEFAULT 'GERAL', `active` boolean NOT NULL DEFAULT true, `createdAt` timestamp NOT NULL DEFAULT (now()), `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT `task_templates_id` PRIMARY KEY(`id`))",
        "CREATE TABLE IF NOT EXISTS `client_task_templates` (`id` int AUTO_INCREMENT NOT NULL, `clientId` int NOT NULL, `taskTemplateId` int NOT NULL, `catalogId` int, `active` boolean NOT NULL DEFAULT true, `createdAt` timestamp NOT NULL DEFAULT (now()), CONSTRAINT `client_task_templates_id` PRIMARY KEY(`id`))",
        "CREATE TABLE IF NOT EXISTS `recurring_tasks` (`id` int AUTO_INCREMENT NOT NULL, `clientId` int NOT NULL, `taskTemplateId` int, `title` varchar(255) NOT NULL, `description` text, `taskType` enum('DAS','NFS','DCTF','SPED','OUTROS') NOT NULL, `dueDayOfMonth` int NOT NULL, `active` boolean NOT NULL DEFAULT true, `createdAt` timestamp NOT NULL DEFAULT (now()), `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT `recurring_tasks_id` PRIMARY KEY(`id`))",
        "CREATE TABLE IF NOT EXISTS `tasks` (`id` int AUTO_INCREMENT NOT NULL, `clientId` int NOT NULL, `recurringTaskId` int, `title` varchar(255) NOT NULL, `description` text, `taskType` enum('DAS','NFS','DCTF','SPED','OUTROS') NOT NULL, `competencia` varchar(7) NOT NULL, `dueDate` timestamp NOT NULL, `status` enum('PENDENTE','EM_ANDAMENTO','AGUARDANDO_CLIENTE','EM_REVISAO','CONCLUIDA','CANCELADA','VENCIDA') NOT NULL DEFAULT 'PENDENTE', `priority` enum('BAIXA','NORMAL','ALTA','URGENTE') NOT NULL DEFAULT 'NORMAL', `department` enum('FISCAL','CONTABIL','DP','SOCIETARIO','FINANCEIRO','GERAL') NOT NULL DEFAULT 'GERAL', `assignedTo` int, `internalDeadline` timestamp NULL, `waitingSince` timestamp NULL, `startedAt` timestamp NULL, `notes` text, `completedAt` timestamp NULL, `createdAt` timestamp NOT NULL DEFAULT (now()), `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT `tasks_id` PRIMARY KEY(`id`))",
        "CREATE TABLE IF NOT EXISTS `task_files` (`id` int AUTO_INCREMENT NOT NULL, `taskId` int NOT NULL, `clientId` int NOT NULL, `filename` varchar(255) NOT NULL, `fileKey` varchar(512) NOT NULL, `fileUrl` mediumtext NOT NULL, `mimeType` varchar(100), `fileSize` bigint, `uploadedBy` int, `uploadedAt` timestamp NOT NULL DEFAULT (now()), CONSTRAINT `task_files_id` PRIMARY KEY(`id`))",
        "CREATE TABLE IF NOT EXISTS `activity_logs` (`id` int AUTO_INCREMENT NOT NULL, `entityType` varchar(50) NOT NULL, `entityId` int NOT NULL, `action` varchar(100) NOT NULL, `before` text, `after` text, `userId` int, `createdAt` timestamp NOT NULL DEFAULT (now()), CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`))",
        "CREATE TABLE IF NOT EXISTS `email_logs` (`id` int AUTO_INCREMENT NOT NULL, `taskId` int NOT NULL, `clientId` int NOT NULL, `taskFileId` int, `recipientEmail` varchar(320) NOT NULL, `subject` varchar(500) NOT NULL, `body` text, `status` enum('ENVIADO','FALHOU') NOT NULL DEFAULT 'ENVIADO', `errorMessage` text, `sentBy` int, `sentAt` timestamp NOT NULL DEFAULT (now()), CONSTRAINT `email_logs_id` PRIMARY KEY(`id`))",
        "CREATE TABLE IF NOT EXISTS `departments` (`id` int AUTO_INCREMENT NOT NULL, `name` varchar(100) NOT NULL, `color` varchar(20) NOT NULL DEFAULT '#a1a1aa', `active` boolean NOT NULL DEFAULT true, `createdAt` timestamp NOT NULL DEFAULT (now()), CONSTRAINT `departments_id` PRIMARY KEY(`id`), CONSTRAINT `departments_name_unique` UNIQUE(`name`))",
        "CREATE TABLE IF NOT EXISTS `user_departments` (`id` int AUTO_INCREMENT NOT NULL, `userId` int NOT NULL, `departmentId` int NOT NULL, `createdAt` timestamp NOT NULL DEFAULT (now()), CONSTRAINT `user_departments_id` PRIMARY KEY(`id`))",
        "CREATE TABLE IF NOT EXISTS `user_clients` (`id` int AUTO_INCREMENT NOT NULL, `userId` int NOT NULL, `clientId` int NOT NULL, `createdAt` timestamp NOT NULL DEFAULT (now()), CONSTRAINT `user_clients_id` PRIMARY KEY(`id`))",
        "INSERT IGNORE INTO `departments` (name, color) VALUES ('Fiscal','#9fd4dc'),('Contábil','#c084fc'),('Pessoal','#fb923c'),('Societário','#4ade80'),('Financeiro','#facc15'),('Geral','#a1a1aa')",
        // Converter department de enum para varchar (aceita departamentos gerenciáveis)
        "ALTER TABLE `tasks` MODIFY COLUMN `department` varchar(100) NOT NULL DEFAULT 'Geral'",
        "ALTER TABLE `task_templates` MODIFY COLUMN `department` varchar(100) NOT NULL DEFAULT 'Geral'",
        "ALTER TABLE `recurring_tasks` ADD COLUMN `department` varchar(100) NOT NULL DEFAULT 'Geral'",
        "ALTER TABLE `task_templates` ADD COLUMN `periodicity` enum('MENSAL','TRIMESTRAL','ANUAL') NOT NULL DEFAULT 'MENSAL'",
        "ALTER TABLE `task_templates` ADD COLUMN `competenciaOffset` int NOT NULL DEFAULT 1",
        "ALTER TABLE `task_templates` ADD COLUMN `annualMonth` int NULL",
        "ALTER TABLE `recurring_tasks` ADD COLUMN `periodicity` enum('MENSAL','TRIMESTRAL','ANUAL') NOT NULL DEFAULT 'MENSAL'",
        "ALTER TABLE `recurring_tasks` ADD COLUMN `competenciaOffset` int NOT NULL DEFAULT 1",
        "ALTER TABLE `recurring_tasks` ADD COLUMN `annualMonth` int NULL",
        "ALTER TABLE `task_templates` ADD COLUMN `sendToClient` boolean NOT NULL DEFAULT true",
        "ALTER TABLE `recurring_tasks` ADD COLUMN `sendToClient` boolean NOT NULL DEFAULT true",
        "ALTER TABLE `tasks` ADD COLUMN `sendToClient` boolean NOT NULL DEFAULT true",
        "CREATE TABLE IF NOT EXISTS `calendar_events` (`id` int AUTO_INCREMENT NOT NULL, `ownerId` int NOT NULL, `title` varchar(255) NOT NULL, `description` text, `location` varchar(255), `startAt` timestamp NOT NULL, `endAt` timestamp NOT NULL, `allDay` boolean NOT NULL DEFAULT false, `color` varchar(20) NOT NULL DEFAULT '#24646c', `googleEventId` varchar(255), `createdAt` timestamp NOT NULL DEFAULT (now()), `updatedAt` timestamp NOT NULL DEFAULT (now()), CONSTRAINT `calendar_events_id` PRIMARY KEY(`id`))",
        "CREATE TABLE IF NOT EXISTS `calendar_event_guests` (`id` int AUTO_INCREMENT NOT NULL, `eventId` int NOT NULL, `userId` int NOT NULL, `status` enum('PENDENTE','ACEITO','RECUSADO') NOT NULL DEFAULT 'PENDENTE', `createdAt` timestamp NOT NULL DEFAULT (now()), CONSTRAINT `calendar_event_guests_id` PRIMARY KEY(`id`))",
        "CREATE TABLE IF NOT EXISTS `google_calendar_tokens` (`id` int AUTO_INCREMENT NOT NULL, `userId` int NOT NULL, `accessToken` text, `refreshToken` text, `expiryDate` timestamp NULL, `connected` boolean NOT NULL DEFAULT false, `createdAt` timestamp NOT NULL DEFAULT (now()), `updatedAt` timestamp NOT NULL DEFAULT (now()), CONSTRAINT `google_calendar_tokens_id` PRIMARY KEY(`id`), CONSTRAINT `google_calendar_tokens_userId_unique` UNIQUE(`userId`))",
        "CREATE TABLE IF NOT EXISTS `user_modules` (`id` int AUTO_INCREMENT NOT NULL, `userId` int NOT NULL, `module` varchar(40) NOT NULL, `level` varchar(40) NOT NULL DEFAULT 'colaborador', `createdAt` timestamp NOT NULL DEFAULT (now()), CONSTRAINT `user_modules_id` PRIMARY KEY(`id`))",
        "CREATE TABLE IF NOT EXISTS `proposals` (`id` int AUTO_INCREMENT NOT NULL, `ownerId` int NOT NULL, `title` varchar(255) NOT NULL, `clientName` varchar(255), `data` text NOT NULL, `status` enum('RASCUNHO','ENVIADA','ACEITA','RECUSADA') NOT NULL DEFAULT 'RASCUNHO', `createdAt` timestamp NOT NULL DEFAULT (now()), `updatedAt` timestamp NOT NULL DEFAULT (now()), CONSTRAINT `proposals_id` PRIMARY KEY(`id`))",
      ];

      const results: string[] = [];
      for (const stmt of createStatements) {
        try { await conn.query(stmt); results.push("\u2713 tabela criada"); }
        catch (err: any) { results.push(`\u2717 ${err.message?.slice(0, 120)}`); }
      }

      // Normalizar emails existentes para minúsculas (corrige logins que não
      // encontravam o usuário por diferença de maiúsculas/minúsculas)
      try {
        const [normResult]: any = await conn.query(
          "UPDATE users SET email = LOWER(TRIM(email)) WHERE email != LOWER(TRIM(email))"
        );
        results.push(`\u2713 ${normResult.affectedRows ?? 0} email(s) normalizado(s)`);
      } catch (err: any) {
        results.push(`\u2717 normalização de emails: ${err.message?.slice(0, 100)}`);
      }

      // Migração dos módulos: usuários da equipe que ainda não têm módulos
      // atribuídos recebem o padrão conforme o role:
      //   admin       → todos os módulos como admin
      //   colaborador → só o módulo Tarefas como colaborador
      // (usuários-cliente não entram aqui — eles acessam via portal do cliente)
      try {
        const [teamUsers]: any = await conn.query(
          "SELECT id, role FROM users WHERE role IN ('admin', 'user')"
        );
        let modulesCreated = 0;
        for (const u of teamUsers as any[]) {
          const [existing]: any = await conn.query(
            "SELECT COUNT(*) as cnt FROM user_modules WHERE userId = ?", [u.id]
          );
          if (existing[0].cnt > 0) continue; // já tem módulos, não mexe

          if (u.role === "admin") {
            // Admin ganha todos os módulos como admin
            await conn.query(
              "INSERT INTO user_modules (userId, module, level) VALUES (?, 'tarefas', 'admin'), (?, 'propostas', 'admin'), (?, 'whatsapp', 'admin')",
              [u.id, u.id, u.id]
            );
            modulesCreated += 3;
          } else {
            // Colaborador ganha só Tarefas como colaborador
            await conn.query(
              "INSERT INTO user_modules (userId, module, level) VALUES (?, 'tarefas', 'colaborador')",
              [u.id]
            );
            modulesCreated += 1;
          }
        }
        results.push(`\u2713 ${modulesCreated} vínculo(s) de módulo criado(s) na migração`);
      } catch (err: any) {
        results.push(`\u2717 migração de módulos: ${err.message?.slice(0, 100)}`);
      }

      // Criar usuário admin se email/senha fornecidos
      let adminMsg = "Admin não criado (forneça email e password)";
      const email = (req.query.email as string) || (req.body && req.body.email);
      const password = (req.query.password as string) || (req.body && req.body.password);
      const name = (req.query.name as string) || (req.body && req.body.name) || "Administrador";

      if (email && password) {
        try {
          const bcrypt = await import("bcryptjs");
          const hash = await bcrypt.default.hash(password, 10);
          const [existing] = await conn.query("SELECT id FROM users WHERE email = ?", [email]) as [any[], any];
          if (existing.length > 0) {
            await conn.query("UPDATE users SET passwordHash = ?, role = 'admin', name = ? WHERE email = ?", [hash, name, email]);
            adminMsg = `Admin atualizado: ${email}`;
          } else {
            await conn.query(
              "INSERT INTO users (email, name, passwordHash, loginMethod, role) VALUES (?, ?, ?, 'local', 'admin')",
              [email, name, hash]
            );
            adminMsg = `Admin criado: ${email}`;
          }
        } catch (err: any) {
          adminMsg = `Erro ao criar admin: ${err.message?.slice(0, 120)}`;
        }
      }

      await conn.end();
      res.json({ success: true, tables: createStatements.length, results, admin: adminMsg });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // ── Restaurar dados de backup ─────────────────────────────────────────────
  // Recebe SQL (INSERTs) no corpo e executa no banco. Limpa as tabelas antes.
  // POST /admin/restore  body: { secret, sql, truncate: true }
  app.post("/admin/restore", async (req, res) => {
    const secret = process.env.MIGRATE_SECRET || "equilibrium-migrate-2024";
    const provided = req.headers["x-migrate-secret"] || req.query.secret || (req.body && req.body.secret);
    if (provided !== secret) return res.status(403).json({ error: "Forbidden" });

    const sql: string = req.body && req.body.sql;
    if (!sql || typeof sql !== "string") {
      return res.status(400).json({ error: "Forneça o SQL no campo 'sql' do body" });
    }

    try {
      const mysql = await import("mysql2/promise");
      const conn = await mysql.default.createConnection({
        uri: process.env.DATABASE_URL!,
        multipleStatements: false,
      });

      // Desabilitar checagem de FK durante a restauração
      await conn.query("SET FOREIGN_KEY_CHECKS = 0");

      // Limpar tabelas antes (na ordem inversa de dependência) se truncate=true
      const results: string[] = [];
      if (req.body.truncate) {
        const tablesToClear = [
          "email_logs", "activity_logs", "task_files", "tasks",
          "recurring_tasks", "client_task_templates", "catalog_templates",
          "task_templates", "task_catalogs", "clients", "users"
        ];
        for (const t of tablesToClear) {
          try { await conn.query(`TRUNCATE TABLE \`${t}\``); results.push(`🗑 ${t} limpa`); }
          catch (err: any) { results.push(`⚠ truncate ${t}: ${err.message?.slice(0,60)}`); }
        }
      }

      // Separar os INSERTs por linha (cada um termina com ; e quebra de linha)
      // Cada statement está em uma linha própria no nosso arquivo
      const statements = sql.split(/;\s*\n/).map(s => s.trim()).filter(s => s.length > 5);

      let ok = 0, fail = 0;
      for (const stmt of statements) {
        try {
          await conn.query(stmt);
          ok++;
        } catch (err: any) {
          fail++;
          const table = (stmt.match(/INSERT INTO `(\w+)`/) || [])[1] || "?";
          results.push(`✗ ${table}: ${err.message?.slice(0, 120)}`);
        }
      }

      await conn.query("SET FOREIGN_KEY_CHECKS = 1");
      await conn.end();

      res.json({ success: true, executados: ok, falhas: fail, results });
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

  // ── Diagnóstico de login de um usuário (sem expor senha) ──────────────────
  // Uso: GET /admin/diag-user?secret=...&email=fulano@x.com[&pw=senhaTeste]
  // Diz se o email existe, se o hash é bcrypt e (se pw for passado) se a senha bate.
  app.get("/admin/diag-user", async (req, res) => {
    const secret = process.env.MIGRATE_SECRET || "equilibrium-migrate-2024";
    if (req.headers["x-migrate-secret"] !== secret && req.query.secret !== secret) {
      return res.status(403).json({ error: "Forbidden" });
    }
    try {
      const emailRaw = String(req.query.email || "");
      const emailNorm = emailRaw.trim().toLowerCase();
      const { getPool } = await import("../db");
      const pool = getPool();

      // Busca tanto pelo email exato quanto normalizado, para detectar divergência
      const [rows]: any = await pool.query(
        "SELECT id, email, name, role, clientId, passwordHash FROM users WHERE LOWER(TRIM(email)) = ? OR email = ?",
        [emailNorm, emailRaw]
      );

      if (!rows || rows.length === 0) {
        // Lista emails parecidos para ajudar a achar erro de digitação
        const [similar]: any = await pool.query(
          "SELECT email, role FROM users WHERE email LIKE ? LIMIT 10",
          [`%${emailNorm.split("@")[0].slice(0, 5)}%`]
        );
        return res.json({
          found: false,
          searchedFor: { raw: emailRaw, normalized: emailNorm },
          hint: "Nenhum usuário com esse email. Veja se algum destes parecidos é o certo:",
          similarEmails: (similar || []).map((s: any) => ({ email: s.email, role: s.role })),
        });
      }

      const bcryptjs = (await import("bcryptjs")).default;
      const report = await Promise.all(rows.map(async (u: any) => {
        const hash = u.passwordHash || "";
        const isBcrypt = hash.startsWith("$2b$") || hash.startsWith("$2a$");
        const emailMatchesNormalized = u.email === emailNorm;
        let passwordMatches: boolean | null = null;
        const pw = req.query.pw ? String(req.query.pw) : null;
        if (pw && isBcrypt) {
          try { passwordMatches = await bcryptjs.compare(pw, hash); } catch { passwordMatches = null; }
        }
        return {
          id: u.id,
          emailStored: u.email,
          emailIsNormalized: emailMatchesNormalized,
          role: u.role,
          clientId: u.clientId,
          hasPassword: !!hash,
          hashType: isBcrypt ? "bcrypt ✓" : (hash ? "LEGADO não-bcrypt ✗" : "SEM HASH ✗"),
          passwordTest: pw ? (passwordMatches === true ? "SENHA CONFERE ✓" : passwordMatches === false ? "senha NÃO confere ✗" : "não testável") : "não testada (passe &pw=)",
        };
      }));

      return res.json({ found: true, count: rows.length, users: report });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message });
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

// ── Agendador automático ──────────────────────────────────────────────────────
// Roda após o servidor iniciar, sem bloquear o startup

// ── Agendador automático em horário fixo ─────────────────────────────────────
// Roda no início de cada hora cheia: 08:00, 09:00, 10:00...
// Não usa setInterval de 1h (que derivaria) — recalcula sempre o próximo :00

async function runScheduledJobs() {
  console.log(`[Scheduler] Iniciando ciclo — ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`);

  // 1. Marcar tarefas vencidas
  try {
    const { markOverdueTasks } = await import("../db");
    const count = await markOverdueTasks();
    if (count > 0) console.log(`[Scheduler] ${count} tarefa(s) marcada(s) como VENCIDA`);
  } catch (err) {
    console.warn("[Scheduler] markOverdue error:", err);
  }

  // 2. Disparar e-mails de guias pendentes de envio
  try {
    const { autoSendPendingGuias } = await import("../autoSend");
    const result = await autoSendPendingGuias();
    if (result.sent > 0 || result.failed > 0) {
      console.log(`[Scheduler] AutoSend: ${result.sent} enviada(s), ${result.failed} falha(s)`);
    }
  } catch (err) {
    console.warn("[Scheduler] autoSend error:", err);
  }

  // 3. Geração automática: mantém 3 meses de tarefas geradas à frente
  // Quando vira o mês, o próximo mês de competência é gerado sozinho.
  try {
    const { ensureUpcomingTasksGenerated } = await import("../taskGenerator");
    await ensureUpcomingTasksGenerated(3);
  } catch (err) {
    console.warn("[Scheduler] autoGen error:", err);
  }
}

function scheduleNextHour() {
  const now = new Date();
  // Calcula quantos ms faltam para a próxima hora cheia (xx:00:00)
  const msUntilNextHour =
    (60 - now.getMinutes()) * 60 * 1000
    - now.getSeconds() * 1000
    - now.getMilliseconds();

  console.log(
    `[Scheduler] Próximo ciclo em ${Math.round(msUntilNextHour / 60000)} min ` +
    `(${new Date(Date.now() + msUntilNextHour).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })})`
  );

  setTimeout(async () => {
    await runScheduledJobs();
    scheduleNextHour(); // agenda o próximo
  }, msUntilNextHour);
}

// Roda imediatamente ao iniciar (marca vencidas sem esperar)
runScheduledJobs();

// Agenda o ciclo em horário fixo (próxima hora cheia)
scheduleNextHour();

// ── Keep-alive do banco ───────────────────────────────────────────────────────
// O Aiven free desliga o banco por inatividade. Para evitar isso, fazemos um
// ping leve (SELECT 1) a cada 4 minutos, mantendo conexões constantes.
// Isso complementa o UptimeRobot apontado para /health/db.
setInterval(async () => {
  try {
    const { checkDbHealth } = await import("../db");
    const result = await checkDbHealth();
    if (!result.ok) {
      console.warn("[KeepAlive] Banco não respondeu:", result.error);
    }
  } catch (err) {
    console.warn("[KeepAlive] Erro no ping do banco:", err);
  }
}, 4 * 60 * 1000); // a cada 4 minutos
