import { createTransport } from 'nodemailer';

// Real delivery over SMTP (any provider: Gmail/Google Workspace, Microsoft 365,
// Zoho, cPanel/hosting mailboxes, SendGrid/Mailgun/Brevo SMTP relays…).
// Configured entirely from environment variables — see .env.example.

let transporter = null;

function smtpConfig() {
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
  const missing = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'].filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`SMTP is not configured. Missing: ${missing.join(', ')}`);
  return {
    host: process.env.SMTP_HOST,
    port,
    // secure=true: TLS from the first byte (port 465). secure=false: STARTTLS
    // upgrade (port 587), which requireTLS makes mandatory.
    secure,
    requireTLS: !secure && process.env.SMTP_REQUIRE_TLS !== 'false',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    pool: process.env.VERCEL ? false : true,
    maxConnections: 3,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 30000
  };
}

function getTransporter() {
  transporter ??= createTransport(smtpConfig());
  return transporter;
}

export async function send({ from, replyTo, to, subject, html, text, attachments }) {
  const info = await getTransporter().sendMail({ from, replyTo, to, subject, html, text, attachments });
  return { success: true, provider: 'smtp', messageId: info.messageId, accepted: info.accepted, rejected: info.rejected };
}

// Opens a connection and authenticates without sending anything.
export async function verify() {
  await getTransporter().verify();
  return { success: true };
}
