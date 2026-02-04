import pool from './db';
import { User, Patient, Clinic, Appointment } from '../types';

/**
 * PostgreSQL Services - Direct connection to Neon Database
 * These services replace mockDb with real database operations
 */

// ==================== USERS ====================

export const pgUsers = {
  getAll: async (): Promise<User[]> => {
    const result = await pool.query('SELECT * FROM users WHERE NOT COALESCE(is_archived, false) ORDER BY id');
    return result.rows.map(row => ({
      uid: String(row.id),
      email: row.email,
      password: row.password,
      name: row.full_name,
      role: row.role,
      clinicIds: row.clinic_id ? [String(row.clinic_id)] : [],
      isActive: true,
      createdAt: new Date(row.created_at).getTime(),
      createdBy: 'system',
      updatedAt: new Date(row.created_at).getTime(),
      updatedBy: 'system',
      isArchived: false
    }));
  },

  getById: async (id: string): Promise<User | null> => {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [parseInt(id)]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      uid: String(row.id),
      email: row.email,
      password: row.password,
      name: row.full_name,
      role: row.role,
      clinicIds: row.clinic_id ? [String(row.clinic_id)] : [],
      isActive: true,
      createdAt: new Date(row.created_at).getTime(),
      createdBy: 'system',
      updatedAt: new Date(row.created_at).getTime(),
      updatedBy: 'system',
      isArchived: false
    };
  },

  create: async (user: Omit<User, 'uid' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>): Promise<string> => {
    const clinicId = user.clinicIds.length > 0 ? parseInt(user.clinicIds[0]) : null;
    const result = await pool.query(
      'INSERT INTO users (full_name, email, password, role, clinic_id, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id',
      [user.name, user.email, user.password || 'password123', user.role, clinicId]
    );
    return String(result.rows[0].id);
  },

  update: async (id: string, updates: Partial<User>): Promise<void> => {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name) {
      fields.push(`full_name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.email) {
      fields.push(`email = $${paramIndex++}`);
      values.push(updates.email);
    }
    if (updates.password) {
      fields.push(`password = $${paramIndex++}`);
      values.push(updates.password);
    }
    if (updates.role) {
      fields.push(`role = $${paramIndex++}`);
      values.push(updates.role);
    }
    if (updates.clinicIds) {
      const clinicId = updates.clinicIds.length > 0 ? parseInt(updates.clinicIds[0]) : null;
      fields.push(`clinic_id = $${paramIndex++}`);
      values.push(clinicId);
    }

    if (fields.length > 0) {
      values.push(parseInt(id));
      await pool.query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
        values
      );
    }
  },

  delete: async (id: string): Promise<void> => {
    await pool.query('DELETE FROM users WHERE id = $1', [parseInt(id)]);
  }
};

// ==================== CLINICS ====================

export const pgClinics = {
  getAll: async (): Promise<Clinic[]> => {
    const result = await pool.query('SELECT * FROM clinics ORDER BY id');
    return result.rows.map(row => ({
      id: String(row.id),
      name: row.name,
      type: row.type || 'General',
      category: 'clinic' as const,
      active: true,
      createdAt: new Date(row.created_at || Date.now()).getTime(),
      createdBy: 'system',
      updatedAt: new Date(row.created_at || Date.now()).getTime(),
      updatedBy: 'system',
      isArchived: false
    }));
  },

  getById: async (id: string): Promise<Clinic | null> => {
    const result = await pool.query('SELECT * FROM clinics WHERE id = $1', [parseInt(id)]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: String(row.id),
      name: row.name,
      type: row.type || 'General',
      category: 'clinic' as const,
      active: true,
      createdAt: new Date(row.created_at || Date.now()).getTime(),
      createdBy: 'system',
      updatedAt: new Date(row.created_at || Date.now()).getTime(),
      updatedBy: 'system',
      isArchived: false
    };
  },

  create: async (clinic: Omit<Clinic, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>): Promise<string> => {
    const result = await pool.query(
      'INSERT INTO clinics (name, type, created_at) VALUES ($1, $2, NOW()) RETURNING id',
      [clinic.name, clinic.type]
    );
    return String(result.rows[0].id);
  },

  update: async (id: string, updates: Partial<Clinic>): Promise<void> => {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.type) {
      fields.push(`type = $${paramIndex++}`);
      values.push(updates.type);
    }

    if (fields.length > 0) {
      values.push(parseInt(id));
      await pool.query(
        `UPDATE clinics SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
        values
      );
    }
  },

  delete: async (id: string): Promise<void> => {
    await pool.query('DELETE FROM clinics WHERE id = $1', [parseInt(id)]);
  }
};

// ==================== PATIENTS ====================

