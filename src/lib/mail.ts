import nodemailer from "nodemailer";

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: Buffer }[];
}

export interface SendMailResult {
  sent: boolean;
  reason?: string;
}

/**
 * Sends via SMTP if configured (SMTP_HOST/PORT/USER/PASS/FROM env vars).
 * If not configured, this is a no-op that reports why — callers should still
 * record the invoice as "sent" with the recipient/date and let the user
 * download the PDF to send manually.
 */
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return { sent: false, reason: "SMTP is not configured (set SMTP_HOST/SMTP_USER/SMTP_PASS env vars)." };
  }

  try {
    const transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT ? parseInt(SMTP_PORT, 10) : 587,
      secure: SMTP_PORT === "465",
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transport.sendMail({
      from: SMTP_FROM || SMTP_USER,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments,
    });

    return { sent: true };
  } catch (err: any) {
    return { sent: false, reason: String(err?.message || err) };
  }
}
