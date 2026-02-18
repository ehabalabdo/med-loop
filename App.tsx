
import React, { useEffect, useState } from 'react';
import { BrowserRouter, MemoryRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
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
import LandingView from './views/LandingView';
import HrEmployeesView from './views/HrEmployeesView';
import HrAttendanceView from './views/HrAttendanceView';
import HrReportsView from './views/HrReportsView';
import HrEmployeeMeView from './views/HrEmployeeMeView';
// HrLoginView removed — HR login integrated into main LoginView
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
    <BrowserRouter>{children}</BrowserRouter>
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

// --- Expired Block Screen (blocks entire system) ---
const ExpiredBlockScreen: React.FC = () => {
  const { isExpired, client } = useClient();
  if (!isExpired) return null;
  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-slate-900 via-red-950 to-slate-900 flex items-center justify-center" dir="rtl">
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-10 max-w-md text-center border border-white/20 shadow-2xl">
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <i className="fa-solid fa-lock text-red-400 text-4xl"></i>
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">انتهى الاشتراك</h1>
        <p className="text-slate-300 mb-2 text-lg">{client?.name || 'المركز'}</p>
        <p className="text-slate-400 text-sm mb-6">
          {client?.status === 'trial' 
            ? 'انتهت فترة التجربة المجانية. تواصل مع إدارة المنصة لتفعيل الاشتراك.'
            : client?.status === 'suspended'
            ? 'تم إيقاف هذا المركز. تواصل مع إدارة المنصة.'
            : 'انتهى اشتراكك. تواصل مع إدارة المنصة للتجديد.'}
        </p>
        <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-6">
          <p className="text-slate-400 text-xs mb-1">للتواصل مع الإدارة</p>
          <p className="text-white font-bold text-lg">0790904030</p>
        </div>
        <button onClick={() => { const s = localStorage.getItem('currentClientSlug'); localStorage.removeItem('token'); localStorage.removeItem('user'); localStorage.removeItem('patientUser'); window.location.href = s ? `/${s}/login` : '/login'; }}
          className="text-slate-500 hover:text-white text-sm transition">
          <i className="fa-solid fa-arrow-right-from-bracket ml-1"></i> تسجيل خروج
        </button>
      </div>
    </div>
  );
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  // Detect slug from current URL for proper redirect
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const knownTopRoutes = ['login', 'admin', 'reception', 'doctor', 'patients', 'appointments', 
    'dental-lab', 'implant-company', 'academy', 'clinic-history', 'device-results', 'device-management', 
    'queue-display', 'patient', 'super-admin', 'hr'];
  const currentSlug = pathParts[0] && !knownTopRoutes.includes(pathParts[0]) ? pathParts[0] : null;
  const loginPath = currentSlug ? `/${currentSlug}/login` : '/login';

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50 text-slate-400 dark:bg-slate-900 dark:text-slate-500">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl"></i>
      </div>
    );
  }

  if (!user) {
    return <RedirectHandler to={loginPath} />;
  }

  if (!allowedRoles.includes(user.role)) {
    const prefix = currentSlug ? `/${currentSlug}` : '';
    if (user.role === UserRole.ADMIN) return <RedirectHandler to={`${prefix}/admin`} />;
    if (user.role === UserRole.SECRETARY) return <RedirectHandler to={`${prefix}/reception`} />;
    if (user.role === UserRole.DOCTOR) return <RedirectHandler to={`${prefix}/doctor`} />;
    if (user.role === UserRole.LAB_TECH) return <RedirectHandler to={`${prefix}/dental-lab`} />;
    if (user.role === UserRole.IMPLANT_MANAGER) return <RedirectHandler to={`${prefix}/implant-company`} />;
    if (user.role === UserRole.COURSE_MANAGER) return <RedirectHandler to={`${prefix}/academy`} />;
    
    return <RedirectHandler to={loginPath} />;
  }

  return <>{children}</>;
};

// --- HR Employee Route Guard (separate from staff auth) ---
const HrEmployeeGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const slug = pathParts[0] || '';
  const hrData = localStorage.getItem('hrEmployee');
  if (!hrData) return <RedirectHandler to={`/${slug}/login`} />;
  try {
    const parsed = JSON.parse(hrData);
    if (!parsed.id) return <RedirectHandler to={`/${slug}/login`} />;
  } catch {
    return <RedirectHandler to={`/${slug}/hr/login`} />;
  }
  return <>{children}</>;
};

