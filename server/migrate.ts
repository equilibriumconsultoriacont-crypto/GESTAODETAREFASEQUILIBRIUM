/**
 * Script de migração segura para Railway
 * Aplica todas as colunas/tabelas faltantes sem perder dados
 * Executar via: npx tsx server/migrate.ts
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { join } from "path";

async function runMigration() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL não configurado");
    process.exit(1);
  }

  console.log("[Migrate] Conectando ao banco...");
  const conn = await mysql.createConnection({ uri: url, multipleStatements: true });

  try {
    const sqlPath = join(process.cwd(), "drizzle/migrations/fix_all_missing_columns.sql");
    const sql = readFileSync(sqlPath, "utf-8");

    // Separar por statement-breakpoint ou ponto-e-vírgula seguido de newline
    const statements = sql
      .split(/;\s*\n/)
      .map(s => s.trim().replace(/^--.*$/gm, "").trim())
      .filter(s => s.length > 5);

    console.log(`[Migrate] ${statements.length} statements para executar`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (!stmt) continue;
      try {
        await conn.query(stmt);
        console.log(`[Migrate] ✓ Statement ${i + 1}/${statements.length}`);
      } catch (err: any) {
        // Ignorar erros de "já existe" — migration é idempotente
        if (err.code === "ER_DUP_FIELDNAME" || err.code === "ER_TABLE_EXISTS_ERROR" || err.message?.includes("Duplicate column")) {
          console.log(`[Migrate] ⚠ Já existe (ok): ${err.message?.slice(0, 80)}`);
        } else {
          console.error(`[Migrate] ✗ Erro no statement ${i + 1}:`, err.message);
        }
      }
    }

    console.log("[Migrate] ✅ Migração concluída!");
  } finally {
    await conn.end();
  }
}

runMigration().catch(err => {
  console.error("[Migrate] Falha fatal:", err);
  process.exit(1);
});
