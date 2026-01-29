
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { UserRole } from '../types';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
}

const Layout: React.FC<LayoutProps> = ({ children, title }) => {
  const { user, logout } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  const { isDarkMode, toggleTheme } = useTheme();
  const location = useLocation();

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN: return 'bg-purple-500/20 text-purple-300 border border-purple-500/30';
      case UserRole.DOCTOR: return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
      case UserRole.SECRETARY: return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
      case UserRole.LAB_TECH: return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
      case UserRole.IMPLANT_MANAGER: return 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30';
      case UserRole.COURSE_MANAGER: return 'bg-pink-500/20 text-pink-300 border border-pink-500/30';
      default: return 'bg-gray-100';
    }
  };

  const NavItem = ({ to, icon, label, mobile = false }: { to: string; icon: string; label: string, mobile?: boolean }) => {
     const isActive = location.pathname.startsWith(to);
     if (mobile) {
         return (
             <Link to={to} className={`flex flex-col items-center justify-center flex-1 py-2 ${isActive ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}`}>
                <i className={`${icon} text-lg`}></i>
                <span className="text-[10px] font-bold mt-1">{label}</span>
             </Link>
         );
     }
     return (
        <Link 
            to={to} 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-sm font-semibold group relative overflow-hidden ${
                isActive 
                ? 'text-white bg-gradient-to-r from-primary to-secondary shadow-glow' 
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
        >
            {isActive && <div className="absolute inset-0 bg-white/10 opacity-50"></div>}
            <i className={`${icon} w-6 text-center transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-primary'}`}></i>
            <span className="relative z-10">{label}</span>
        </Link>
     );
  };

  // --- ACCESS CONTROL LOGIC ---
  const role = user?.role;
  const isLabTech = role === UserRole.LAB_TECH;
  const isImplantMgr = role === UserRole.IMPLANT_MANAGER;
  const isCourseMgr = role === UserRole.COURSE_MANAGER;
  
  // Clinical Views: Admin, Doctor, Secretary
  const showClinicalViews = !isLabTech && !isImplantMgr && !isCourseMgr; 

  // Department Visibility
  const showLabView = role === UserRole.ADMIN || role === UserRole.DOCTOR || role === UserRole.LAB_TECH;
  const showImplantView = role === UserRole.ADMIN || role === UserRole.DOCTOR || role === UserRole.IMPLANT_MANAGER;
  // UPDATE: Secretary can also see Academy now (View Schedule)
  const showAcademyView = role === UserRole.ADMIN || role === UserRole.COURSE_MANAGER || role === UserRole.SECRETARY;

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden">
      {/* Sidebar - Desktop Only */}
      <aside className="w-72 glass-sidebar text-white flex-shrink-0 hidden md:flex flex-col shadow-2xl relative z-20">
        <div className="p-8 pb-4">
          <div className="flex items-center gap-3 mb-1">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-cyan-400 flex items-center justify-center shadow-lg shadow-primary/20 text-white text-xl">
               <i className="fa-solid fa-heart-pulse"></i>
             </div>
             <div>
                <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                    {t('system_name')}
                </h1>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{t('system_sub')}</p>
             </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-6 overflow-y-auto custom-scrollbar">
           <div className="px-4 pb-2 text-xs font-bold uppercase text-slate-600 tracking-wider">Menu</div>
           
           {/* Admin & Secretary Views */}
           {role === UserRole.ADMIN && <NavItem to="/admin" icon="fa-solid fa-shield-halved" label={t('admin_dashboard')} />}
           {role === UserRole.SECRETARY && <NavItem to="/reception" icon="fa-solid fa-clipboard-user" label={t('reception_desk')} />}
           
           {/* Clinical Views (Hidden for Dept Staff) */}
           {showClinicalViews && (
             <>
               {role === UserRole.DOCTOR && <NavItem to="/doctor" icon="fa-solid fa-user-doctor" label={t('doctor_console')} />}
               <NavItem to="/appointments" icon="fa-regular fa-calendar-check" label={t('appointments_nav')} />
               <NavItem to="/patients" icon="fa-solid fa-users-viewfinder" label={t('patients_registry')} />
             </>
           )}
           
           {/* Departments Section */}
           {(showLabView || showImplantView || showAcademyView) && (
               <>
                   {showClinicalViews && <div className="px-4 pb-2 mt-6 text-xs font-bold uppercase text-slate-600 tracking-wider">Departments</div>}
                   {showLabView && <NavItem to="/dental-lab" icon="fa-solid fa-tooth" label="Dental Lab" />}
                   {showImplantView && <NavItem to="/implant-company" icon="fa-solid fa-box-open" label="Implant Co." />}
                   {showAcademyView && <NavItem to="/academy" icon="fa-solid fa-graduation-cap" label="Beauty Academy" />}
               </>
           )}
           
           <div className="my-6 border-t border-white/10 mx-4"></div>
           
           <div className="flex gap-2 px-1">
               <button onClick={toggleLanguage} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all text-sm font-medium border border-white/5">
                 <i className="fa-solid fa-globe"></i>
                 <span>{language === 'en' ? 'AR' : 'EN'}</span>
               </button>
               <button onClick={toggleTheme} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-slate-400 hover:text-yellow-300 hover:bg-white/5 transition-all text-sm font-medium border border-white/5">
                 <i className={`fa-solid ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
                 <span>{isDarkMode ? 'Light' : 'Dark'}</span>
               </button>
           </div>

        </nav>

        <div className="p-4 m-4 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border border-white/10 flex items-center justify-center">
              <span className="font-bold text-sm text-slate-200">{(user?.name || user?.email || "U").charAt(0)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate text-slate-100">{user?.name}</p>
              <span className={`text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold ${getRoleBadgeColor(user?.role || UserRole.DOCTOR)}`}>
                {user?.role}
              </span>
            </div>
          </div>
          <button onClick={() => logout()} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all text-xs font-bold uppercase tracking-wide border border-red-500/10">
            <i className={`fa-solid ${language === 'ar' ? 'fa-arrow-left-from-bracket' : 'fa-arrow-right-from-bracket'}`}></i>
            {t('logout')}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-slate-50 md:bg-transparent dark:bg-slate-900">
        {/* Mobile Top Header */}
        <header className="md:hidden glass-panel p-4 flex justify-between items-center z-30 sticky top-0 shadow-sm shrink-0 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white">
                <i className="fa-solid fa-heart-pulse text-sm"></i>
            </div>
            <h1 className="font-bold text-slate-800 dark:text-white text-base">{t('system_name')}</h1>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={toggleTheme} className="text-slate-500 dark:text-yellow-400 hover:text-primary transition-colors">
                <i className={`fa-solid ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
            </button>
            <button onClick={toggleLanguage} className="text-primary font-bold text-xs bg-primary/10 px-3 py-1.5 rounded-full">
                {language === 'en' ? 'عربي' : 'En'}
            </button>
            <button onClick={() => logout()} className="text-slate-400 hover:text-red-400">
                <i className={`fa-solid ${language === 'ar' ? 'fa-arrow-left-from-bracket' : 'fa-arrow-right-from-bracket'}`}></i>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-auto p-4 md:p-8 relative pb-24 md:pb-8">
           <div className="max-w-7xl mx-auto mb-6 md:mb-8 animate-fade-in-down px-2">
                <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white tracking-tight">{title}</h2>
                <div className="h-1 w-16 bg-primary rounded-full mt-1.5"></div>
           </div>
           <div className="max-w-7xl mx-auto">
             {children}
           </div>
        </div>

        {/* Mobile Bottom Navigation Bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-around items-center z-40 px-2 pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
            {role === UserRole.ADMIN && <NavItem to="/admin" icon="fa-solid fa-shield-halved" label="Admin" mobile />}
            {role === UserRole.SECRETARY && <NavItem to="/reception" icon="fa-solid fa-clipboard-user" label="Clinic" mobile />}
            
            {showClinicalViews && (
              <>
                {role === UserRole.DOCTOR && <NavItem to="/doctor" icon="fa-solid fa-user-doctor" label="Console" mobile />}
                <NavItem to="/appointments" icon="fa-regular fa-calendar-check" label="Dates" mobile />
                <NavItem to="/patients" icon="fa-solid fa-users-viewfinder" label="Registry" mobile />
              </>
            )}
            
            {showLabView && <NavItem to="/dental-lab" icon="fa-solid fa-tooth" label="Lab" mobile />}
            {showImplantView && <NavItem to="/implant-company" icon="fa-solid fa-box-open" label="Implants" mobile />}
            {showAcademyView && <NavItem to="/academy" icon="fa-solid fa-graduation-cap" label="Academy" mobile />}
        </nav>
      </main>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </div>
  );
};

export default Layout;
