import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types';
import { api } from '../src/api';
import { pgUsers } from '../services/pgServices';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  simulateLogin: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return (parsed.uid && parsed.role) ? parsed : null;
      } catch { return null; }
    }
    return null;
  });
  const [loading, setLoading] = useState(false);

  const login = async (email: string, password: string) => {
    // Use PostgreSQL directly instead of Render backend
    const allUsers = await pgUsers.getAll();
    const foundUser = allUsers.find(u => u.email === email && u.password === password);
    
    if (!foundUser) {
      throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }
    
    if (!foundUser.isActive) {
      throw new Error('هذا الحساب غير مفعل');
    }
    
    // Save user to localStorage
    localStorage.setItem('user', JSON.stringify(foundUser));
    setUser(foundUser);
  };

  const logout = async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const simulateLogin = (newUser: User) => {
    localStorage.setItem('user', JSON.stringify(newUser));
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