import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Patient } from '../types';
import { api } from '../src/api';
import { pgUsers, pgPatients } from '../services/pgServices';

interface AuthContextType {
  user: User | null;
  patientUser: Patient | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  patientLogin: (username: string, password: string) => Promise<void>;
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
  
  const [patientUser, setPatientUser] = useState<Patient | null>(() => {
    const saved = localStorage.getItem('patientUser');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return (parsed.id && parsed.username) ? parsed : null;
      } catch { return null; }
    }
    return null;
  });
  
  const [loading, setLoading] = useState(false);

  const login = async (usernameOrEmail: string, password: string) => {
    // Try staff login first (check if input is email format)
    const isEmail = usernameOrEmail.includes('@');
    
    if (isEmail) {
      // Staff login with email
      const allUsers = await pgUsers.getAll();
      const foundUser = allUsers.find(u => u.email === usernameOrEmail && u.password === password);
      
      if (!foundUser) {
        throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      }
      
      if (!foundUser.isActive) {
        throw new Error('هذا الحساب غير مفعل');
      }
      
      // Save user to localStorage
      localStorage.setItem('user', JSON.stringify(foundUser));
      setUser(foundUser);
    } else {
      // Patient login with username
      const allPatients = await pgPatients.getAll();
      const foundPatient = allPatients.find(
        p => p.username === usernameOrEmail && p.password === password && p.hasAccess === true
      );
      
      if (!foundPatient) {
        throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
      }
      
      // Save patient to localStorage
      localStorage.setItem('patientUser', JSON.stringify(foundPatient));
      setPatientUser(foundPatient);
    }
  };

  const patientLogin = async (username: string, password: string) => {
    // Get all patients from PostgreSQL
    const allPatients = await pgPatients.getAll();
    const foundPatient = allPatients.find(
      p => p.username === username && p.password === password && p.hasAccess === true
    );
    
    if (!foundPatient) {
      throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
    }
    
    // Save patient to localStorage
    localStorage.setItem('patientUser', JSON.stringify(foundPatient));
    setPatientUser(foundPatient);
  };

  const logout = async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('patientUser');
    setUser(null);
    setPatientUser(null);
  };

  const simulateLogin = (newUser: User) => {
    localStorage.setItem('user', JSON.stringify(newUser));
    setUser(newUser);
  }

  return (
    <AuthContext.Provider value={{ user, patientUser, loading, login, patientLogin, logout, simulateLogin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};