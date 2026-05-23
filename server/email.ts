import nodemailer from "nodemailer";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  cc?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
}

// ── Envio via Resend API (HTTPS, sem bloqueio de firewall) ─────────────────
async function sendViaResend(options: SendEmailOptions): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY!;
  const fromEmail = process.env.RESEND_FROM || `contato@equilibriumcont.com`;
  const fromName = process.env.SMTP_FROM_NAME || "Equilibrium Consultoria";
  const ccEmail = options.cc ?? process.env.SMTP_CC_EMAIL;

  const body: any = {
    from: `${fromName} <${fromEmail}>`,
    to: [options.to],
    subject: options.subject,
    html: options.html,
  };

  if (ccEmail && ccEmail !== options.to) body.cc = [ccEmail];

  // Anexos em base64
  if (options.attachments?.length) {
    body.attachments = options.attachments.map((a) => ({
      filename: a.filename,
      content: a.content.toString("base64"),
    }));
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`Resend API error ${res.status}: ${JSON.stringify(err)}`);
  }
}

// ── Envio via SMTP (fallback) ──────────────────────────────────────────────
async function resolveIPv4(hostname: string): Promise<string> {
  try {
    const dns = await import("dns/promises");
    const addresses = await dns.resolve4(hostname);
    if (addresses.length > 0) return addresses[0]!;
  } catch {}
  return hostname;
}

async function sendViaSMTP(options: SendEmailOptions): Promise<void> {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromEmail = user || "noreply@example.com";
  const fromName = process.env.SMTP_FROM_NAME || "Equilibrium Consultoria";
  const ccEmail = options.cc ?? process.env.SMTP_CC_EMAIL;

  if (!user || !pass) throw new Error("SMTP credentials not configured");

  const ipv4Host = await resolveIPv4(host);

  for (const tryPort of [port, port === 465 ? 587 : 465]) {
    try {
      const transporter = nodemailer.createTransport({
        host: ipv4Host, port: tryPort, secure: tryPort === 465,
        auth: { user, pass },
        tls: { rejectUnauthorized: false, servername: host },
        connectionTimeout: 10000, greetingTimeout: 10000,
      });
      await transporter.verify();
      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: options.to,
        cc: ccEmail && ccEmail !== options.to ? ccEmail : undefined,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments,
      });
      return;
    } catch {}
  }
  throw new Error("SMTP: todas as portas falharam");
}

// ── Função principal: usa Resend se tiver API key, senão SMTP ─────────────
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  if (process.env.RESEND_API_KEY) {
    console.log(`[Email] Enviando via Resend para ${options.to}`);
    await sendViaResend(options);
  } else {
    console.log(`[Email] Enviando via SMTP para ${options.to}`);
    await sendViaSMTP(options);
  }
}

export function buildGuiaEmailHtml(params: {
  clientName: string;
  taskTitle: string;
  taskType: string;
  competencia: string;
  dueDate: string;
  notes?: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
        <!-- Header -->
        <tr><td style="background:#24646c;padding:28px 32px">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">Equilibrium Consultoria</h1>
          <p style="margin:4px 0 0;color:#9fd4dc;font-size:13px">Gestão Contábil e Tributária</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px">
          <p style="margin:0 0 16px;color:#333;font-size:15px">Olá, <strong>${params.clientName}</strong>!</p>
          <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.6">
            Segue em anexo a guia <strong>${params.taskTitle}</strong> referente à competência <strong>${params.competencia}</strong>.
          </p>
          <table width="100%" cellpadding="12" cellspacing="0" style="background:#f8fafb;border-radius:6px;border:1px solid #e5e7eb;margin-bottom:24px">
            <tr><td style="color:#555;font-size:13px;border-bottom:1px solid #e5e7eb"><strong>Tipo:</strong> ${params.taskType}</td></tr>
            <tr><td style="color:#555;font-size:13px;border-bottom:1px solid #e5e7eb"><strong>Competência:</strong> ${params.competencia}</td></tr>
            <tr><td style="color:#e74c3c;font-size:13px;font-weight:600"><strong>Vencimento:</strong> ${params.dueDate}</td></tr>
          </table>
          ${params.notes ? `<p style="margin:0 0 24px;color:#555;font-size:13px;padding:12px;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:0 4px 4px 0"><strong>Observação:</strong> ${params.notes}</p>` : ""}
          <p style="margin:0;color:#555;font-size:13px;line-height:1.6">
            Em caso de dúvidas, entre em contato conosco pelo e-mail ou WhatsApp.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8fafb;padding:16px 32px;border-top:1px solid #e5e7eb">
          <p style="margin:0;color:#999;font-size:12px;text-align:center">
            Equilibrium Consultoria Contábil • contato@equilibriumcont.com
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildAlertEmailHtml(params: {
  clientName: string;
  taskTitle: string;
  taskType: string;
  competencia: string;
  dueDate: string;
  daysUntilDue: number;
}): string {
  const urgency = params.daysUntilDue <= 1 ? "URGENTE" : params.daysUntilDue <= 3 ? "ATENÇÃO" : "AVISO";
  const color = params.daysUntilDue <= 1 ? "#e74c3c" : params.daysUntilDue <= 3 ? "#f59e0b" : "#24646c";
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
        <tr><td style="background:${color};padding:28px 32px">
          <h1 style="margin:0;color:#ffffff;font-size:20px">${urgency}: Guia vencendo em breve</h1>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="color:#333;font-size:15px">Olá, <strong>${params.clientName}</strong>!</p>
          <p style="color:#555;font-size:14px">A guia <strong>${params.taskTitle}</strong> vence em <strong style="color:${color}">${params.daysUntilDue === 0 ? "HOJE" : `${params.daysUntilDue} dia(s)`}</strong>.</p>
          <table width="100%" cellpadding="10" cellspacing="0" style="background:#f8fafb;border-radius:6px;border:1px solid #e5e7eb">
            <tr><td style="color:#555;font-size:13px"><strong>Competência:</strong> ${params.competencia}</td></tr>
            <tr><td style="color:${color};font-size:13px;font-weight:600"><strong>Vencimento:</strong> ${params.dueDate}</td></tr>
          </table>
        </td></tr>
        <tr><td style="background:#f8fafb;padding:16px 32px;border-top:1px solid #e5e7eb">
          <p style="margin:0;color:#999;font-size:12px;text-align:center">Equilibrium Consultoria Contábil • contato@equilibriumcont.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
