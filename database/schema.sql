-- MedLoop Database Schema for Neon PostgreSQL
-- Updated: 2026-02-04
-- Supports complete authentication workflow for doctors and patients

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- USERS TABLE (Doctors, Admins, Staff)
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    uid VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255), -- Hashed password for authentication
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'secretary', 'doctor', 'lab_tech', 'implant_manager', 'course_manager')),
    clinic_ids TEXT[], -- Array of clinic IDs
    is_active BOOLEAN DEFAULT true,
    
    -- Audit fields
    created_at BIGINT NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    updated_at BIGINT NOT NULL,
    updated_by VARCHAR(255) NOT NULL,
    is_archived BOOLEAN DEFAULT false,
    
    created_at_timestamp TIMESTAMP DEFAULT NOW(),
    updated_at_timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);

-- =============================================
-- CLINICS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS clinics (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL, -- e.g., "Dental", "Medical", "Laboratory"
    category VARCHAR(50) NOT NULL CHECK (category IN ('clinic', 'department')),
    active BOOLEAN DEFAULT true,
    
    -- Audit fields
    created_at BIGINT NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    updated_at BIGINT NOT NULL,
    updated_by VARCHAR(255) NOT NULL,
    is_archived BOOLEAN DEFAULT false,
    
    created_at_timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_clinics_category ON clinics(category);
CREATE INDEX idx_clinics_active ON clinics(active);

-- =============================================
-- PATIENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS patients (
    id VARCHAR(255) PRIMARY KEY,
    
    -- Demographics
    name VARCHAR(255) NOT NULL,
    age INTEGER,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female')),
    phone VARCHAR(50),
    
    -- Authentication (for patient portal)
    email VARCHAR(255),
    password VARCHAR(255), -- Hashed password
    
    -- Medical Profile (stored as JSONB for flexibility)
    medical_profile JSONB DEFAULT '{}',
    
    -- Current Visit (embedded)
    current_visit JSONB NOT NULL,
    
    -- History
    history JSONB DEFAULT '[]',
    
    -- Audit fields
    created_at BIGINT NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    updated_at BIGINT NOT NULL,
    updated_by VARCHAR(255) NOT NULL,
    is_archived BOOLEAN DEFAULT false,
    
    created_at_timestamp TIMESTAMP DEFAULT NOW(),
    updated_at_timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_patients_email ON patients(email);
CREATE INDEX idx_patients_name ON patients(name);
CREATE INDEX idx_patients_is_archived ON patients(is_archived);
CREATE INDEX idx_patients_current_visit ON patients USING GIN(current_visit);

-- =============================================
-- APPOINTMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS appointments (
    id VARCHAR(255) PRIMARY KEY,
    patient_id VARCHAR(255) NOT NULL,
    patient_name VARCHAR(255) NOT NULL,
    clinic_id VARCHAR(255) NOT NULL,
    doctor_id VARCHAR(255),
    date BIGINT NOT NULL,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'checked-in', 'completed', 'cancelled')),
    
    -- Audit fields
    created_at BIGINT NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    updated_at BIGINT NOT NULL,
    updated_by VARCHAR(255) NOT NULL,
    
    created_at_timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX idx_appointments_clinic_id ON appointments(clinic_id);
CREATE INDEX idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX idx_appointments_date ON appointments(date);
CREATE INDEX idx_appointments_status ON appointments(status);

-- =============================================
-- INVOICES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(255) PRIMARY KEY,
    visit_id VARCHAR(255) NOT NULL,
    patient_id VARCHAR(255) NOT NULL,
    patient_name VARCHAR(255) NOT NULL,
    items JSONB NOT NULL, -- Array of {id, description, price}
    total_amount DECIMAL(10, 2) NOT NULL,
    paid_amount DECIMAL(10, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid')),
    payment_method VARCHAR(50) DEFAULT 'cash',
    
    -- Audit fields
    created_at BIGINT NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    updated_at BIGINT NOT NULL,
    updated_by VARCHAR(255) NOT NULL,
    
    created_at_timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_invoices_patient_id ON invoices(patient_id);
CREATE INDEX idx_invoices_status ON invoices(status);

-- =============================================
-- NOTIFICATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(50) NOT NULL CHECK (type IN ('reminder', 'alert', 'info')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    target_role VARCHAR(50),
    related_patient_id VARCHAR(255),
    due_date BIGINT,
    is_read BOOLEAN DEFAULT false,
    
    -- Audit fields
    created_at BIGINT NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    updated_at BIGINT NOT NULL,
    updated_by VARCHAR(255) NOT NULL,
    
    created_at_timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_due_date ON notifications(due_date);

-- =============================================
-- SYSTEM SETTINGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS system_settings (
    id VARCHAR(255) PRIMARY KEY DEFAULT 'settings_default',
    clinic_name VARCHAR(255),
    logo_url TEXT,
    address TEXT,
    phone VARCHAR(50)
);

-- Insert default settings
INSERT INTO system_settings (id, clinic_name, logo_url, address, phone)
VALUES ('settings_default', 'MED LOOP Clinic', '', 'Medical Plaza', '000-000-0000')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- LAB CASES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS lab_cases (
    id VARCHAR(255) PRIMARY KEY,
    visit_id VARCHAR(255) NOT NULL,
    patient_id VARCHAR(255) NOT NULL,
    patient_name VARCHAR(255) NOT NULL,
    doctor_id VARCHAR(255),
    doctor_name VARCHAR(255),
    case_type VARCHAR(100),
    notes TEXT,
    due_date BIGINT,
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'DELIVERED')),
    
    -- Audit fields
    created_at BIGINT NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    updated_at BIGINT NOT NULL,
    updated_by VARCHAR(255) NOT NULL
);

CREATE INDEX idx_lab_cases_doctor_id ON lab_cases(doctor_id);
CREATE INDEX idx_lab_cases_status ON lab_cases(status);

-- =============================================
-- IMPLANT INVENTORY TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS implant_inventory (
    id VARCHAR(255) PRIMARY KEY,
    brand VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    size VARCHAR(50),
    quantity INTEGER NOT NULL DEFAULT 0,
    min_threshold INTEGER DEFAULT 5,
    
    -- Audit fields
    created_at BIGINT NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    updated_at BIGINT NOT NULL,
    updated_by VARCHAR(255) NOT NULL
);

CREATE INDEX idx_implant_inventory_quantity ON implant_inventory(quantity);

-- =============================================
-- IMPLANT ORDERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS implant_orders (
    id VARCHAR(255) PRIMARY KEY,
    clinic_id VARCHAR(255) NOT NULL,
    clinic_name VARCHAR(255),
    doctor_id VARCHAR(255) NOT NULL,
    doctor_name VARCHAR(255),
    item_id VARCHAR(255) NOT NULL,
    brand VARCHAR(255),
    type VARCHAR(255),
    size VARCHAR(50),
    quantity INTEGER NOT NULL,
    required_date BIGINT,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'DELIVERED')),
    
    -- Audit fields
    created_at BIGINT NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    updated_at BIGINT NOT NULL,
    updated_by VARCHAR(255) NOT NULL
);

