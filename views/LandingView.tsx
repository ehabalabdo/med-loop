import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';

/* ═══════════════════════════ TYPES ═══════════════════════════════ */
interface Feature {
  icon: string;
  title: string;
  titleEn: string;
  desc: string;
  color: string;
  details: string[];
}
interface FeatureCategory {
  id: string;
  label: string;
  labelEn: string;
  icon: string;
  gradient: string;
  features: Feature[];
}

/* ═══════════════════════ SPOTLIGHT CARD ══════════════════════════ */
const SpotlightCard = ({ children, className = '', spotColor = 'rgba(45,212,191,0.15)' }: { children: React.ReactNode, className?: string, spotColor?: string }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current || isFocused) return;
    const div = divRef.current;
    const rect = div.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onFocus={() => { setIsFocused(true); setOpacity(1); }}
      onBlur={() => { setIsFocused(false); setOpacity(0); }}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] transition-colors duration-500 hover:bg-white/[0.04] ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition duration-300"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${spotColor}, transparent 40%)`,
        }}
      />
      {children}
    </div>
  );
};

/* ═══════════════════════ GLOWING LINES ═══════════════════════════ */
const GlowingLines = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
    <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent opacity-30" />
    <div className="absolute top-0 left-2/4 w-px h-full bg-gradient-to-b from-transparent via-primary/20 to-transparent opacity-30" />
    <div className="absolute top-0 left-3/4 w-px h-full bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent opacity-30" />
    
    <motion.div 
      animate={{ top: ['-10%', '110%'] }} 
      transition={{ duration: 5, repeat: Infinity, ease: 'linear' }} 
      className="absolute left-1/4 w-[2px] h-32 bg-gradient-to-b from-transparent via-cyan-400 to-transparent -translate-x-1/2 blur-[2px]" 
    />
    <motion.div 
      animate={{ top: ['-10%', '110%'] }} 
      transition={{ duration: 7, repeat: Infinity, ease: 'linear', delay: 2 }} 
      className="absolute left-2/4 w-[2px] h-40 bg-gradient-to-b from-transparent via-primary to-transparent -translate-x-1/2 blur-[2px]" 
    />
  </div>
);

/* ═══════════════════════ COUNT-UP HOOK ═══════════════════════════ */
const useCountUp = (end: number, duration = 2200, start = 0) => {
  const [value, setValue] = useState(start);
  const ref = useRef<HTMLDivElement>(null);
  const counted = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !counted.current) {
          counted.current = true;
          const t0 = performance.now();
          const tick = (now: number) => {
            const p = Math.min((now - t0) / duration, 1);
            const ease = 1 - Math.pow(1 - p, 4);
            setValue(Math.round(start + (end - start) * ease));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [end, duration, start]);
  return { value, ref };
};

