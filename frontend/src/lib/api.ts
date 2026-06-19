import axios from 'axios';
import { storage } from '@/src/utils/storage';

const BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || '') + '/api';

export const api = axios.create({ baseURL: BASE, timeout: 30000 });

api.interceptors.request.use(async (config) => {
  const token = await storage.getItem<string>('auth_token', '');
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

export const apiUrl = (path: string) => BASE + path;
