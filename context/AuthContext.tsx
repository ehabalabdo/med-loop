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
    
    // If not found in staff, try patient login (search by username OR name OR email)
    const allPatients = await pgPatients.getAll();
    const foundPatient = allPatients.find(
      p => (p.username === identifier || p.name === identifier || p.email === identifier) && 
           p.password === password && 
           (p.hasAccess === true || p.hasAccess === 'true' || p.hasAccess === 1)
    );
    
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
    // Get all patients from PostgreSQL
    const allPatients = await pgPatients.getAll();
    
    console.log('[PatientLogin] 🔍 Attempting login:', { 
      inputUsername: username, 
      totalPatients: allPatients.length,
      patientsWithAccess: allPatients.filter(p => p.hasAccess).length 
    });
    
    // البحث برقم الهاتف (username أو phone)
    const foundPatient = allPatients.find(
      p => (p.username === username || p.phone === username) && 
           p.password === password && 
           p.hasAccess === true
    );
    
    if (!foundPatient) {
      // للتشخيص: تحقق من وجود المريض برقم الهاتف
      const patientByPhone = allPatients.find(p => p.phone === username);
      const patientByUsername = allPatients.find(p => p.username === username);
      
      console.log('[PatientLogin] ❌ Login failed:', {
        foundByPhone: patientByPhone ? {
          id: patientByPhone.id,
          name: patientByPhone.name,
          phone: patientByPhone.phone,
          username: patientByPhone.username,
          hasPassword: !!patientByPhone.password,
          hasAccess: patientByPhone.hasAccess
        } : 'Not found',
        foundByUsername: patientByUsername ? {
          id: patientByUsername.id,
          name: patientByUsername.name,
          phone: patientByUsername.phone,
          hasPassword: !!patientByUsername.password,
          hasAccess: patientByUsername.hasAccess
        } : 'Not found'
      });
      
      throw new Error('رقم الهاتف أو كلمة المرور غير صحيحة');
    }
    
    console.log('[PatientLogin] ✅ Login successful:', {
      id: foundPatient.id,
      name: foundPatient.name,
      phone: foundPatient.phone
    });
    
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