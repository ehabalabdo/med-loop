
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole, User } from '../types';

// Demo users for testing
const demoUsers: User[] = [
  { uid: 'demo_admin', name: 'Admin User', email: 'admin@medloop.com', role: UserRole.ADMIN, clinicIds: [], isActive: true, createdAt: Date.now(), createdBy: 'system', updatedAt: Date.now(), updatedBy: 'system' },
  { uid: 'demo_secretary', name: 'Secretary User', email: 'secretary@medloop.com', role: UserRole.SECRETARY, clinicIds: [], isActive: true, createdAt: Date.now(), createdBy: 'system', updatedAt: Date.now(), updatedBy: 'system' },
  { uid: 'demo_doctor', name: 'Dr. Ahmed', email: 'doctor@medloop.com', role: UserRole.DOCTOR, clinicIds: [], isActive: true, createdAt: Date.now(), createdBy: 'system', updatedAt: Date.now(), updatedBy: 'system' },
  { uid: 'demo_lab', name: 'Lab Technician', email: 'lab@medloop.com', role: UserRole.LAB_TECH, clinicIds: [], isActive: true, createdAt: Date.now(), createdBy: 'system', updatedAt: Date.now(), updatedBy: 'system' },
  { uid: 'demo_implant', name: 'Implant Manager', email: 'implant@medloop.com', role: UserRole.IMPLANT_MANAGER, clinicIds: [], isActive: true, createdAt: Date.now(), createdBy: 'system', updatedAt: Date.now(), updatedBy: 'system' },
  { uid: 'demo_course', name: 'Course Manager', email: 'academy@medloop.com', role: UserRole.COURSE_MANAGER, clinicIds: [], isActive: true, createdAt: Date.now(), createdBy: 'system', updatedAt: Date.now(), updatedBy: 'system' }
];

const DevModeSwitcher: React.FC = () => {
  const { user: currentUser, simulateLogin } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleSwitch = (targetUser: User) => {
    // 1. Perform the login switch
    simulateLogin(targetUser);
    setIsOpen(false);

    // 2. Navigate to the correct dashboard based on role
    switch (targetUser.role) {
        case UserRole.ADMIN:
            navigate('/admin');
            break;
        case UserRole.SECRETARY:
            navigate('/reception');
            break;
        case UserRole.DOCTOR:
            navigate('/doctor');
            break;
        case UserRole.LAB_TECH:
            navigate('/dental-lab');
            break;
        case UserRole.IMPLANT_MANAGER:
            navigate('/implant-company');
            break;
        case UserRole.COURSE_MANAGER:
            navigate('/academy');
            break;
        default:
            navigate('/');
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      {isOpen && (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-2xl rounded-2xl mb-4 w-80 overflow-hidden animate-fade-in-up">
          <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
            <div>
                <h4 className="font-bold text-sm flex items-center gap-2">
                    <i className="fa-solid fa-users-gear text-yellow-400"></i> Role Switcher
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Instant Access Portal</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>
          
          <div className="p-2 max-h-[400px] overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-900/50">
            {demoUsers.map(u => {
              const isActive = currentUser?.uid === u.uid;
              return (
                <button
                    key={u.uid}
                    onClick={() => handleSwitch(u)}
                    disabled={isActive}
                    className={`w-full text-left p-3 rounded-xl flex items-center gap-3 mb-2 transition-all border ${
                        isActive 
                        ? 'bg-primary/10 border-primary text-primary dark:text-primary cursor-default' 
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:shadow-md'
                    }`}
                >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${
                        u.role === 'admin' ? 'bg-purple-100 text-purple-600' : 
                        u.role === 'doctor' ? 'bg-blue-100 text-blue-600' :
                        u.role === 'secretary' ? 'bg-emerald-100 text-emerald-600' :
                        'bg-gray-100 text-gray-600'
                    }`}>
                        <i className={`fa-solid ${
                            u.role === 'admin' ? 'fa-shield-halved' : 
                            u.role === 'doctor' ? 'fa-user-doctor' :
                            u.role === 'secretary' ? 'fa-clipboard-user' :
                            'fa-user'
                        }`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-slate-800 dark:text-white truncate">{u.name}</div>
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{u.role}</div>
                    </div>
                    {isActive && <i className="fa-solid fa-check-circle"></i>}
                </button>
              );
            })}
          </div>
          <div className="p-3 bg-slate-100 dark:bg-slate-800 text-[10px] text-center text-slate-400 border-t border-slate-200 dark:border-slate-700">
             Current Session: <span className="font-bold text-slate-600 dark:text-slate-300">{currentUser?.name || 'Guest'}</span>
          </div>
        </div>
      )}
      
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`h-14 w-14 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center justify-center text-xl z-50 relative border-4 border-white dark:border-slate-800 ${
            isOpen ? 'bg-slate-800 text-white rotate-45' : 'bg-yellow-400 text-slate-900 animate-bounce-slow'
        }`}
        title="Switch User Role"
      >
        <i className={`fa-solid ${isOpen ? 'fa-plus' : 'fa-bolt'}`}></i>
      </button>
      
      <style>{`
        .animate-bounce-slow { animation: bounce 3s infinite; }
        @keyframes bounce {
            0%, 100% { transform: translateY(-5%); }
            50% { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default DevModeSwitcher;