export const pgPatients = {
  getAll: async (): Promise<Patient[]> => {
    const result = await pool.query('SELECT * FROM patients ORDER BY id DESC');
    return result.rows.map(row => ({
      id: String(row.id),
      name: row.full_name,
      age: row.age || undefined,
      gender: row.gender as 'male' | 'female' | undefined,
      phone: row.phone || '',
      email: row.email || undefined,
      password: row.password || undefined,
      medicalProfile: row.medical_profile || {},
      currentVisit: row.current_visit || {
        visitId: '',
        clinicId: '',
        date: Date.now(),
        status: 'waiting' as const,
        priority: 'normal' as const,
        reasonForVisit: ''
      },
      history: row.history || [],
      createdAt: new Date(row.created_at || Date.now()).getTime(),
      createdBy: 'system',
      updatedAt: new Date(row.created_at || Date.now()).getTime(),
      updatedBy: 'system',
      isArchived: false
    }));
  },

  getById: async (id: string): Promise<Patient | null> => {
    const result = await pool.query('SELECT * FROM patients WHERE id = $1', [parseInt(id)]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: String(row.id),
      name: row.full_name,
      age: row.age || undefined,
      gender: row.gender as 'male' | 'female' | undefined,
      phone: row.phone || '',
      email: row.email || undefined,
      password: row.password || undefined,
      medicalProfile: row.medical_profile || {},
      currentVisit: row.current_visit || {
        visitId: '',
        clinicId: '',
        date: Date.now(),
        status: 'waiting' as const,
        priority: 'normal' as const,
        reasonForVisit: ''
      },
      history: row.history || [],
      createdAt: new Date(row.created_at || Date.now()).getTime(),
      createdBy: 'system',
      updatedAt: new Date(row.created_at || Date.now()).getTime(),
      updatedBy: 'system',
      isArchived: false
    };
  },

  create: async (patient: Omit<Patient, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>): Promise<string> => {
    const result = await pool.query(
      `INSERT INTO patients (full_name, phone, email, password, notes, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id`,
      [
        patient.name,
        patient.phone || '',
        patient.email || null,
        patient.password || 'patient123',
        patient.currentVisit?.reasonForVisit || ''
      ]
    );
    return String(result.rows[0].id);
  },

  update: async (id: string, updates: Partial<Patient>): Promise<void> => {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name) {
      fields.push(`full_name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.phone !== undefined) {
      fields.push(`phone = $${paramIndex++}`);
      values.push(updates.phone);
    }
    if (updates.email !== undefined) {
      fields.push(`email = $${paramIndex++}`);
      values.push(updates.email);
    }
    if (updates.password !== undefined) {
      fields.push(`password = $${paramIndex++}`);
      values.push(updates.password);
    }
    if (updates.currentVisit !== undefined) {
      fields.push(`notes = $${paramIndex++}`);
      values.push(updates.currentVisit.reasonForVisit || '');
    }

    if (fields.length > 0) {
      values.push(parseInt(id));
      await pool.query(
        `UPDATE patients SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
        values
      );
    }
  },

  delete: async (id: string): Promise<void> => {
    await pool.query('DELETE FROM patients WHERE id = $1', [parseInt(id)]);
  },

  subscribe: (callback: (patients: Patient[]) => void): (() => void) => {
    // For real-time updates, we need polling or websockets
    // For now, just call once
    pgPatients.getAll().then(callback);
    
    // Return unsubscribe function
    return () => {};
  }
};

// ==================== APPOINTMENTS ====================

export const pgAppointments = {
  getAll: async (): Promise<Appointment[]> => {
    const result = await pool.query('SELECT * FROM appointments ORDER BY scheduled_time DESC');
    return result.rows.map(row => ({
      id: String(row.id),
      patientId: String(row.patient_id),
      clinicId: String(row.clinic_id),
      doctorId: row.doctor_id ? String(row.doctor_id) : undefined,
      scheduledTime: new Date(row.scheduled_time).getTime(),
      status: row.status || 'scheduled',
      notes: row.notes || '',
      createdAt: new Date(row.created_at || Date.now()).getTime(),
      createdBy: 'system',
      updatedAt: new Date(row.created_at || Date.now()).getTime(),
      updatedBy: 'system',
      isArchived: false
    }));
  },

  create: async (appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>): Promise<string> => {
    const result = await pool.query(
      `INSERT INTO appointments (patient_id, clinic_id, doctor_id, scheduled_time, status, notes, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
      [
        parseInt(appointment.patientId),
        parseInt(appointment.clinicId),
        appointment.doctorId ? parseInt(appointment.doctorId) : null,
        new Date(appointment.scheduledTime),
        appointment.status,
        appointment.notes || ''
      ]
    );
    return String(result.rows[0].id);
  }
};
