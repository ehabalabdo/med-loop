-- Seed Data for MedLoop Database
-- Date: 2026-02-04
-- Purpose: Initial data for testing and development

-- =============================================
-- 1. SEED CLINICS
-- =============================================

-- Patient-facing clinics
INSERT INTO clinics (id, name, type, category, active, created_at, created_by, updated_at, updated_by)
VALUES 
    ('c_dental', 'Dental Clinic', 'Dental', 'clinic', true, 
     extract(epoch from now())::bigint * 1000, 'system', 
     extract(epoch from now())::bigint * 1000, 'system'),
    
    ('c_gp', 'General Medicine', 'Medical', 'clinic', true,
     extract(epoch from now())::bigint * 1000, 'system',
     extract(epoch from now())::bigint * 1000, 'system'),
    
    ('c_laser', 'Laser Clinic', 'Cosmetic', 'clinic', true,
     extract(epoch from now())::bigint * 1000, 'system',
     extract(epoch from now())::bigint * 1000, 'system'),
    
    ('c_cosmetic', 'Cosmetic Clinic', 'Cosmetic', 'clinic', true,
     extract(epoch from now())::bigint * 1000, 'system',
     extract(epoch from now())::bigint * 1000, 'system')
ON CONFLICT (id) DO NOTHING;

-- Back-office departments
INSERT INTO clinics (id, name, type, category, active, created_at, created_by, updated_at, updated_by)
VALUES 
    ('c_lab', 'Dental Lab', 'Laboratory', 'department', true,
     extract(epoch from now())::bigint * 1000, 'system',
     extract(epoch from now())::bigint * 1000, 'system'),
    
    ('c_implant', 'Implantology Co.', 'Logistics', 'department', true,
     extract(epoch from now())::bigint * 1000, 'system',
     extract(epoch from now())::bigint * 1000, 'system'),
    
    ('c_courses', 'Beauty Courses', 'Education', 'department', true,
     extract(epoch from now())::bigint * 1000, 'system',
     extract(epoch from now())::bigint * 1000, 'system')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 2. SEED USERS
-- =============================================

-- Admin
INSERT INTO users (uid, email, password, name, role, clinic_ids, is_active, created_at, created_by, updated_at, updated_by)
VALUES 
    ('admin_1', 'admin@medloop.com', 'password123', 'System Admin', 'admin', 
     ARRAY[]::text[], true,
     extract(epoch from now())::bigint * 1000, 'system',
     extract(epoch from now())::bigint * 1000, 'system')
ON CONFLICT (uid) DO NOTHING;

-- Secretary
INSERT INTO users (uid, email, password, name, role, clinic_ids, is_active, created_at, created_by, updated_at, updated_by)
VALUES 
    ('sec_1', 'reception@medloop.com', 'password123', 'Sarah Reception', 'secretary',
     ARRAY[]::text[], true,
     extract(epoch from now())::bigint * 1000, 'system',
     extract(epoch from now())::bigint * 1000, 'system')
ON CONFLICT (uid) DO NOTHING;

-- Doctors
INSERT INTO users (uid, email, password, name, role, clinic_ids, is_active, created_at, created_by, updated_at, updated_by)
VALUES 
    ('doc_dental', 'dentist@medloop.com', 'password123', 'Dr. Dental', 'doctor',
     ARRAY['c_dental']::text[], true,
     extract(epoch from now())::bigint * 1000, 'system',
     extract(epoch from now())::bigint * 1000, 'system'),
    
    ('doc_gp', 'gp@medloop.com', 'password123', 'Dr. General', 'doctor',
     ARRAY['c_gp']::text[], true,
     extract(epoch from now())::bigint * 1000, 'system',
     extract(epoch from now())::bigint * 1000, 'system'),
    
    ('doc_beauty', 'beauty@medloop.com', 'password123', 'Dr. Beauty', 'doctor',
     ARRAY['c_laser', 'c_cosmetic']::text[], true,
     extract(epoch from now())::bigint * 1000, 'system',
     extract(epoch from now())::bigint * 1000, 'system')
ON CONFLICT (uid) DO NOTHING;

-- Lab Tech
INSERT INTO users (uid, email, password, name, role, clinic_ids, is_active, created_at, created_by, updated_at, updated_by)
VALUES 
    ('lab_1', 'lab@medloop.com', 'password123', 'Lab Technician', 'lab_tech',
     ARRAY['c_lab']::text[], true,
     extract(epoch from now())::bigint * 1000, 'system',
     extract(epoch from now())::bigint * 1000, 'system')
ON CONFLICT (uid) DO NOTHING;

