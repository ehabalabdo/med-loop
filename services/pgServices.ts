import sql from './db';
import { User, Patient, Clinic, Appointment, ClinicCategory, Client, SuperAdmin, Device, DeviceResult, DeviceResultStatus } from '../types';
import { getCurrentClientId } from '../context/ClientContext';

/**
 * PostgreSQL Services - Direct connection to Neon Database
 * Using @neondatabase/serverless for browser compatibility via HTTP
 * All queries filter by client_id for multi-tenant isolation
 */

// ==================== SUPER ADMIN ====================

export const pgSuperAdmin = {
  login: async (username: string, password: string): Promise<SuperAdmin | null> => {
    const result = await sql`
      SELECT * FROM super_admins WHERE username = ${username} AND password = ${password} LIMIT 1
    `;
    if (result.length === 0) return null;
    const row = result[0] as any;
    return { id: row.id, username: row.username, name: row.name };
  }
};

// ==================== CLIENTS (SaaS) ====================

export const pgClientsService = {
  getAll: async (): Promise<Client[]> => {
    const result = await sql`SELECT * FROM clients ORDER BY created_at DESC`;
    return result.map((row: any) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      logoUrl: row.logo_url || '',
      phone: row.phone || '',
      email: row.email || '',
      address: row.address || '',
      status: row.status,
      trialEndsAt: row.trial_ends_at,
      subscriptionEndsAt: row.subscription_ends_at,
      ownerUserId: row.owner_user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isActive: row.is_active,
      enabledFeatures: row.enabled_features || { dental_lab: false, implant_company: false, academy: false, device_results: false }
    }));
  },

  getBySlug: async (slug: string): Promise<Client | null> => {
    const result = await sql`SELECT * FROM clients WHERE slug = ${slug} LIMIT 1`;
    if (result.length === 0) return null;
    const row = result[0] as any;
    return {
      id: row.id, name: row.name, slug: row.slug,
      logoUrl: row.logo_url || '', phone: row.phone || '',
      email: row.email || '', address: row.address || '',
      status: row.status, trialEndsAt: row.trial_ends_at,
      subscriptionEndsAt: row.subscription_ends_at,
      ownerUserId: row.owner_user_id,
      createdAt: row.created_at, updatedAt: row.updated_at,
      isActive: row.is_active,
      enabledFeatures: row.enabled_features || { dental_lab: false, implant_company: false, academy: false, device_results: false }
    };
  },

  getById: async (id: number): Promise<Client | null> => {
    const result = await sql`SELECT * FROM clients WHERE id = ${id} LIMIT 1`;
    if (result.length === 0) return null;
    const row = result[0] as any;
    return {
      id: row.id, name: row.name, slug: row.slug,
      logoUrl: row.logo_url || '', phone: row.phone || '',
      email: row.email || '', address: row.address || '',
      status: row.status, trialEndsAt: row.trial_ends_at,
      subscriptionEndsAt: row.subscription_ends_at,
      ownerUserId: row.owner_user_id,
      createdAt: row.created_at, updatedAt: row.updated_at,
      isActive: row.is_active,
      enabledFeatures: row.enabled_features || { dental_lab: false, implant_company: false, academy: false, device_results: false }
    };
  },

  create: async (data: { name: string; slug: string; phone?: string; email?: string; address?: string; trialDays?: number }): Promise<number> => {
    const trialDays = data.trialDays || 30;
    const result = await sql`
      INSERT INTO clients (name, slug, phone, email, address, status, trial_ends_at, created_at, updated_at, is_active)
      VALUES (${data.name}, ${data.slug}, ${data.phone || ''}, ${data.email || ''}, ${data.address || ''}, 
              'trial', NOW() + ${trialDays + ' days'}::interval, NOW(), NOW(), true)
      RETURNING id
    `;
    return result[0].id as number;
  },

  // Create the admin user for a new client
  createOwner: async (clientId: number, data: { name: string; email: string; password: string }): Promise<number> => {
    const result = await sql`
      INSERT INTO users (full_name, email, password, role, client_id, created_at, updated_at, created_by, updated_by, is_active, is_archived)
      VALUES (${data.name}, ${data.email}, ${data.password}, 'admin', ${clientId}, NOW(), NOW(), 'super_admin', 'super_admin', true, false)
      RETURNING id
    `;
    const userId = result[0].id as number;
    // Update client with owner
    await sql`UPDATE clients SET owner_user_id = ${userId} WHERE id = ${clientId}`;
    return userId;
  },

  // Extend trial period by N days (keeps trial status)
  extendTrial: async (clientId: number, days: number): Promise<void> => {
    await sql`
      UPDATE clients 
      SET trial_ends_at = COALESCE(
            CASE WHEN trial_ends_at > NOW() THEN trial_ends_at ELSE NOW() END
          , NOW()) + ${days + ' days'}::interval,
          updated_at = NOW()
      WHERE id = ${clientId}
    `;
  },

  // Set trial end date directly
  setTrialEndDate: async (clientId: number, endDate: string): Promise<void> => {
    await sql`
      UPDATE clients 
      SET trial_ends_at = ${endDate}::timestamptz,
          updated_at = NOW()
      WHERE id = ${clientId}
    `;
  },

  // Activate subscription (switch from trial to active) by N days
  extendSubscription: async (clientId: number, days: number): Promise<void> => {
    await sql`
      UPDATE clients 
      SET status = 'active',
          subscription_ends_at = COALESCE(
            CASE WHEN subscription_ends_at > NOW() THEN subscription_ends_at ELSE NOW() END
          , NOW()) + ${days + ' days'}::interval,
          updated_at = NOW()
      WHERE id = ${clientId}
    `;
  },

  // Suspend a client
  suspend: async (clientId: number): Promise<void> => {
    await sql`UPDATE clients SET status = 'suspended', updated_at = NOW() WHERE id = ${clientId}`;
  },

  // Reactivate
  activate: async (clientId: number): Promise<void> => {
    await sql`UPDATE clients SET status = 'active', updated_at = NOW() WHERE id = ${clientId}`;
  },

  // Update enabled features
  updateFeatures: async (clientId: number, features: Record<string, boolean>): Promise<void> => {
    await sql`UPDATE clients SET enabled_features = ${JSON.stringify(features)}::jsonb, updated_at = NOW() WHERE id = ${clientId}`;
  },

  // Delete a client and all related data
  delete: async (clientId: number): Promise<void> => {
    // Delete in dependency order
    await sql`DELETE FROM appointments WHERE client_id = ${clientId}`;
    await sql`DELETE FROM patients WHERE client_id = ${clientId}`;
    await sql`DELETE FROM users WHERE client_id = ${clientId}`;
    await sql`DELETE FROM clinics WHERE client_id = ${clientId}`;
    // Try device tables (may not exist)
    try { await sql`DELETE FROM device_results WHERE client_id = ${clientId}`; } catch {}
    try { await sql`DELETE FROM device_api_keys WHERE client_id = ${clientId}`; } catch {}
    try { await sql`DELETE FROM device_registrations WHERE client_id = ${clientId}`; } catch {}
    // Finally delete the client
    await sql`DELETE FROM clients WHERE id = ${clientId}`;
  },

  // Update client info
  update: async (clientId: number, data: Partial<Pick<Client, 'name' | 'phone' | 'email' | 'address' | 'logoUrl'>>): Promise<void> => {
    await sql`UPDATE clients SET updated_at = NOW() WHERE id = ${clientId}`;
    if (data.name !== undefined) await sql`UPDATE clients SET name = ${data.name} WHERE id = ${clientId}`;
    if (data.phone !== undefined) await sql`UPDATE clients SET phone = ${data.phone} WHERE id = ${clientId}`;
    if (data.email !== undefined) await sql`UPDATE clients SET email = ${data.email} WHERE id = ${clientId}`;
    if (data.address !== undefined) await sql`UPDATE clients SET address = ${data.address} WHERE id = ${clientId}`;
    if (data.logoUrl !== undefined) await sql`UPDATE clients SET logo_url = ${data.logoUrl} WHERE id = ${clientId}`;
  },

  // Get stats for a client
  getStats: async (clientId: number) => {
    const [patients, users, appointments] = await Promise.all([
      sql`SELECT COUNT(*)::int as count FROM patients WHERE client_id = ${clientId}`,
      sql`SELECT COUNT(*)::int as count FROM users WHERE client_id = ${clientId}`,
      sql`SELECT COUNT(*)::int as count FROM appointments WHERE client_id = ${clientId}`
    ]);
    return {
      patientsCount: patients[0]?.count || 0,
      usersCount: users[0]?.count || 0,
      appointmentsCount: appointments[0]?.count || 0
    };
  }
};

