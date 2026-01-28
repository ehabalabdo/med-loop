
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



  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300">
      
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] animate-float"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-secondary/20 rounded-full blur-[120px] animate-float" style={{animationDelay: '2s'}}></div>

      <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-white/50 dark:border-slate-700 rounded-3xl shadow-glass w-full max-w-5xl overflow-hidden flex flex-col md:flex-row relative z-10 transition-colors duration-300">
        
        {/* Top Controls */}
        <div className="absolute top-6 right-6 z-20 flex gap-2">
            <button 
                onClick={toggleTheme}
                className="text-xs font-bold text-slate-500 dark:text-slate-300 hover:text-primary dark:hover:text-yellow-400 bg-white/50 dark:bg-slate-700/50 border border-white dark:border-slate-600 px-3 py-2 rounded-full transition-all hover:shadow-md"
            >
                <i className={`fa-solid ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
            </button>
            <button 
                onClick={toggleLanguage}
                className="text-xs font-bold text-slate-500 dark:text-slate-300 hover:text-primary bg-white/50 dark:bg-slate-700/50 border border-white dark:border-slate-600 px-4 py-2 rounded-full transition-all hover:shadow-md"
            >
                <i className="fa-solid fa-globe mr-2"></i>
                {language === 'en' ? 'العربية' : 'English'}
            </button>
        </div>

        {/* Left: Login Form */}
        <div className="p-10 md:p-14 w-full md:w-1/2 order-2 md:order-1 flex flex-col justify-center">
          <div className="mb-10">
            <div className="h-14 w-14 bg-gradient-to-tr from-primary to-cyan-400 text-white rounded-2xl flex items-center justify-center mb-6 text-2xl shadow-lg shadow-primary/20">
              <i className="fa-solid fa-heart-pulse"></i>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{t('welcome_back')}</h1>
            <p className="text-slate-500 dark:text-slate-400">{t('sign_in_subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">{t('email_label')}</label>
              <div className="relative">
                  <i className="fa-regular fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 rtl:right-4 rtl:left-auto"></i>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm font-medium text-slate-800 dark:text-white rtl:pr-11 rtl:pl-4 hover:bg-white dark:hover:bg-slate-900"
                    placeholder="user@medcore.com"
                    required
                  />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">{t('password_label')}</label>
              <div className="relative">
                  <i className="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 rtl:right-4 rtl:left-auto"></i>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm font-medium text-slate-800 dark:text-white rtl:pr-11 rtl:pl-4 hover:bg-white dark:hover:bg-slate-900"
                    placeholder="••••••••"
                    required
                  />
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-300 text-sm flex items-center gap-3 animate-pulse">
                <i className="fa-solid fa-circle-exclamation text-lg"></i>
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-slate-900 to-slate-800 hover:from-primary hover:to-secondary text-white font-bold py-4 rounded-xl shadow-lg shadow-slate-900/20 hover:shadow-primary/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="fa-solid fa-circle-notch fa-spin"></i> {t('authenticating')}
                </span>
              ) : t('sign_in_btn')}
            </button>
          </form>

          <div className="mt-8 text-center text-xs text-slate-400 font-medium">
            <p><i className="fa-solid fa-shield-halved mr-1"></i> {t('protected_msg')}</p>
          </div>
        </div>


      </div>

      <DevModeSwitcher />
    </div>
  );
};

export default LoginView;
