
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { ClinicService, PatientService } from '../services/services';
import { Patient, Clinic, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';

/**
 * QueueDisplayView
 * Designed for TV screens / External Monitors
 * Minimal UI, High Contrast, Auto-Updating
 */
const QueueDisplayView: React.FC = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth(); // We need auth to access the DB service
  const [patients, setPatients] = useState<Patient[]>([]);
  const [clinics, setClinics] = useState<Record<string, string>>({});
  const [currentTime, setCurrentTime] = useState(new Date());
  const [soundEnabled, setSoundEnabled] = useState(false);
  
  // Track previous patients to detect changes for TTS
  const prevPatientsRef = useRef<Patient[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Audio & TTS Logic
  const speak = (text: string) => {
    if (!soundEnabled || !window.speechSynthesis) return;
    
    // Play chime (simple oscillator)
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);

    // Speak after chime
    setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = language === 'ar' ? 'ar-SA' : 'en-US';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    }, 600);
  };

  // Fetch Logic
  useEffect(() => {
    if (!user) return;

    // 1. Get Clinic Names
    ClinicService.getActive().then(all => {
      const map: Record<string, string> = {};
      all.forEach(c => map[c.id] = c.name);
      setClinics(map);
    });

    // 2. Poll for Patients
    const fetchData = async () => {
       const dummyUser = { ...user, role: UserRole.SECRETARY }; 
       const subscription = PatientService.subscribe(dummyUser, (data) => {
          // Filter out completed to keep screen clean
          const active = data.filter(p => p.currentVisit.status !== 'completed');
          
          // Check for new "in-progress" status (patient called by doctor)
          active.forEach(p => {
              const prev = prevPatientsRef.current.find(old => old.id === p.id);
              if (p.currentVisit.status === 'in-progress' && prev?.currentVisit.status !== 'in-progress') {
                  const clinicName = clinics[p.currentVisit.clinicId] || 'Clinic';
                  // Announce patient name
                  const text = language === 'ar' 
                    ? `المريض ${p.name}, يرجى التوجه إلى ${clinicName}`
                    : `Patient ${p.name}, please proceed to ${clinicName}`;
                  speak(text);
              }
          });

          prevPatientsRef.current = active;
          setPatients(active);
       });
       return subscription;
    };

    fetchData().then(unsub => {
      unsubscribeRef.current = unsub;
    });

    const poller = setInterval(() => {
       fetchData().then(unsub => {
          if(unsubscribeRef.current) unsubscribeRef.current();
          unsubscribeRef.current = unsub;
       });
    }, 3000);

    return () => {
        if(unsubscribeRef.current) unsubscribeRef.current();
        clearInterval(poller);
    };
  }, [user, clinics, soundEnabled]); // Added dependencies

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col font-sans">
      
      {/* Header */}
      <header className="bg-slate-800 p-6 flex justify-between items-center border-b border-slate-700 shadow-lg relative">
        <div className="flex items-center gap-4">
           <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center text-3xl shadow-lg shadow-primary/20">
             <i className="fa-solid fa-heart-pulse text-white"></i>
           </div>
           <div>
             <h1 className="text-3xl font-bold tracking-wide">{t('system_name')}</h1>
             <p className="text-slate-400 text-lg">{t('queue_display_title')}</p>
           </div>
        </div>
        
        <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`absolute top-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-bold transition-colors ${soundEnabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-500 hover:text-white'}`}
        >
            <i className={`fa-solid ${soundEnabled ? 'fa-volume-high' : 'fa-volume-xmark'} mr-2`}></i>
            {soundEnabled ? 'Audio ON' : 'Click to Enable Audio'}
        </button>

        <div className="text-right">
           <div className="text-4xl font-mono font-bold text-primary">
             {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
           </div>
           <div className="text-slate-400 text-sm uppercase tracking-widest mt-1">
             {currentTime.toLocaleDateString()}
           </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-hidden flex flex-col">
        <div className="flex-1 bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl backdrop-blur-sm">
           
           {/* Table Header */}
           <div className="grid grid-cols-4 bg-slate-700 text-slate-300 p-5 text-xl font-bold uppercase tracking-wider">
              <div>{t('patient_col')}</div>
              <div>{t('clinic_col')}</div>
              <div className="text-center">{t('status_col')}</div>
              <div className="text-end">{t('time_col')}</div>
           </div>

           {/* Table Body */}
           <div className="divide-y divide-slate-700/50 overflow-y-auto h-full">
              {patients.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
                    <i className="fa-regular fa-clock text-6xl opacity-50"></i>
                    <p className="text-2xl">{t('no_active_patients')}</p>
                </div>
              ) : patients.map((p, idx) => (
                <div key={p.id} className={`grid grid-cols-4 p-6 items-center text-xl transition-all animate-fade-in ${idx % 2 === 0 ? 'bg-slate-800/30' : 'bg-transparent'}`}>
                   
                   {/* Patient Name (Masked for privacy if needed, but usually full name in clinics) */}
                   <div className="font-bold text-2xl flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-mono text-slate-400">
                        {idx + 1}
                      </div>
                      {p.name}
                   </div>

                   {/* Clinic */}
                   <div className="text-slate-300">
                      <i className="fa-solid fa-hospital-user mr-2 text-slate-500"></i>
                      {clinics[p.currentVisit.clinicId] || '...'}
                   </div>

                   {/* Status Badge */}
                   <div className="text-center">
                      <span className={`inline-block px-6 py-2 rounded-full font-bold shadow-lg ${
                         p.currentVisit.status === 'in-progress' 
                         ? 'bg-green-600 text-white animate-pulse' 
                         : 'bg-amber-600 text-white'
                      }`}>
                         {p.currentVisit.status === 'in-progress' ? t('queue_status_in') : t('queue_status_wait')}
                      </span>
                   </div>

                   {/* Time */}
                   <div className="text-end font-mono text-slate-400">
                      {new Date(p.currentVisit.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   </div>
                </div>
              ))}
           </div>

        </div>
      </main>

      {/* Ticker / Footer */}
      <footer className="bg-primary text-white p-3 overflow-hidden whitespace-nowrap">
         <div className="animate-marquee inline-block font-semibold">
            Please have your ID ready • يرجى تجهيز الهوية الشخصية • Emergency cases are prioritized • الحالات الطارئة لها الأولوية
         </div>
      </footer>

      <style>{`
        @keyframes marquee {
            0% { transform: translateX(100%); }
            100% { transform: translateX(-100%); }
        }
        .animate-marquee {
            animation: marquee 20s linear infinite;
        }
        .animate-fade-in {
            animation: fadeIn 0.5s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default QueueDisplayView;
