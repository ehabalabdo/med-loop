-- Migration Script: Add Authentication Fields
-- Date: 2026-02-04
-- Purpose: Add password field to users table and email/password to patients table

-- =============================================
-- ADD PASSWORD TO USERS TABLE
-- =============================================
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password VARCHAR(255);

COMMENT ON COLUMN users.password IS 'Hashed password for user authentication';

-- =============================================
-- ADD EMAIL AND PASSWORD TO PATIENTS TABLE
-- =============================================
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS password VARCHAR(255);

COMMENT ON COLUMN patients.email IS 'Email for patient portal access';
COMMENT ON COLUMN patients.password IS 'Hashed password for patient portal authentication';

-- Create index on patient email for faster lookups
CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email);

-- =============================================
-- UPDATE EXISTING DATA (OPTIONAL)
-- =============================================
-- Set default password for existing users (should be changed on first login)
UPDATE users 
SET password = 'password123' 
WHERE password IS NULL;

-- Set default password for existing patients who have email
UPDATE patients 
SET password = 'patient123' 
WHERE email IS NOT NULL AND password IS NULL;

-- =============================================
-- VERIFICATION QUERIES
-- =============================================
-- Check users table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Check patients table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'patients'
ORDER BY ordinal_position;

-- Count users with passwords
SELECT 
    role,
    COUNT(*) as total,
    COUNT(password) as with_password
FROM users
GROUP BY role;

-- Count patients with email/password
SELECT 
    COUNT(*) as total_patients,
    COUNT(email) as with_email,
    COUNT(password) as with_password
FROM patients
WHERE is_archived = false;
