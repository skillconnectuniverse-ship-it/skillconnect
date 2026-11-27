import { config } from '../config.js';

// Twilio REST (no SDK). Without credentials the message is only logged in development.
export async function sendSms(to, body) {
  if (!config.smsEnabled) {
    if (!config.isProd) console.log(`[sms disabled] to=${to}: ${body}`);
    return false;
  }
  const { sid, token, from } = config.twilio;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  if (!res.ok) throw new Error(`SMS provider error ${res.status}`);
  return true;
}
