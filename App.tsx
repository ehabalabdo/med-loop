
import React, { useEffect, useState } from 'react';
import { HashRouter, MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { UserRole, User } from './types';
import LoginView from './views/LoginView';
import AdminView from './views/AdminView';
import ReceptionView from './views/ReceptionView';
import DoctorView from './views/DoctorView';
import QueueDisplayView from './views/QueueDisplayView';
import PatientsRegistryView from './views/PatientsRegistryView';
import PatientProfileView from './views/PatientProfileView';
import AppointmentsView from './views/AppointmentsView'; 
import DentalLabView from './views/DentalLabView';
import ImplantView from './views/ImplantView';
import CoursesView from './views/CoursesView';
import PatientLoginView from './views/PatientLoginView';
import PatientDashboardView from './views/PatientDashboardView';
import ClinicHistoryView from './views/ClinicHistoryView';
import DevModeSwitcher from './components/DevModeSwitcher';
import ErrorBoundary from './components/ErrorBoundary';

// --- Safe Router Strategy ---
const SafeRouter: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [useMemory, setUseMemory] = useState(true);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      if (!window.location) throw new Error("No location");
      if (window.location.protocol === 'blob:' || window.location.origin === 'null') {
         // Keep MemoryRouter
      } else {
         setUseMemory(false);
      }
    } catch (e) {
      console.warn("Environment restricted: defaulting to MemoryRouter");
    } finally {
      setChecked(true);
    }
  }, []);

  if (!checked) return null;

  return useMemory ? (
    <MemoryRouter>{children}</MemoryRouter>
  ) : (
    <HashRouter>{children}</HashRouter>
  );
};

// --- Redirect Helper ---
const RedirectHandler = ({ to }: { to: string }) => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace: true });
  }, [navigate, to]);
  return null;
};

// --- Route Guard ---
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50 text-slate-400 dark:bg-slate-900 dark:text-slate-500">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl"></i>
      </div>
    );
  }

  if (!user) {
    return <RedirectHandler to="/login" />;
  }

  if (!allowedRoles.includes(user.role)) {
    // Basic Role Redirects based on Strict Roles
    if (user.role === UserRole.ADMIN) return <RedirectHandler to="/admin" />;
    if (user.role === UserRole.SECRETARY) return <RedirectHandler to="/reception" />;
    if (user.role === UserRole.DOCTOR) return <RedirectHandler to="/doctor" />;
    if (user.role === UserRole.LAB_TECH) return <RedirectHandler to="/dental-lab" />;
    if (user.role === UserRole.IMPLANT_MANAGER) return <RedirectHandler to="/implant-company" />;
    if (user.role === UserRole.COURSE_MANAGER) return <RedirectHandler to="/academy" />;
    
    return <RedirectHandler to="/login" />;
  }

  return <>{children}</>;
};

// --- Helper to Determine Home Page ---
const getHomeRoute = (user: User): string => {
  if (user.role === UserRole.ADMIN) return "/admin";
  if (user.role === UserRole.SECRETARY) return "/reception";
  if (user.role === UserRole.DOCTOR) return "/doctor";
  if (user.role === UserRole.LAB_TECH) return "/dental-lab";
  if (user.role === UserRole.IMPLANT_MANAGER) return "/implant-company";
  if (user.role === UserRole.COURSE_MANAGER) return "/academy";
  return "/login";
};

// --- App Router ---
const AppRoutes: React.FC = () => {
  const { user, patientUser } = useAuth();

  return (
    <Routes>
      {/* Staff Login */}
      <Route path="/login" element={user ? <RedirectHandler to={getHomeRoute(user)} /> : <LoginView />} />

      {/* Patient Portal Routes */}
      <Route 
        path="/patient/login" 
        element={patientUser ? <RedirectHandler to="/patient/dashboard" /> : <PatientLoginView />} 
      />
      <Route 
        path="/patient/dashboard" 
        element={patientUser ? <PatientDashboardView /> : <RedirectHandler to="/patient/login" />} 
      />

      {/* Admin Routes */}
      <Route 
        path="/admin" 
        element={
          <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
            <AdminView />
          </ProtectedRoute>
        } 
      />

      {/* Secretary Routes */}
      <Route 
        path="/reception" 
        element={
          <ProtectedRoute allowedRoles={[UserRole.SECRETARY]}>
            <ReceptionView />
          </ProtectedRoute>
        } 
      />

      {/* Doctor Routes */}
      <Route 
        path="/doctor" 
        element={
          <ProtectedRoute allowedRoles={[UserRole.DOCTOR]}>
            <DoctorView />
          </ProtectedRoute>
        } 
      />

      {/* Shared: Patient Registry */}
      <Route 
        path="/patients" 
        element={
          <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SECRETARY, UserRole.DOCTOR]}>
            <PatientsRegistryView />
          </ProtectedRoute>
        } 
      />

      {/* Shared: Patient Profile */}
      <Route 
        path="/patients/:id" 
        element={
          <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SECRETARY, UserRole.DOCTOR]}>
            <PatientProfileView />
          </ProtectedRoute>
        } 
      />

      {/* New: Appointments (Path 1) */}
      <Route 
        path="/appointments" 
        element={
          <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SECRETARY, UserRole.DOCTOR]}>
            <AppointmentsView />
          </ProtectedRoute>
        } 
      />

      {/* Dental Lab */}
      <Route 
        path="/dental-lab" 
        element={
          <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.DOCTOR, UserRole.LAB_TECH]}>
            <DentalLabView />
          </ProtectedRoute>
        } 
      />

      {/* Implant Company */}
      <Route 
        path="/implant-company" 
        element={
          <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.DOCTOR, UserRole.IMPLANT_MANAGER]}>
            <ImplantView />
          </ProtectedRoute>
        } 
      />

      {/* Beauty Academy - NEW - Added Secretary Access */}
      <Route 
        path="/academy" 
        element={
          <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.COURSE_MANAGER, UserRole.SECRETARY]}>
            <CoursesView />
          </ProtectedRoute>
        } 
      />

      {/* Clinic History - Admin & Doctors */}
      <Route 
        path="/clinic-history" 
        element={
          <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.DOCTOR]}>
            <ClinicHistoryView />
          </ProtectedRoute>
        } 
      />

      {/* Public Queue Display */}
      <Route 
        path="/queue-display" 
        element={
           <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SECRETARY]}>
             <QueueDisplayView />
           </ProtectedRoute>
        } 
      />

      {/* Root Redirect Logic */}
      <Route 
        path="/" 
        element={
          user ? <RedirectHandler to={getHomeRoute(user)} /> : <RedirectHandler to="/login" />
        } 
      />

      <Route path="*" element={<RedirectHandler to="/" />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ThemeProvider>
          <AuthProvider>
            <SafeRouter>
              <AppRoutes />
              {window.location.hostname === 'localhost' && <DevModeSwitcher />}
            </SafeRouter>
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
};

export default App;
