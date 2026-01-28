

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import DevModeSwitcher from '../components/DevModeSwitcher';

const LoginView: React.FC = () => {
  const { login } = useAuth();
  const { t, toggleLanguage, language } = useLanguage();
  const { isDarkMode, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const fillCredential = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword('123456');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-slate-100 to-secondary/10 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors duration-300 relative p-2">
      {/* خلفية زخرفية */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[-15%] left-[-10%] w-[40vw] h-[40vw] bg-primary/20 rounded-full blur-[120px] animate-float"></div>
        <div className="absolute bottom-[-15%] right-[-10%] w-[40vw] h-[40vw] bg-secondary/20 rounded-full blur-[120px] animate-float" style={{animationDelay: '2s'}}></div>
      </div>

      <div className="relative z-10 w-full max-w-4xl flex flex-col md:flex-row shadow-2xl rounded-3xl overflow-hidden border border-white/40 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl">
        {/* لوحة جانبية: شعار وتبديل الوضع واللغة */}
        <div className="hidden md:flex flex-col items-center justify-between bg-gradient-to-b from-primary/90 to-secondary/80 dark:from-slate-900 dark:to-slate-800 p-10 w-1/2 relative">
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white/20 rounded-2xl p-4 shadow-lg">
              <i className="fa-solid fa-heart-pulse text-4xl text-primary drop-shadow"></i>
            </div>
            <h2 className="text-3xl font-bold text-white drop-shadow">Medloop</h2>
          </div>
          <div className="flex flex-col gap-4 w-full mt-10">
            <button onClick={toggleTheme} className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-white/20 text-white font-bold hover:bg-white/40 transition">
              <i className={`fa-solid ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
              {isDarkMode ? t('light_mode') : t('dark_mode')}
            </button>
            <button onClick={toggleLanguage} className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-white/20 text-white font-bold hover:bg-white/40 transition">
              <i className="fa-solid fa-globe"></i>
              {language === 'en' ? 'العربية' : 'English'}
            </button>
          </div>
          <div className="mt-10 text-xs text-white/70 text-center">
            <span>© 2026 Medloop</span>
          </div>
        </div>

        {/* نموذج تسجيل الدخول */}
        <div className="flex-1 flex flex-col justify-center p-8 sm:p-12 relative">
          <div className="flex flex-col items-center mb-8">
            <div className="h-16 w-16 bg-gradient-to-tr from-primary to-cyan-400 text-white rounded-2xl flex items-center justify-center mb-4 text-3xl shadow-lg">
              <i className="fa-solid fa-heart-pulse"></i>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{t('welcome_back')}</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{t('sign_in_subtitle')}</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t('email_label')}</label>
              <div className="relative">
                <i className="fa-regular fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm font-medium text-slate-800 dark:text-white hover:bg-white dark:hover:bg-slate-900 transition"
                  placeholder="user@medcore.com"
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

          {/* بيانات الدخول التجريبية */}
          <div className="mt-10">
            <h3 className="text-lg font-bold mb-2 text-slate-700 dark:text-white flex items-center gap-2">
              <i className="fa-solid fa-user-shield"></i> {t('demo_credentials')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button onClick={() => fillCredential('admin@medcore.com')} className="flex items-center gap-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-primary/10 hover:dark:bg-primary/20 transition group">
                <i className="fa-solid fa-shield-halved text-purple-500 group-hover:text-primary"></i>
                <span className="font-bold text-xs text-slate-800 dark:text-white">{t('admin_role')}</span>
                <span className="text-xs text-slate-400 font-mono ml-auto">admin@medcore.com</span>
              </button>
              <button onClick={() => fillCredential('dentist@medcore.com')} className="flex items-center gap-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-blue-100 hover:dark:bg-blue-900/20 transition group">
                <i className="fa-solid fa-user-doctor text-blue-500 group-hover:text-blue-700"></i>
                <span className="font-bold text-xs text-slate-800 dark:text-white">Dentist</span>
                <span className="text-xs text-slate-400 font-mono ml-auto">dentist@medcore.com</span>
              </button>
              <button onClick={() => fillCredential('lab@medcore.com')} className="flex items-center gap-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-amber-100 hover:dark:bg-amber-900/20 transition group">
                <i className="fa-solid fa-tooth text-amber-500 group-hover:text-amber-700"></i>
                <span className="font-bold text-xs text-slate-800 dark:text-white">{t('lab_tech')}</span>
                <span className="text-xs text-slate-400 font-mono ml-auto">lab@medcore.com</span>
              </button>
              <button onClick={() => fillCredential('implants@medcore.com')} className="flex items-center gap-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-cyan-100 hover:dark:bg-cyan-900/20 transition group">
                <i className="fa-solid fa-box-open text-cyan-500 group-hover:text-cyan-700"></i>
                <span className="font-bold text-xs text-slate-800 dark:text-white">{t('implant_mgr')}</span>
                <span className="text-xs text-slate-400 font-mono ml-auto">implants@medcore.com</span>
              </button>
              <button onClick={() => fillCredential('academy@medcore.com')} className="flex items-center gap-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-pink-100 hover:dark:bg-pink-900/20 transition group">
                <i className="fa-solid fa-graduation-cap text-pink-500 group-hover:text-pink-700"></i>
                <span className="font-bold text-xs text-slate-800 dark:text-white">Academy</span>
                <span className="text-xs text-slate-400 font-mono ml-auto">academy@medcore.com</span>
              </button>
            </div>
            <div className="text-xs text-slate-400 mt-2">{t('demo_hint')}</div>
          </div>
        </div>
      </div>
      <DevModeSwitcher />
    </div>
  );
};

export default LoginView;
