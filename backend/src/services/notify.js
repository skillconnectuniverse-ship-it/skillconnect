import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { emitToUser } from '../realtime.js';

async function sendExpoPush(token, title, body, data) {
  if (!token || !token.startsWith('ExponentPushToken')) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: token, title, body, data, sound: 'default' }),
    });
  } catch (err) {
    console.error('push failed', err.message);
  }
}

// Stores an in-app notification (unless store=false), emits it over the socket and pushes to the device.
export async function notify(userId, { type = 'info', title, body = '', data = {}, store = true }) {
  let doc = null;
  if (store) {
    doc = await Notification.create({ user: userId, type, title, body, data });
    emitToUser(userId, 'notification', { id: String(doc._id), type, title, body, data, createdAt: doc.createdAt });
  }
  const user = await User.findById(userId).select('+pushToken');
  await sendExpoPush(user?.pushToken, title, body, { ...data, type });
  return doc;
}
