
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

        {/* Right: Info/Demo Section - Modern Dark */}
        <div className="w-full md:w-1/2 bg-slate-900 text-white p-10 md:p-14 flex flex-col justify-center order-1 md:order-2 relative overflow-hidden">
           {/* Abstract Pattern */}
           <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px'}}></div>
           
           <div className="relative z-10">
                <div className="mb-8">
                    <h3 className="text-2xl font-bold mb-2">{t('demo_credentials')}</h3>
                    <p className="text-slate-400 text-sm">{t('demo_hint')}</p>
                </div>
           
               <div className="space-y-4">
                 <button onClick={() => fillCredential('admin@medcore.com')} className="w-full text-left p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all flex items-center gap-4 group">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-white transition shadow-lg shadow-purple-900/20">
                      <i className="fa-solid fa-shield-halved text-lg"></i>
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-100">{t('admin_role')}</div>
                      <div className="text-xs text-slate-400 font-mono">admin@medcore.com</div>
                    </div>
                    <i className="fa-solid fa-arrow-right ml-auto text-slate-600 group-hover:text-white transition opacity-0 group-hover:opacity-100"></i>
                 </button>

                 <div className="flex gap-2">
                    <button onClick={() => fillCredential('dentist@medcore.com')} className="flex-1 text-left p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all flex items-center gap-2 group">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition shadow-lg shadow-blue-900/20">
                        <i className="fa-solid fa-user-doctor"></i>
                        </div>
                        <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-100 truncate">Dentist</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">dentist@medcore.com</div>
                        </div>
                    </button>
                    <button onClick={() => fillCredential('lab@medcore.com')} className="flex-1 text-left p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all flex items-center gap-2 group">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition">
                        <i className="fa-solid fa-tooth"></i>
                        </div>
                        <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-100 truncate">{t('lab_tech')}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">lab@medcore.com</div>
                        </div>
                    </button>
                 </div>
                 
                 <div className="flex gap-2">
                    <button onClick={() => fillCredential('implants@medcore.com')} className="flex-1 text-left p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all flex items-center gap-2 group">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center group-hover:bg-cyan-500 group-hover:text-white transition shadow-lg shadow-cyan-900/20">
                        <i className="fa-solid fa-box-open"></i>
                        </div>
                        <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-100 truncate">{t('implant_mgr')}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">implants@medcore.com</div>
                        </div>
                    </button>
                    
                    {/* Course Manager */}
                    <button onClick={() => fillCredential('academy@medcore.com')} className="flex-1 text-left p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all flex items-center gap-2 group">
                        <div className="w-8 h-8 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center group-hover:bg-pink-500 group-hover:text-white transition shadow-lg shadow-pink-900/20">
                        <i className="fa-solid fa-graduation-cap"></i>
                        </div>
                        <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-100 truncate">Academy</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">academy@medcore.com</div>
                        </div>
                    </button>
                 </div>

               </div>
           </div>
        </div>
      </div>

      <DevModeSwitcher />
    </div>
  );
};

export default LoginView;
