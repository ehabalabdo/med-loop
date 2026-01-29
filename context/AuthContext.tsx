import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types';
import { api } from '../src/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  simulateLogin: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    // POST /auth/login
    const data = {
      email: email,
      username: email, // نرسل الإيميل أيضاً باسم username
      password: password
    };
    const res = await api.post('/auth/login', data);
    // Debug: Print the received role from backend
    console.log("FRONTEND_RECEIVED_ROLE:", res?.user?.role || res?.role);
    if (!res.token) throw new Error(res.message || 'Login failed');
    localStorage.setItem('token', res.token);
    setUser(res.user || { email, role: res.role });
    window.location.href = '/dashboard';
  };

  const logout = async () => {
    localStorage.removeItem('token');
    setUser(null);
    window.location.href = '/login';
  };

  const simulateLogin = (newUser: User) => {
    setUser(newUser);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, simulateLogin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};