// ==================== USERS ====================

export const pgUsers = {
  getAll: async (clientId?: number): Promise<User[]> => {
    const cid = clientId || getCurrentClientId();
    const result = cid 
      ? await sql`SELECT * FROM users WHERE client_id = ${cid} ORDER BY id`
      : await sql`SELECT * FROM users ORDER BY id`;
    
    const users = result.map((row: any) => {
      // Parse clinic_ids jsonb array
      let clinicIds: string[] = [];
      if (row.clinic_ids) {
        try {
          const parsed = typeof row.clinic_ids === 'string' ? JSON.parse(row.clinic_ids) : row.clinic_ids;
          clinicIds = Array.isArray(parsed) ? parsed : [];
        } catch {
          clinicIds = [];
        }
      }
      // Fallback to old clinic_id if clinic_ids is empty
      if (clinicIds.length === 0 && row.clinic_id) {
        clinicIds = [String(row.clinic_id)];
      }
      
      return {
        uid: String(row.id),
        email: row.email,
        password: row.password,
        name: row.full_name,
        role: row.role,
        clinicIds: clinicIds,
        clientId: row.client_id || undefined,
        isActive: row.is_active !== false,
        createdAt: new Date(row.created_at || Date.now()).getTime(),
        createdBy: row.created_by || 'system',
        updatedAt: new Date(row.updated_at || row.created_at || Date.now()).getTime(),
        updatedBy: row.updated_by || 'system',
        isArchived: row.is_archived || false
      };
    });
    
    return users;
  },

  create: async (user: Omit<User, 'uid' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>): Promise<string> => {
    const deptClinicId = user.clinicIds.length > 0 ? parseInt(user.clinicIds[0]) : null;
    const clinicIdsJson = JSON.stringify(user.clinicIds);
    const cid = user.clientId || getCurrentClientId();
    const result = await sql`
      INSERT INTO users (full_name, email, password, role, clinic_id, clinic_ids, client_id, created_at, updated_at, created_by, updated_by, is_active, is_archived) 
      VALUES (${user.name}, ${user.email}, ${user.password || 'password123'}, ${user.role}, ${deptClinicId}, ${clinicIdsJson}::jsonb, ${cid}, NOW(), NOW(), 'system', 'system', TRUE, FALSE) 
      RETURNING id
    `;
    return String(result[0].id);
  },

  update: async (uid: string, data: Partial<Pick<User, 'name' | 'email' | 'password' | 'role' | 'clinicIds' | 'isActive'>>): Promise<void> => {
    const userId = parseInt(uid);
    
    // Execute separate UPDATEs for each field
    await sql`UPDATE users SET updated_at = NOW() WHERE id = ${userId}`;
    
    if (data.name !== undefined) {
      await sql`UPDATE users SET full_name = ${data.name} WHERE id = ${userId}`;
    }
    if (data.email !== undefined) {
      await sql`UPDATE users SET email = ${data.email} WHERE id = ${userId}`;
    }
    if (data.password !== undefined && data.password !== '') {
      await sql`UPDATE users SET password = ${data.password} WHERE id = ${userId}`;
    }
    if (data.role !== undefined) {
      await sql`UPDATE users SET role = ${data.role} WHERE id = ${userId}`;
    }
    if (data.clinicIds !== undefined) {
      const clinicIdsJson = JSON.stringify(data.clinicIds);
      await sql`UPDATE users SET clinic_ids = ${clinicIdsJson}::jsonb WHERE id = ${userId}`;
    }
    if (data.isActive !== undefined) {
      await sql`UPDATE users SET is_active = ${data.isActive} WHERE id = ${userId}`;
    }
  },

  delete: async (uid: string): Promise<void> => {
    const userId = parseInt(uid);
    await sql`DELETE FROM users WHERE id = ${userId}`;
  }
};

