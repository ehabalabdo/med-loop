-- =============================================
-- MIGRATION: Medical Device Integration Layer
-- Date: 2026-02-16
-- Description: Adds devices and device_results tables
--              for clinic bridge agent integration.
--              Multi-tenant isolated via client_id.
-- =============================================

-- =============================================
-- 1. DEVICES TABLE (الأجهزة الطبية)
-- =============================================
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    clinic_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('cbc', 'ecg', 'glucose', 'chemistry', 'xray', 'other')),
    connection_type VARCHAR(50) NOT NULL CHECK (connection_type IN ('lan', 'serial', 'hl7', 'folder', 'api')),
    ip_address VARCHAR(45),            -- IPv4 or IPv6
    port INTEGER,
    com_port VARCHAR(20),              -- e.g. COM3, /dev/ttyUSB0
    baud_rate INTEGER,                 -- Serial baud rate
    config JSONB DEFAULT '{}',         -- Future extensible config
    is_active BOOLEAN DEFAULT true,
    last_seen_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_client_id ON devices(client_id);
CREATE INDEX IF NOT EXISTS idx_devices_clinic_id ON devices(clinic_id);
CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(type);
CREATE INDEX IF NOT EXISTS idx_devices_is_active ON devices(is_active);

-- =============================================
-- 2. DEVICE RESULTS TABLE (نتائج الأجهزة)
-- =============================================
CREATE TABLE IF NOT EXISTS device_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    patient_identifier TEXT NOT NULL,           -- ID or MRN sent by bridge agent
    test_code VARCHAR(100) NOT NULL,            -- e.g. WBC, RBC, HGB, GLU
    test_name VARCHAR(255),                     -- Human readable name
    value TEXT NOT NULL,                         -- Result value
    unit VARCHAR(50),                            -- e.g. mg/dL, mmol/L
    reference_range VARCHAR(100),               -- e.g. "4.0-11.0"
    is_abnormal BOOLEAN DEFAULT false,          -- Flag for out-of-range
    raw_message TEXT,                            -- Full raw device output
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'error', 'rejected')),
    matched_patient_id INTEGER,                 -- FK to patients.id (nullable until matched)
    matched_at TIMESTAMP,                       -- When was it matched
    matched_by VARCHAR(255),                    -- Who matched it (user or 'auto')
    error_message TEXT,                          -- If status = error
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_results_client_id ON device_results(client_id);
CREATE INDEX IF NOT EXISTS idx_device_results_device_id ON device_results(device_id);
CREATE INDEX IF NOT EXISTS idx_device_results_status ON device_results(status);
CREATE INDEX IF NOT EXISTS idx_device_results_patient_identifier ON device_results(patient_identifier);
CREATE INDEX IF NOT EXISTS idx_device_results_matched_patient_id ON device_results(matched_patient_id);
CREATE INDEX IF NOT EXISTS idx_device_results_created_at ON device_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_results_client_status ON device_results(client_id, status);

-- =============================================
-- 3. DEVICE API KEYS TABLE (مفاتيح وصول الأجهزة)
-- For authenticating bridge agent requests
-- =============================================
CREATE TABLE IF NOT EXISTS device_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) NOT NULL,             -- SHA-256 hashed API key
    label VARCHAR(255) NOT NULL,                -- e.g. "Main Lab Bridge"
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_api_keys_client_id ON device_api_keys(client_id);
CREATE INDEX IF NOT EXISTS idx_device_api_keys_key_hash ON device_api_keys(key_hash);

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON TABLE devices IS 'Medical devices registered per clinic for bridge agent integration';
COMMENT ON TABLE device_results IS 'Raw results received from clinic bridge agents, pending patient matching';
COMMENT ON TABLE device_api_keys IS 'API keys for authenticating bridge agent HTTP requests';
COMMENT ON COLUMN device_results.patient_identifier IS 'Patient ID or MRN as entered on the device side';
COMMENT ON COLUMN device_results.raw_message IS 'Complete raw output from device (HL7/serial/etc) for audit trail';
