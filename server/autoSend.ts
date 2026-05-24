import { getPool } from "./db";
import { sendEmail, buildGuiaEmailHtml } from "./email";
import { storageGetBuffer } from "./storage";

/**
 * Envia automaticamente guias que têm arquivo anexado mas nunca foram enviadas por e-mail.
 * Executado a cada 1 hora pelo scheduler em index.ts
 */
export async function autoSendPendingGuias(): Promise<{
  sent: number;
  failed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let sent = 0;
  let failed = 0;

  try {
    const pool = getPool();

    // Tarefas com arquivo mas sem e-mail enviado
    const [rows] = await pool.query(`
      SELECT 
        t.id, t.title, t.taskType, t.competencia, t.dueDate, t.status, t.notes,
        t.clientId,
        c.name as clientName, c.email as clientEmail, c.phone as clientPhone,
        f.id as fileId, f.filename, f.fileKey, f.fileUrl, f.mimeType
      FROM tasks t
      INNER JOIN task_files f ON f.taskId = t.id
      INNER JOIN clients c ON c.id = t.clientId
      WHERE t.status NOT IN ('CANCELADA', 'CONCLUIDA')
        AND c.active = 1
        AND c.email IS NOT NULL AND c.email != ''
        AND (
          SELECT COUNT(*) FROM email_logs el 
          WHERE el.taskId = t.id AND el.status = 'ENVIADO'
        ) = 0
      ORDER BY t.dueDate ASC
      LIMIT 50
    `) as [any[], any];

    for (const row of rows) {
      try {
        // Carregar arquivo do storage
        const buf = await storageGetBuffer(row.fileKey, row.fileUrl);
        if (!buf) {
          errors.push(`Tarefa ${row.id}: arquivo não encontrado no storage`);
          failed++;
          continue;
        }

        const subject = `Guia ${row.taskType} — Competência ${row.competencia} | Equilibrium Consultoria`;
        const html = buildGuiaEmailHtml({
          clientName: row.clientName,
          taskTitle: row.title,
          competencia: row.competencia,
          dueDate: new Date(row.dueDate),
          notes: row.notes ?? undefined,
        });

        await sendEmail({
          to: row.clientEmail,
          subject,
          html,
          attachments: [{
            filename: row.filename,
            content: buf,
            contentType: row.mimeType || "application/pdf",
          }],
        });

        // Registrar envio no log
        await pool.query(
          `INSERT INTO email_logs (taskId, clientId, taskFileId, recipientEmail, subject, body, status, sentAt, sentBy)
           VALUES (?, ?, ?, ?, ?, ?, 'ENVIADO', NOW(), NULL)`,
          [row.id, row.clientId, row.fileId, row.clientEmail, subject, html]
        );

        // Marcar como CONCLUIDA
        await pool.query(
          `UPDATE tasks SET status = 'CONCLUIDA', completedAt = NOW() WHERE id = ?`,
          [row.id]
        );

        console.log(`[AutoSend] ✓ Tarefa ${row.id} (${row.title}) enviada para ${row.clientEmail}`);
        sent++;
      } catch (err: any) {
        const msg = err?.message ?? String(err);
        errors.push(`Tarefa ${row.id}: ${msg}`);
        console.error(`[AutoSend] ✗ Tarefa ${row.id}:`, msg);

        // Registrar falha no log
        try {
          await pool.query(
            `INSERT INTO email_logs (taskId, clientId, taskFileId, recipientEmail, subject, body, status, errorMessage, sentAt, sentBy)
             VALUES (?, ?, ?, ?, ?, '', 'FALHOU', ?, NOW(), NULL)`,
            [row.id, row.clientId, row.fileId, row.clientEmail,
             `Guia ${row.taskType} — ${row.competencia}`, msg]
          );
        } catch {}

        failed++;
      }
    }

    console.log(`[AutoSend] Concluído: ${sent} enviadas, ${failed} falhas`);
    return { sent, failed, errors };
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error("[AutoSend] Erro fatal:", msg);
    return { sent: 0, failed: 0, errors: [msg] };
  }
}

/**
 * Envia alertas internos de tarefas vencendo em 3 dias
 */
export async function sendDueSoonAlerts(): Promise<{ sent: number; errors: string[] }> {
  const errors: string[] = [];
  let sent = 0;

  try {
    const pool = getPool();
    const alertEmail = process.env.SMTP_USER || process.env.RESEND_FROM;
    if (!alertEmail) return { sent: 0, errors: ["E-mail de alerta não configurado"] };

    const [rows] = await pool.query(`
      SELECT t.id, t.title, t.taskType, t.competencia, t.dueDate,
             c.name as clientName, c.cnpj
      FROM tasks t
      INNER JOIN clients c ON c.id = t.clientId
      WHERE t.status IN ('PENDENTE', 'EM_ANDAMENTO')
        AND t.dueDate BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 3 DAY)
        AND (
          SELECT COUNT(*) FROM email_logs el
          WHERE el.taskId = t.id AND el.status = 'ENVIADO'
            AND el.sentAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        ) = 0
      ORDER BY t.dueDate ASC
      LIMIT 50
    `) as [any[], any];

    if (rows.length === 0) return { sent: 0, errors: [] };

    const taskList = rows.map((r: any) =>
      `• ${r.clientName} (${r.cnpj}) — ${r.title} [${r.competencia}] vence ${new Date(r.dueDate).toLocaleDateString("pt-BR")}`
    ).join("\n");

    await sendEmail({
      to: alertEmail,
      subject: `⚠️ ${rows.length} guia(s) vencendo nos próximos 3 dias`,
      html: `<h2>Guias vencendo em breve</h2><pre style="font-family:monospace">${taskList}</pre>`,
    });

    sent = 1;
  } catch (err: any) {
    errors.push(err?.message ?? String(err));
  }

  return { sent, errors };
}