// ==================== CLINICS ====================

export const pgClinics = {
  getAll: async (clientId?: number): Promise<Clinic[]> => {
    const cid = clientId || getCurrentClientId();
    const result = cid
      ? await sql`SELECT * FROM clinics WHERE client_id = ${cid} ORDER BY id`
      : await sql`SELECT * FROM clinics ORDER BY id`;
    return result.map((row: any) => ({
      id: String(row.id),
      name: row.name,
      type: row.type || 'General',
      category: (row.category || 'clinic') as ClinicCategory,
      active: row.active !== false,
      clientId: row.client_id || undefined,
      createdAt: new Date(row.created_at || Date.now()).getTime(),
      createdBy: row.created_by || 'system',
      updatedAt: new Date(row.updated_at || row.created_at || Date.now()).getTime(),
      updatedBy: row.updated_by || 'system',
      isArchived: row.is_archived || false
    }));
  },

  create: async (clinic: Omit<Clinic, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>): Promise<string> => {
    const cid = clinic.clientId || getCurrentClientId();
    const result = await sql`
      INSERT INTO clinics (name, type, category, active, client_id, created_at, updated_at, created_by, updated_by, is_archived) 
      VALUES (${clinic.name}, ${clinic.type}, ${clinic.category || 'clinic'}, ${clinic.active !== false}, ${cid}, NOW(), NOW(), 'system', 'system', FALSE) 
      RETURNING id
    `;
    return String(result[0].id);
  },

  update: async (id: string, data: Partial<Pick<Clinic, 'name' | 'type' | 'category' | 'active'>>): Promise<void> => {
    const clinicId = parseInt(id);
    
    await sql`UPDATE clinics SET updated_at = NOW() WHERE id = ${clinicId}`;
    
    if (data.name !== undefined) {
      await sql`UPDATE clinics SET name = ${data.name} WHERE id = ${clinicId}`;
    }
    if (data.type !== undefined) {
      await sql`UPDATE clinics SET type = ${data.type} WHERE id = ${clinicId}`;
    }
    if (data.category !== undefined) {
      await sql`UPDATE clinics SET category = ${data.category} WHERE id = ${clinicId}`;
    }
    if (data.active !== undefined) {
      await sql`UPDATE clinics SET active = ${data.active} WHERE id = ${clinicId}`;
    }
  },

  toggleStatus: async (id: string, active: boolean): Promise<void> => {
    const clinicId = parseInt(id);
    await sql`UPDATE clinics SET active = ${active} WHERE id = ${clinicId}`;
  },

  delete: async (id: string): Promise<void> => {
    const clinicId = parseInt(id);
    await sql`DELETE FROM clinics WHERE id = ${clinicId}`;
  }
};

// ==================== PATIENTS ====================