/* ═══════════════════════ FEATURE DATA ═══════════════════════════ */
const featureCategories: FeatureCategory[] = [
  {
    id: 'clinic', label: 'إدارة العيادة', labelEn: 'Clinic Ops', icon: 'fa-hospital', gradient: 'from-cyan-500 to-cyan-600',
    features: [
      { icon: 'fa-hospital-user', title: 'إدارة العيادات المتعددة', titleEn: 'Multi-Clinic', desc: 'عيادات وأقسام غير محدودة من لوحة تحكم واحدة.', color: 'cyan', details: ['إنشاء عيادات وأقسام غير محدودة','تعيين كوادر بصلاحيات منفصلة','لوحة تحكم مركزية','تقارير مقارنة بين الفروع','إعدادات مستقلة لكل عيادة'] },
      { icon: 'fa-user-nurse', title: 'الاستقبال الذكي', titleEn: 'Smart Reception', desc: 'تسجيل المرضى وإدارة الانتظار بنقرة واحدة.', color: 'cyan', details: ['تسجيل دخول بنقرة واحدة','إدارة قائمة الانتظار','تحويل فوري للعيادة','إشعارات فورية للطبيب','بحث بالاسم أو الهاتف أو الرقم الوطني','عرض حالة المريض لحظياً'] },
      { icon: 'fa-calendar-check', title: 'نظام المواعيد', titleEn: 'Appointments', desc: 'حجز وتأكيد وتذكير تلقائي بدون تضارب.', color: 'cyan', details: ['عرض يومي/أسبوعي/شهري','حالات: مؤكد، معلق، ملغي، مكتمل','منع التضارب التلقائي','ملاحظات وسبب الزيارة','ربط مع شاشة الانتظار','تذكير عبر واتساب'] },
      { icon: 'fa-tv', title: 'شاشة الانتظار', titleEn: 'Queue Display', desc: 'شاشة حية بنداء صوتي تلقائي.', color: 'cyan', details: ['تصميم احترافي للـ TV','نداء صوتي باسم المريض','تحديث Real-time','رقم الدور والطبيب والعيادة','دعم عربي/إنجليزي','بدون تحديث يدوي للصفحة'] },
    ]
  },
  {
    id: 'medical', label: 'الملف الطبي', labelEn: 'Medical', icon: 'fa-stethoscope', gradient: 'from-teal-500 to-teal-600',
    features: [
      { icon: 'fa-user-doctor', title: 'لوحة الطبيب', titleEn: 'Doctor Dashboard', desc: 'تشخيص، وصفات، خطط علاجية، مرفقات.', color: 'teal', details: ['ملف طبي شامل لكل مريض','تشخيصات وملاحظات تفصيلية','وصفات طبية قابلة للطباعة','رفع صور وأشعة وتحاليل','خطط علاجية متعددة الجلسات','قوالب جاهزة للتشخيصات الشائعة'] },
      { icon: 'fa-clipboard-list', title: 'السجل السريري', titleEn: 'Clinical History', desc: 'تاريخ كامل لكل زيارة وعلاج.', color: 'teal', details: ['عرض زمني للزيارات','تصفية حسب التاريخ أو النوع','ملاحظات ومرفقات لكل زيارة','طباعة ملخص السجل','مشاركة مع طبيب آخر','أرشيف كامل قابل للبحث'] },
      { icon: 'fa-address-book', title: 'سجل المرضى', titleEn: 'Patient Registry', desc: 'قاعدة بيانات شاملة مع بحث متقدم.', color: 'teal', details: ['بيانات ديموغرافية كاملة','بحث متقدم وفلترة','تصدير إلى Excel','إحصائيات جدد وعائدين','تاريخ أول وآخر زيارة','أرقام التواصل والرقم الوطني'] },
      { icon: 'fa-mobile-screen', title: 'بوابة المريض', titleEn: 'Patient Portal', desc: 'المريض يحجز ويتابع ملفه بنفسه.', color: 'teal', details: ['تسجيل دخول بالجوال','عرض السجل الطبي الكامل','حجز وإلغاء المواعيد','عرض الوصفات والتعليمات','متابعة الطلبات والحجوزات','واجهة بسيطة للمريض'] },
    ]
  },
  {
    id: 'financial', label: 'المالية', labelEn: 'Finance', icon: 'fa-coins', gradient: 'from-cyan-500 to-teal-600',
    features: [
      { icon: 'fa-file-invoice-dollar', title: 'الفواتير والمحاسبة', titleEn: 'Billing', desc: 'فواتير تفصيلية ودفعات جزئية وتقارير مالية.', color: 'cyan', details: ['فواتير تفصيلية مع بنود','دفعات جزئية ومتابعة المتبقي','تقارير يومية وشهرية وسنوية','طباعة احترافية','خصومات مرنة','ربط مع ملف المريض'] },
      { icon: 'fa-tags', title: 'كتالوج الخدمات', titleEn: 'Service Catalog', desc: 'إدارة الخدمات والأسعار بمرونة تامة.', color: 'cyan', details: ['قائمة خدمات شاملة','تصنيف حسب القسم','تعديل أسعار مع حفظ التاريخ','ربط مع الفواتير','تصدير إلى Excel','دعم العملات المختلفة'] },
      { icon: 'fa-chart-pie', title: 'التقارير والـ KPI', titleEn: 'Reports & KPI', desc: 'لوحة مؤشرات أداء ورسوم بيانية تفاعلية.', color: 'cyan', details: ['إيرادات ومصروفات','إحصائيات المرضى','أداء الأطباء','رسوم بيانية تفاعلية','مقارنة بين الفترات','لوحة KPI للإدارة'] },
    ]
  },
  {
    id: 'hr', label: 'الموارد البشرية', labelEn: 'HR', icon: 'fa-people-group', gradient: 'from-cyan-500 to-cyan-600',
    features: [
      { icon: 'fa-id-card', title: 'إدارة الموظفين', titleEn: 'Employees', desc: 'ملفات كاملة، هيكل تنظيمي، صلاحيات.', color: 'cyan', details: ['ملف شامل لكل موظف','تحديد القسم والراتب','بدلات وخصومات','هيكل تنظيمي شجري','تاريخ التوظيف والترقيات','صلاحيات حسب الدور'] },
      { icon: 'fa-fingerprint', title: 'الحضور والبصمة', titleEn: 'Biometric', desc: 'ربط مع أجهزة البصمة وحساب الساعات آلياً.', color: 'cyan', details: ['ربط أجهزة البصمة','تسجيل يدوي بديل','حساب ساعات العمل والتأخير','تقارير حضور مفصلة','إشعارات تأخير وغياب','دعم الورديات المرنة'] },
      { icon: 'fa-money-check-dollar', title: 'الرواتب و PDF', titleEn: 'Payroll', desc: 'معالجة رواتب وكشف PDF يحمله الموظف.', color: 'cyan', details: ['حساب الراتب آلياً بناءً على الحضور','بدلات وخصومات مرنة','كشف راتب PDF احترافي','الموظف يحمّل كشفه','تقارير رواتب للإدارة','دعم العملات المحلية'] },
      { icon: 'fa-chart-bar', title: 'تقارير HR', titleEn: 'HR Reports', desc: 'تقارير حضور ورواتب وأداء.', color: 'cyan', details: ['تقارير حضور وغياب','تكلفة رواتب شهرية','إحصائيات إنتاجية','تقارير إجازات','تصدير Excel و PDF','مقارنة أداء الأقسام'] },
    ]
  },
  {
    id: 'specialty', label: 'وحدات متخصصة', labelEn: 'Specialty', icon: 'fa-puzzle-piece', gradient: 'from-teal-500 to-teal-600',
    features: [
      { icon: 'fa-tooth', title: 'مختبر الأسنان', titleEn: 'Dental Lab', desc: 'إدارة حالات المختبر مع تتبع لحظي.', color: 'teal', details: ['إرسال حالة من الطبيب مباشرة','تتبع (جديد، قيد التنفيذ، جاهز)','ملاحظات ومواصفات تفصيلية','ربط مع ملف المريض','تقارير إنتاجية','إشعارات فورية'] },
      { icon: 'fa-screwdriver-wrench', title: 'شركة الزراعات', titleEn: 'Implant Co.', desc: 'مخزون زراعات وطلبات وتقارير.', color: 'teal', details: ['كتالوج منتجات الزراعة','تتبع المخزون','طلبات الأطباء','ربط مع المريض والطبيب','تقارير مبيعات','إشعارات انخفاض المخزون'] },
      { icon: 'fa-graduation-cap', title: 'الأكاديمية', titleEn: 'Academy', desc: 'دورات تدريبية وشهادات وحضور.', color: 'teal', details: ['إنشاء دورات تدريبية','تسجيل طلاب ومجموعات','جدولة جلسات','متابعة حضور','إصدار شهادات إتمام','تقييم المدربين'] },
      { icon: 'fa-microchip', title: 'ربط الأجهزة الطبية', titleEn: 'Device Integration', desc: 'استقبال نتائج HL7 تلقائياً في الملف الطبي.', color: 'teal', details: ['بروتوكول HL7','نتائج مباشرة في الملف','Serial Port و MLLP','تنبيهات القيم غير الطبيعية','أرشفة تلقائية','Bridge Agent سحابي'] },
    ]
  },
  {
    id: 'platform', label: 'المنصة', labelEn: 'Platform', icon: 'fa-shield-halved', gradient: 'from-teal-500 to-cyan-600',
    features: [
      { icon: 'fa-shield-halved', title: 'الأمان والخصوصية', titleEn: 'Security', desc: 'تشفير، صلاحيات، حماية متقدمة.', color: 'teal', details: ['تشفير SSL/TLS','صلاحيات متعددة المستويات','Rate Limiting + Helmet + CORS','JWT Token','تسجيل أنشطة','فصل بيانات العملاء'] },
      { icon: 'fa-language', title: 'عربي وإنجليزي', titleEn: 'Multi-Language', desc: 'تبديل فوري بين اللغتين.', color: 'teal', details: ['واجهة عربية RTL كاملة','تبديل فوري للإنجليزية','تقارير وفواتير بكلتا اللغتين','تذكر اللغة المفضلة','خدمات وتشخيصات بكلتا اللغتين','قابل لإضافة لغات مستقبلاً'] },
      { icon: 'fa-moon', title: 'الوضع الليلي', titleEn: 'Dark Mode', desc: 'وضع ليلي مريح مع تبديل فوري.', color: 'teal', details: ['وضع ليلي مريح للعين','وضع نهاري واضح','تبديل فوري','حفظ تفضيل المستخدم','تصميم متجاوب','ألوان احترافية لكلا الوضعين'] },
      { icon: 'fa-building', title: 'SaaS متعددة العملاء', titleEn: 'Multi-Tenant', desc: 'كل مركز برابطه وبياناته المستقلة.', color: 'teal', details: ['رابط مخصص لكل عميل','بيانات منفصلة تماماً','لوحة Super Admin','إنشاء عميل بدقائق','خطط اشتراك مرنة','نسخ احتياطي تلقائي'] },
      { icon: 'fa-brands fa-whatsapp', title: 'تكامل واتساب', titleEn: 'WhatsApp', desc: 'تأكيد مواعيد وتذكيرات عبر واتساب.', color: 'green', details: ['تأكيد موعد تلقائي','تذكير قبل الموعد','رابط حجز للمريض','رد سريع على استفسارات','زر واتساب في ملف المريض','إشعارات مخصصة'] },
    ]
  },
];

const allFeatures = featureCategories.flatMap(c => c.features);

/* ═══════════════════════ AUTOMATION FLOW ════════════════════════ */
const automationSteps = [
  { icon: 'fa-calendar-plus', label: 'مريض يحجز موعد', color: 'from-cyan-500 to-cyan-500' },
  { icon: 'fa-bell', label: 'إشعار للطبيب', color: 'from-cyan-500 to-cyan-500' },
  { icon: 'fa-user-check', label: 'تسجيل الحضور', color: 'from-cyan-500 to-cyan-500' },
  { icon: 'fa-stethoscope', label: 'فحص وتشخيص', color: 'from-cyan-500 to-cyan-500' },
  { icon: 'fa-file-invoice-dollar', label: 'فاتورة تلقائية', color: 'from-cyan-500 to-teal-500' },
  { icon: 'fa-chart-line', label: 'تقرير KPI', color: 'from-teal-500 to-teal-500' },
];

