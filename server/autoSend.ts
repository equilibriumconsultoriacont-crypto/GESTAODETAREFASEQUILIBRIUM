import { getPool } from "./db";
import { sendEmail, buildGuiaEmailHtml } from "./email";
import { storageGetBuffer } from "./storage";

/**
 * Envia automaticamente arquivos de guia que ainda não foram enviados por e-mail.
 * 
 * LÓGICA: verifica arquivo por arquivo (taskFileId).
 * Se um arquivo específico nunca foi enviado com sucesso (sem email_log
 * com aquele taskFileId + status ENVIADO), ele é incluído no disparo.
 * 
 * Isso garante que:
 * - Um e-mail de teste enviado SEM arquivo não bloqueia o envio da guia
 * - Cada arquivo é enviado exatamente uma vez
 * - Se houver múltiplos arquivos em uma tarefa, cada um é enviado
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

    // Buscar arquivos não enviados (por taskFileId, não por taskId)
    const [rows] = await pool.query(`
      SELECT 
        f.id as fileId, f.filename, f.fileKey, f.fileUrl, f.mimeType,
        t.id as taskId, t.title, t.taskType, t.competencia, t.dueDate, t.status, t.notes,
        t.clientId,
        c.name as clientName, c.email as clientEmail, c.phone as clientPhone
      FROM task_files f
      INNER JOIN tasks t ON t.id = f.taskId
      INNER JOIN clients c ON c.id = t.clientId
      WHERE t.status NOT IN ('CANCELADA')
        AND t.sendToClient = 1
        AND c.active = 1
        AND c.email IS NOT NULL AND c.email != ''
        AND NOT EXISTS (
          SELECT 1 FROM email_logs el
          WHERE el.taskFileId = f.id
            AND el.status = 'ENVIADO'
        )
      ORDER BY t.dueDate ASC
      LIMIT 50
    `) as [any[], any];

    for (const row of rows) {
      try {
        // Carregar arquivo do storage
        const buf = await storageGetBuffer(row.fileKey, row.fileUrl);
        if (!buf) {
          errors.push(`Arquivo ${row.fileId} (tarefa ${row.taskId}): não encontrado no storage`);
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

        // Registrar envio no log com taskFileId
        await pool.query(
          `INSERT INTO email_logs (taskId, clientId, taskFileId, recipientEmail, subject, body, status, sentAt, sentBy)
           VALUES (?, ?, ?, ?, ?, ?, 'ENVIADO', NOW(), NULL)`,
          [row.taskId, row.clientId, row.fileId, row.clientEmail, subject, html]
        );

        // Marcar tarefa como CONCLUIDA
        await pool.query(
          `UPDATE tasks SET status = 'CONCLUIDA', completedAt = NOW() 
           WHERE id = ? AND status NOT IN ('CANCELADA', 'CONCLUIDA')`,
          [row.taskId]
        );

        console.log(`[AutoSend] ✓ Arquivo ${row.fileId} (${row.filename}) → ${row.clientEmail}`);
        sent++;
      } catch (err: any) {
        const msg = err?.message ?? String(err);
        errors.push(`Arquivo ${row.fileId}: ${msg}`);
        console.error(`[AutoSend] ✗ Arquivo ${row.fileId}:`, msg);

        // Registrar falha com taskFileId para não tentar novamente até corrigir
        try {
          await pool.query(
            `INSERT INTO email_logs (taskId, clientId, taskFileId, recipientEmail, subject, body, status, errorMessage, sentAt, sentBy)
             VALUES (?, ?, ?, ?, ?, '', 'FALHOU', ?, NOW(), NULL)`,
            [row.taskId, row.clientId, row.fileId, row.clientEmail,
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
 * Envia alertas internos de tarefas vencendo nos próximos 3 dias
 */
export async function sendDueSoonAlerts(): Promise<{ sent: number; errors: string[] }> {
  const errors: string[] = [];
  let sent = 0;

  try {
    const pool = getPool();
    const alertEmail = process.env.RESEND_FROM || process.env.SMTP_USER;
    if (!alertEmail) return { sent: 0, errors: ["E-mail de alerta não configurado"] };

    const [rows] = await pool.query(`
      SELECT t.id, t.title, t.taskType, t.competencia, t.dueDate,
             c.name as clientName, c.cnpj
      FROM tasks t
      INNER JOIN clients c ON c.id = t.clientId
      WHERE t.status IN ('PENDENTE', 'EM_ANDAMENTO')
        AND t.dueDate BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 3 DAY)
        AND NOT EXISTS (
          SELECT 1 FROM email_logs el
          WHERE el.taskId = t.id 
            AND el.status = 'ENVIADO'
            AND el.sentAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        )
      ORDER BY t.dueDate ASC
      LIMIT 50
    `) as [any[], any];

    if (rows.length === 0) return { sent: 0, errors: [] };

    const taskList = (rows as any[]).map((r: any) =>
      `• ${r.clientName} — ${r.title} [${r.competencia}] vence ${new Date(r.dueDate).toLocaleDateString("pt-BR")}`
    ).join("\n");

    await sendEmail({
      to: alertEmail,
      subject: `⚠️ ${rows.length} guia(s) vencendo nos próximos 3 dias`,
      html: `<h2 style="color:#e74c3c">Guias vencendo em breve</h2><pre style="font-family:monospace;font-size:13px">${taskList}</pre>`,
    });

    sent = 1;
  } catch (err: any) {
    errors.push(err?.message ?? String(err));
  }

  return { sent, errors };
}