// Helper: calculate age from date of birth
function calculateAge(dateOfBirth: string | null | undefined): number {
  if (!dateOfBirth) return 0;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export const pgPatients = {
  getAll: async (clientId?: number): Promise<Patient[]> => {
    const cid = clientId || getCurrentClientId();
    const result = cid
      ? await sql`SELECT * FROM patients WHERE client_id = ${cid} ORDER BY id DESC`
      : await sql`SELECT * FROM patients ORDER BY id DESC`;
    const patients = result.map((row: any) => {
      // Parse JSON columns
      let medicalProfile = row.medical_profile;
      if (typeof medicalProfile === 'string') {
        try { medicalProfile = JSON.parse(medicalProfile); } catch { medicalProfile = {}; }
      }
      
      let currentVisit = row.current_visit;
      if (typeof currentVisit === 'string') {
        try { currentVisit = JSON.parse(currentVisit); } catch { currentVisit = null; }
      }
      
      let history = row.history;
      if (typeof history === 'string') {
        try { history = JSON.parse(history); } catch { history = []; }
      }
      
      return {
        id: String(row.id),
        name: row.full_name,
        age: row.date_of_birth ? calculateAge(row.date_of_birth) : (row.age || 0),
        dateOfBirth: row.date_of_birth || undefined,
        gender: (row.gender || 'male') as 'male' | 'female',
        phone: row.phone || '',
        username: row.username || undefined,
        email: row.email || undefined,
        password: row.password || undefined,
        hasAccess: row.has_access || false,
        medicalProfile: medicalProfile && Object.keys(medicalProfile).length > 0 ? medicalProfile : {
          allergies: { exists: false, details: '' },
          chronicConditions: { exists: false, details: '' },
          currentMedications: { exists: false, details: '' },
          isPregnant: false,
          notes: row.notes || ''
        },
        currentVisit: currentVisit && Object.keys(currentVisit).length > 0 ? currentVisit : {
          visitId: `v_${row.id}_${Date.now()}`,
          clinicId: '',
          date: Date.now(),
          status: 'waiting' as const,
          priority: 'normal' as const,
          reasonForVisit: row.notes || ''
        },
        history: Array.isArray(history) ? history : [],
        createdAt: new Date(row.created_at || Date.now()).getTime(),
        createdBy: row.created_by || 'system',
        updatedAt: new Date(row.updated_at || row.created_at || Date.now()).getTime(),
        updatedBy: row.updated_by || 'system',
        isArchived: row.is_archived || false
      };
    });
    
    return patients;
  },

  findByLogin: async (identifier: string, password: string, clientId?: number): Promise<Patient | null> => {
    const cid = clientId || getCurrentClientId();
    const result = cid
      ? await sql`
          SELECT * FROM patients 
          WHERE (username = ${identifier} OR phone = ${identifier} OR full_name = ${identifier} OR email = ${identifier})
            AND password = ${password}
            AND has_access = true
            AND client_id = ${cid}
          LIMIT 1
        `
      : await sql`
          SELECT * FROM patients 
          WHERE (username = ${identifier} OR phone = ${identifier} OR full_name = ${identifier} OR email = ${identifier})
            AND password = ${password}
            AND has_access = true
          LIMIT 1
        `;
    if (result.length === 0) return null;
    const row = result[0] as any;
    let medicalProfile = row.medical_profile;
    if (typeof medicalProfile === 'string') { try { medicalProfile = JSON.parse(medicalProfile); } catch { medicalProfile = {}; } }
    let currentVisit = row.current_visit;
    if (typeof currentVisit === 'string') { try { currentVisit = JSON.parse(currentVisit); } catch { currentVisit = null; } }
    let history = row.history;
    if (typeof history === 'string') { try { history = JSON.parse(history); } catch { history = []; } }
    return {
      id: String(row.id), name: row.full_name, age: row.date_of_birth ? calculateAge(row.date_of_birth) : (row.age || 0),
      dateOfBirth: row.date_of_birth || undefined,
      gender: (row.gender || 'male') as 'male' | 'female', phone: row.phone || '',
      username: row.username || undefined, email: row.email || undefined,
      password: row.password || undefined, hasAccess: row.has_access || false,
      medicalProfile: medicalProfile && Object.keys(medicalProfile).length > 0 ? medicalProfile : {
        allergies: { exists: false, details: '' }, chronicConditions: { exists: false, details: '' },
        currentMedications: { exists: false, details: '' }, isPregnant: false, notes: row.notes || ''
      },
      currentVisit: currentVisit && Object.keys(currentVisit).length > 0 ? currentVisit : {
        visitId: '', clinicId: '', date: Date.now(), status: 'waiting' as const, priority: 'normal' as const, reasonForVisit: ''
      },
      history: Array.isArray(history) ? history : [],
      createdAt: new Date(row.created_at || Date.now()).getTime(), createdBy: row.created_by || 'system',
      updatedAt: new Date(row.updated_at || row.created_at || Date.now()).getTime(), updatedBy: row.updated_by || 'system',
      isArchived: row.is_archived || false
    };
  },

  getById: async (id: string): Promise<Patient | null> => {
    const idInt = parseInt(id);
    if (isNaN(idInt)) return null;
    const result = await sql`SELECT * FROM patients WHERE id = ${idInt} LIMIT 1`;
    if (result.length === 0) return null;
    const row = result[0] as any;
    let medicalProfile = row.medical_profile;
    if (typeof medicalProfile === 'string') {
      try { medicalProfile = JSON.parse(medicalProfile); } catch { medicalProfile = {}; }
    }
    let currentVisit = row.current_visit;
    if (typeof currentVisit === 'string') {
      try { currentVisit = JSON.parse(currentVisit); } catch { currentVisit = null; }
    }
    let history = row.history;
    if (typeof history === 'string') {
      try { history = JSON.parse(history); } catch { history = []; }
    }
    return {
      id: String(row.id),
      name: row.full_name,
      age: row.date_of_birth ? calculateAge(row.date_of_birth) : (row.age || 0),
      dateOfBirth: row.date_of_birth || undefined,
      gender: (row.gender || 'male') as 'male' | 'female',
      phone: row.phone || '',
      username: row.username || undefined,
      email: row.email || undefined,
      password: row.password || undefined,
      hasAccess: row.has_access || false,
      medicalProfile: medicalProfile && Object.keys(medicalProfile).length > 0 ? medicalProfile : {
        allergies: { exists: false, details: '' },
        chronicConditions: { exists: false, details: '' },
        currentMedications: { exists: false, details: '' },
        isPregnant: false,
        notes: row.notes || ''
      },
      currentVisit: currentVisit && Object.keys(currentVisit).length > 0 ? currentVisit : {
        visitId: '', clinicId: '', date: Date.now(), status: 'waiting' as const, priority: 'normal' as const, reasonForVisit: ''
      },
      history: Array.isArray(history) ? history : [],
      createdAt: new Date(row.created_at || Date.now()).getTime(),
      createdBy: row.created_by || 'system',
      updatedAt: new Date(row.updated_at || row.created_at || Date.now()).getTime(),
      updatedBy: row.updated_by || 'system',
      isArchived: row.is_archived || false
    };
  },

  create: async (patient: Omit<Patient, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>): Promise<string> => {
    const medicalProfileJson = JSON.stringify(patient.medicalProfile || {});
    const currentVisitJson = JSON.stringify(patient.currentVisit || {});
    const historyJson = JSON.stringify(patient.history || []);
    const cid = patient.clientId || getCurrentClientId();
    
    const result = await sql`
      INSERT INTO patients (
        full_name, age, date_of_birth, gender, phone, username, email, password, has_access, 
        notes, medical_profile, current_visit, history, client_id, created_at, updated_at, created_by, updated_by, is_archived
      ) 
      VALUES (
        ${patient.name}, 
        ${patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : (patient.age || 0)}, 
        ${patient.dateOfBirth || null},
        ${patient.gender || 'male'}, 
        ${patient.phone || ''}, 
        ${patient.username || null}, 
        ${patient.email || null}, 
        ${patient.password || null}, 
        ${patient.hasAccess || false}, 
        ${patient.medicalProfile?.notes || ''}, 
        ${medicalProfileJson}::jsonb,
        ${currentVisitJson}::jsonb,
        ${historyJson}::jsonb,
        ${cid},
        NOW(),
        NOW(),
        'system',
        'system',
        FALSE
      )
      RETURNING id
    `;
    return String(result[0].id);
  },

  update: async (id: string, data: Partial<Patient>): Promise<void> => {
    const patientId = parseInt(id);
    
    console.log('[pgPatients.update] 🔄 Updating patient:', {
      id: patientId,
      updates: Object.keys(data)
    });
    
    try {
      // Execute separate UPDATE for each field - Neon-compatible approach
      // Always update updated_at timestamp
      await sql`UPDATE patients SET updated_at = NOW() WHERE id = ${patientId}`;
      
      if (data.name !== undefined) {
        await sql`UPDATE patients SET full_name = ${data.name} WHERE id = ${patientId}`;
      }
      if (data.dateOfBirth !== undefined) {
        await sql`UPDATE patients SET date_of_birth = ${data.dateOfBirth}, age = ${calculateAge(data.dateOfBirth)} WHERE id = ${patientId}`;
      } else if (data.age !== undefined) {
        await sql`UPDATE patients SET age = ${data.age} WHERE id = ${patientId}`;
      }
      if (data.gender !== undefined) {
        await sql`UPDATE patients SET gender = ${data.gender} WHERE id = ${patientId}`;
      }
      if (data.phone !== undefined) {
        await sql`UPDATE patients SET phone = ${data.phone} WHERE id = ${patientId}`;
      }
      if (data.username !== undefined) {
        await sql`UPDATE patients SET username = ${data.username || null} WHERE id = ${patientId}`;
      }
      if (data.email !== undefined) {
        await sql`UPDATE patients SET email = ${data.email || null} WHERE id = ${patientId}`;
      }
      if (data.password !== undefined && data.password !== '') {
        await sql`UPDATE patients SET password = ${data.password} WHERE id = ${patientId}`;
      }
      if (data.hasAccess !== undefined) {
        await sql`UPDATE patients SET has_access = ${data.hasAccess} WHERE id = ${patientId}`;
      }
      
      // JSON columns - convert to string first, then cast to jsonb in SQL
      if (data.medicalProfile !== undefined) {
        const jsonStr = JSON.stringify(data.medicalProfile);
        await sql`UPDATE patients SET medical_profile = ${jsonStr}::jsonb WHERE id = ${patientId}`;
      }
      if (data.currentVisit !== undefined) {
        const jsonStr = JSON.stringify(data.currentVisit);
        await sql`UPDATE patients SET current_visit = ${jsonStr}::jsonb WHERE id = ${patientId}`;
      }
      if (data.history !== undefined) {
        const jsonStr = JSON.stringify(data.history);
        await sql`UPDATE patients SET history = ${jsonStr}::jsonb WHERE id = ${patientId}`;
      }
      
      console.log('[pgPatients.update] ✅ Update successful');
    } catch (error: any) {
      console.error('[pgPatients.update] ❌ Update FAILED:', {
        message: error.message,
        stack: error.stack,
        patientId: patientId,
        fields: Object.keys(data)
      });
      throw error;
    }
  },

  subscribe: (callback: (data: Patient[]) => void) => {
    let lastDataString = '';
    
    const fetchAndCompare = async () => {
      const data = await pgPatients.getAll();
      const dataString = JSON.stringify(data);
      
      // Only trigger callback if data actually changed
      if (dataString !== lastDataString) {
        console.log('[pgPatients.subscribe] Data changed, triggering callback');
        lastDataString = dataString;
        callback(data);
      }
    };
    
    // Call once immediately
    fetchAndCompare();
    
    // Poll every 3 seconds (reduced from 1s to avoid spam)
    const interval = setInterval(fetchAndCompare, 3000);
    
    // Return unsubscribe function with manual refresh capability
    const unsubscribe = () => clearInterval(interval);
    
    // Expose refresh method for manual triggering
    (unsubscribe as any).refresh = fetchAndCompare;
    
    return unsubscribe;
  }
};

// ==================== APPOINTMENTS ====================

export const pgAppointments = {
  getAll: async (clientId?: number): Promise<Appointment[]> => {
    const cid = clientId || getCurrentClientId();
    const result = cid
      ? await sql`SELECT * FROM appointments WHERE client_id = ${cid} ORDER BY start_time DESC`
      : await sql`SELECT * FROM appointments ORDER BY start_time DESC`;
    return result.map((row: any) => ({
      id: String(row.id),
      patientId: String(row.patient_id),
      patientName: row.patient_name,
      clinicId: String(row.clinic_id),
      doctorId: row.doctor_id ? String(row.doctor_id) : undefined,
      date: new Date(row.start_time).getTime(),
      status: row.status,
      reason: row.reason || '',
      notes: '',
      suggestedDate: row.suggested_date ? new Date(row.suggested_date).getTime() : undefined,
      suggestedNotes: row.suggested_notes || undefined,
      createdAt: new Date(row.created_at || Date.now()).getTime(),
      createdBy: row.created_by || 'system',
      updatedAt: new Date(row.updated_at || row.created_at || Date.now()).getTime(),
      updatedBy: row.updated_by || 'system',
      isArchived: row.is_archived || false
    }));
  },

  getByPatientId: async (patientId: string): Promise<Appointment[]> => {
    const patientIdInt = parseInt(patientId) || 0;
    const result = await sql`SELECT * FROM appointments WHERE patient_id = ${patientIdInt} ORDER BY start_time DESC`;
    return result.map((row: any) => ({
      id: String(row.id),
      patientId: String(row.patient_id),
      patientName: row.patient_name,
      clinicId: String(row.clinic_id),
      doctorId: row.doctor_id ? String(row.doctor_id) : undefined,
      date: new Date(row.start_time).getTime(),
      status: row.status,
      reason: row.reason || '',
      notes: '',
      suggestedDate: row.suggested_date ? new Date(row.suggested_date).getTime() : undefined,
      suggestedNotes: row.suggested_notes || undefined,
      createdAt: new Date(row.created_at || Date.now()).getTime(),
      createdBy: row.created_by || 'system',
      updatedAt: new Date(row.updated_at || row.created_at || Date.now()).getTime(),
      updatedBy: row.updated_by || 'system',
      isArchived: row.is_archived || false
    }));
  },

  create: async (data: Pick<Appointment, 'id'|'patientId'|'patientName'|'clinicId'|'doctorId'|'date'|'reason'|'status'>): Promise<void> => {
    const startTime = new Date(data.date).toISOString();
    const endTime = new Date(data.date + 3600000).toISOString();
    const patientIdInt = parseInt(data.patientId) || 0;
    const clinicIdInt = parseInt(data.clinicId) || 0;
    const doctorIdInt = data.doctorId ? parseInt(data.doctorId) : null;
    const cid = getCurrentClientId();
    
    await sql`
      INSERT INTO appointments (patient_id, patient_name, clinic_id, doctor_id, start_time, end_time, status, reason, client_id, created_at)
      VALUES (
        ${patientIdInt},
        ${data.patientName},
        ${clinicIdInt},
        ${doctorIdInt},
        ${startTime},
        ${endTime},
        ${data.status},
        ${data.reason},
        ${cid},
        NOW()
      )
    `;
  },

  update: async (id: string, data: Partial<Pick<Appointment, 'clinicId'|'doctorId'|'date'|'reason'|'status'|'suggestedDate'|'suggestedNotes'>>): Promise<void> => {
    const idInt = parseInt(id);
    await sql`UPDATE appointments SET updated_at = NOW() WHERE id = ${idInt}`;
    
    if (data.clinicId !== undefined) {
      const clinicIdInt = parseInt(data.clinicId) || 0;
      await sql`UPDATE appointments SET clinic_id = ${clinicIdInt} WHERE id = ${idInt}`;
    }
    if (data.doctorId !== undefined) {
      const doctorIdInt = data.doctorId ? parseInt(data.doctorId) : null;
      await sql`UPDATE appointments SET doctor_id = ${doctorIdInt} WHERE id = ${idInt}`;
    }
    if (data.date !== undefined) {
      const dateStr = new Date(data.date).toISOString();
      await sql`UPDATE appointments SET start_time = ${dateStr} WHERE id = ${idInt}`;
    }
    if (data.reason !== undefined) {
      await sql`UPDATE appointments SET reason = ${data.reason} WHERE id = ${idInt}`;
    }
    if (data.status !== undefined) {
      await sql`UPDATE appointments SET status = ${data.status} WHERE id = ${idInt}`;
    }
    if (data.suggestedDate !== undefined) {
      const suggestedDateStr = new Date(data.suggestedDate).toISOString();
      await sql`UPDATE appointments SET suggested_date = ${suggestedDateStr} WHERE id = ${idInt}`;
    }
    if (data.suggestedNotes !== undefined) {
      await sql`UPDATE appointments SET suggested_notes = ${data.suggestedNotes} WHERE id = ${idInt}`;
    }
  },

  delete: async (id: string): Promise<void> => {
    const idInt = parseInt(id);
    await sql`DELETE FROM appointments WHERE id = ${idInt}`;
  }
};

// ==================== INVOICES ====================

export const pgInvoices = {
  getAll: async (clientId?: number): Promise<any[]> => {
    const cid = clientId || getCurrentClientId();
    const result = cid
      ? await sql`SELECT * FROM invoices WHERE client_id = ${cid} ORDER BY created_at DESC`
      : await sql`SELECT * FROM invoices ORDER BY created_at DESC`;
    return result.map((row: any) => ({
      id: row.id,
      visitId: row.visit_id,
      patientId: row.patient_id,
      patientName: row.patient_name,
      items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
      totalAmount: parseFloat(row.total_amount),
      paidAmount: parseFloat(row.paid_amount),
      paymentMethod: row.payment_method,
      status: row.status,
      createdAt: new Date(row.created_at || Date.now()).getTime(),
      createdBy: row.created_by || 'system',
      updatedAt: new Date(row.updated_at || row.created_at || Date.now()).getTime(),
      updatedBy: row.updated_by || 'system',
      isArchived: row.is_archived || false
    }));
  },

  create: async (data: any): Promise<void> => {
    const itemsJson = JSON.stringify(data.items);
    const cid = getCurrentClientId();
    await sql`
      INSERT INTO invoices (
        id, visit_id, patient_id, patient_name, items, 
        total_amount, paid_amount, payment_method, status,
        client_id, created_at, updated_at, created_by, updated_by, is_archived
      )
      VALUES (
        ${data.id}, ${data.visitId}, ${data.patientId}, ${data.patientName},
        ${itemsJson}::jsonb, ${data.totalAmount}, ${data.paidAmount || 0},
        ${data.paymentMethod || 'cash'}, ${data.status}, ${cid},
        NOW(), NOW(), 'system', 'system', FALSE
      )
    `;
  },

  update: async (id: string, data: any): Promise<void> => {
    await sql`UPDATE invoices SET updated_at = NOW() WHERE id = ${id}`;
    
    if (data.items !== undefined) {
      const itemsJson = JSON.stringify(data.items);
      await sql`UPDATE invoices SET items = ${itemsJson}::jsonb WHERE id = ${id}`;
    }
    if (data.totalAmount !== undefined) {
      await sql`UPDATE invoices SET total_amount = ${data.totalAmount} WHERE id = ${id}`;
    }
    if (data.paidAmount !== undefined) {
      await sql`UPDATE invoices SET paid_amount = ${data.paidAmount} WHERE id = ${id}`;
    }
    if (data.paymentMethod !== undefined) {
      await sql`UPDATE invoices SET payment_method = ${data.paymentMethod} WHERE id = ${id}`;
    }
    if (data.status !== undefined) {
      await sql`UPDATE invoices SET status = ${data.status} WHERE id = ${id}`;
    }
  },

  delete: async (id: string): Promise<void> => {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
  }
};

// ==================== DEVICES ====================

export const pgDevices = {
  getAll: async (clientId?: number): Promise<Device[]> => {
    const cid = clientId || getCurrentClientId();
    if (!cid) return [];
    const result = await sql`
      SELECT * FROM devices WHERE client_id = ${cid} ORDER BY created_at DESC
    `;
    return result.map((row: any) => ({
      id: row.id,
      clientId: row.client_id,
      clinicId: String(row.clinic_id),
      name: row.name,
      type: row.type,
      connectionType: row.connection_type,
      ipAddress: row.ip_address || undefined,
      port: row.port || undefined,
      comPort: row.com_port || undefined,
      baudRate: row.baud_rate || undefined,
      config: row.config || {},
      isActive: row.is_active,
      lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).toISOString() : undefined,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString()
    }));
  },

  getByClinic: async (clinicId: string, clientId?: number): Promise<Device[]> => {
    const cid = clientId || getCurrentClientId();
    if (!cid) return [];
    const clinicIdInt = parseInt(clinicId) || 0;
    const result = await sql`
      SELECT * FROM devices 
      WHERE client_id = ${cid} AND clinic_id = ${clinicIdInt} AND is_active = true
      ORDER BY name
    `;
    return result.map((row: any) => ({
      id: row.id,
      clientId: row.client_id,
      clinicId: String(row.clinic_id),
      name: row.name,
      type: row.type,
      connectionType: row.connection_type,
      ipAddress: row.ip_address || undefined,
      port: row.port || undefined,
      comPort: row.com_port || undefined,
      baudRate: row.baud_rate || undefined,
      config: row.config || {},
      isActive: row.is_active,
      lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).toISOString() : undefined,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString()
    }));
  },

  create: async (data: Omit<Device, 'id' | 'createdAt' | 'updatedAt' | 'lastSeenAt'>): Promise<string> => {
    const cid = data.clientId || getCurrentClientId();
    const clinicIdInt = parseInt(data.clinicId) || 0;
    const result = await sql`
      INSERT INTO devices (client_id, clinic_id, name, type, connection_type, ip_address, port, com_port, baud_rate, config, is_active)
      VALUES (${cid}, ${clinicIdInt}, ${data.name}, ${data.type}, ${data.connectionType}, 
              ${data.ipAddress || null}, ${data.port || null}, ${data.comPort || null}, 
              ${data.baudRate || null}, ${JSON.stringify(data.config || {})}::jsonb, ${data.isActive})
      RETURNING id
    `;
    return result[0].id;
  },

  update: async (id: string, data: Partial<Device>): Promise<void> => {
    await sql`UPDATE devices SET updated_at = NOW() WHERE id = ${id}::uuid`;
    if (data.name !== undefined) await sql`UPDATE devices SET name = ${data.name} WHERE id = ${id}::uuid`;
    if (data.type !== undefined) await sql`UPDATE devices SET type = ${data.type} WHERE id = ${id}::uuid`;
    if (data.connectionType !== undefined) await sql`UPDATE devices SET connection_type = ${data.connectionType} WHERE id = ${id}::uuid`;
    if (data.ipAddress !== undefined) await sql`UPDATE devices SET ip_address = ${data.ipAddress} WHERE id = ${id}::uuid`;
    if (data.port !== undefined) await sql`UPDATE devices SET port = ${data.port} WHERE id = ${id}::uuid`;
    if (data.comPort !== undefined) await sql`UPDATE devices SET com_port = ${data.comPort} WHERE id = ${id}::uuid`;
    if (data.isActive !== undefined) await sql`UPDATE devices SET is_active = ${data.isActive} WHERE id = ${id}::uuid`;
  },

  updateLastSeen: async (id: string): Promise<void> => {
    await sql`UPDATE devices SET last_seen_at = NOW() WHERE id = ${id}::uuid`;
  },

  delete: async (id: string): Promise<void> => {
    await sql`DELETE FROM devices WHERE id = ${id}::uuid`;
  }
};

