import sql from './db';
import { User, Patient, Clinic, Appointment, ClinicCategory, Client, SuperAdmin } from '../types';
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
      isActive: row.is_active
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
      isActive: row.is_active
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
      isActive: row.is_active
    };
  },

  create: async (data: { name: string; slug: string; phone?: string; email?: string; address?: string }): Promise<number> => {
    const result = await sql`
      INSERT INTO clients (name, slug, phone, email, address, status, trial_ends_at, created_at, updated_at, is_active)
      VALUES (${data.name}, ${data.slug}, ${data.phone || ''}, ${data.email || ''}, ${data.address || ''}, 
              'trial', NOW() + INTERVAL '30 days', NOW(), NOW(), true)
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

  // Extend subscription by N days
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
        age: row.age || 0,
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
      id: String(row.id), name: row.full_name, age: row.age || 0,
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
      age: row.age || 0,
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
        full_name, age, gender, phone, username, email, password, has_access, 
        notes, medical_profile, current_visit, history, client_id, created_at, updated_at, created_by, updated_by, is_archived
      ) 
      VALUES (
        ${patient.name}, 
        ${patient.age || 0}, 
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
      if (data.age !== undefined) {
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

  update: async (id: string, data: Partial<Pick<Appointment, 'clinicId'|'doctorId'|'date'|'reason'|'status'>>): Promise<void> => {
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


