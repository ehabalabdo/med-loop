import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const PatientLoginView: React.FC = () => {
  const navigate = useNavigate();
  const { patientLogin } = useAuth();
  const { t, dir } = useLanguage();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await patientLogin(username, password);
      navigate('/patient/dashboard');
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4" dir={dir}>
      <div className="max-w-md w-full">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <i className="fa-solid fa-user-injured text-white text-3xl"></i>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">بوابة المريض</h1>
          <p className="text-slate-500 text-sm">MED LOOP Patient Portal</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                <i className="fa-solid fa-circle-exclamation"></i>
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                <i className="fa-solid fa-user ml-1"></i> اسم المستخدم
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="أدخل اسم المستخدم"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                <i className="fa-solid fa-lock ml-1"></i> كلمة المرور
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="أدخل كلمة المرور"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  جاري تسجيل الدخول...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-right-to-bracket"></i>
                  تسجيل الدخول
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-2 mx-auto"
            >
              <i className="fa-solid fa-arrow-left"></i>
              تسجيل دخول الموظفين
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-slate-400">
          <p>للمساعدة، يرجى الاتصال بالعيادة</p>
        </div>
      </div>
    </div>
  );
};

export default PatientLoginView;
