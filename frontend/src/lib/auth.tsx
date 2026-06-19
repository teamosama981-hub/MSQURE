import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { storage } from '@/src/utils/storage';
import { api } from './api';
import { router } from 'expo-router';

export type Role = 'student' | 'teacher' | 'admin' | 'super_admin';
export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  phone?: string;
  role: Role;
}

interface AuthCtx {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  register: (data: any) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    const t = await storage.getItem<string>('auth_token', '');
    if (t) {
      setToken(t);
      try {
        const res = await api.get('/auth/me');
        setUser(res.data);
      } catch {
        await storage.removeItem('auth_token');
        setToken(null);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  const login = async (username: string, password: string) => {
    const r = await api.post('/auth/login', { username, password });
    await storage.setItem('auth_token', r.data.token);
    setToken(r.data.token);
    setUser(r.data.user);
    return r.data.user as User;
  };

  const register = async (data: any) => {
    const r = await api.post('/auth/register', data);
    await storage.setItem('auth_token', r.data.token);
    setToken(r.data.token);
    setUser(r.data.user);
    return r.data.user as User;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    await storage.removeItem('auth_token');
    setUser(null);
    setToken(null);
    router.replace('/');
  };

  const refresh = async () => {
    const res = await api.get('/auth/me');
    setUser(res.data);
  };

  return <Ctx.Provider value={{ user, token, loading, login, register, logout, refresh }}>{children}</Ctx.Provider>;
};

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be inside AuthProvider');
  return c;
};

export const routeForRole = (role: Role) => {
  if (role === 'student') return '/(student)/home';
  if (role === 'teacher') return '/(admin)/dashboard';
  return '/(admin)/dashboard';
};
