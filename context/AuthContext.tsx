import React, { createContext, useContext, useState } from 'react';
import { User, Patient } from '../types';
import { api } from '../src/api';
import { getCurrentClientId } from './ClientContext';

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
    const clientId = getCurrentClientId();
    
    try {
      const result = await api.post('/auth/login', {
        username: identifier,
        password,
        client_id: clientId || undefined,
      });

      // Store JWT token
      if (result.token) {
        localStorage.setItem('token', result.token);
      }

      if (result.type === 'staff') {
        const foundUser: User = {
          uid: result.user.uid || String(result.user.id),
          name: result.user.name || result.user.full_name,
          email: result.user.email || '',
          role: result.user.role,
          clinicIds: result.user.clinicIds || [],
          clientId: result.user.clientId || clientId || undefined,
          isActive: result.user.isActive !== false,
          createdAt: Date.now(),
          createdBy: 'system',
          updatedAt: Date.now(),
          updatedBy: 'system',
          isArchived: false,
        };

        if (!foundUser.isActive) {
          throw new Error('هذا الحساب غير مفعل');
        }
        if (clientId && foundUser.clientId && foundUser.clientId !== clientId) {
          throw new Error('هذا الحساب لا ينتمي لهذا المركز');
        }

        // Clear patient session to prevent wrong redirect
        localStorage.removeItem('patientUser');
        setPatientUser(null);

        localStorage.setItem('user', JSON.stringify(foundUser));
        setUser(foundUser);
        return;
      }

      if (result.type === 'patient') {
        const foundPatient: Partial<Patient> = {
          id: result.patient.id || String(result.patient.patient_id),
          name: result.patient.name || result.patient.full_name,
          phone: result.patient.phone || '',
          username: result.patient.username,
          email: result.patient.email,
          hasAccess: true,
        };

        // Clear staff session to prevent wrong redirect
        localStorage.removeItem('user');
        setUser(null);

        localStorage.setItem('patientUser', JSON.stringify(foundPatient));
        setPatientUser(foundPatient as Patient);
        return;
      }

      throw new Error('بيانات تسجيل الدخول غير صحيحة');
    } catch (error: any) {
      // Re-throw with Arabic message if it's a credentials error
      if (error.message?.includes('Invalid credentials') || error.message?.includes('401')) {
        throw new Error('بيانات تسجيل الدخول غير صحيحة');
      }
      throw error;
    }
  };

  const patientLogin = async (username: string, password: string) => {
    const clientId = getCurrentClientId();
    
    try {
      const result = await api.post('/auth/login', {
        username,
        password,
        client_id: clientId || undefined,
      });

      if (result.token) {
        localStorage.setItem('token', result.token);
      }

      if (result.type === 'patient') {
        const foundPatient: Partial<Patient> = {
          id: result.patient.id || String(result.patient.patient_id),
          name: result.patient.name || result.patient.full_name,
          phone: result.patient.phone || '',
          username: result.patient.username,
          email: result.patient.email,
          hasAccess: true,
        };

        localStorage.setItem('patientUser', JSON.stringify(foundPatient));
        setPatientUser(foundPatient as Patient);
        return;
      }

      throw new Error('رقم الهاتف أو كلمة المرور غير صحيحة');
    } catch (error: any) {
      if (error.message?.includes('Invalid credentials') || error.message?.includes('401')) {
        throw new Error('رقم الهاتف أو كلمة المرور غير صحيحة');
      }
      throw error;
    }
  };

  const logout = async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('patientUser');
    setUser(null);
    setPatientUser(null);
  };

  const simulateLogin = (newUser: User) => {
    if (window.location.hostname !== 'localhost') return; // production guard
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