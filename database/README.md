# MedLoop Database Documentation

## نظرة عامة
قاعدة البيانات مصممة لنظام عيادات طبية متكامل مع دعم للمصادقة الكاملة للأطباء والمرضى.

## الملفات

### 1. schema.sql
**الوصف:** Schema كامل للقاعدة البيانات من الصفر  
**الاستخدام:** لإنشاء قاعدة بيانات جديدة

```bash
# تشغيل على Neon
psql -h <your-neon-host> -U <username> -d <database> -f database/schema.sql
```

### 2. migration_add_auth.sql
**الوصف:** Migration script لإضافة حقول المصادقة للجداول الموجودة  
**الاستخدام:** لتحديث قاعدة بيانات قديمة

```bash
# تشغيل على Neon
psql -h <your-neon-host> -U <username> -d <database> -f database/migration_add_auth.sql
```

## الجداول الرئيسية

### users
**الغرض:** حسابات المستخدمين (أطباء، مسؤولين، موظفين)

**حقول جديدة:**
- `password` - كلمة المرور المشفرة

**Indexes:**
- `idx_users_email` - للبحث السريع بالبريد الإلكتروني
- `idx_users_role` - لفلترة حسب الدور
- `idx_users_is_active` - للمستخدمين النشطين

### patients
**الغرض:** سجلات المرضى مع إمكانية الدخول للبوابة الشخصية

**حقول جديدة:**
- `email` - البريد الإلكتروني للدخول
- `password` - كلمة المرور المشفرة

**Indexes:**
- `idx_patients_email` - للبحث السريع بالبريد الإلكتروني
- `idx_patients_name` - للبحث بالاسم
- `idx_patients_current_visit` - GIN index على current_visit (JSONB)

### clinics
**الغرض:** العيادات والأقسام

**حقول مهمة:**
- `category` - 'clinic' أو 'department' (للتمييز بين عيادات المرضى والأقسام الإدارية)
- `active` - حالة النشاط

### appointments
**الغرض:** المواعيد المجدولة

**Indexes:**
- `idx_appointments_date` - للبحث بالتاريخ
- `idx_appointments_doctor_id` - لمواعيد دكتور معين
- `idx_appointments_status` - لفلترة حسب الحالة

## Views

### active_queue
**الغرض:** عرض قائمة الانتظار النشطة مع ترتيب حسب الأولوية

```sql
SELECT * FROM active_queue;
```

### todays_appointments
**الغرض:** عرض مواعيد اليوم المجدولة

```sql
SELECT * FROM todays_appointments;
```

## سير العمل

### 1. إنشاء حساب طبيب
```sql
INSERT INTO users (uid, email, password, name, role, clinic_ids, is_active, created_at, created_by, updated_at, updated_by)
VALUES (
    'user_abc123_xyz',
    'doctor@clinic.com',
    'hashed_password_here', -- استخدم bcrypt في production
    'Dr. Ahmed',
    'doctor',
    ARRAY['clinic_1', 'clinic_2'],
    true,
    extract(epoch from now())::bigint * 1000,
    'admin_uid',
    extract(epoch from now())::bigint * 1000,
    'admin_uid'
);
```

### 2. إنشاء حساب مريض
```sql
INSERT INTO patients (id, name, age, gender, phone, email, password, medical_profile, current_visit, history, created_at, created_by, updated_at, updated_by)
VALUES (
    'patient_xyz789_abc',
    'محمد أحمد',
    35,
    'male',
    '0501234567',
    'patient@email.com',
    'hashed_password_here',
    '{}'::jsonb,
    jsonb_build_object(
        'visitId', 'visit_123',
        'clinicId', 'clinic_1',
        'date', extract(epoch from now())::bigint * 1000,
        'status', 'waiting',
        'priority', 'normal',
        'reasonForVisit', 'فحص دوري'
    ),
    '[]'::jsonb,
    extract(epoch from now())::bigint * 1000,
    'secretary_uid',
    extract(epoch from now())::bigint * 1000,
    'secretary_uid'
);
```

### 3. البحث عن مريض في قائمة الانتظار
```sql
SELECT * FROM active_queue
WHERE clinic_id = 'clinic_1'
ORDER BY 
    CASE WHEN priority = 'urgent' THEN 0 ELSE 1 END,
    visit_date;
```

## الأمان

### كلمات المرور الافتراضية
- **الأطباء:** `password123`
- **المرضى:** `patient123`

⚠️ **مهم:** يجب تغيير كلمات المرور عند أول تسجيل دخول!

### تشفير كلمات المرور
في بيئة الإنتاج، استخدم:
- bcrypt لتشفير كلمات المرور
- HTTPS لجميع الاتصالات
- JWT tokens للمصادقة

## صيانة قاعدة البيانات

### Backup
```bash
pg_dump -h <neon-host> -U <username> -d <database> -F c -f medloop_backup.dump
```

### Restore
```bash
pg_restore -h <neon-host> -U <username> -d <database> -F c medloop_backup.dump
```

### تنظيف السجلات القديمة
```sql
-- أرشفة المرضى القدامى
UPDATE patients 
SET is_archived = true
WHERE current_visit->>'status' = 'completed'
  AND (current_visit->>'date')::BIGINT < extract(epoch from now() - interval '1 year')::bigint * 1000;

-- حذف الإشعارات القديمة
DELETE FROM notifications
WHERE is_read = true
  AND created_at < extract(epoch from now() - interval '3 months')::bigint * 1000;
```

## استكشاف الأخطاء

### التحقق من الاتصال
```sql
SELECT version();
SELECT current_database();
SELECT current_user;
```

### التحقق من الجداول
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

### التحقق من Indexes
```sql
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

## التطوير المستقبلي

### ميزات مخططة
- [ ] Role-based access control (RBAC)
- [ ] Audit logs للتتبع الكامل
- [ ] Soft delete مع إمكانية الاسترجاع
- [ ] Full-text search على السجلات الطبية
- [ ] Data encryption at rest

## الدعم
للمشاكل والاستفسارات، راجع:
- [Neon Documentation](https://neon.tech/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
