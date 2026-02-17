import React, { useState, useEffect } from 'react';

const LandingView: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: 'fa-hospital-user',
      title: 'إدارة العيادات المتعددة',
      titleEn: 'Multi-Clinic Management',
      desc: 'إدارة عدة عيادات من لوحة تحكم واحدة. تنظيم العيادات، الأقسام، وفرق العمل بكل سهولة.',
    },
    {
      icon: 'fa-user-nurse',
      title: 'نظام الاستقبال الذكي',
      titleEn: 'Smart Reception System',
      desc: 'تسجيل المرضى، إدارة قائمة الانتظار، وتحويل المرضى للعيادات بضغطة واحدة.',
    },
    {
      icon: 'fa-user-doctor',
      title: 'لوحة الطبيب',
      titleEn: 'Doctor Dashboard',
      desc: 'ملف طبي شامل لكل مريض، تشخيصات، وصفات طبية، ملاحظات، ومرفقات.',
    },
    {
      icon: 'fa-calendar-check',
      title: 'نظام المواعيد',
      titleEn: 'Appointment System',
      desc: 'حجز المواعيد، تأكيدها، تذكيرات تلقائية، وعرض على شاشة الانتظار.',
    },
    {
      icon: 'fa-tv',
      title: 'شاشة الانتظار',
      titleEn: 'Queue Display',
      desc: 'شاشة عرض للمرضى المنتظرين مع نداء صوتي تلقائي عند حان الدور.',
    },
    {
      icon: 'fa-file-invoice-dollar',
      title: 'الفواتير والمحاسبة',
      titleEn: 'Billing & Invoicing',
      desc: 'إنشاء الفواتير، تتبع المدفوعات، وتقارير مالية مفصلة.',
    },
    {
      icon: 'fa-tooth',
      title: 'مختبر الأسنان',
      titleEn: 'Dental Lab',
      desc: 'إدارة حالات المختبر، تتبع الطلبات، والتواصل مع فني المختبر.',
    },
    {
      icon: 'fa-screwdriver-wrench',
      title: 'شركة الزراعات',
      titleEn: 'Implant Company',
      desc: 'إدارة مخزون الزراعات، تتبع الطلبات، وربط مع الأطباء.',
    },
    {
      icon: 'fa-graduation-cap',
      title: 'الأكاديمية',
      titleEn: 'Academy & Courses',
      desc: 'إنشاء دورات تدريبية، تسجيل الطلاب، وإدارة الجلسات.',
    },
    {
      icon: 'fa-microchip',
      title: 'ربط الأجهزة الطبية',
      titleEn: 'Medical Device Integration',
      desc: 'ربط أجهزة الفحص مع النظام واستقبال النتائج تلقائياً في ملف المريض.',
    },
    {
      icon: 'fa-mobile-screen',
      title: 'بوابة المريض',
      titleEn: 'Patient Portal',
      desc: 'دخول المريض لحسابه، عرض سجله الطبي، حجز المواعيد، ومتابعة زياراته.',
    },
    {
      icon: 'fa-shield-halved',
      title: 'أمان وخصوصية',
      titleEn: 'Security & Privacy',
      desc: 'تشفير البيانات، صلاحيات متعددة المستويات، وحماية كاملة للبيانات الطبية.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden" style={{ fontFamily: "'Cairo', 'Plus Jakarta Sans', sans-serif" }}>

      {/* Navbar */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-slate-900/95 backdrop-blur-md shadow-lg shadow-primary/5 border-b border-primary/10' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="MED LOOP" className="w-10 h-10 object-contain" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">MED LOOP</span>
          </div>
          
          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-slate-400 hover:text-primary transition-colors text-sm font-medium">المميزات</a>
            <a href="#why" className="text-slate-400 hover:text-primary transition-colors text-sm font-medium">لماذا MED LOOP</a>
            <a href="#contact" className="text-slate-400 hover:text-primary transition-colors text-sm font-medium">تواصل معنا</a>
          </div>

          {/* Mobile Menu Button */}
          <button onClick={() => setMobileMenu(!mobileMenu)} className="md:hidden text-slate-400 hover:text-white text-xl">
            <i className={`fa-solid ${mobileMenu ? 'fa-xmark' : 'fa-bars'}`}></i>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenu && (
          <div className="md:hidden bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-6 py-4 space-y-3">
            <a href="#features" onClick={() => setMobileMenu(false)} className="block text-slate-300 hover:text-primary py-2">المميزات</a>
            <a href="#why" onClick={() => setMobileMenu(false)} className="block text-slate-300 hover:text-primary py-2">لماذا MED LOOP</a>
            <a href="#contact" onClick={() => setMobileMenu(false)} className="block text-slate-300 hover:text-primary py-2">تواصل معنا</a>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Video */}
        <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover z-0 opacity-30">
          <source src="/bg-video.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/50 via-slate-950/80 to-slate-950 z-[1]"></div>

        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <div className="logo-float mb-8">
            <img src="/logo.png" alt="MED LOOP" className="w-24 h-24 mx-auto object-contain" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-cyan-300 to-secondary">MED LOOP</span>
            <br />
            <span className="text-white text-2xl md:text-4xl">نظام إدارة العيادات المتكامل</span>
          </h1>
          <p className="text-slate-400 text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
            حل سحابي شامل لإدارة العيادات والمراكز الطبية. من الاستقبال حتى التشخيص، كل شيء في مكان واحد.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#contact" className="px-8 py-4 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-xl hover:shadow-lg hover:shadow-primary/30 transition-all text-lg">
              <i className="fa-solid fa-rocket ml-2"></i>
              ابدأ الآن
            </a>
            <a href="#features" className="px-8 py-4 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-all text-lg">
              <i className="fa-solid fa-eye ml-2"></i>
              اكتشف المميزات
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 mt-16 max-w-lg mx-auto">
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary">100%</div>
              <div className="text-xs text-slate-500 mt-1">سحابي</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary">24/7</div>
              <div className="text-xs text-slate-500 mt-1">متاح دائماً</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary">∞</div>
              <div className="text-xs text-slate-500 mt-1">عيادات</div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <i className="fa-solid fa-chevron-down text-primary/50 text-2xl"></i>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-primary text-sm font-bold mb-4">
              المميزات
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">كل ما تحتاجه في <span className="text-primary">نظام واحد</span></h2>
            <p className="text-slate-500 max-w-xl mx-auto">مجموعة شاملة من الأدوات المصممة خصيصاً للعيادات والمراكز الطبية</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, idx) => (
              <div key={idx} className="group bg-slate-900/50 border border-slate-800 rounded-2xl p-6 hover:border-primary/30 hover:bg-slate-900/80 transition-all duration-300 hover:-translate-y-1">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary text-xl mb-4 group-hover:bg-primary/20 transition-colors">
                  <i className={`fa-solid ${f.icon}`}></i>
                </div>
                <h3 className="text-lg font-bold text-white mb-1">{f.title}</h3>
                <p className="text-xs text-primary/60 font-medium mb-3">{f.titleEn}</p>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why MED LOOP */}
      <section id="why" className="py-24 px-6 bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-primary text-sm font-bold mb-4">
              لماذا نحن
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">لماذا <span className="text-primary">MED LOOP</span>؟</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0 mt-1">
                <i className="fa-solid fa-cloud"></i>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">سحابي بالكامل</h3>
                <p className="text-slate-400 text-sm">لا حاجة لتثبيت أي برنامج. افتح المتصفح وابدأ العمل من أي مكان وأي جهاز.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0 mt-1">
                <i className="fa-solid fa-bolt"></i>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">سريع وسهل الاستخدام</h3>
                <p className="text-slate-400 text-sm">واجهة بسيطة وسلسة مصممة للاستخدام اليومي في بيئة العيادة.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0 mt-1">
                <i className="fa-solid fa-language"></i>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">عربي وإنجليزي</h3>
                <p className="text-slate-400 text-sm">دعم كامل للغة العربية والإنجليزية مع إمكانية التبديل الفوري.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0 mt-1">
                <i className="fa-solid fa-people-group"></i>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">متعدد المستخدمين</h3>
                <p className="text-slate-400 text-sm">صلاحيات مختلفة للمدير، السكرتيرة، الطبيب، فني المختبر، والمريض.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0 mt-1">
                <i className="fa-solid fa-building"></i>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">SaaS - كل عميل مستقل</h3>
                <p className="text-slate-400 text-sm">كل مركز طبي له بياناته المنفصلة تماماً مع رابط خاص به.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0 mt-1">
                <i className="fa-solid fa-headset"></i>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">دعم فني مستمر</h3>
                <p className="text-slate-400 text-sm">فريق دعم جاهز لمساعدتك في أي وقت وتخصيص النظام حسب احتياجاتك.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-3xl p-12">
          <h2 className="text-3xl font-bold mb-4">جاهز لتطوير عيادتك؟</h2>
          <p className="text-slate-400 mb-8">ابدأ تجربتك المجانية الآن واكتشف كيف يمكن لـ MED LOOP تحسين إدارة عيادتك</p>
          <a href="#contact" className="inline-block px-10 py-4 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-xl hover:shadow-lg hover:shadow-primary/30 transition-all text-lg">
            <i className="fa-solid fa-phone ml-2"></i>
            تواصل معنا
          </a>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 px-6 bg-slate-900/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-primary text-sm font-bold mb-4">
              تواصل معنا
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">نحن هنا <span className="text-primary">لمساعدتك</span></h2>
            <p className="text-slate-500">تواصل معنا للاستفسار أو لبدء تجربتك المجانية</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <a href="tel:0792020388" className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center hover:border-primary/30 transition-all group">
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center text-primary text-2xl mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                <i className="fa-solid fa-phone"></i>
              </div>
              <h3 className="font-bold text-white mb-2">الهاتف</h3>
              <p className="text-primary font-mono text-lg" dir="ltr">079 202 0388</p>
            </a>

            <a href="mailto:info@loopjo.com" className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center hover:border-primary/30 transition-all group">
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center text-primary text-2xl mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                <i className="fa-solid fa-envelope"></i>
              </div>
              <h3 className="font-bold text-white mb-2">البريد الإلكتروني</h3>
              <p className="text-primary text-lg">info@loopjo.com</p>
            </a>

            <a href="https://wa.me/962792020388" target="_blank" rel="noopener noreferrer" className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center hover:border-green-500/30 transition-all group">
              <div className="w-14 h-14 bg-green-500/10 rounded-xl flex items-center justify-center text-green-400 text-2xl mx-auto mb-4 group-hover:bg-green-500/20 transition-colors">
                <i className="fa-brands fa-whatsapp"></i>
              </div>
              <h3 className="font-bold text-white mb-2">واتساب</h3>
              <p className="text-green-400 text-lg">راسلنا مباشرة</p>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="MED LOOP" className="w-8 h-8 object-contain" />
            <span className="text-slate-500 text-sm">© 2026 MED LOOP. جميع الحقوق محفوظة.</span>
          </div>
          <div className="flex items-center gap-6 text-slate-600 text-sm">
            <span>من تطوير <a href="https://loopjo.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Loop</a></span>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp */}
      <a href="https://wa.me/962792020388" target="_blank" rel="noopener noreferrer" 
         className="fixed bottom-6 left-6 w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-white text-2xl shadow-lg shadow-green-500/30 hover:scale-110 transition-transform z-40">
        <i className="fa-brands fa-whatsapp"></i>
      </a>

      <style>{`
        .logo-float {
          animation: logoFloat 3s ease-in-out infinite;
        }
        @keyframes logoFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        html {
          scroll-behavior: smooth;
        }
      `}</style>
    </div>
  );
};

export default LandingView;
