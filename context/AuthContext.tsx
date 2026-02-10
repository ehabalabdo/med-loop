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

  const login = async (identifier: string, password: string) => {
    // Try staff login first (search by name OR email)
    const allUsers = await pgUsers.getAll();
    const foundUser = allUsers.find(
      u => (u.name === identifier || u.email === identifier) && u.password === password
    );
    
    if (foundUser) {
      if (!foundUser.isActive) {
        throw new Error('هذا الحساب غير مفعل');
      }
      
      // Save user to localStorage
      localStorage.setItem('user', JSON.stringify(foundUser));
      setUser(foundUser);
      return;
    }
    
    // If not found in staff, try patient login (optimized single-row query)
    const foundPatient = await pgPatients.findByLogin(identifier, password);
    
    if (foundPatient) {
      // Save patient to localStorage
      localStorage.setItem('patientUser', JSON.stringify(foundPatient));
      setPatientUser(foundPatient);
      return;
    }
    
    // Not found in either table
    throw new Error('بيانات تسجيل الدخول غير صحيحة');
  };

  const patientLogin = async (username: string, password: string) => {
    // Optimized: single-row query instead of loading all patients
    const foundPatient = await pgPatients.findByLogin(username, password);
    
    if (!foundPatient) {
      throw new Error('رقم الهاتف أو كلمة المرور غير صحيحة');
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