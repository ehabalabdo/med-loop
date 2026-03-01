
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { ClinicService, PatientService } from '../services/services';
import { Patient, Clinic, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { fmtDate } from '../utils/formatters';

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
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [currentCalling, setCurrentCalling] = useState<{name: string, clinic: string, patientId?: string} | null>(null);
  
  // Track previous patients to detect changes for TTS
  const prevPatientsRef = useRef<Patient[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const callingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Audio & TTS Logic
  const speak = async (text: string, langCode: string = 'en-US') => {
    if (!soundEnabled) return;
    
    try {
        // 1. Play chime (simple oscillator)
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
        
        // Wait for chime to finish
        await new Promise(resolve => {
            osc.onended = () => {
                ctx.close();
                resolve(true);
            };
        });

        // 2. Fetch and play Google TTS Audio
        const googleLang = langCode.startsWith('ar') ? 'ar' : 'en';
        // Using a more reliable free TTS API endpoint (Google Translate API sometimes blocks direct Audio tag requests due to CORS/Referer)
        const audioUrl = `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=${googleLang}&client=tw-ob&q=${encodeURIComponent(text)}`;
        
        const audio = new Audio(audioUrl);
        await audio.play();

    } catch (e) {
        console.warn("Audio playback failed, falling back to browser TTS", e);
        // Fallback to browser's built-in TTS if the audio file fails
        if (window.speechSynthesis) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = langCode;
            utterance.rate = 0.8;
            
            // Try to find a specific voice for the language
            const voices = window.speechSynthesis.getVoices();
            let targetVoice = null;

            if (langCode.startsWith('ar')) {
                targetVoice = voices.find(v => v.lang.startsWith('ar') || v.lang.includes('ar-')) || 
                              voices.find(v => v.name.toLowerCase().includes('arabic'));
            } else {
                targetVoice = voices.find(v => v.lang.startsWith('en'));
            }

            if (targetVoice) {
                utterance.voice = targetVoice;
            }
            
            window.speechSynthesis.speak(utterance);
        }
    }
  };

  const testAudio = () => {
      speak("تجربة الصوت، أهلاً بك في العيادة", "ar-SA");
  };

  // Load clinic names once (separate from subscription to avoid infinite loop)
  useEffect(() => {
    if (!user) return;
    ClinicService.getActive().then(all => {
      const map: Record<string, string> = {};
      all.forEach(c => map[c.id] = c.name);
      setClinics(map);
    });
  }, [user]);

  // Ref to always have latest clinics in subscription callback without re-subscribing
  const clinicsRef = React.useRef(clinics);
  useEffect(() => { clinicsRef.current = clinics; }, [clinics]);

  // Subscribe to Patients (separate effect, no clinics dependency)
  useEffect(() => {
    if (!user) return;

    const subscription = PatientService.subscribe(user, (data) => {
       console.log('[QueueDisplayView] Received patients from subscription:', {
         count: data.length,
         patients: data.map(p => ({ id: p.id, name: p.name, status: p.currentVisit.status }))
       });
       
       // PatientService.subscribe already filters out patients with empty visitId
       // So we only need to filter by status here
       const active = data.filter(p => p.currentVisit.status !== 'completed');
       
       console.log('[QueueDisplayView] Active patients after filter:', active.length);
       
       // Check for new "in-progress" status (patient called by doctor)
       active.forEach(p => {
           const prev = prevPatientsRef.current.find(old => old.id === p.id);
           if (p.currentVisit.status === 'in-progress' && prev?.currentVisit.status !== 'in-progress') {
               const clinicName = clinicsRef.current[p.currentVisit.clinicId] || 'Clinic';
               
               // Show popup notification
               setCurrentCalling({ name: p.name, clinic: clinicName, patientId: p.id });
               
               // Clear any existing timeout
               if (callingTimeoutRef.current) clearTimeout(callingTimeoutRef.current);
               // Auto-hide after 5 seconds
               callingTimeoutRef.current = setTimeout(() => setCurrentCalling(null), 5000);
               
               // Announce patient name
               const isArabicName = /[\u0600-\u06FF]/.test(p.name);
               const text = isArabicName 
                 ? `الرجاء من المريض ${p.name}, التوجه إلى ${clinicName}`
                 : `Patient ${p.name}, please proceed to ${clinicName}`;
               speak(text, isArabicName ? 'ar-SA' : 'en-US');
           }
       });

       prevPatientsRef.current = active;
       setPatients(active);
    });
    
    unsubscribeRef.current = subscription;

    return () => {
        if(unsubscribeRef.current) unsubscribeRef.current();
    };
  }, [user, soundEnabled, language]); // clinics removed to prevent infinite loop (use clinicsRef)

  return (
    <div className="min-h-screen bg-[#05080f] text-white flex flex-col font-sans relative overflow-hidden">
      
      {/* Futuristic Background Elements */}
      <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-600/10 blur-[150px] rounded-full"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[150px] rounded-full"></div>
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='103.92304845413263' viewBox='0 0 60 103.92304845413263' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 103.92304845413263L0 86.60254037844386L0 51.96152422706631L30 34.64101615137755L60 51.96152422706631L60 86.60254037844386Z' fill='none' stroke='%2306b6d4' stroke-width='1'/%3E%3Cpath d='M30 51.96152422706631L0 34.64101615137755L0 0L30 -17.32050807568877L60 0L60 34.64101615137755Z' fill='none' stroke='%2306b6d4' stroke-width='1'/%3E%3C/svg%3E")`, backgroundSize: '60px 103.9px' }}></div>
      </div>

      {/* Header */}
      <header className="relative z-10 bg-[#0a0f16]/80 backdrop-blur-xl px-8 py-6 flex justify-between items-center border-b border-cyan-900/50 shadow-[0_10px_30px_rgba(8,145,178,0.1)]">
        <div className="flex items-center gap-6">
           <div className="relative">
               <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full"></div>
               <img src="/logo.png" alt="MED LOOP" className="w-16 h-16 object-contain relative z-10 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
           </div>
           <div>
             <h1 className="text-3xl font-bold tracking-widest text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)] uppercase">{t('system_name')}</h1>
             <p className="text-cyan-500/80 text-sm font-mono tracking-[0.2em] uppercase mt-1">{t('queue_display_title')}</p>
           </div>
        </div>
        
        <div className="flex items-center gap-4">
            <button 
                onClick={testAudio}
                className="px-6 py-2.5 rounded-full text-sm font-bold tracking-wider uppercase transition-all duration-300 flex items-center gap-3 bg-blue-500/10 text-blue-400 border border-blue-500/50 hover:bg-blue-500/20"
            >
                <i className="fa-solid fa-play"></i>
                Test Audio
            </button>
            <button 
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`px-6 py-2.5 rounded-full text-sm font-bold tracking-wider uppercase transition-all duration-300 flex items-center gap-3 ${soundEnabled ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/50 shadow-[0_0_15px_rgba(8,145,178,0.3)]' : 'bg-slate-800/50 text-slate-500 border border-slate-700 hover:text-white'}`}
            >
                <i className={`fa-solid ${soundEnabled ? 'fa-volume-high animate-pulse' : 'fa-volume-xmark'}`}></i>
                {soundEnabled ? 'Audio ON' : 'Audio OFF'}
            </button>
        </div>

        <div className="text-right flex flex-col items-end">
           <div className="text-5xl font-light tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
             {currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
           </div>
           <div className="text-cyan-500/70 text-sm font-mono uppercase tracking-[0.2em] mt-1">
             {fmtDate(currentTime)}
           </div>
        </div>
      </header>

      {/* Calling Popup */}
      {currentCalling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05080f]/90 backdrop-blur-xl animate-fade-in">
          <div className="relative bg-[#0a0f16] rounded-[3rem] p-16 shadow-[0_0_100px_rgba(8,145,178,0.3)] border border-cyan-500/30 max-w-4xl w-full mx-8 overflow-hidden">
            {/* Popup Background Effects */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-cyan-500/10 blur-[100px] rounded-full animate-pulse"></div>
                <div className="absolute inset-0 border-[10px] border-cyan-500/10 rounded-[3rem]"></div>
            </div>

            <div className="relative z-10 text-center space-y-10">
              <div className="text-8xl mb-6">
                <div className="inline-flex items-center justify-center w-40 h-40 rounded-full bg-cyan-500/20 border-2 border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.5)] animate-bounce-subtle">
                    <i className="fa-solid fa-bullhorn animate-ring text-cyan-300"></i>
                </div>
              </div>
              <h2 className="text-6xl font-bold text-white tracking-wide drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                {language === 'ar' ? 'حان دورك!' : 'Your Turn!'}
              </h2>
              
              <div className="bg-cyan-950/40 border border-cyan-800/50 rounded-3xl p-10 backdrop-blur-md transform transition-all hover:scale-105">
                <p className="text-3xl font-medium text-cyan-100/70 mb-4 uppercase tracking-widest">
                  {language === 'ar' ? 'المريض' : 'Patient'}
                </p>
                <p className="text-6xl font-bold text-white mb-10 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                  {currentCalling.name}
                </p>
                
                <div className="w-24 h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent mx-auto mb-10 opacity-50"></div>

                <p className="text-2xl text-cyan-100/70 mb-4 uppercase tracking-widest">
                  {language === 'ar' ? 'يرجى التوجه إلى' : 'Please proceed to'}
                </p>
                <p className="text-5xl font-bold text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.4)] flex items-center justify-center gap-6">
                  <i className="fa-solid fa-door-open"></i>
                  {currentCalling.clinic}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-hidden flex flex-col relative z-10">
        <div className="flex-1 bg-[#0f172a]/60 rounded-[2rem] border border-cyan-900/30 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] backdrop-blur-xl flex flex-col">
           
           {/* Table Header */}
           <div className="grid grid-cols-4 bg-cyan-950/40 text-cyan-400 p-6 text-sm font-mono font-bold uppercase tracking-[0.2em] border-b border-cyan-900/50">
              <div className="pl-4">{t('patient_col')}</div>
              <div>{t('clinic_col')}</div>
              <div className="text-center">{t('status_col')}</div>
              <div className="text-end pr-4">{t('time_col')}</div>
           </div>

           {/* Table Body */}
           <div className="divide-y divide-cyan-900/20 overflow-y-auto h-full custom-scrollbar">
              {patients.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-cyan-500/30 gap-6">
                    <i className="fa-solid fa-satellite-dish text-7xl animate-pulse"></i>
                    <p className="text-2xl font-mono tracking-widest uppercase">{t('no_active_patients')}</p>
                </div>
              ) : patients.map((p, idx) => (
                <div key={p.id} className={`grid grid-cols-4 p-6 items-center text-2xl transition-all duration-500 animate-fade-in ${idx % 2 === 0 ? 'bg-cyan-950/10' : 'bg-transparent'} hover:bg-cyan-900/20 group`}>
                   
                   <div className="font-bold text-white flex items-center gap-6 pl-4">
                      <div className="relative flex items-center justify-center w-12 h-12">
                          <div className="absolute inset-0 border border-cyan-500/30 rounded-full group-hover:border-cyan-400 transition-colors"></div>
                          <div className="absolute inset-1 border border-dashed border-cyan-700 rounded-full animate-[spin_10s_linear_infinite]"></div>
                          <span className="text-cyan-400 font-mono text-lg">{String(idx + 1).padStart(2, '0')}</span>
                      </div>
                      <span className="drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">{p.name}</span>
                   </div>

                   <div className="text-cyan-100/80 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-950/50 border border-blue-900/50 flex items-center justify-center text-blue-400">
                          <i className="fa-solid fa-house-medical"></i>
                      </div>
                      <span className="font-medium tracking-wide">{clinics[p.currentVisit.clinicId] || '...'}</span>
                   </div>

                   <div className="text-center">
                      {p.currentVisit.status === 'in-progress' ? (
                          <div className="inline-flex items-center gap-3 px-6 py-2.5 rounded-full bg-cyan-500/20 border border-cyan-400 text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.2)] animate-pulse">
                              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping absolute"></span>
                              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 relative"></span>
                              <span className="font-bold tracking-widest uppercase text-sm">{t('queue_status_in')}</span>
                          </div>
                      ) : (
                          <div className="inline-flex items-center gap-3 px-6 py-2.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
                              <i className="fa-solid fa-hourglass-half"></i>
                              <span className="font-bold tracking-widest uppercase text-sm">{t('queue_status_wait')}</span>
                          </div>
                      )}
                   </div>

                   <div className="text-end pr-4 font-mono text-cyan-500/60 text-xl">
                      {new Date(p.currentVisit.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                   </div>
                </div>
              ))}
           </div>

        </div>
      </main>

      <style>{`
        .animate-fade-in {
            animation: fadeIn 0.5s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce-subtle {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        .animate-bounce-subtle {
            animation: bounce-subtle 2s ease-in-out infinite;
        }
        @keyframes ring {
            0%, 100% { transform: rotate(-15deg); }
            25% { transform: rotate(15deg); }
            50% { transform: rotate(-10deg); }
            75% { transform: rotate(10deg); }
        }
        .animate-ring {
            animation: ring 0.5s ease-in-out infinite;
        }
        .custom-scrollbar::-webkit-scrollbar {
            width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: rgba(8, 145, 178, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(8, 145, 178, 0.2);
            border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(8, 145, 178, 0.4);
        }
      `}</style>
    </div>
  );
};

export default QueueDisplayView;