/* ═══════════════════════ COMPONENT ══════════════════════════════ */
const rotatingWords = ['ذكية', 'مؤتمتة', 'دقيقة', 'متكاملة', 'بلا أخطاء'];

const LandingView: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [activeCategory, setActiveCategory] = useState('clinic');
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [activeFlowStep, setActiveFlowStep] = useState(0);
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setWordIndex(i => (i + 1) % rotatingWords.length), 2000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('revealed'); }),
      { threshold: 0.1 },
    );
    document.querySelectorAll('.reveal-on-scroll').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [activeCategory]);

  useEffect(() => {
    const iv = setInterval(() => setActiveFlowStep(s => (s + 1) % automationSteps.length), 2200);
    return () => clearInterval(iv);
  }, []);

  const closeModal = useCallback(() => setSelectedFeature(null), []);

  const patientsToday = useCountUp(47, 2000);
  const revenue = useCountUp(3850, 2500);
  const occupancy = useCountUp(89, 2000);
  const appointmentsCount = useCountUp(24, 1800);

  const colorMap: Record<string, { bg: string; text: string; border: string; glow: string }> = {
    cyan:    { bg: 'bg-cyan-500/10',    text: 'text-cyan-400',    border: 'border-cyan-500/20',    glow: 'shadow-cyan-500/20' },
    emerald: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20', glow: 'shadow-teal-500/20' },
    amber:   { bg: 'bg-cyan-500/10',   text: 'text-cyan-400',   border: 'border-cyan-500/20',   glow: 'shadow-cyan-500/20' },
    violet:  { bg: 'bg-cyan-500/10',  text: 'text-cyan-400',  border: 'border-cyan-500/20',  glow: 'shadow-cyan-500/20' },
    rose:    { bg: 'bg-teal-500/10',    text: 'text-teal-400',    border: 'border-teal-500/20',    glow: 'shadow-teal-500/20' },
    sky:     { bg: 'bg-teal-500/10',     text: 'text-teal-400',     border: 'border-teal-500/20',     glow: 'shadow-teal-500/20' },
    green:   { bg: 'bg-green-500/10',   text: 'text-green-400',   border: 'border-green-500/20',   glow: 'shadow-green-500/20' },
  };

  const currentCategory = featureCategories.find(c => c.id === activeCategory)!;

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden" style={{ fontFamily: "'Cairo', 'Plus Jakarta Sans', sans-serif" }}>

      {/* ════════════════ NAVBAR ════════════════ */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-slate-950/90 backdrop-blur-xl shadow-2xl shadow-black/20 border-b border-white/5' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="MED LOOP" className="w-10 h-10 object-contain" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">MED LOOP</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {[
              { href: '#command-center', label: 'المنصة' },
              { href: '#features', label: 'المميزات' },
              { href: '#transform', label: 'التحول' },
              { href: '#tech', label: 'البنية التحتية' },
              { href: '#contact', label: 'تواصل معنا' },
            ].map(l => (
              <a key={l.href} href={l.href} className="text-slate-400 hover:text-primary transition-colors text-sm font-medium">{l.label}</a>
            ))}
          </div>
          <button onClick={() => setMobileMenu(!mobileMenu)} className="md:hidden text-slate-400 hover:text-white text-xl">
            <i className={`fa-solid ${mobileMenu ? 'fa-xmark' : 'fa-bars'}`}></i>
          </button>
        </div>
        {mobileMenu && (
          <div className="md:hidden bg-slate-950/95 backdrop-blur-xl border-t border-white/5 px-6 py-4 space-y-3">
            {['#command-center', '#features', '#transform', '#tech', '#contact'].map((h, i) => (
              <a key={h} href={h} onClick={() => setMobileMenu(false)} className="block text-slate-300 hover:text-primary py-2">
                {['المنصة', 'المميزات', 'التحول', 'البنية التحتية', 'تواصل معنا'][i]}
              </a>
            ))}
          </div>
        )}
      </nav>

      {/* ════════════════ HERO — ROTATING HEADLINE (V4: Ultra-Futuristic) ════════════════ */}
      <section className="relative min-h-screen flex items-center overflow-hidden bg-[#060a13]">
        {/* Animated Background Lines */}
        <GlowingLines />

        {/* Deep Space Radial Gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(14,22,40,0.8)_0%,rgba(6,10,19,1)_100%)] pointer-events-none" />

        {/* Floating Orbs */}
        <motion.div
          animate={{ y: [0, -20, 0], x: [0, 10, 0], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[20%] right-[15%] w-96 h-96 bg-teal-500/10 rounded-full blur-[120px] pointer-events-none"
        />
        <motion.div
          animate={{ y: [0, 30, 0], x: [0, -15, 0], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-[10%] left-[10%] w-[30rem] h-[30rem] bg-cyan-600/10 rounded-full blur-[150px] pointer-events-none"
        />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12 lg:px-16 py-32 md:py-40">
          <div className="grid lg:grid-cols-[1fr_0.85fr] gap-16 xl:gap-28 items-center">

            {/* ── Text Column ── */}
            <div className="text-right hero-text-enter">
              {/* Futuristic Badge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-md mb-8"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500"></span>
                </span>
                <span className="text-xs font-medium text-teal-300 tracking-wider uppercase" style={{ fontFamily: "'Cairo', sans-serif" }}>
                  نظام المستقبل الطبي
                </span>
              </motion.div>

              {/* Main headline */}
              <h1 className="mb-8 relative">
                <motion.span
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="block text-[clamp(2.5rem,5vw,4.5rem)] font-black text-white leading-[1.1] mb-2 drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                  style={{ fontFamily: "'Cairo', sans-serif" }}
                >
                  إدارة طبية
                </motion.span>

                {/* Rotating word container */}
                <span className="block relative" style={{ height: 'clamp(4rem, 8vw, 6.5rem)' }}>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={rotatingWords[wordIndex]}
                      initial={{ opacity: 0, y: 40, filter: 'blur(12px)', scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 }}
                      exit={{ opacity: 0, y: -40, filter: 'blur(12px)', scale: 1.1 }}
                      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute right-0 top-0 text-[clamp(3rem,6vw,5.5rem)] font-black leading-[1.2]"
                      style={{ 
                        fontFamily: "'Cairo', sans-serif", 
                        WebkitBackgroundClip: 'text', 
                        WebkitTextFillColor: 'transparent', 
                        backgroundImage: 'linear-gradient(to right, #38bdf8, #818cf8, #c084fc)',
                        textShadow: '0 0 40px rgba(129, 140, 248, 0.3)'
                      }}
                    >
                      {rotatingWords[wordIndex]}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </h1>

              {/* Subheading */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="text-slate-400 text-lg md:text-xl leading-relaxed max-w-xl mr-0 ml-auto lg:ml-0 mb-10 font-light"
                style={{ fontFamily: "'Cairo', sans-serif" }}
              >
                تجاوز الأنظمة التقليدية. اكتشف منصة تشغيل متكاملة مصممة بتقنيات المستقبل لترتقي بمركزك الطبي إلى آفاق جديدة من الكفاءة والذكاء.
              </motion.p>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col sm:flex-row gap-5 justify-end lg:justify-start"
              >
                <a href="#contact" className="group relative px-8 py-4 bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-bold rounded-2xl text-[16px] text-center overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(45,212,191,0.4)]">
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                  <span className="relative z-10 flex items-center justify-center gap-3">
                    اطلب عرض تجريبي
                    <i className="fa-solid fa-rocket text-sm group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform duration-300"></i>
                  </span>
                </a>
                <a href="#demo-video" className="group px-8 py-4 border border-white/10 bg-white/[0.02] backdrop-blur-sm text-white/80 font-bold rounded-2xl text-[16px] text-center transition-all duration-300 hover:bg-white/[0.08] hover:border-white/20 hover:text-white">
                  <span className="flex items-center justify-center gap-3">
                    شاهد النظام
                    <i className="fa-solid fa-play text-xs opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300"></i>
                  </span>
                </a>
              </motion.div>
            </div>

            {/* ── Dashboard Mockup (Control Center) ── */}
            <div className="hidden lg:block relative perspective-1000">
              <motion.div
                initial={{ opacity: 0, rotateY: -15, rotateX: 5, z: -100 }}
                animate={{ opacity: 1, rotateY: 0, rotateX: 0, z: 0 }}
                transition={{ duration: 1.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="relative transform-style-3d"
              >
                <SpotlightCard className="p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-transparent border border-white/[0.05]">
                  <div className="relative bg-[#0a0f1c]/90 backdrop-blur-2xl rounded-[1.8rem] p-6 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                    
                    {/* Top bar */}
                    <div className="flex items-center justify-between mb-8 border-b border-white/[0.05] pb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-teal-500/80 shadow-[0_0_10px_rgba(20,184,166,0.5)]" />
                        <div className="w-3 h-3 rounded-full bg-cyan-500/80 shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
                        <div className="w-3 h-3 rounded-full bg-teal-500/80 shadow-[0_0_10px_rgba(20,184,166,0.5)]" />
                      </div>
                      <div className="flex items-center gap-3 bg-white/[0.03] px-3 py-1.5 rounded-full border border-white/[0.05]">
                        <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse shadow-[0_0_10px_rgba(45,212,191,0.8)]"></span>
                        <span className="text-[10px] text-teal-300 font-mono tracking-widest uppercase">System Active</span>
                      </div>
                    </div>

                    {/* Holographic Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      {[
                        { label: 'المرضى النشطين', val: '124', icon: 'fa-users', color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20' },
                        { label: 'معدل الإشغال', val: '92%', icon: 'fa-chart-pie', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
                      ].map((stat, i) => (
                        <div key={i} className={`relative p-4 rounded-2xl border ${stat.border} ${stat.bg} overflow-hidden group`}>
                          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                          <div className="flex justify-between items-start mb-2 relative z-10">
                            <i className={`fa-solid ${stat.icon} ${stat.color} text-lg opacity-80`}></i>
                            <span className="text-[10px] text-white/40 font-medium">{stat.label}</span>
                          </div>
                          <div className={`text-3xl font-black ${stat.color} tracking-tight relative z-10 drop-shadow-[0_0_15px_currentColor]`}>
                            {stat.val}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Animated Activity Stream */}
                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-teal-500/50 to-transparent" />
                      <div className="text-[11px] text-white/40 mb-4 font-medium flex justify-between items-center">
                        <span>تدفق العمليات المباشر</span>
                        <i className="fa-solid fa-satellite-dish text-teal-400/50 animate-pulse"></i>
                      </div>
                      
                      <div className="space-y-3">
                        {[
                          { action: 'تم تسجيل دخول مريض جديد', time: 'الآن', color: 'teal' },
                          { action: 'تحديث السجل الطبي', time: 'قبل دقيقتين', color: 'teal' },
                          { action: 'اكتمال تحليل المختبر', time: 'قبل 5 دقائق', color: 'cyan' }
                        ].map((item, i) => (
                          <motion.div 
                            key={i}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 1 + (i * 0.2) }}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.02] transition-colors"
                          >
                            <div className={`w-1.5 h-1.5 rounded-full bg-${item.color}-400 shadow-[0_0_8px_rgba(var(--${item.color}-400),0.8)]`} />
                            <span className="text-xs text-white/70 flex-1 text-right">{item.action}</span>
                            <span className="text-[9px] text-white/30 font-mono">{item.time}</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                  </div>
                </SpotlightCard>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20">
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
            <div className="w-6 h-10 rounded-full border-2 border-white/10 flex items-start justify-center pt-2 backdrop-blur-sm bg-white/[0.02]">
              <div className="w-1 h-2 rounded-full bg-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.8)]" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════ AUTOMATION FLOW (V4: Holographic Pipeline) ════════════════ */}
      <section id="command-center" className="py-32 px-6 relative overflow-hidden bg-[#060a13]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(45,212,191,0.05)_0%,transparent_70%)] pointer-events-none" />
        
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold mb-6"
            >
              <i className="fa-solid fa-microchip animate-pulse"></i> أتمتة عصبية
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-5xl font-black mb-6 text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            >
              دورة حياة المريض — <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-cyan-400">ذاتية القيادة</span>
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto font-light"
            >
              النظام يتوقع الخطوة التالية وينفذها قبل أن تطلبها. من لحظة دخول المريض حتى إصدار التقرير المالي.
            </motion.p>
          </div>

          <div className="relative flex flex-wrap justify-center items-center gap-4 md:gap-0">
            {/* Connecting Line Background */}
            <div className="hidden md:block absolute top-1/2 left-[10%] right-[10%] h-0.5 bg-white/[0.05] -translate-y-1/2 z-0" />
            
            {automationSteps.map((step, i) => (
              <React.Fragment key={i}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  whileInView={{ opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15, type: "spring", stiffness: 200 }}
                  className={`relative z-10 flex flex-col items-center transition-all duration-500 cursor-pointer group
                    ${activeFlowStep === i ? 'scale-110' : 'scale-100 opacity-50 hover:opacity-100'}`}
                  onClick={() => setActiveFlowStep(i)}
                >
                  <SpotlightCard className={`w-20 h-20 md:w-24 md:h-24 rounded-2xl p-0.5 transition-all duration-500 ${activeFlowStep === i ? 'bg-gradient-to-br from-teal-400 to-cyan-500 shadow-[0_0_30px_rgba(45,212,191,0.3)]' : 'bg-white/[0.05]'}`}>
                    <div className="w-full h-full bg-[#0a0f1c] rounded-[14px] flex items-center justify-center relative overflow-hidden">
                      <div className={`absolute inset-0 bg-gradient-to-br ${step.color} opacity-20 group-hover:opacity-40 transition-opacity duration-500`} />
                      <i className={`fa-solid ${step.icon} text-2xl md:text-3xl relative z-10 ${activeFlowStep === i ? 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]' : 'text-slate-400'}`}></i>
                    </div>
                  </SpotlightCard>
                  
                  <span className={`mt-6 text-sm font-bold text-center max-w-[100px] transition-colors duration-300
                    ${activeFlowStep === i ? 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'text-slate-500'}`}>
                    {step.label}
                  </span>
                  
                  {activeFlowStep === i && (
                    <motion.div 
                      layoutId="activeStepIndicator"
                      className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-12 h-1 bg-gradient-to-r from-teal-400 to-cyan-400 rounded-full shadow-[0_0_10px_rgba(45,212,191,0.8)]" 
                    />
                  )}
                </motion.div>

                {i < automationSteps.length - 1 && (
                  <div className="hidden md:flex items-center mx-2 relative z-10">
                    <div className={`w-12 h-0.5 transition-all duration-500 relative overflow-hidden ${activeFlowStep >= i ? 'bg-teal-500/30' : 'bg-transparent'}`}>
                      {activeFlowStep >= i && (
                        <motion.div 
                          initial={{ x: '-100%' }}
                          animate={{ x: '100%' }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-teal-400 to-transparent"
                        />
                      )}
                    </div>
                    <i className={`fa-solid fa-chevron-left text-[10px] -ml-1 transition-colors duration-500 ${activeFlowStep >= i ? 'text-teal-400 drop-shadow-[0_0_5px_rgba(45,212,191,0.8)]' : 'text-white/[0.05]'}`}></i>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ IMAGINE YOUR CENTER (V4: The Future Reality) ════════════════ */}
      <section id="transform" className="py-32 px-6 relative overflow-hidden bg-[#060a13]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(20,184,166,0.05)_0%,transparent_70%)] pointer-events-none" />
        
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold mb-6"
            >
              <i className="fa-solid fa-eye animate-pulse"></i> رؤية المستقبل
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-5xl font-black mb-6 text-white"
            >
              تخيّل مركزك بعد <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-cyan-400 drop-shadow-[0_0_15px_rgba(20,184,166,0.3)]">٦ أشهر</span>
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto font-light"
            >
              النتيجة التي تنتظرك — ليست مجرد ميزات برمجية، بل واقع تشغيلي جديد كلياً يضعك في صدارة القطاع الطبي.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: 'fa-file-circle-xmark', text: 'بيئة خالية من الورق تماماً', desc: 'رقمنة كاملة من الاستقبال حتى الأرشيف', color: 'teal' },
              { icon: 'fa-calculator', text: 'دقة مالية مطلقة', desc: 'ربط تلقائي بين الخدمات والفواتير بلا تسرب مالي', color: 'teal' },
              { icon: 'fa-calendar-check', text: 'جدولة ذكية خالية من التضارب', desc: 'خوارزميات تمنع تداخل المواعيد وتدير قوائم الانتظار', color: 'cyan' },
              { icon: 'fa-chart-pie', text: 'رؤية تحليلية فورية', desc: 'لوحات قياس أداء (KPIs) تتحدث لحظة بلحظة', color: 'cyan' },
              { icon: 'fa-user-doctor', text: 'تمكين الطاقم الطبي', desc: 'مساحات عمل مخصصة تزيد من إنتاجية كل طبيب', color: 'teal' },
              { icon: 'fa-building-shield', text: 'حوكمة مؤسسية (Corporate)', desc: 'انتقال من الإدارة الفردية إلى العمل المؤسسي المنظم', color: 'cyan' },
            ].map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <SpotlightCard className="h-full p-px rounded-3xl bg-gradient-to-b from-white/[0.08] to-transparent">
                  <div className="h-full bg-[#0a0f1c]/90 backdrop-blur-xl rounded-[23px] p-8 relative overflow-hidden group">
                    <div className={`absolute top-0 right-0 w-32 h-32 bg-${item.color}-500/10 rounded-full blur-[50px] group-hover:bg-${item.color}-500/20 transition-colors duration-500`} />
                    
                    <div className={`w-14 h-14 rounded-2xl bg-${item.color}-500/10 border border-${item.color}-500/20 flex items-center justify-center text-${item.color}-400 text-2xl mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500`}>
                      <i className={`fa-solid ${item.icon}`}></i>
                    </div>
                    
                    <h3 className="text-xl font-bold text-white mb-3">{item.text}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </SpotlightCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ TRADITIONAL VS MED LOOP (V4: The Paradigm Shift) ════════════════ */}
      <section className="py-32 px-6 bg-[#060a13] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-[40rem] h-[40rem] bg-red-500/5 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[40rem] h-[40rem] bg-teal-500/5 rounded-full blur-[150px] pointer-events-none" />
        
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-20">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-5xl font-black mb-6 text-white"
            >
              لماذا <span className="text-red-400 drop-shadow-[0_0_15px_rgba(248,113,113,0.3)]">تنهار</span> الأنظمة التقليدية؟
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto font-light"
            >
              الفجوة التقنية بين الماضي والمستقبل لم تعد مجرد رفاهية، بل هي مسألة بقاء.
            </motion.p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Legacy System */}
            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <SpotlightCard className="h-full p-px rounded-3xl bg-gradient-to-b from-red-500/20 to-transparent">
                <div className="h-full bg-[#0a0f1c]/90 backdrop-blur-xl rounded-[23px] p-10 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-teal-500 opacity-50" />
                  
                  <div className="flex items-center gap-4 mb-10">
                    <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 text-xl">
                      <i className="fa-solid fa-triangle-exclamation"></i>
                    </div>
                    <h3 className="text-2xl font-bold text-red-400">عصر الأنظمة المتهالكة</h3>
                  </div>
                  
                  <div className="space-y-5">
                    {[
                      'برمجيات محلية مقيدة بجهاز واحد',
                      'بيانات هشة — تعطل الجهاز يعني كارثة',
                      'غياب تام للنسخ الاحتياطي السحابي',
                      'انعدام التواصل الرقمي مع المريض',
                      'تقارير بدائية لا تدعم اتخاذ القرار',
                      'عزلة تامة عن الأجهزة الطبية الحديثة',
                      'واجهات مستخدم معقدة وبطيئة',
                    ].map((t, i) => (
                      <div key={i} className="flex items-start gap-4">
                        <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                          <i className="fa-solid fa-xmark text-red-400 text-xs"></i>
                        </div>
                        <span className="text-slate-400 text-base leading-relaxed">{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </SpotlightCard>
            </motion.div>

            {/* MED LOOP */}
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <SpotlightCard className="h-full p-px rounded-3xl bg-gradient-to-b from-teal-400 to-cyan-500 shadow-[0_0_40px_rgba(45,212,191,0.15)]">
                <div className="h-full bg-[#0a0f1c]/95 backdrop-blur-xl rounded-[23px] p-10 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 to-cyan-500" />
                  <div className="absolute -top-20 -right-20 w-64 h-64 bg-teal-500/10 rounded-full blur-[60px] pointer-events-none" />
                  
                  <div className="flex items-center gap-4 mb-10 relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-xl shadow-[0_0_20px_rgba(45,212,191,0.4)]">
                      <i className="fa-solid fa-shield-halved"></i>
                    </div>
                    <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">MED LOOP</h3>
                  </div>
                  
                  <div className="space-y-5 relative z-10">
                    {[
                      'بنية سحابية فائقة — وصول آمن من أي مكان',
                      'تشفير عسكري وحماية سيبرانية متقدمة',
                      'نسخ احتياطي لحظي مشفر جغرافياً',
                      'بوابة تفاعلية متكاملة للمرضى',
                      'ذكاء أعمال (BI) وتقارير استراتيجية فورية',
                      'تكامل سلس (HL7) مع أحدث الأجهزة الطبية',
                      'تجربة مستخدم (UX) سابقة لعصرها',
                    ].map((t, i) => (
                      <div key={i} className="flex items-start gap-4">
                        <div className="w-6 h-6 rounded-full bg-teal-500/20 flex items-center justify-center shrink-0 mt-0.5 shadow-[0_0_10px_rgba(45,212,191,0.3)]">
                          <i className="fa-solid fa-check text-teal-400 text-xs"></i>
                        </div>
                        <span className="text-white/90 text-base font-medium leading-relaxed">{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </SpotlightCard>
            </motion.div>
          </div>
        </div>
      </section>
      {/* ════════════════ MULTI-TENANT (V4: Enterprise Architecture) ════════════════ */}
      <section className="py-32 px-6 relative overflow-hidden bg-[#060a13]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(6,182,212,0.05)_0%,transparent_70%)] pointer-events-none" />
        
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold mb-6"
            >
              <i className="fa-solid fa-server animate-pulse"></i> بنية مؤسسية (SaaS)
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-5xl font-black mb-6 text-white"
            >
              كل مركز — <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-cyan-400 drop-shadow-[0_0_15px_rgba(6,182,212,0.3)]">بيئة معزولة تماماً</span>
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto font-light"
            >
              ليس مجرد برنامج مشترك. نحن نوفر بنية تحتية سحابية تمنح كل عميل عالمه الرقمي الخاص بأعلى معايير الأمان والخصوصية.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: 'fa-globe', title: 'نطاق فرعي مخصص', desc: 'رابط خاص بمركزك يعكس هويتك المؤسسية', color: 'cyan' },
              { icon: 'fa-database', title: 'عزل تام للبيانات', desc: 'قاعدة بيانات منفصلة تضمن خصوصية مطلقة', color: 'cyan' },
              { icon: 'fa-shield-halved', title: 'حماية سيبرانية', desc: 'تشفير متقدم وصلاحيات دقيقة لكل مستخدم', color: 'cyan' },
              { icon: 'fa-sliders', title: 'تحكم لا محدود', desc: 'تخصيص كامل للخدمات، الأسعار، والعمليات', color: 'fuchsia' },
            ].map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <SpotlightCard className="h-full p-px rounded-3xl bg-gradient-to-b from-white/[0.08] to-transparent">
                  <div className="h-full bg-[#0a0f1c]/90 backdrop-blur-xl rounded-[23px] p-8 text-center relative overflow-hidden group">
                    <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-24 h-24 bg-${item.color}-500/10 rounded-full blur-[40px] group-hover:bg-${item.color}-500/20 transition-colors duration-500`} />
                    
                    <div className={`w-16 h-16 mx-auto rounded-2xl bg-${item.color}-500/10 border border-${item.color}-500/20 flex items-center justify-center text-${item.color}-400 text-2xl mb-6 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(var(--${item.color}-500),0.3)] transition-all duration-500 relative z-10`}>
                      <i className={`fa-solid ${item.icon}`}></i>
                    </div>
                    
                    <h3 className="text-xl font-bold text-white mb-3 relative z-10">{item.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed relative z-10">{item.desc}</p>
                  </div>
                </SpotlightCard>
              </motion.div>
            ))}
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="text-center mt-16"
          >
            <div className="inline-flex items-center gap-3 px-8 py-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl backdrop-blur-sm shadow-[0_0_30px_rgba(0,0,0,0.5)]">
              <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse shadow-[0_0_10px_rgba(20,184,166,0.8)]"></div>
              <span className="text-slate-400 font-mono tracking-wide">
                https://<strong className="text-white font-bold">your-clinic</strong>.medloop.com
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════ FEATURES (V4: Holographic Grid) ════════════════ */}
      <section id="features" className="py-32 px-6 bg-[#060a13] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(45,212,191,0.03)_0%,transparent_100%)] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold mb-6"
            >
              <i className="fa-solid fa-cubes animate-pulse"></i> {allFeatures.length}+ قدرة تشغيلية
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-5xl font-black mb-6 text-white"
            >
              ترسانة تقنية في <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-cyan-400 drop-shadow-[0_0_15px_rgba(45,212,191,0.3)]">منصة واحدة</span>
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto font-light"
            >
              تصفح القدرات التشغيلية التي ستحول مركزك إلى آلة تعمل بدقة متناهية.
            </motion.p>
          </div>

          {/* Category Selector */}
          <div className="flex flex-wrap justify-center gap-3 mb-16">
            {featureCategories.map((cat, i) => (
              <motion.button 
                key={cat.id} 
                onClick={() => setActiveCategory(cat.id)}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className={`relative px-6 py-3 rounded-2xl text-sm font-bold transition-all duration-500 flex items-center gap-2 overflow-hidden group
                  ${activeCategory === cat.id
                    ? `text-white shadow-[0_0_20px_rgba(255,255,255,0.1)]`
                    : 'bg-white/[0.02] text-slate-400 border border-white/[0.05] hover:border-white/[0.1] hover:text-white hover:bg-white/[0.05]'}`}
              >
                {activeCategory === cat.id && (
                  <motion.div 
                    layoutId="activeCategoryBg"
                    className={`absolute inset-0 bg-gradient-to-r ${cat.gradient} opacity-80`}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <i className={`fa-solid ${cat.icon} relative z-10 ${activeCategory === cat.id ? 'animate-bounce' : ''}`}></i>
                <span className="relative z-10">{cat.label}</span>
              </motion.button>
            ))}
          </div>

          <div className="text-center mb-10">
            <motion.span 
              key={activeCategory}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-block px-4 py-1 bg-white/[0.03] border border-white/[0.05] rounded-full text-[10px] font-bold text-slate-500 tracking-[0.3em] uppercase"
            >
              {currentCategory.labelEn} MODULE
            </motion.span>
          </div>

          {/* Features Grid */}
          <motion.div 
            key={activeCategory}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6"
          >
            {currentCategory.features.map((f, idx) => {
              const c = colorMap[f.color] || colorMap.cyan;
              return (
                <SpotlightCard key={`${activeCategory}-${idx}`} className="h-full p-px rounded-3xl bg-gradient-to-b from-white/[0.08] to-transparent">
                  <button 
                    onClick={() => setSelectedFeature(f)}
                    className="w-full h-full text-right bg-[#0a0f1c]/90 backdrop-blur-xl rounded-[23px] p-8 relative overflow-hidden group transition-all duration-500 hover:bg-[#0a0f1c]"
                  >
                    <div className={`absolute inset-0 ${c.bg} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />
                    <div className={`absolute -top-20 -right-20 w-40 h-40 ${c.bg} rounded-full blur-[50px] opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />
                    
                    <div className="relative z-10">
                      <div className={`w-16 h-16 rounded-2xl ${c.bg} border border-${f.color}-500/20 flex items-center justify-center ${c.text} text-3xl mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-[0_0_15px_rgba(var(--${f.color}-500),0.2)]`}>
                        <i className={`${f.icon.startsWith('fa-brands') ? f.icon : `fa-solid ${f.icon}`}`}></i>
                      </div>
                      
                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-slate-400 transition-all">{f.title}</h3>
                      <p className={`text-[10px] ${c.text} font-mono tracking-widest uppercase mb-4 opacity-70`}>{f.titleEn}</p>
                      
                      <p className="text-slate-400 text-sm leading-relaxed mb-8 font-light">{f.desc}</p>
                      
                      <div className={`inline-flex items-center gap-2 text-xs font-bold ${c.text} opacity-60 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-[-5px]`}>
                        <span>استكشف النظام</span>
                        <i className="fa-solid fa-arrow-left text-[10px]"></i>
                      </div>
                    </div>
                  </button>
                </SpotlightCard>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ════════════════ FEATURE MODAL (V4: Holographic Overlay) ════════════════ */}
      <AnimatePresence>
        {selectedFeature && (() => {
          const f = selectedFeature;
          const c = colorMap[f.color] || colorMap.cyan;
          const cat = featureCategories.find(cat => cat.features.includes(f));
          
          return (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6" 
              onClick={closeModal}
            >
              <div className="absolute inset-0 bg-[#060a13]/80 backdrop-blur-md" />
              
              <motion.div 
                initial={{ scale: 0.95, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 20, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative w-full max-w-2xl"
                onClick={e => e.stopPropagation()}
              >
                <SpotlightCard className="p-px rounded-[2rem] bg-gradient-to-b from-white/[0.15] to-white/[0.02] shadow-[0_0_50px_rgba(0,0,0,0.8)]">
                  <div className="bg-[#0a0f1c] rounded-[31px] overflow-hidden relative">
                    {/* Top Gradient Bar */}
                    <div className={`h-2 w-full bg-gradient-to-r ${cat?.gradient || 'from-teal-400 to-cyan-500'}`} />
                    
                    {/* Ambient Glow */}
                    <div className={`absolute top-0 right-0 w-64 h-64 ${c.bg} rounded-full blur-[80px] pointer-events-none`} />
                    
                    <div className="p-8 md:p-10 relative z-10">
                      <button 
                        onClick={closeModal} 
                        className="absolute top-6 left-6 w-10 h-10 rounded-full bg-white/[0.05] border border-white/[0.1] hover:bg-white/[0.1] flex items-center justify-center text-slate-400 hover:text-white transition-all duration-300 hover:rotate-90"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                      
                      <div className="flex items-start gap-6 mb-8">
                        <div className={`w-20 h-20 rounded-3xl ${c.bg} border border-${f.color}-500/30 flex items-center justify-center ${c.text} text-4xl shrink-0 shadow-[0_0_30px_rgba(var(--${f.color}-500),0.2)]`}>
                          <i className={`${f.icon.startsWith('fa-brands') ? f.icon : `fa-solid ${f.icon}`}`}></i>
                        </div>
                        <div className="pt-2">
                          <h3 className="text-2xl md:text-3xl font-black text-white mb-2">{f.title}</h3>
                          <p className={`text-sm ${c.text} font-mono tracking-widest uppercase opacity-80`}>{f.titleEn}</p>
                        </div>
                      </div>
                      
                      <p className="text-slate-300 text-lg leading-relaxed mb-10 font-light border-r-2 border-white/[0.1] pr-4">{f.desc}</p>
                      
                      <div className="grid sm:grid-cols-2 gap-4 mb-10">
                        {f.details.map((d, i) => (
                          <motion.div 
                            key={i} 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 + (i * 0.05) }}
                            className="flex items-start gap-3 bg-white/[0.02] border border-white/[0.05] p-4 rounded-2xl hover:bg-white/[0.04] transition-colors"
                          >
                            <div className={`w-6 h-6 rounded-full ${c.bg} flex items-center justify-center ${c.text} shrink-0 mt-0.5 shadow-[0_0_10px_rgba(var(--${f.color}-500),0.3)]`}>
                              <i className="fa-solid fa-check text-[10px]"></i>
                            </div>
                            <p className="text-slate-300 text-sm leading-relaxed font-medium">{d}</p>
                          </motion.div>
                        ))}
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-white/[0.05]">
                        <a href="#contact" onClick={closeModal} className={`flex-1 text-center px-8 py-4 bg-gradient-to-r ${cat?.gradient || 'from-teal-400 to-cyan-500'} text-white font-bold rounded-2xl hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all duration-300 hover:scale-[1.02]`}>
                          <i className="fa-solid fa-rocket ml-2"></i> ابدأ التحول الرقمي
                        </a>
                        <button onClick={closeModal} className="px-8 py-4 bg-white/[0.05] border border-white/[0.1] text-white font-bold rounded-2xl hover:bg-white/[0.1] transition-all duration-300">
                          إغلاق النافذة
                        </button>
                      </div>
                    </div>
                  </div>
                </SpotlightCard>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ════════════════ TECH SECTION (V4: Cybernetic Core) ════════════════ */}
      <section id="tech" className="py-32 px-6 relative overflow-hidden bg-[#060a13]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(45,212,191,0.05)_0%,transparent_70%)] pointer-events-none" />
        
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold mb-6"
            >
              <i className="fa-solid fa-microchip animate-pulse"></i> النواة التقنية
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-5xl font-black mb-6 text-white"
            >
              بنية تحتية <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-cyan-400 drop-shadow-[0_0_15px_rgba(45,212,191,0.3)]">لا تُقهر</span>
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto font-light"
            >
              نحن لا نبني برامج، نحن نبني حصوناً رقمية. أمان عسكري، أداء فائق، وتوافر مستمر.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { icon: 'fa-cloud', title: 'بنية سحابية موزعة', desc: 'خوادم عالمية تضمن سرعة استجابة أجزاء من الثانية وتوافر 99.99%.', color: 'teal' },
              { icon: 'fa-lock', title: 'تشفير عسكري', desc: 'تشفير End-to-End لجميع البيانات الطبية والمالية. لا أحد يرى بياناتك سواك.', color: 'cyan' },
              { icon: 'fa-clock-rotate-left', title: 'نسخ احتياطي لحظي', desc: 'نسخ احتياطية مشفرة وموزعة جغرافياً. بياناتك في مأمن من أي كارثة.', color: 'teal' },
              { icon: 'fa-bolt', title: 'أداء فائق (High Performance)', desc: 'معمارية مصممة للتعامل مع آلاف العمليات المتزامنة بدون أي تباطؤ.', color: 'cyan' },
            ].map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <SpotlightCard className="h-full p-px rounded-3xl bg-gradient-to-b from-white/[0.08] to-transparent">
                  <div className="h-full bg-[#0a0f1c]/90 backdrop-blur-xl rounded-[23px] p-8 relative overflow-hidden group flex items-start gap-6">
                    <div className={`absolute top-0 right-0 w-32 h-32 bg-${item.color}-500/10 rounded-full blur-[40px] group-hover:bg-${item.color}-500/20 transition-colors duration-500`} />
                    
                    <div className={`w-16 h-16 rounded-2xl bg-${item.color}-500/10 border border-${item.color}-500/20 flex items-center justify-center text-${item.color}-400 text-2xl shrink-0 group-hover:scale-110 transition-transform duration-500 shadow-[0_0_15px_rgba(var(--${item.color}-500),0.2)]`}>
                      <i className={`fa-solid ${item.icon}`}></i>
                    </div>
                    
                    <div className="relative z-10 pt-2">
                      <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                      <p className="text-slate-400 text-sm leading-relaxed font-light">{item.desc}</p>
                    </div>
                  </div>
                </SpotlightCard>
              </motion.div>
            ))}
          </div>

          {/* Tech Stack Ticker */}
          <div className="mt-20 relative overflow-hidden py-4 border-y border-white/[0.05] bg-white/[0.01]">
            <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#060a13] to-transparent z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#060a13] to-transparent z-10" />
            
            <motion.div 
              animate={{ x: [0, -1000] }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              className="flex items-center gap-12 whitespace-nowrap"
            >
              {[...Array(2)].map((_, i) => (
                <React.Fragment key={i}>
                  {[
                    { icon: 'fa-shield-halved', label: 'SSL/TLS 256-bit' },
                    { icon: 'fa-key', label: 'JWT Authentication' },
                    { icon: 'fa-helmet-safety', label: 'Helmet Security' },
                    { icon: 'fa-gauge', label: 'Rate Limiting' },
                    { icon: 'fa-database', label: 'PostgreSQL' },
                    { icon: 'fa-cloud', label: 'Neon Serverless' },
                    { icon: 'fa-server', label: 'Vite Edge' },
                    { icon: 'fa-code', label: 'TypeScript' },
                  ].map((t, j) => (
                    <div key={`${i}-${j}`} className="flex items-center gap-3 text-slate-500">
                      <i className={`fa-solid ${t.icon} text-teal-500/50`}></i>
                      <span className="font-mono text-sm tracking-wider">{t.label}</span>
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ════════════════ DEMO VIDEO (V4: Cinematic Showcase) ════════════════ */}
      <section id="demo-video" className="py-32 px-6 bg-[#060a13] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.05)_0%,transparent_70%)] pointer-events-none" />
        
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold mb-6"
            >
              <i className="fa-solid fa-circle-play animate-pulse"></i> العرض السينمائي
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-5xl font-black mb-6 text-white"
            >
              60 ثانية ستغير <span className="text-teal-400 drop-shadow-[0_0_15px_rgba(20,184,166,0.3)]">مفهومك</span> للإدارة الطبية
            </motion.h2>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 40 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="relative group perspective-1000"
          >
            <SpotlightCard className="p-1 rounded-[2.5rem] bg-gradient-to-b from-white/[0.1] to-transparent shadow-[0_0_50px_rgba(20,184,166,0.15)]">
              <div className="aspect-video bg-[#0a0f1c] rounded-[2.3rem] overflow-hidden relative">
                <video className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-700" poster="/logo.png" controls preload="none">
                  <source src="/demo-video.mp4" type="video/mp4" />
                </video>
                
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-colors duration-500 pointer-events-none group-has-[:playing]:hidden">
                  <div className="relative">
                    <div className="absolute inset-0 bg-teal-500 rounded-full blur-xl opacity-50 animate-pulse" />
                    <div className="w-24 h-24 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-md group-hover:scale-110 transition-transform duration-500 relative z-10">
                      <i className="fa-solid fa-play text-white text-3xl ml-2 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]"></i>
                    </div>
                  </div>
                </div>
              </div>
            </SpotlightCard>
          </motion.div>
        </div>
      </section>

      {/* ════════════════ CONTACT (V4: Secure Comms) ════════════════ */}
      <section id="contact" className="py-32 px-6 bg-[#060a13] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.05)_0%,transparent_70%)] pointer-events-none" />
        
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold mb-6"
            >
              <i className="fa-solid fa-satellite-dish animate-pulse"></i> قناة الاتصال المشفرة
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-5xl font-black mb-6 text-white"
            >
              نحن هنا <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-teal-400 drop-shadow-[0_0_15px_rgba(20,184,166,0.3)]">لخدمتك</span>
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto font-light"
            >
              فريق من الخبراء جاهز للإجابة على استفساراتك وتجهيز عرض تجريبي مخصص لمركزك.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { 
                href: "tel:0792020388", 
                icon: "fa-phone", 
                title: "الاتصال المباشر", 
                value: "079 202 0388", 
                color: "teal",
                delay: 0
              },
              { 
                href: "mailto:info@loopjo.com", 
                icon: "fa-envelope", 
                title: "البريد الإلكتروني", 
                value: "info@loopjo.com", 
                color: "cyan",
                delay: 0.1
              },
              { 
                href: "https://wa.me/962792020388", 
                icon: "fa-whatsapp", 
                title: "واتساب", 
                value: "محادثة فورية", 
                color: "teal",
                delay: 0.2,
                isBrand: true
              }
            ].map((item, i) => (
              <motion.a 
                key={i}
                href={item.href}
                target={item.isBrand ? "_blank" : undefined}
                rel={item.isBrand ? "noopener noreferrer" : undefined}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: item.delay }}
                className="block group"
              >
                <SpotlightCard className="h-full p-px rounded-3xl bg-gradient-to-b from-white/[0.08] to-transparent">
                  <div className="h-full bg-[#0a0f1c]/90 backdrop-blur-xl rounded-[23px] p-8 text-center relative overflow-hidden">
                    <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-${item.color}-500/10 rounded-full blur-[40px] group-hover:bg-${item.color}-500/20 transition-colors duration-500`} />
                    
                    <div className={`w-16 h-16 mx-auto rounded-2xl bg-${item.color}-500/10 border border-${item.color}-500/20 flex items-center justify-center text-${item.color}-400 text-2xl mb-6 group-hover:scale-110 transition-transform duration-500 shadow-[0_0_15px_rgba(var(--${item.color}-500),0.2)] relative z-10`}>
                      <i className={`${item.isBrand ? 'fa-brands' : 'fa-solid'} ${item.icon}`}></i>
                    </div>
                    
                    <div className="relative z-10">
                      <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                      <p className={`text-${item.color}-400 font-mono text-lg tracking-wider`} dir="ltr">{item.value}</p>
                    </div>
                  </div>
                </SpotlightCard>
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ FINAL CTA (V4: The Launchpad) ════════════════ */}
      <section className="py-32 px-6 relative overflow-hidden bg-[#060a13]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(45,212,191,0.1)_0%,transparent_70%)] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <SpotlightCard className="p-px rounded-[3rem] bg-gradient-to-b from-teal-400 to-cyan-500 shadow-[0_0_80px_rgba(45,212,191,0.2)]">
              <div className="bg-[#0a0f1c]/95 backdrop-blur-2xl rounded-[2.9rem] p-12 md:p-20 relative overflow-hidden">
                <div className="absolute -top-32 -right-32 w-64 h-64 bg-teal-500/20 rounded-full blur-[80px]" />
                <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-cyan-500/20 rounded-full blur-[80px]" />
                
                <div className="relative z-10">
                  <div className="w-24 h-24 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-3xl flex items-center justify-center text-white text-4xl mx-auto mb-10 shadow-[0_0_30px_rgba(45,212,191,0.5)]">
                    <i className="fa-solid fa-rocket"></i>
                  </div>
                  
                  <h2 className="text-4xl md:text-6xl font-black mb-6 leading-tight text-white">
                    هل مركزك جاهز
                    <br />
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-cyan-400">للمستقبل؟</span>
                  </h2>
                  
                  <p className="text-slate-400 mb-12 text-xl max-w-2xl mx-auto font-light">
                    كل يوم تقضيه في الأنظمة التقليدية هو فرصة ضائعة للنمو. انضم إلى نخبة المراكز الطبية التي تعمل بذكاء.
                  </p>
                  
                  <a href="#contact" className="inline-flex items-center justify-center gap-4 px-12 py-5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-bold rounded-2xl hover:shadow-[0_0_40px_rgba(45,212,191,0.4)] transition-all duration-300 hover:scale-[1.02] text-lg group">
                    <span>اطلب عرض تجريبي خاص</span>
                    <i className="fa-solid fa-arrow-left group-hover:-translate-x-2 transition-transform duration-300"></i>
                  </a>
                </div>
              </div>
            </SpotlightCard>
          </motion.div>
        </div>
      </section>

      {/* ════════════════ FOOTER (V4: Cybernetic Footer) ════════════════ */}
      <footer className="border-t border-white/[0.05] py-12 px-6 bg-[#060a13] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(45,212,191,0.03)_0%,transparent_70%)] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.1] flex items-center justify-center p-2">
              <img src="/logo.png" alt="MED LOOP" className="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]" />
            </div>
            <div className="flex flex-col">
              <span className="text-white font-bold tracking-wider">MED LOOP</span>
              <span className="text-slate-500 text-xs">© 2025 جميع الحقوق محفوظة.</span>
            </div>
          </div>
          
          <div className="flex items-center gap-6 text-slate-500 text-sm">
            <span className="flex items-center gap-2">
              من تطوير 
              <a href="https://loopjo.com" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:text-teal-300 transition-colors font-bold flex items-center gap-1 group">
                Loop
                <i className="fa-solid fa-arrow-up-right-from-square text-[10px] opacity-50 group-hover:opacity-100 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all"></i>
              </a>
            </span>
          </div>
        </div>
      </footer>

      {/* ════════════════ FLOATING WHATSAPP (V4: Holographic Orb) ════════════════ */}
      <a href="https://wa.me/962792020388" target="_blank" rel="noopener noreferrer"
         className="fixed bottom-8 left-8 z-50 group">
        <div className="absolute inset-0 bg-teal-500 rounded-full blur-xl opacity-40 group-hover:opacity-60 animate-pulse transition-opacity duration-500" />
        <div className="relative w-16 h-16 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center text-white text-3xl shadow-[0_0_30px_rgba(20,184,166,0.5)] group-hover:scale-110 transition-transform duration-500 border border-teal-300/50">
          <i className="fa-brands fa-whatsapp drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]"></i>
        </div>
      </a>
    </div>
  );
};

export default LandingView;
