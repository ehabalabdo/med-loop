-- =============================================
-- MIGRATION: Multi-Tenant SaaS (clients)
-- Date: 2026-02-15
-- Description: Adds clients table and client_id to all existing tables
-- =============================================

-- =============================================
-- 1. CLIENTS TABLE (الزبائن - المراكز)
-- =============================================
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,                    -- اسم المركز
    slug VARCHAR(100) UNIQUE NOT NULL,             -- الرابط الفريد (alshifa, royal)
    logo_url TEXT DEFAULT '',                       -- شعار المركز
    phone VARCHAR(50) DEFAULT '',                   -- رقم التواصل
    email VARCHAR(255) DEFAULT '',                  -- إيميل المركز
    address TEXT DEFAULT '',                        -- العنوان
    
    -- الاشتراك
    status VARCHAR(20) DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'expired', 'suspended')),
    trial_ends_at TIMESTAMP DEFAULT (NOW() + INTERVAL '30 days'),
    subscription_ends_at TIMESTAMP,
    
    -- المدير
    owner_user_id INTEGER,                          -- أول يوزر (المدير)
    
    -- Audit
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_slug ON clients(slug);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);

-- =============================================
-- 2. SUPER ADMIN TABLE (أنت فقط)
-- =============================================
CREATE TABLE IF NOT EXISTS super_admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert super admin (ehabloop)
INSERT INTO super_admins (username, password, name)
VALUES ('ehabloop', 'ehab@&2026', 'Ehab - Super Admin')
ON CONFLICT (username) DO NOTHING;

-- =============================================
-- 3. ADD client_id TO ALL EXISTING TABLES
-- =============================================

-- Users
ALTER TABLE users ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id);
CREATE INDEX IF NOT EXISTS idx_users_client_id ON users(client_id);

-- Patients
ALTER TABLE patients ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id);
CREATE INDEX IF NOT EXISTS idx_patients_client_id ON patients(client_id);

-- Clinics (departments)
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id);
CREATE INDEX IF NOT EXISTS idx_clinics_client_id ON clinics(client_id);

-- Appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON appointments(client_id);

-- Invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);

-- Notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id);
CREATE INDEX IF NOT EXISTS idx_notifications_client_id ON notifications(client_id);

-- Lab Cases
ALTER TABLE lab_cases ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id);
CREATE INDEX IF NOT EXISTS idx_lab_cases_client_id ON lab_cases(client_id);

-- Implant Inventory
ALTER TABLE implant_inventory ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id);
CREATE INDEX IF NOT EXISTS idx_implant_inventory_client_id ON implant_inventory(client_id);

-- Implant Orders
ALTER TABLE implant_orders ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id);
CREATE INDEX IF NOT EXISTS idx_implant_orders_client_id ON implant_orders(client_id);

-- Courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id);
CREATE INDEX IF NOT EXISTS idx_courses_client_id ON courses(client_id);

-- Course Students
ALTER TABLE course_students ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id);
CREATE INDEX IF NOT EXISTS idx_course_students_client_id ON course_students(client_id);

-- Course Sessions
ALTER TABLE course_sessions ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id);
CREATE INDEX IF NOT EXISTS idx_course_sessions_client_id ON course_sessions(client_id);

-- System Settings
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id);
CREATE INDEX IF NOT EXISTS idx_system_settings_client_id ON system_settings(client_id);

-- =============================================
-- DONE
-- =============================================
COMMENT ON TABLE clients IS 'SaaS clients - each client is a medical center with its own subscription';
COMMENT ON TABLE super_admins IS 'Platform owner - manages all clients';
