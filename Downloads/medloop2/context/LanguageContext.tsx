
import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'ar';

const translations = {
  en: {
    // Auth & General
    welcome_back: "Welcome Back",
    sign_in_subtitle: "Sign in to MED LOOP System",
    email_label: "Email Address",
    password_label: "Password",
    sign_in_btn: "Sign In",
    authenticating: "Authenticating...",
    protected_msg: "Protected by Medical Data Compliance",

    admin_role: "Administrator",
    sec_role: "Secretary",
    doc_dental: "Doctor (Dental)",
    lab_tech: "Lab Technician",
    implant_mgr: "Implant Manager",
    logout: "Logout",
    dev_tip: "Dev Tip",
    dev_tip_msg: "Use the lightning button to switch roles instantly.",
    
    // Layout
    system_name: "MED LOOP",
    system_sub: "Multi-Clinic System",
    current_view: "Current View",
    patients_registry: "Patients Registry",
    appointments_nav: "Appointments",
    
    // Admin View
    admin_dashboard: "Administrator Dashboard",
    active_clinics: "Active Clinics",
    clinics_mgmt: "Clinics Management",
    add_clinic: "Add Clinic",
    cancel: "Cancel",
    save: "Save",
    clinic_name: "Clinic Name",
    name_col: "Name",
    status_col: "Status",
    actions_col: "Actions",
    user_roles: "User Roles",
    user_col: "User",
    role_col: "Role",
    active: "Active",
    disabled: "Disabled",

    // Reception View (Expanded)
    reception_desk: "Reception Desk",
    new_patient: "New Patient Entry",
    personal_info: "Personal Information",
    medical_intake: "Quick Medical Intake",
    admin_details: "Administrative Details",
    
    full_name: "Full Name",
    age: "Age",
    phone: "Phone",
    gender: "Gender",
    male: "Male",
    female: "Female",
    
    allergies: "Allergies?",
    allergies_hint: "List specific allergens",
    chronic_conditions: "Chronic Conditions?",
    current_meds: "Current Medications?",
    specify_details: "Please specify details...",
    
    pregnancy: "Pregnant?",
    
    assign_clinic: "Assign Clinic",
    reason_visit: "Reason for Visit",
    priority: "Priority",
    normal: "Normal",
    urgent: "Urgent",
    source: "Source",
    referral: "Referral",
    walk_in: "Walk-in",
    advertisement: "Advertisement",
    
    register_patient: "Register Patient",
    todays_queue: "Today's Queue",
    open_queue_screen: "Launch TV Screen",
    time_col: "Time",
    patient_col: "Patient",
    clinic_col: "Clinic",
    
    // Doctor View (Expanded)
    doctor_console: "Doctor's Console",
    waiting_room: "Waiting Room",
    filter_hint: "Filtered by your assigned clinics",
    no_active_patients: "No active patients.",
    years: "Years",
    unknown_clinic: "Unknown Clinic",
    assigned_to: "Assigned To",
    
    medical_alerts: "Medical Alerts",
    no_allergies: "No known allergies",
    no_chronic: "No chronic conditions",
    no_meds: "No current medications",
    
    patient_history: "Visit Timeline",
    current_encounter: "Current Encounter",
    
    diagnosis: "Diagnosis",
    diagnosis_placeholder: "Clinical diagnosis...",
    treatment: "Treatment / Plan",
    treatment_placeholder: "Prescriptions, recommendations, follow-up...",
    notes_placeholder: "Internal doctor notes...",
    
    emr_view: "Electronic Medical Record (EMR)",
    entry_id: "Visit ID",
    created: "Check-in",
    start_consult: "Start Consultation",
    complete_discharge: "Complete & Discharge",
    select_patient: "Select a patient to begin consultation",

    // Queue Screen
    queue_display_title: "Patient Waiting List",
    queue_status_wait: "Please Wait",
    queue_status_in: "Now Serving",

    // Registry & Profile
    search_placeholder: "Search by name or phone...",
    all_clinics: "All Clinics",
    all_statuses: "All Statuses",
    last_visit: "Last Visit",
    view_profile: "View Profile",
    
    tab_basic: "Basic Info",
    tab_timeline: "Visits Timeline",
    tab_clinical: "Clinical Data",
    
    access_denied: "Access Denied",
    access_denied_msg: "You do not have permission to view sensitive medical data.",
    
    save_changes: "Save Changes",
    saved_successfully: "Saved successfully",

    // Appointments
    appointments_title: "Appointments Schedule",
    new_appointment: "New Appointment",
    date_col: "Date & Time",
    doctor_col: "Doctor",
    check_in_btn: "Check-In",
    edit_btn: "Edit",
    cancel_btn: "Cancel",
    status_scheduled: "Scheduled",
    status_checked_in: "Checked In",
    status_cancelled: "Cancelled",
    no_appointments: "No appointments scheduled for this date.",
    select_existing_patient: "Select Existing Patient",
    schedule_btn: "Schedule",

    // Statuses
    waiting: "Waiting",
    in_progress: "In Progress",
    completed: "Completed"
  },
  ar: {
    // Auth & General
    welcome_back: "مرحباً بعودتك",
    sign_in_subtitle: "تسجيل الدخول لنظام MED LOOP",
    email_label: "البريد الإلكتروني",
    password_label: "كلمة المرور",
    sign_in_btn: "تسجيل الدخول",
    authenticating: "جاري التحقق...",
    protected_msg: "محمي بموجب قوانين البيانات الطبية",

    admin_role: "مدير النظام",
    sec_role: "سكرتارية",
    doc_dental: "طبيب (أسنان)",
    lab_tech: "فني مختبر",
    implant_mgr: "مدير الزراعة",
    logout: "تسجيل خروج",
    dev_tip: "نصيحة مطور",
    dev_tip_msg: "استخدم زر الصاعقة للتبديل السريع بين الأدوار.",

    // Layout
    system_name: "ميد لوب",
    system_sub: "نظام إدارة العيادات",
    current_view: "الواجهة الحالية",
    patients_registry: "سجل المرضى",
    appointments_nav: "المواعيد",

    // Admin View
    admin_dashboard: "لوحة تحكم المدير",
    active_clinics: "عيادات نشطة",
    clinics_mgmt: "إدارة العيادات",
    add_clinic: "إضافة عيادة",
    cancel: "إلغاء",
    save: "حفظ",
    clinic_name: "اسم العيادة",
    name_col: "الاسم",
    status_col: "الحالة",
    actions_col: "إجراءات",
    user_roles: "أدوار المستخدمين",
    user_col: "المستخدم",
    role_col: "الدور",
    active: "نشط",
    disabled: "معطل",

    // Reception View
    reception_desk: "مكتب الاستقبال",
    new_patient: "تسجيل مريض جديد",
    personal_info: "البيانات الشخصية",
    medical_intake: "الفحص الطبي السريع",
    admin_details: "بيانات إدارية",

    full_name: "الاسم الكامل",
    age: "العمر",
    phone: "الهاتف",
    gender: "الجنس",
    male: "ذكر",
    female: "أنثى",

    allergies: "حساسية؟",
    allergies_hint: "اذكر التفاصيل إن وجدت",
    chronic_conditions: "أمراض مزمنة؟",
    current_meds: "أدوية حالية؟",
    specify_details: "يرجى ذكر التفاصيل...",
    
    pregnancy: "حمل؟",

    assign_clinic: "توجيه لعيادة",
    reason_visit: "سبب الزيارة",
    priority: "الأولوية",
    normal: "عادي",
    urgent: "مستعجل",
    source: "المصدر",
    referral: "تحويل",
    walk_in: "حضور شخصي",
    advertisement: "إعلان",

    register_patient: "تسجيل المريض",
    todays_queue: "قائمة الانتظار",
    open_queue_screen: "فتح شاشة الانتظار",
    time_col: "الوقت",
    patient_col: "المريض",
    clinic_col: "العيادة",

    // Doctor View
    doctor_console: "وحدة تحكم الطبيب",
    waiting_room: "غرفة الانتظار",
    filter_hint: "مفلترة حسب العيادات المخصصة لك",
    no_active_patients: "لا يوجد مرضى نشطين.",
    years: "سنة",
    unknown_clinic: "عيادة غير معروفة",
    assigned_to: "محول إلى",

    medical_alerts: "تنبيهات طبية",
    no_allergies: "لا يوجد حساسية معروفة",
    no_chronic: "لا أمراض مزمنة",
    no_meds: "لا أدوية حالية",

    patient_history: "سجل الزيارات",
    current_encounter: "المعاينة الحالية",

    diagnosis: "التشخيص",
    diagnosis_placeholder: "اكتب التشخيص الطبي...",
    treatment: "العلاج / الخطة",
    treatment_placeholder: "وصفات طبية، توصيات، موعد قادم...",
    notes_placeholder: "ملاحظات داخلية للطبيب...",

    emr_view: "السجل الطبي الإلكتروني (EMR)",
    entry_id: "رقم الزيارة",
    created: "وقت الدخول",
    start_consult: "بدء المعاينة",
    complete_discharge: "إكمال وخروج",
    select_patient: "اختر مريضاً للبدء",

    // Queue Screen
    queue_display_title: "قائمة انتظار المرضى",
    queue_status_wait: "الرجاء الانتظار",
    queue_status_in: "تفضل بالدخول",

    // Registry & Profile
    search_placeholder: "بحث بالاسم أو الهاتف...",
    all_clinics: "كل العيادات",
    all_statuses: "كل الحالات",
    last_visit: "آخر زيارة",
    view_profile: "فتح الملف",
    
    tab_basic: "المعلومات الأساسية",
    tab_timeline: "سجل الزيارات",
    tab_clinical: "البيانات الطبية",
    
    access_denied: "تم رفض الوصول",
    access_denied_msg: "ليس لديك صلاحية للاطلاع على البيانات الطبية الحساسة.",

    save_changes: "حفظ التغييرات",
    saved_successfully: "تم الحفظ بنجاح",

    // Appointments
    appointments_title: "جدول المواعيد",
    new_appointment: "موعد جديد",
    date_col: "الوقت والتاريخ",
    doctor_col: "الطبيب",
    check_in_btn: "تأكيد الحضور",
    edit_btn: "تعديل",
    cancel_btn: "إلغاء",
    status_scheduled: "مجدول",
    status_checked_in: "حضر",
    status_cancelled: "ملغي",
    no_appointments: "لا توجد مواعيد لهذا اليوم.",
    select_existing_patient: "اختر مريض مسجل",
    schedule_btn: "حجز الموعد",

    // Statuses
    waiting: "انتظار",
    in_progress: "جاري المعاينة",
    completed: "مكتمل"
  }
};

type TransKey = keyof typeof translations.en;

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  t: (key: TransKey) => string;
  dir: 'ltr' | 'rtl';
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    // Set HTML direction
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'ar' : 'en');
  };

  const t = (key: TransKey): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t, dir: language === 'ar' ? 'rtl' : 'ltr' }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
};
