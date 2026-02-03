

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
      const response = await fetch('https://medloop-api.onrender.com/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }) // إزالة username إذا لم يكن مطلوبًا
      });

      // فحص نوع الاستجابة
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        setError('استجابة غير صالحة من السيرفر');
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      console.log("[LOGIN RESPONSE]", data);

      // فحص صحة البيانات
      if (!data || typeof data !== 'object') {
        setError('استجابة غير متوقعة من السيرفر');
        setIsLoading(false);
        return;
      }

      if (response.ok && data.token) {
        localStorage.setItem('token', data.token);
        const userToSave = data.user || { email, role: data.role };
        localStorage.setItem('user', JSON.stringify(userToSave));
        console.log("✅ دخول ناجح، جاري إعادة تحميل التطبيق...");
        window.location.reload();
      } else {
        setError(data.error || 'فشل تسجيل الدخول');
      }
    } catch (err: any) {
      setError('خطأ في الاتصال بالسيرفر');
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
          <div className="h-16 w-16 bg-gradient-to-tr from-primary to-cyan-400 text-white rounded-2xl flex items-center justify-center mb-4 text-3xl shadow-lg">
            <i className="fa-solid fa-heart-pulse animate-heartbeat"></i>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Medloop</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t('sign_in_subtitle')}</p>
        </div>
        <form onSubmit={handleSubmit} className="w-full space-y-5">
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
        <div className="mt-6 text-xs text-slate-400 text-center">© 2026 Medloop</div>
      </div>
      <DevModeSwitcher />
    </div>
  );
};

export default LoginView;