// ==================== DEVICE RESULTS ====================

export const pgDeviceResults = {
  /** Insert a result and attempt auto-match by patient_identifier → patients.id within same client */
  insert: async (clientId: number, data: {
    deviceId: string;
    patientIdentifier: string;
    testCode: string;
    testName?: string;
    value: string;
    unit?: string;
    referenceRange?: string;
    isAbnormal?: boolean;
    rawMessage?: string;
  }): Promise<{ id: string; status: DeviceResultStatus; matchedPatientId: number | null }> => {
    // Step 1: Try auto-match by patient id or phone within same client
    let matchedPatientId: number | null = null;
    let status: DeviceResultStatus = 'pending';
    const identifier = data.patientIdentifier.trim();

    // Try matching by numeric patient ID first
    const numericId = parseInt(identifier);
    if (!isNaN(numericId)) {
      const match = await sql`
        SELECT id FROM patients WHERE id = ${numericId} AND client_id = ${clientId} LIMIT 1
      `;
      if (match.length > 0) {
        matchedPatientId = match[0].id;
        status = 'matched';
      }
    }

    // Fallback: try matching by phone number
    if (!matchedPatientId) {
      const phoneMatch = await sql`
        SELECT id FROM patients WHERE phone = ${identifier} AND client_id = ${clientId} LIMIT 1
      `;
      if (phoneMatch.length > 0) {
        matchedPatientId = phoneMatch[0].id;
        status = 'matched';
      }
    }

    // Fallback: try matching by full_name (exact)
    if (!matchedPatientId) {
      const nameMatch = await sql`
        SELECT id FROM patients WHERE full_name = ${identifier} AND client_id = ${clientId} LIMIT 1
      `;
      if (nameMatch.length > 0) {
        matchedPatientId = nameMatch[0].id;
        status = 'matched';
      }
    }

    // Step 2: Insert the result
    const result = await sql`
      INSERT INTO device_results (
        client_id, device_id, patient_identifier, test_code, test_name,
        value, unit, reference_range, is_abnormal, raw_message,
        status, matched_patient_id, matched_at, matched_by
      )
      VALUES (
        ${clientId}, ${data.deviceId}::uuid, ${identifier}, ${data.testCode}, ${data.testName || null},
        ${data.value}, ${data.unit || null}, ${data.referenceRange || null}, ${data.isAbnormal || false},
        ${data.rawMessage || null},
        ${status}, ${matchedPatientId}, ${matchedPatientId ? new Date().toISOString() : null},
        ${matchedPatientId ? 'auto' : null}
      )
      RETURNING id
    `;

    return { id: result[0].id, status, matchedPatientId };
  },

  /** Get pending (unmatched) results for a clinic's client */
  getPending: async (clientId: number): Promise<DeviceResult[]> => {
    const result = await sql`
      SELECT dr.*, d.name as device_name, d.type as device_type
      FROM device_results dr
      LEFT JOIN devices d ON d.id = dr.device_id
      WHERE dr.client_id = ${clientId} AND dr.status = 'pending'
      ORDER BY dr.created_at DESC
    `;
    return result.map(mapDeviceResultRow);
  },

  /** Get all results for a specific client with optional status filter */
  getAll: async (clientId: number, statusFilter?: DeviceResultStatus): Promise<DeviceResult[]> => {
    const result = statusFilter
      ? await sql`
          SELECT dr.*, d.name as device_name, d.type as device_type, p.full_name as patient_name
          FROM device_results dr
          LEFT JOIN devices d ON d.id = dr.device_id
          LEFT JOIN patients p ON p.id = dr.matched_patient_id
          WHERE dr.client_id = ${clientId} AND dr.status = ${statusFilter}
          ORDER BY dr.created_at DESC
          LIMIT 200
        `
      : await sql`
          SELECT dr.*, d.name as device_name, d.type as device_type, p.full_name as patient_name
          FROM device_results dr
          LEFT JOIN devices d ON d.id = dr.device_id
          LEFT JOIN patients p ON p.id = dr.matched_patient_id
          WHERE dr.client_id = ${clientId}
          ORDER BY dr.created_at DESC
          LIMIT 200
        `;
    return result.map(mapDeviceResultRow);
  },

  /** Get results for a specific patient */
  getByPatientId: async (patientId: string, clientId?: number): Promise<DeviceResult[]> => {
    const cid = clientId || getCurrentClientId();
    const patientIdInt = parseInt(patientId) || 0;
    const result = cid
      ? await sql`
          SELECT dr.*, d.name as device_name, d.type as device_type
          FROM device_results dr
          LEFT JOIN devices d ON d.id = dr.device_id
          WHERE dr.matched_patient_id = ${patientIdInt} AND dr.client_id = ${cid}
          ORDER BY dr.created_at DESC
        `
      : await sql`
          SELECT dr.*, d.name as device_name, d.type as device_type
          FROM device_results dr
          LEFT JOIN devices d ON d.id = dr.device_id
          WHERE dr.matched_patient_id = ${patientIdInt}
          ORDER BY dr.created_at DESC
        `;
    return result.map(mapDeviceResultRow);
  },

  /** Manual match: link a pending result to a patient */
  manualMatch: async (resultId: string, patientId: string, matchedBy: string): Promise<void> => {
    const patientIdInt = parseInt(patientId) || 0;
    await sql`
      UPDATE device_results
      SET status = 'matched',
          matched_patient_id = ${patientIdInt},
          matched_at = NOW(),
          matched_by = ${matchedBy}
      WHERE id = ${resultId}::uuid AND status = 'pending'
    `;
  },

  /** Reject a result (mark as rejected) */
  reject: async (resultId: string): Promise<void> => {
    await sql`
      UPDATE device_results SET status = 'rejected' WHERE id = ${resultId}::uuid
    `;
  },

  /** Get count of pending results for badge display */
  getPendingCount: async (clientId: number): Promise<number> => {
    const result = await sql`
      SELECT COUNT(*)::int as count FROM device_results 
      WHERE client_id = ${clientId} AND status = 'pending'
    `;
    return result[0]?.count || 0;
  }
};

/** Helper to map a DB row to DeviceResult interface */
function mapDeviceResultRow(row: any): DeviceResult {
  return {
    id: row.id,
    clientId: row.client_id,
    deviceId: row.device_id,
    deviceName: row.device_name || undefined,
    deviceType: row.device_type || undefined,
    patientIdentifier: row.patient_identifier,
    testCode: row.test_code,
    testName: row.test_name || undefined,
    value: row.value,
    unit: row.unit || undefined,
    referenceRange: row.reference_range || undefined,
    isAbnormal: row.is_abnormal || false,
    rawMessage: row.raw_message || undefined,
    status: row.status,
    matchedPatientId: row.matched_patient_id ? String(row.matched_patient_id) : undefined,
    matchedPatientName: row.patient_name || undefined,
    matchedAt: row.matched_at ? new Date(row.matched_at).toISOString() : undefined,
    matchedBy: row.matched_by || undefined,
    errorMessage: row.error_message || undefined,
    createdAt: new Date(row.created_at).toISOString()
  };
}


