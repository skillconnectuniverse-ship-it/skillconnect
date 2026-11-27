import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL } from './config';

let socket: Socket | null = null;

export function connectSocket(token: string) {
  disconnectSocket();
  socket = io(API_URL, { auth: { token }, transports: ['websocket', 'polling'] });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

// Subscribes to a realtime event for as long as the component is mounted.
export function useSocketEvent<T = unknown>(event: string, handler: (payload: T) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const fn = (p: T) => ref.current(p);
    // The socket may connect after mount, so poll briefly until it exists.
    let attached: Socket | null = null;
    const attach = () => {
      if (socket && socket !== attached) {
        attached?.off(event, fn);
        socket.on(event, fn);
        attached = socket;
      }
    };
    attach();
    const t = setInterval(attach, 1500);
    return () => {
      clearInterval(t);
      attached?.off(event, fn);
    };
  }, [event]);
}
