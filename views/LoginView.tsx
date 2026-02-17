

import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useClientSafe } from '../context/ClientContext';

const LoginView: React.FC = () => {
  const { login } = useAuth();
  const { t, toggleLanguage, language } = useLanguage();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const clientCtx = useClientSafe();
  const client = clientCtx?.client;
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await login(identifier, password);
      // Login successful - redirect to appropriate dashboard
      // Give AuthContext a moment to update state
      setTimeout(() => {
        const savedUser = localStorage.getItem('user');
        const savedPatient = localStorage.getItem('patientUser');
        
        if (savedPatient) {
          navigate(slug ? `/${slug}/patient/dashboard` : '/patient/dashboard', { replace: true });
        } else if (savedUser) {
          try {
            const parsed = JSON.parse(savedUser);
            const role = parsed.role;
            const prefix = slug ? `/${slug}` : '';
            if (role === 'admin') navigate(`${prefix}/admin`, { replace: true });
            else if (role === 'secretary') navigate(`${prefix}/reception`, { replace: true });
            else if (role === 'doctor') navigate(`${prefix}/doctor`, { replace: true });
            else if (role === 'lab_tech') navigate(`${prefix}/dental-lab`, { replace: true });
            else if (role === 'implant_manager') navigate(`${prefix}/implant-company`, { replace: true });
            else if (role === 'course_manager') navigate(`${prefix}/academy`, { replace: true });
            else navigate(`${prefix}/`, { replace: true });
          } catch {
            navigate(slug ? `/${slug}/` : '/', { replace: true });
          }
        }
      }, 100);
    } catch (err: any) {
      setError(err.message || 'خطأ في تسجيل الدخول');
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-slate-100 to-secondary/10 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors duration-300 relative p-2">
      {/* زر اللغة والوضع الليلي في الزاوية */}
      <div className="absolute top-6 right-6 flex flex-col gap-2 z-20">
        <button
          onClick={toggleTheme}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/30 text-primary text-lg shadow-md hover:scale-110 hover:bg-primary/60 transition-all duration-300 animate-bounce-slow"
          style={{fontWeight: 'bold'}}
          aria-label="Toggle dark mode"
        >
          <i className={`fa-solid ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
        </button>
        <button
          onClick={toggleLanguage}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/30 text-primary text-lg shadow-md hover:scale-110 hover:bg-secondary/60 transition-all duration-300 animate-bounce-slow"
          style={{fontWeight: 'bold'}}
          aria-label="Toggle language"
        >
          <i className="fa-solid fa-globe"></i>
        </button>
      </div>

      {/* نموذج مركزي */}
      <div className="relative z-10 w-full max-w-md mx-auto bg-white/90 dark:bg-slate-900/90 rounded-3xl shadow-2xl border border-white/40 dark:border-slate-700 backdrop-blur-xl p-8 flex flex-col items-center">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg overflow-hidden bg-white">
            <img src={client?.logoUrl || "/logo.png"} alt={client?.name || "MED LOOP"} className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{client?.name || 'Medloop'}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t('sign_in_subtitle')}</p>
        </div>
        <form onSubmit={handleSubmit} className="w-full space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">الاسم / البريد الإلكتروني / اسم المستخدم</label>
            <div className="relative">
              <i className="fa-solid fa-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm font-medium text-slate-800 dark:text-white hover:bg-white dark:hover:bg-slate-900 transition"
                placeholder="أدخل الاسم أو البريد أو اسم المستخدم"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t('password_label')}</label>
            <div className="relative">
              <i className="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm font-medium text-slate-800 dark:text-white hover:bg-white dark:hover:bg-slate-900 transition"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-300 text-sm flex items-center gap-2 animate-pulse">
              <i className="fa-solid fa-circle-exclamation"></i>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-primary to-secondary hover:from-secondary hover:to-primary text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <i className="fa-solid fa-circle-notch fa-spin"></i> {t('authenticating')}
              </span>
            ) : t('sign_in_btn')}
          </button>
        </form>
        <div className="mt-6 text-center text-xs text-slate-400 font-medium">
          <i className="fa-solid fa-shield-halved mr-1"></i> {t('protected_msg')}
        </div>
        <div className="mt-6 text-xs text-slate-400 text-center">© 2026 Medloop</div>
      </div>
    </div>
  );
};

export default LoginView;
