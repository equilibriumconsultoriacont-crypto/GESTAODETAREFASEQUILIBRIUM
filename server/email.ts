import nodemailer from "nodemailer";

export interface SendEmailOptions {
  to: string;
  cc?: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content?: Buffer;
    path?: string;
    contentType?: string;
  }>;
}

async function resolveIPv4(hostname: string): Promise<string> {
  const dns = await import("dns/promises");
  try {
    const addresses = await dns.resolve4(hostname);
    if (addresses.length > 0) return addresses[0]!;
  } catch {}
  return hostname;
}

async function createTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error("SMTP credentials not configured. Set SMTP_USER and SMTP_PASS.");
  }

  // Resolver IPv4 explicitamente (Railway resolve para IPv6 por padrão)
  const ipv4Host = await resolveIPv4(host);
  console.log(`[SMTP] Conectando: ${host} → ${ipv4Host}:${port}`);

  const secure = port === 465;

  // Tenta portas em ordem: a configurada, depois fallbacks
  const portsToTry = [port];
  if (port === 465) portsToTry.push(587, 25);
  else if (port === 587) portsToTry.push(465, 25);

  let lastError: Error | null = null;
  for (const tryPort of portsToTry) {
    try {
      const transport = nodemailer.createTransport({
        host: ipv4Host,
        port: tryPort,
        secure: tryPort === 465,
        auth: { user, pass },
        tls: { rejectUnauthorized: false, servername: host },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });
      await transport.verify();
      console.log(`[SMTP] Conectado com sucesso na porta ${tryPort}`);
      return transport;
    } catch (err: any) {
      console.warn(`[SMTP] Porta ${tryPort} falhou: ${err.message}`);
      lastError = err;
    }
  }
  throw lastError ?? new Error("SMTP: todas as portas falharam");
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const transporter = await createTransporter();
  const fromName = process.env.SMTP_FROM_NAME || "Equilibrium Consultoria";
  const fromEmail = process.env.SMTP_USER || "";

  // CC apenas se explicitamente configurado via env ou passado como opção
  const ccEmail = options.cc ?? process.env.SMTP_CC_EMAIL;
  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: options.to,
    cc: ccEmail && ccEmail !== options.to ? ccEmail : undefined,
    subject: options.subject,
    html: options.html,
    attachments: options.attachments,
  });
}

export function buildGuiaEmailHtml(params: {
  clientName: string;
  taskTitle: string;
  competencia: string;
  dueDate: Date;
  notes?: string;
}): string {
  const dueDateStr = params.dueDate.toLocaleDateString("pt-BR");
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #24646c; padding: 28px 32px; }
    .header h1 { color: #fff; margin: 0; font-size: 22px; }
    .header p { color: #c5e4ea; margin: 4px 0 0; font-size: 14px; }
    .body { padding: 28px 32px; color: #333; }
    .body h2 { color: #24646c; font-size: 18px; margin-top: 0; }
    .info-box { background: #f0f9fa; border-left: 4px solid #24646c; padding: 14px 18px; border-radius: 4px; margin: 18px 0; }
    .info-box p { margin: 4px 0; font-size: 14px; }
    .info-box strong { color: #1c444c; }
    .footer { background: #f0f9fa; padding: 18px 32px; text-align: center; font-size: 12px; color: #888; }
    .footer a { color: #24646c; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Equilibrium Consultoria</h1>
      <p>Gestão Contábil e Fiscal</p>
    </div>
    <div class="body">
      <h2>Olá, ${params.clientName}!</h2>
      <p>Segue em anexo a guia referente à obrigação fiscal abaixo:</p>
      <div class="info-box">
        <p><strong>Obrigação:</strong> ${params.taskTitle}</p>
        <p><strong>Competência:</strong> ${params.competencia}</p>
        <p><strong>Vencimento:</strong> ${dueDateStr}</p>
        ${params.notes ? `<p><strong>Observações:</strong> ${params.notes}</p>` : ""}
      </div>
      <p>Por favor, efetue o pagamento até a data de vencimento para evitar multas e juros.</p>
      <p>Em caso de dúvidas, entre em contato com nosso escritório.</p>
      <p>Atenciosamente,<br/><strong>Equipe Equilibrium Consultoria</strong></p>
    </div>
    <div class="footer">
      <p>Este e-mail foi enviado automaticamente pelo sistema de gestão do escritório Equilibrium.</p>
      <p>Contato: <a href="mailto:equilibriumconsultoria.cont@gmail.com">equilibriumconsultoria.cont@gmail.com</a></p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function buildAlertEmailHtml(params: {
  tasks: Array<{ title: string; clientName: string; competencia: string; dueDate: Date; status: string }>;
  type: "vencendo" | "vencida";
}): string {
  const title = params.type === "vencendo" ? "⚠️ Tarefas Próximas do Vencimento" : "🚨 Tarefas Vencidas Sem Conclusão";
  const color = params.type === "vencendo" ? "#e6a817" : "#dc2626";
  const rows = params.tasks
    .map(
      (t) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${t.clientName}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${t.title}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${t.competencia}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:${color};font-weight:bold;">${t.dueDate.toLocaleDateString("pt-BR")}</td>
    </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8" />
<style>
  body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
  .container { max-width: 700px; margin: 30px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
  .header { background: #24646c; padding: 24px 32px; }
  .header h1 { color: #fff; margin: 0; font-size: 20px; }
  .body { padding: 24px 32px; color: #333; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th { background: #24646c; color: #fff; padding: 10px 12px; text-align: left; }
  .footer { background: #f0f9fa; padding: 16px 32px; text-align: center; font-size: 12px; color: #888; }
</style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>${title}</h1></div>
    <div class="body">
      <p>As seguintes tarefas requerem atenção imediata:</p>
      <table>
        <thead><tr><th>Cliente</th><th>Tarefa</th><th>Competência</th><th>Vencimento</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:20px;">Acesse o sistema para tomar as ações necessárias.</p>
    </div>
    <div class="footer"><p>Equilibrium Consultoria — Sistema de Gestão de Tarefas</p></div>
  </div>
</body>
</html>
  `.trim();
}
