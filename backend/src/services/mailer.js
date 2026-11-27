import nodemailer from 'nodemailer';
import { config } from '../config.js';

const transport = config.emailEnabled
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  : null;

// Returns true when a real email was sent; without SMTP the message is only logged (development).
export async function sendMail({ to, subject, text }) {
  if (!transport) {
    if (!config.isProd) console.log(`[mail disabled] to=${to} subject="${subject}"\n${text}`);
    return false;
  }
  await transport.sendMail({ from: config.smtp.from, to, subject, text });
  return true;
}
