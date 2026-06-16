import { createContext, useContext, useState, type ReactNode } from 'react';
import * as authApi from '../api/auth';

interface AuthContextValue {
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('access_token'));

  async function login(email: string, password: string) {
    const res = await authApi.login({ email, password });
    localStorage.setItem('access_token', res.access_token);
    setToken(res.access_token);
  }

  async function signup(fullName: string, email: string, password: string) {
    await authApi.signup({ full_name: fullName, email, password });
    // signup doesn't return a token — caller should redirect to /login
  }

  async function logout() {
    try {
      await authApi.logout();
    } finally {
      // Always clear locally even if the API call fails
      localStorage.removeItem('access_token');
      setToken(null);
    }
  }

  return (
    <AuthContext.Provider value={{ token, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
