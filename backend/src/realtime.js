import crypto from 'crypto';
import { Server } from 'socket.io';
import { config } from './config.js';
import { verifyToken } from './middleware/auth.js';
import { Booking } from './models/Booking.js';
import { User } from './models/User.js';
import { notify } from './services/notify.js';
import { BOOKING_STATUS as S } from './constants.js';

let io = null;

// Active calls: callId -> { from, to, bookingId, accepted, createdAt }. Only signalling lives here; audio is peer-to-peer.
const calls = new Map();
const CALL_TTL_MS = 3 * 60 * 60 * 1000;
const RING_TTL_MS = 60 * 1000;

setInterval(() => {
  const cutoff = Date.now() - CALL_TTL_MS;
  for (const [id, c] of calls) if (c.createdAt < cutoff) calls.delete(id);
}, 10 * 60 * 1000).unref();

const peerOf = (call, userId) => (call.from === userId ? call.to : call.to === userId ? call.from : null);

export function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: config.corsOrigins.includes('*') ? true : config.corsOrigins },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      socket.userId = verifyToken(token).sub;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const me = String(socket.userId);
    socket.join(`user:${me}`);

    // Calling is limited to the two people in an active booking.
    socket.on('call:invite', async ({ bookingId } = {}, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        const booking = await Booking.findById(bookingId);
        if (!booking || ![S.CONFIRMED, S.IN_PROGRESS].includes(booking.status)) return reply({ ok: false, error: 'Booking is not active' });
        const client = String(booking.client);
        const provider = String(booking.provider);
        if (![client, provider].includes(me)) return reply({ ok: false, error: 'Not allowed' });
        const to = me === client ? provider : client;
        for (const [id, c] of calls) {
          if (!c.accepted && Date.now() - c.createdAt > RING_TTL_MS) {
            calls.delete(id);
            continue;
          }
          if ([c.from, c.to].some((u) => [me, to].includes(u))) return reply({ ok: false, error: 'A call is already in progress' });
        }
        const callId = crypto.randomUUID();
        calls.set(callId, { from: me, to, bookingId: String(booking._id), accepted: false, createdAt: Date.now() });
        const caller = await User.findById(me).select('name avatar');
        const online = (await io.in(`user:${to}`).fetchSockets()).length > 0;
        io.to(`user:${to}`).emit('call:incoming', { callId, bookingId: String(booking._id), from: { id: me, name: caller.name, avatar: caller.avatar } });
        if (!online) {
          notify(to, { type: 'call', title: 'Incoming call', body: `${caller.name} is calling you on SkillConnect`, data: { bookingId: String(booking._id) }, store: false }).catch(() => {});
        }
        reply({ ok: true, callId, delivered: online });
      } catch (e) {
        console.error('call:invite failed', e.message);
        reply({ ok: false, error: 'Could not start the call' });
      }
    });

    const relay = (event, outEvent, { end = false, markAccepted = false } = {}) =>
      socket.on(event, ({ callId, data } = {}) => {
        const call = calls.get(callId);
        const peer = call && peerOf(call, me);
        if (!peer) return;
        if (markAccepted) call.accepted = true;
        io.to(`user:${peer}`).emit(outEvent, { callId, data });
        if (end) calls.delete(callId);
      });

    relay('call:accept', 'call:accepted', { markAccepted: true });
    relay('call:reject', 'call:rejected', { end: true });
    relay('call:end', 'call:ended', { end: true });
    relay('call:signal', 'call:signal');

    socket.on('disconnect', () => {
      for (const [id, c] of calls) {
        const peer = peerOf(c, me);
        if (!peer) continue;
        io.to(`user:${peer}`).emit('call:ended', { callId: id });
        calls.delete(id);
      }
    });
  });

  return io;
}

export function emitToUser(userId, event, payload) {
  if (io) io.to(`user:${String(userId)}`).emit(event, payload);
}