// --- Helper to Determine Home Page ---
const getHomeRoute = (user: User): string => {
  const slug = localStorage.getItem('currentClientSlug');
  const prefix = slug ? `/${slug}` : '';
  if (user.role === UserRole.ADMIN) return `${prefix}/admin`;
  if (user.role === UserRole.SECRETARY) return `${prefix}/reception`;
  if (user.role === UserRole.DOCTOR) return `${prefix}/doctor`;
  if (user.role === UserRole.LAB_TECH) return `${prefix}/dental-lab`;
  if (user.role === UserRole.IMPLANT_MANAGER) return `${prefix}/implant-company`;
  if (user.role === UserRole.COURSE_MANAGER) return `${prefix}/academy`;
  return slug ? `/${slug}/login` : '/login';
};

// --- Slug Redirect: redirects bare /path to /{slug}/path ---
const SlugRedirect: React.FC<{ path: string }> = ({ path }) => {
  const slug = localStorage.getItem('currentClientSlug');
  if (slug) {
    return <RedirectHandler to={`/${slug}${path}`} />;
  }
  // No slug saved — show login page directly (no redirect loop)
  if (path === '/login') return <LoginView />;
  return <RedirectHandler to="/login" />;
};

// --- Slug Redirect with ID param (e.g. /patients/:id → /:slug/patients/:id) ---
const SlugRedirectWithId: React.FC<{ basePath: string }> = ({ basePath }) => {
  const { id } = useParams<{ id: string }>();
  const slug = localStorage.getItem('currentClientSlug');
  if (slug && id) {
    return <RedirectHandler to={`/${slug}${basePath}/${id}`} />;
  }
  if (slug) {
    return <RedirectHandler to={`/${slug}${basePath}`} />;
  }
  return <RedirectHandler to="/login" />;
};

// --- App Router ---
const AppRoutes: React.FC = () => {
  const { user, patientUser } = useAuth();

  return (
    <Routes>
      {/* Super Admin - YOUR control panel */}
      <Route path="/super-admin" element={<SuperAdminView />} />

      {/* Staff Login — redirect to slug login if slug saved */}
      <Route path="/login" element={user ? <RedirectHandler to={getHomeRoute(user)} /> : <SlugRedirect path="/login" />} />

      {/* Patient Portal Routes */}
      <Route 
        path="/patient/login" 
        element={patientUser ? <RedirectHandler to="/patient/dashboard" /> : <PatientLoginView />} 
      />
      <Route 
        path="/patient/dashboard" 
        element={patientUser ? <PatientDashboardView /> : <RedirectHandler to="/patient/login" />} 
      />

      {/* Legacy bare routes → redirect to slug versions */}
      <Route path="/admin" element={<SlugRedirect path="/admin" />} />
      <Route path="/reception" element={<SlugRedirect path="/reception" />} />
      <Route path="/doctor" element={<SlugRedirect path="/doctor" />} />
      <Route path="/patients/:id" element={<SlugRedirectWithId basePath="/patients" />} />
      <Route path="/patients" element={<SlugRedirect path="/patients" />} />
      <Route path="/appointments" element={<SlugRedirect path="/appointments" />} />
      <Route path="/dental-lab" element={<SlugRedirect path="/dental-lab" />} />
      <Route path="/implant-company" element={<SlugRedirect path="/implant-company" />} />
      <Route path="/academy" element={<SlugRedirect path="/academy" />} />
      <Route path="/clinic-history" element={<SlugRedirect path="/clinic-history" />} />
      <Route path="/device-results" element={<SlugRedirect path="/device-results" />} />
      <Route path="/device-management" element={<SlugRedirect path="/device-management" />} />
      <Route path="/queue-display" element={<SlugRedirect path="/queue-display" />} />

      {/* Root - Landing Page */}
      <Route 
        path="/" 
        element={<LandingView />} 
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
    'patient', 'super-admin', 'hr'];
  if (slug && knownRoutes.includes(slug)) {
    return <RedirectHandler to={`/${slug}`} />;
  }

  return (
    <ClientProvider slug={slug}>
      <ClientGate>
        <ExpiredBlockScreen />
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
          
          {/* HR Admin Routes (admin only) */}
          <Route path="/hr/employees" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]}><HrEmployeesView /></ProtectedRoute>} />
          <Route path="/hr/attendance" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]}><HrAttendanceView /></ProtectedRoute>} />
          <Route path="/hr/reports" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]}><HrReportsView /></ProtectedRoute>} />
          
          {/* HR Employee Portal */}
          <Route path="/hr/me" element={<HrEmployeeGuard><HrEmployeeMeView /></HrEmployeeGuard>} />
          
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
          <a href="/super-admin" className="text-primary hover:underline text-sm">الذهاب للوحة التحكم</a>
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