CREATE INDEX idx_implant_orders_doctor_id ON implant_orders(doctor_id);
CREATE INDEX idx_implant_orders_status ON implant_orders(status);

-- =============================================
-- COURSES TABLE (Beauty Academy)
-- =============================================
CREATE TABLE IF NOT EXISTS courses (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration VARCHAR(100),
    price DECIMAL(10, 2),
    instructor_name VARCHAR(255),
    has_certificate BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'COMPLETED')),
    
    -- Audit fields
    created_at BIGINT NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    updated_at BIGINT NOT NULL,
    updated_by VARCHAR(255) NOT NULL
);

-- =============================================
-- COURSE STUDENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS course_students (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    gender VARCHAR(10),
    course_id VARCHAR(255) NOT NULL,
    course_name VARCHAR(255),
    enrollment_date BIGINT,
    total_fees DECIMAL(10, 2),
    paid_amount DECIMAL(10, 2) DEFAULT 0,
    payment_status VARCHAR(50) DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID', 'PARTIAL', 'PAID')),
    is_certified BOOLEAN DEFAULT false,
    
    -- Audit fields
    created_at BIGINT NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    updated_at BIGINT NOT NULL,
    updated_by VARCHAR(255) NOT NULL
);

CREATE INDEX idx_course_students_course_id ON course_students(course_id);
CREATE INDEX idx_course_students_payment_status ON course_students(payment_status);

-- =============================================
-- COURSE SESSIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS course_sessions (
    id VARCHAR(255) PRIMARY KEY,
    course_id VARCHAR(255) NOT NULL,
    course_name VARCHAR(255),
    date BIGINT NOT NULL,
    topic VARCHAR(255),
    instructor VARCHAR(255),
    
    -- Audit fields
    created_at BIGINT NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    updated_at BIGINT NOT NULL,
    updated_by VARCHAR(255) NOT NULL
);

CREATE INDEX idx_course_sessions_course_id ON course_sessions(course_id);
CREATE INDEX idx_course_sessions_date ON course_sessions(date);

-- =============================================
-- VIEWS FOR EASIER QUERYING
-- =============================================

-- Active patients in queue
CREATE OR REPLACE VIEW active_queue AS
SELECT 
    p.id,
    p.name,
    p.age,
    p.gender,
    p.phone,
    p.current_visit->>'status' as status,
    p.current_visit->>'priority' as priority,
    p.current_visit->>'clinicId' as clinic_id,
    (p.current_visit->>'date')::BIGINT as visit_date,
    p.created_at_timestamp
FROM patients p
WHERE p.is_archived = false
  AND p.current_visit->>'status' != 'completed'
ORDER BY 
    CASE WHEN p.current_visit->>'priority' = 'urgent' THEN 0 ELSE 1 END,
    (p.current_visit->>'date')::BIGINT;

-- Today's appointments
CREATE OR REPLACE VIEW todays_appointments AS
SELECT *
FROM appointments
WHERE date >= EXTRACT(EPOCH FROM date_trunc('day', NOW())) * 1000
  AND date < EXTRACT(EPOCH FROM date_trunc('day', NOW() + INTERVAL '1 day')) * 1000
  AND status = 'scheduled'
ORDER BY date;

COMMENT ON TABLE users IS 'System users including doctors, admins, and staff with authentication';
COMMENT ON TABLE patients IS 'Patient records with demographics, medical profile, and portal access';
COMMENT ON TABLE clinics IS 'Clinical departments and facilities';
COMMENT ON TABLE appointments IS 'Scheduled patient appointments';
COMMENT ON TABLE invoices IS 'Billing and payment records';
COMMENT ON TABLE notifications IS 'System notifications and reminders';
