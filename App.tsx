
import React, { useEffect, useState } from 'react';
import { HashRouter, MemoryRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ClientProvider, useClient } from './context/ClientContext';
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
import DeviceResultsView from './views/DeviceResultsView';
import DeviceManagementView from './views/DeviceManagementView';
import SuperAdminView from './views/SuperAdminView';
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

// --- Read Only Banner (expired subscription) ---
const ReadOnlyBanner: React.FC = () => {
  const { isReadOnly, client } = useClient();
  if (!isReadOnly) return null;
  return (
    <div className="bg-red-500 text-white text-center py-2 px-4 text-sm font-bold sticky top-0 z-50">
      <i className="fa-solid fa-lock mr-2"></i>
      انتهى اشتراك {client?.name || 'المركز'} — النظام بوضع القراءة فقط. تواصل مع الإدارة للتجديد.
    </div>
  );
};

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
      {/* Super Admin - YOUR control panel */}
      <Route path="/super-admin" element={<SuperAdminView />} />

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

      {/* Device Results - Admin & Receptionist */}
      <Route 
        path="/device-results" 
        element={
          <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SECRETARY, UserRole.DOCTOR]}>
            <DeviceResultsView />
          </ProtectedRoute>
        } 
      />

      {/* Device Management - Admin Only */}
      <Route 
        path="/device-management" 
        element={
          <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
            <DeviceManagementView />
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

      {/* Slug-based routes: /:slug/login, /:slug/admin, etc. */}
      <Route path="/:slug/*" element={<ClientSlugRoutes />} />

      <Route path="*" element={<RedirectHandler to="/" />} />
    </Routes>
  );
};

// --- Client Slug Routes (/:slug/...) ---
const ClientSlugRoutes: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user, patientUser } = useAuth();

  // Don't treat known routes as slugs
  const knownRoutes = ['login', 'admin', 'reception', 'doctor', 'patients', 'appointments', 
    'dental-lab', 'implant-company', 'academy', 'clinic-history', 'device-results', 'device-management', 'queue-display', 
    'patient', 'super-admin'];
  if (slug && knownRoutes.includes(slug)) {
    return <RedirectHandler to={`/${slug}`} />;
  }

  return (
    <ClientProvider slug={slug}>
      <ClientGate>
        <ReadOnlyBanner />
        <Routes>
          <Route path="/login" element={user ? <RedirectHandler to={`/${slug}/admin`} /> : <LoginView />} />
          <Route path="/admin" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]}><AdminView /></ProtectedRoute>} />
          <Route path="/reception" element={<ProtectedRoute allowedRoles={[UserRole.SECRETARY]}><ReceptionView /></ProtectedRoute>} />
          <Route path="/doctor" element={<ProtectedRoute allowedRoles={[UserRole.DOCTOR]}><DoctorView /></ProtectedRoute>} />
          <Route path="/patients" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SECRETARY, UserRole.DOCTOR]}><PatientsRegistryView /></ProtectedRoute>} />
          <Route path="/patients/:id" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SECRETARY, UserRole.DOCTOR]}><PatientProfileView /></ProtectedRoute>} />
          <Route path="/appointments" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SECRETARY, UserRole.DOCTOR]}><AppointmentsView /></ProtectedRoute>} />
          <Route path="/dental-lab" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.DOCTOR, UserRole.LAB_TECH]}><DentalLabView /></ProtectedRoute>} />
          <Route path="/implant-company" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.DOCTOR, UserRole.IMPLANT_MANAGER]}><ImplantView /></ProtectedRoute>} />
          <Route path="/academy" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.COURSE_MANAGER, UserRole.SECRETARY]}><CoursesView /></ProtectedRoute>} />
          <Route path="/clinic-history" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.DOCTOR]}><ClinicHistoryView /></ProtectedRoute>} />
          <Route path="/device-results" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SECRETARY, UserRole.DOCTOR]}><DeviceResultsView /></ProtectedRoute>} />
          <Route path="/device-management" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]}><DeviceManagementView /></ProtectedRoute>} />
          <Route path="/queue-display" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SECRETARY]}><QueueDisplayView /></ProtectedRoute>} />
          <Route path="/patient/login" element={patientUser ? <RedirectHandler to={`/${slug}/patient/dashboard`} /> : <PatientLoginView />} />
          <Route path="/patient/dashboard" element={patientUser ? <PatientDashboardView /> : <RedirectHandler to={`/${slug}/patient/login`} />} />
          <Route path="/" element={user ? <RedirectHandler to={`/${slug}/admin`} /> : <RedirectHandler to={`/${slug}/login`} />} />
          <Route path="*" element={<RedirectHandler to={`/${slug}/login`} />} />
        </Routes>
      </ClientGate>
    </ClientProvider>
  );
};

// --- Client Gate: Shows loading/error while resolving client ---
const ClientGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { client, loading, error } = useClient();

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="text-center">
          <i className="fa-solid fa-circle-notch fa-spin text-3xl text-primary mb-3"></i>
          <p className="text-slate-500">جاري تحميل بيانات المركز...</p>
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="text-center bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-lg max-w-md">
          <i className="fa-solid fa-building-circle-xmark text-5xl text-red-400 mb-4"></i>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">المركز غير موجود</h2>
          <p className="text-slate-500 mb-4">{error || 'تأكد من صحة الرابط'}</p>
          <a href="/#/super-admin" className="text-primary hover:underline text-sm">الذهاب للوحة التحكم</a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
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
