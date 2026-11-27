import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { getSocket, useSocketEvent } from '../realtime';
import { colors } from '../theme';
import { Avatar, Button, showAlert } from '../ui';
import { formatDuration } from '../utils';
import { callsSupported, createEngine } from './engine';
import { Engine, IceServer } from './types';

interface Peer {
  id: string;
  name: string;
  avatar?: string;
}

type Phase = 'ringing' | 'connecting' | 'connected';

interface ActiveCall {
  callId: string;
  bookingId: string;
  peer: Peer;
  direction: 'out' | 'in';
  phase: Phase;
}

interface CallApi {
  supported: boolean;
  startCall: (bookingId: string, peer: Peer) => Promise<void>;
}

const Ctx = createContext<CallApi>({ supported: false, startCall: async () => {} });
export const useCall = () => useContext(Ctx);

const RING_TIMEOUT_MS = 45_000;

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [call, setCall] = useState<ActiveCall | null>(null);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const callRef = useRef<ActiveCall | null>(null);
  const engine = useRef<Engine | null>(null);
  const ice = useRef<IceServer[]>([]);
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = useCallback((next: ActiveCall | null) => {
    callRef.current = next;
    setCall(next);
  }, []);

  const cleanup = useCallback(() => {
    if (ringTimer.current) clearTimeout(ringTimer.current);
    engine.current?.close();
    engine.current = null;
    setMuted(false);
    setSeconds(0);
    update(null);
  }, [update]);

  const makeEngine = useCallback(
    (callId: string, isCaller: boolean) => {
      const e = createEngine({
        iceServers: ice.current,
        isCaller,
        onSignal: (data) => getSocket()?.emit('call:signal', { callId, data }),
        onConnected: () => {
          const c = callRef.current;
          if (c && c.callId === callId) update({ ...c, phase: 'connected' });
        },
        onFailed: () => {
          showAlert('Call failed', 'The connection was lost.');
          getSocket()?.emit('call:end', { callId });
          cleanup();
        },
      });
      engine.current = e;
      return e;
    },
    [cleanup, update]
  );

  const loadIce = async () => {
    try {
      ice.current = (await api.get<{ iceServers: IceServer[] }>('/calls/ice')).iceServers;
    } catch {
      ice.current = [{ urls: 'stun:stun.l.google.com:19302' }];
    }
  };

  const startCall = useCallback(
    async (bookingId: string, peer: Peer) => {
      const socket = getSocket();
      if (!socket || callRef.current) return;
      await loadIce();
      const res = await new Promise<{ ok: boolean; error?: string; callId?: string; delivered?: boolean }>((resolve) => socket.emit('call:invite', { bookingId }, resolve));
      if (!res.ok || !res.callId) {
        showAlert('Cannot call', res.error ?? 'Try again');
        return;
      }
      update({ callId: res.callId, bookingId, peer, direction: 'out', phase: 'ringing' });
      ringTimer.current = setTimeout(() => {
        if (callRef.current?.phase === 'ringing') {
          socket.emit('call:end', { callId: res.callId });
          cleanup();
          showAlert('No answer', 'They did not pick up. You can leave a message or use the phone call button.');
        }
      }, RING_TIMEOUT_MS);
    },
    [cleanup, update]
  );

  useSocketEvent<{ callId: string; bookingId: string; from: Peer }>('call:incoming', (p) => {
    if (!callsSupported || callRef.current) {
      getSocket()?.emit('call:reject', { callId: p.callId, data: { reason: callRef.current ? 'busy' : 'unsupported' } });
      return;
    }
    update({ callId: p.callId, bookingId: p.bookingId, peer: p.from, direction: 'in', phase: 'ringing' });
  });

  useSocketEvent<{ callId: string }>('call:accepted', async (p) => {
    const c = callRef.current;
    if (!c || c.callId !== p.callId) return;
    if (ringTimer.current) clearTimeout(ringTimer.current);
    update({ ...c, phase: 'connecting' });
    try {
      await makeEngine(p.callId, true).start();
    } catch {
      showAlert('Microphone needed', 'Allow microphone access to make calls.');
      getSocket()?.emit('call:end', { callId: p.callId });
      cleanup();
    }
  });

  useSocketEvent<{ callId: string; data?: { reason?: string } }>('call:rejected', (p) => {
    if (callRef.current?.callId !== p.callId) return;
    const reason = p.data?.reason;
    cleanup();
    showAlert('Call declined', reason === 'busy' ? 'They are on another call.' : reason === 'unsupported' ? 'Their device cannot take in-app calls. Use the phone call button instead.' : 'They declined the call.');
  });

  useSocketEvent<{ callId: string }>('call:ended', (p) => {
    if (callRef.current?.callId === p.callId) cleanup();
  });

  useSocketEvent<{ callId: string; data: unknown }>('call:signal', (p) => {
    if (callRef.current?.callId === p.callId) engine.current?.handleSignal(p.data).catch(() => {});
  });

  useEffect(() => {
    if (call?.phase !== 'connected') return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [call?.phase]);

  const accept = async () => {
    const c = callRef.current;
    if (!c) return;
    await loadIce();
    update({ ...c, phase: 'connecting' });
    try {
      await makeEngine(c.callId, false).start();
      getSocket()?.emit('call:accept', { callId: c.callId });
    } catch {
      showAlert('Microphone needed', 'Allow microphone access to answer calls.');
      getSocket()?.emit('call:reject', { callId: c.callId });
      cleanup();
    }
  };

  const decline = () => {
    if (call) getSocket()?.emit('call:reject', { callId: call.callId });
    cleanup();
  };

  const hangUp = () => {
    if (call) getSocket()?.emit('call:end', { callId: call.callId });
    cleanup();
  };

  const value = useMemo(() => ({ supported: callsSupported, startCall }), [startCall]);

  const status = !call
    ? ''
    : call.phase === 'connected'
      ? formatDuration(seconds * 1000)
      : call.phase === 'connecting'
        ? 'Connecting...'
        : call.direction === 'out'
          ? 'Ringing...'
          : 'Incoming call';

  return (
    <Ctx.Provider value={value}>
      {children}
      <Modal visible={!!call} animationType="fade" onRequestClose={hangUp}>
        {call ? (
          <View style={{ flex: 1, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 80 }}>
            <View style={{ alignItems: 'center' }}>
              <Avatar uri={call.peer.avatar} name={call.peer.name} size={120} />
              <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 20 }}>{call.peer.name}</Text>
              <Text style={{ color: '#9ca3af', fontSize: 16, marginTop: 6 }}>{status}</Text>
            </View>
            {call.direction === 'in' && call.phase === 'ringing' ? (
              <View style={{ flexDirection: 'row', gap: 40 }}>
                <Button title="Decline" variant="danger" icon="call" onPress={decline} style={{ minWidth: 130 }} />
                <Button title="Answer" variant="success" icon="call" onPress={accept} style={{ minWidth: 130 }} />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 30, alignItems: 'center' }}>
                <Button
                  title={muted ? 'Unmute' : 'Mute'}
                  variant="outline"
                  onPress={() => {
                    engine.current?.setMuted(!muted);
                    setMuted(!muted);
                  }}
                  style={{ minWidth: 110, backgroundColor: '#fff' }}
                />
                <Button title="End call" variant="danger" onPress={hangUp} style={{ minWidth: 130 }} />
              </View>
            )}
            <Ionicons name="lock-closed" size={14} color="#6b7280" />
          </View>
        ) : null}
      </Modal>
    </Ctx.Provider>
  );
}