-- Implant Manager
INSERT INTO users (uid, email, password, name, role, clinic_ids, is_active, created_at, created_by, updated_at, updated_by)
VALUES 
    ('implant_1', 'implant@medloop.com', 'password123', 'Implant Manager', 'implant_manager',
     ARRAY['c_implant']::text[], true,
     extract(epoch from now())::bigint * 1000, 'system',
     extract(epoch from now())::bigint * 1000, 'system')
ON CONFLICT (uid) DO NOTHING;

-- Course Manager
INSERT INTO users (uid, email, password, name, role, clinic_ids, is_active, created_at, created_by, updated_at, updated_by)
VALUES 
    ('course_1', 'academy@medloop.com', 'password123', 'Academy Manager', 'course_manager',
     ARRAY['c_courses']::text[], true,
     extract(epoch from now())::bigint * 1000, 'system',
     extract(epoch from now())::bigint * 1000, 'system')
ON CONFLICT (uid) DO NOTHING;

-- =============================================
-- 3. SEED SAMPLE PATIENTS
-- =============================================

INSERT INTO patients (id, name, age, gender, phone, email, password, medical_profile, current_visit, history, created_at, created_by, updated_at, updated_by)
VALUES 
    ('p_test_1', 'أحمد محمد', 35, 'male', '0501234567', 'ahmed@example.com', 'patient123',
     '{}'::jsonb,
     jsonb_build_object(
         'visitId', 'v_1',
         'clinicId', 'c_dental',
         'date', extract(epoch from now())::bigint * 1000,
         'status', 'waiting',
         'priority', 'normal',
         'source', 'walk-in',
         'reasonForVisit', 'ألم في الأسنان'
     ),
     '[]'::jsonb,
     extract(epoch from now())::bigint * 1000, 'sec_1',
     extract(epoch from now())::bigint * 1000, 'sec_1'),
    
    ('p_test_2', 'فاطمة علي', 28, 'female', '0509876543', 'fatima@example.com', 'patient123',
     '{}'::jsonb,
     jsonb_build_object(
         'visitId', 'v_2',
         'clinicId', 'c_gp',
         'date', extract(epoch from now())::bigint * 1000,
         'status', 'waiting',
         'priority', 'urgent',
         'source', 'walk-in',
         'reasonForVisit', 'فحص عام'
     ),
     '[]'::jsonb,
     extract(epoch from now())::bigint * 1000, 'sec_1',
     extract(epoch from now())::bigint * 1000, 'sec_1')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 4. SEED SYSTEM SETTINGS
-- =============================================

INSERT INTO system_settings (id, clinic_name, logo_url, address, phone)
VALUES ('settings_default', 'MED LOOP Clinic', '', 'Medical Plaza, Main Street', '+966-50-1234567')
ON CONFLICT (id) DO UPDATE 
SET clinic_name = EXCLUDED.clinic_name,
    address = EXCLUDED.address,
    phone = EXCLUDED.phone;

-- =============================================
-- 5. SEED COURSES (Beauty Academy)
-- =============================================

INSERT INTO courses (id, title, description, duration, price, instructor_name, has_certificate, status, created_at, created_by, updated_at, updated_by)
VALUES 
    ('crs_1', 'Advanced Botox & Fillers', 'Learn advanced injection techniques', '2 Days', 1500, 'Dr. Beauty', true, 'ACTIVE',
     extract(epoch from now())::bigint * 1000, 'course_1',
     extract(epoch from now())::bigint * 1000, 'course_1'),
    
    ('crs_2', 'Laser Hair Removal Tech', 'Master laser technology', '1 Week', 800, 'Sarah Tech', true, 'ACTIVE',
     extract(epoch from now())::bigint * 1000, 'course_1',
     extract(epoch from now())::bigint * 1000, 'course_1')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Count records
SELECT 'Clinics' as table_name, COUNT(*) as count FROM clinics
UNION ALL
SELECT 'Users', COUNT(*) FROM users
UNION ALL
SELECT 'Patients', COUNT(*) FROM patients
UNION ALL
SELECT 'Courses', COUNT(*) FROM courses;

-- List all users with roles
SELECT uid, name, email, role, 
       CASE WHEN password IS NOT NULL THEN '✓ Has Password' ELSE '✗ No Password' END as password_status
FROM users
ORDER BY role, name;

-- List all clinics
SELECT id, name, type, category, active
FROM clinics
ORDER BY category, name;

-- List patients in queue
SELECT * FROM active_queue;

COMMENT ON EXTENSION "uuid-ossp" IS 'UUID generation extension';
