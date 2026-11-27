import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuthToken, setUnauthorizedHandler } from './api';
import { getStoredToken, setStoredToken } from './storage';
import { connectSocket, disconnectSocket } from './realtime';
import { registerForPush } from './push';
import { User } from './types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { name: string; email: string; password: string; phone?: string; city?: string }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
  refreshUser: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const startSession = useCallback(async (token: string, u: User) => {
    setAuthToken(token);
    await setStoredToken(token);
    connectSocket(token);
    setUser(u);
    registerForPush();
  }, []);

  const logout = useCallback(async () => {
    disconnectSocket();
    setAuthToken(null);
    await setStoredToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
    });
    (async () => {
      try {
        const token = await getStoredToken();
        if (token) {
          setAuthToken(token);
          const { user: u } = await api.get<{ user: User }>('/users/me');
          await startSession(token, u);
        }
      } catch {
        await logout();
      } finally {
        setLoading(false);
      }
    })();
    return () => setUnauthorizedHandler(null);
  }, [logout, startSession]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      logout,
      setUser,
      login: async (email, password) => {
        const r = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
        await startSession(r.token, r.user);
      },
      register: async (input) => {
        const r = await api.post<{ token: string; user: User }>('/auth/register', input);
        await startSession(r.token, r.user);
      },
      refreshUser: async () => {
        const { user: u } = await api.get<{ user: User }>('/users/me');
        setUser(u);
      },
    }),
    [user, loading, logout, startSession]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
