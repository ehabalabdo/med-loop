
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
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [clinics, setClinics] = useState<Record<string, string>>({});
  const [currentTime, setCurrentTime] = useState(new Date());
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [ttsStatus, setTtsStatus] = useState('اضغط لتفعيل الصوت');
  const [currentCalling, setCurrentCalling] = useState<{name: string, clinic: string, patientId?: string} | null>(null);
  
  const prevPatientsRef = useRef<Patient[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const callingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soundEnabledRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Create persistent audio element
  useEffect(() => {
    const audio = new Audio();
    audio.volume = 1;
    audioRef.current = audio;
    return () => { audio.pause(); audio.src = ''; };
  }, []);

  // ============ SERVER-SIDE TTS (via Vercel serverless proxy) ============
  const speakServer = (text: string, isArabic: boolean): Promise<void> => {
    return new Promise((resolve, reject) => {
      const audio = audioRef.current;
      if (!audio) { reject('no audio element'); return; }
      
      const lang = isArabic ? 'ar' : 'en';
      // This calls our own /api/tts serverless function (same domain, no CORS)
      const url = `/api/tts?lang=${encodeURIComponent(lang)}&text=${encodeURIComponent(text)}`;
      
      console.log('[TTS] Server TTS URL:', url);
      setTtsStatus('جاري النطق...');
      
      audio.src = url;
      audio.onended = () => { setTtsStatus('جاهز ✅'); resolve(); };
      audio.onerror = (e) => { 
        console.warn('[TTS] Server audio error:', e);
        reject('Server TTS audio error');
      };
      
      audio.play().then(() => {
        console.log('[TTS] Server TTS playing!');
      }).catch((e) => {
        console.warn('[TTS] Server play() failed:', e);
        reject('Server TTS play failed');
      });
    });
  };

  // ============ Browser SpeechSynthesis (fallback) ============
  const speakBrowser = (text: string, isArabic: boolean): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!window.speechSynthesis) { reject('no speechSynthesis'); return; }
      
      window.speechSynthesis.cancel();
      
      const u = new SpeechSynthesisUtterance(text);
      u.lang = isArabic ? 'ar-SA' : 'en-US';
      u.rate = 0.9;
      u.volume = 1;
      u.pitch = 1;
      
      const voices = window.speechSynthesis.getVoices();
      if (isArabic) {
        const arVoice = voices.find(v => v.lang.startsWith('ar'));
        if (arVoice) u.voice = arVoice;
      }
      
      let done = false;
      u.onend = () => { if (!done) { done = true; setTtsStatus('جاهز ✅'); resolve(); } };
      u.onerror = (e) => { if (!done) { done = true; reject('Browser TTS error: ' + e.error); } };
      setTimeout(() => { if (!done) { done = true; reject('Browser TTS timeout'); } }, 10000);
      
      window.speechSynthesis.speak(u);
    });
  };

  // ============ MAIN SPEAK ============
  const speak = async (text: string, isArabic: boolean) => {
    if (!soundEnabledRef.current) {
      console.log('[TTS] Sound disabled, skip');
      return;
    }
    
    console.log('[TTS] === SPEAK CALLED ===', { text, isArabic });
    setTtsStatus('🔔 تنبيه...');

    // 1. Play chime
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.setValueAtTime(900, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc.start(); osc.stop(ctx.currentTime + 0.6);
      await new Promise(r => setTimeout(r, 800));
      ctx.close();
    } catch(e) { /* ignore chime errors */ }

    // 2. Try our server-side TTS proxy FIRST (most reliable, bypasses CORS)
    try {
      setTtsStatus('جاري النطق...');
      await speakServer(text, isArabic);
      console.log('[TTS] ✅ Server TTS worked!');
      return;
    } catch(e) {
      console.log('[TTS] ❌ Server TTS failed:', e);
    }

    // 3. Fallback to browser SpeechSynthesis
    try {
      setTtsStatus('محاولة بالمتصفح...');
      await speakBrowser(text, isArabic);
      console.log('[TTS] ✅ Browser TTS worked!');
      return;
    } catch(e) {
      console.log('[TTS] ❌ Browser TTS failed:', e);
    }

    setTtsStatus('❌ فشل النطق');
    console.error('[TTS] ALL methods failed!');
  };

  // ============ ENABLE SOUND (user click) ============
  const enableSound = async () => {
    const newState = !soundEnabled;
    
    if (newState) {
      setTtsStatus('🔓 جاري تفعيل الصوت...');
      
      // Unlock AudioContext
      try {
        const ctx = new AudioContext();
        await ctx.resume();
        const buf = ctx.createBuffer(1, 1, 22050);
        const s = ctx.createBufferSource();
        s.buffer = buf; s.connect(ctx.destination); s.start();
        ctx.close();
      } catch(e) {}
      
      // Unlock audio element with silent MP3
      try {
        if (audioRef.current) {
          audioRef.current.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAABhkVFqMkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
          await audioRef.current.play().catch(() => {});
          audioRef.current.pause();
          audioRef.current.src = '';
        }
      } catch(e) {}

      soundEnabledRef.current = true;
      setSoundEnabled(true);
      setTtsStatus('✅ الصوت مفعّل - جاهز');
    } else {
      soundEnabledRef.current = false;
      setSoundEnabled(false);
      setTtsStatus('🔇 الصوت مطفي');
    }
  };

  const testAudio = async () => {
    if (!soundEnabled) {
      await enableSound();
      // Small delay to let unlock settle
      await new Promise(r => setTimeout(r, 500));
    }
    soundEnabledRef.current = true;
    speak("المريض أحمد محمد، يرجى التوجه إلى العيادة الأولى", true);
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
               speak(text, isArabicName);
           }
       });

       prevPatientsRef.current = active;
       setPatients(active);
    });
    
    unsubscribeRef.current = subscription;

    return () => {
        if(unsubscribeRef.current) unsubscribeRef.current();
    };
  }, [user, language]); // soundEnabled removed — using soundEnabledRef instead to avoid re-subscribing

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
            {/* TTS Status */}
            <div className={`px-4 py-2 rounded-full text-xs font-mono ${soundEnabled ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'}`}>
              {ttsStatus}
            </div>
            <button 
                onClick={testAudio}
                className="px-6 py-2.5 rounded-full text-sm font-bold tracking-wider uppercase transition-all duration-300 flex items-center gap-3 bg-blue-500/10 text-blue-400 border border-blue-500/50 hover:bg-blue-500/20"
            >
                <i className="fa-solid fa-play"></i>
                تجربة الصوت
            </button>
            <button 
                onClick={enableSound}
                className={`px-6 py-2.5 rounded-full text-sm font-bold tracking-wider uppercase transition-all duration-300 flex items-center gap-3 ${soundEnabled ? 'bg-green-500/20 text-green-400 border border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 animate-pulse'}`}
            >
                <i className={`fa-solid ${soundEnabled ? 'fa-volume-high' : 'fa-volume-xmark'}`}></i>
                {soundEnabled ? '🔊 الصوت مفعّل' : '🔇 اضغط لتفعيل الصوت'}
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
