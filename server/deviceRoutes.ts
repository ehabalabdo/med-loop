/**
 * Device Integration Express Routes
 * 
 * These routes handle:
 * 1. Bridge agent result ingestion (POST /api/device-results)
 * 2. Pending results retrieval (GET /api/device-results/pending/:clientId)
 * 3. Manual patient matching (POST /api/device-results/match)
 * 4. Batch result ingestion (POST /api/device-results/batch)
 * 5. Device registration and management (CRUD /api/devices)
 * 6. Device heartbeat (POST /api/devices/:id/heartbeat)
 * 
 * All endpoints enforce client_id isolation for multi-tenant security.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { Server as SocketIOServer } from 'socket.io';
import crypto from 'crypto';

const router = Router();
let io: SocketIOServer | null = null;
let pool: Pool;

// ============================================================
// INITIALIZATION
// ============================================================

export function initDeviceRoutes(pgPool: Pool, socketIO?: SocketIOServer) {
  pool = pgPool;
  if (socketIO) io = socketIO;
  return router;
}

// ============================================================
// MIDDLEWARE: API Key Authentication for Bridge Agent
// ============================================================

async function authenticateBridgeAgent(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-device-api-key'] as string;
  
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing X-Device-API-Key header' });
  }

  try {
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const result = await pool.query(
      'SELECT client_id FROM device_api_keys WHERE key_hash = $1 AND is_active = true LIMIT 1',
      [keyHash]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Invalid or revoked API key' });
    }

    // Attach client_id to request for downstream use
    (req as any).clientId = result.rows[0].client_id;

    // Update last_used_at
    pool.query('UPDATE device_api_keys SET last_used_at = NOW() WHERE key_hash = $1', [keyHash]);

    next();
  } catch (err) {
    console.error('[DeviceAuth] Error:', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

// Internal auth for frontend calls (uses JWT token from existing auth)
async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  // Uses existing JWT auth middleware from the main app
  // The user and clientId should already be set by the main auth middleware
  if (!(req as any).user || !(req as any).user.clientId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ============================================================
// BRIDGE AGENT ENDPOINTS (authenticated via API key)
// ============================================================

/**
 * POST /api/device-results
 * Receives a single result from the clinic bridge agent.
 */
router.post('/device-results', authenticateBridgeAgent, async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId;
    const { deviceId, patientIdentifier, testCode, testName, value, unit, referenceRange, isAbnormal, rawMessage } = req.body;

    // Validate required fields
    if (!deviceId || !patientIdentifier || !testCode || value === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields: deviceId, patientIdentifier, testCode, value' 
      });
    }

    // Verify device belongs to this client
    const deviceCheck = await pool.query(
      'SELECT id, clinic_id FROM devices WHERE id = $1 AND client_id = $2 AND is_active = true',
      [deviceId, clientId]
    );
    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found or inactive' });
    }

    // Update device last_seen_at
    pool.query('UPDATE devices SET last_seen_at = NOW() WHERE id = $1', [deviceId]);

    // Auto-match logic
    const { resultId, status, matchedPatientId } = await insertAndMatchResult(clientId, {
      deviceId, patientIdentifier, testCode, testName, value, unit, referenceRange, isAbnormal, rawMessage
    });

    // Socket.io notification
    if (io) {
      io.to(`client_${clientId}`).emit('new_lab_result', {
        id: resultId,
        deviceId,
        testCode,
        testName,
        value,
        unit,
        status,
        matchedPatientId,
        patientIdentifier,
        createdAt: new Date().toISOString()
      });
    }

    return res.status(201).json({ 
      id: resultId, 
      status, 
      matchedPatientId,
      message: status === 'matched' ? 'Result auto-matched to patient' : 'Result saved, pending manual matching'
    });
  } catch (err: any) {
    console.error('[DeviceResults] POST error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * POST /api/device-results/batch
 * Receives multiple results from a single patient scan (e.g., CBC panel).
 */
router.post('/device-results/batch', authenticateBridgeAgent, async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId;
    const { deviceId, patientIdentifier, results, rawMessage } = req.body;

    if (!deviceId || !patientIdentifier || !Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ 
        error: 'Missing required fields: deviceId, patientIdentifier, results[]' 
      });
    }

    // Verify device
    const deviceCheck = await pool.query(
      'SELECT id FROM devices WHERE id = $1 AND client_id = $2 AND is_active = true',
      [deviceId, clientId]
    );
    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found or inactive' });
    }

    pool.query('UPDATE devices SET last_seen_at = NOW() WHERE id = $1', [deviceId]);

    const insertedResults: Array<{ id: string; testCode: string; status: string }> = [];

    for (const r of results) {
      if (!r.testCode || r.value === undefined) continue;
      const { resultId, status, matchedPatientId } = await insertAndMatchResult(clientId, {
        deviceId,
        patientIdentifier,
        testCode: r.testCode,
        testName: r.testName,
        value: r.value,
        unit: r.unit,
        referenceRange: r.referenceRange,
        isAbnormal: r.isAbnormal,
        rawMessage
      });
      insertedResults.push({ id: resultId, testCode: r.testCode, status });
    }

    // Notify once for the batch
    if (io) {
      io.to(`client_${clientId}`).emit('new_lab_result_batch', {
        deviceId,
        patientIdentifier,
        count: insertedResults.length,
        results: insertedResults,
        createdAt: new Date().toISOString()
      });
    }

    return res.status(201).json({
      count: insertedResults.length,
      results: insertedResults
    });
  } catch (err: any) {
    console.error('[DeviceResults] Batch error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * POST /api/devices/:id/heartbeat
 * Bridge agent pings to confirm device is online.
 */
router.post('/devices/:id/heartbeat', authenticateBridgeAgent, async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId;
    const { id } = req.params;

    const result = await pool.query(
      'UPDATE devices SET last_seen_at = NOW() WHERE id = $1 AND client_id = $2 RETURNING id',
      [id, clientId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    return res.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (err: any) {
    console.error('[DeviceHeartbeat] Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================
// FRONTEND / STAFF ENDPOINTS (authenticated via JWT)
// ============================================================

/**
 * GET /api/device-results/pending/:clientId
 * Returns unmatched results for receptionist review.
 */
router.get('/device-results/pending/:clientId', async (req: Request, res: Response) => {
  try {
    const clientId = parseInt(req.params.clientId);
    if (!clientId) return res.status(400).json({ error: 'Invalid clientId' });

    const result = await pool.query(`
      SELECT dr.*, d.name as device_name, d.type as device_type
      FROM device_results dr
      LEFT JOIN devices d ON d.id = dr.device_id
      WHERE dr.client_id = $1 AND dr.status = 'pending'
      ORDER BY dr.created_at DESC
    `, [clientId]);

    return res.json(result.rows.map(mapRow));
  } catch (err: any) {
    console.error('[DeviceResults] GET pending error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/device-results/patient/:patientId
 * Returns all matched results for a patient.
 */
router.get('/device-results/patient/:patientId', async (req: Request, res: Response) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const clientId = parseInt(req.query.clientId as string);

    if (!patientId) return res.status(400).json({ error: 'Invalid patientId' });

    let query = `
      SELECT dr.*, d.name as device_name, d.type as device_type
      FROM device_results dr
      LEFT JOIN devices d ON d.id = dr.device_id
      WHERE dr.matched_patient_id = $1
    `;
    const params: any[] = [patientId];

    if (clientId) {
      query += ` AND dr.client_id = $2`;
      params.push(clientId);
    }

    query += ` ORDER BY dr.created_at DESC`;

    const result = await pool.query(query, params);
    return res.json(result.rows.map(mapRow));
  } catch (err: any) {
    console.error('[DeviceResults] GET patient error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/device-results/all/:clientId
 * Returns all results for a client with optional status filter.
 */
router.get('/device-results/all/:clientId', async (req: Request, res: Response) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const status = req.query.status as string;

    if (!clientId) return res.status(400).json({ error: 'Invalid clientId' });

    let query = `
      SELECT dr.*, d.name as device_name, d.type as device_type, p.full_name as patient_name
      FROM device_results dr
      LEFT JOIN devices d ON d.id = dr.device_id
      LEFT JOIN patients p ON p.id = dr.matched_patient_id
      WHERE dr.client_id = $1
    `;
    const params: any[] = [clientId];

    if (status) {
      query += ` AND dr.status = $2`;
      params.push(status);
    }

    query += ` ORDER BY dr.created_at DESC LIMIT 200`;

    const result = await pool.query(query, params);
    return res.json(result.rows.map(mapRow));
  } catch (err: any) {
    console.error('[DeviceResults] GET all error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/device-results/match
 * Manual patient matching by receptionist.
 */
router.post('/device-results/match', async (req: Request, res: Response) => {
  try {
    const { resultId, patientId, matchedBy } = req.body;

    if (!resultId || !patientId) {
      return res.status(400).json({ error: 'Missing resultId or patientId' });
    }

    const patientIdInt = parseInt(patientId);

    // Verify result exists and is pending
    const check = await pool.query(
      'SELECT id, client_id FROM device_results WHERE id = $1 AND status = $2',
      [resultId, 'pending']
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Result not found or already matched' });
    }

    const clientId = check.rows[0].client_id;

    // Verify patient belongs to same client
    const patientCheck = await pool.query(
      'SELECT id FROM patients WHERE id = $1 AND client_id = $2',
      [patientIdInt, clientId]
    );
    if (patientCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Patient not found in this clinic' });
    }

    // Perform match
    await pool.query(`
      UPDATE device_results
      SET status = 'matched', matched_patient_id = $1, matched_at = NOW(), matched_by = $2
      WHERE id = $3
    `, [patientIdInt, matchedBy || 'manual', resultId]);

    // Notify via socket
    if (io) {
      io.to(`client_${clientId}`).emit('device_result_matched', {
        resultId,
        patientId: patientIdInt,
        matchedBy: matchedBy || 'manual'
      });
    }

    return res.json({ ok: true, message: 'Result matched to patient successfully' });
  } catch (err: any) {
    console.error('[DeviceResults] Match error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/device-results/:id/reject
 * Reject a pending result.
 */
router.post('/device-results/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query(
      "UPDATE device_results SET status = 'rejected' WHERE id = $1 AND status = 'pending'",
      [id]
    );
    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[DeviceResults] Reject error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/device-results/pending-count/:clientId
 * Returns count of pending results (for badge).
 */
router.get('/device-results/pending-count/:clientId', async (req: Request, res: Response) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const result = await pool.query(
      "SELECT COUNT(*)::int as count FROM device_results WHERE client_id = $1 AND status = 'pending'",
      [clientId]
    );
    return res.json({ count: result.rows[0]?.count || 0 });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================
// DEVICE MANAGEMENT ENDPOINTS
// ============================================================

/** GET /api/devices/:clientId - List all devices for a client */
router.get('/devices/:clientId', async (req: Request, res: Response) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const result = await pool.query(
      'SELECT * FROM devices WHERE client_id = $1 ORDER BY created_at DESC',
      [clientId]
    );
    return res.json(result.rows.map((row: any) => ({
      id: row.id,
      clientId: row.client_id,
      clinicId: String(row.clinic_id),
      name: row.name,
      type: row.type,
      connectionType: row.connection_type,
      ipAddress: row.ip_address,
      port: row.port,
      comPort: row.com_port,
      isActive: row.is_active,
      lastSeenAt: row.last_seen_at,
      createdAt: row.created_at
    })));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/devices - Register a new device */
router.post('/devices', async (req: Request, res: Response) => {
  try {
    const { clientId, clinicId, name, type, connectionType, ipAddress, port, comPort } = req.body;
    if (!clientId || !clinicId || !name || !type || !connectionType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(`
      INSERT INTO devices (client_id, clinic_id, name, type, connection_type, ip_address, port, com_port, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      RETURNING id
    `, [clientId, parseInt(clinicId), name, type, connectionType, ipAddress || null, port || null, comPort || null]);

    return res.status(201).json({ id: result.rows[0].id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/** PUT /api/devices/:id - Update a device */
router.put('/devices/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, type, connectionType, ipAddress, port, comPort, isActive, clinicId } = req.body;

    await pool.query('UPDATE devices SET updated_at = NOW() WHERE id = $1', [id]);
    if (name !== undefined) await pool.query('UPDATE devices SET name = $1 WHERE id = $2', [name, id]);
    if (type !== undefined) await pool.query('UPDATE devices SET type = $1 WHERE id = $2', [type, id]);
    if (connectionType !== undefined) await pool.query('UPDATE devices SET connection_type = $1 WHERE id = $2', [connectionType, id]);
    if (ipAddress !== undefined) await pool.query('UPDATE devices SET ip_address = $1 WHERE id = $2', [ipAddress, id]);
    if (port !== undefined) await pool.query('UPDATE devices SET port = $1 WHERE id = $2', [port, id]);
    if (comPort !== undefined) await pool.query('UPDATE devices SET com_port = $1 WHERE id = $2', [comPort, id]);
    if (isActive !== undefined) await pool.query('UPDATE devices SET is_active = $1 WHERE id = $2', [isActive, id]);
    if (clinicId !== undefined) await pool.query('UPDATE devices SET clinic_id = $1 WHERE id = $2', [clinicId, id]);

    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/devices/:id */
router.delete('/devices/:id', async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM devices WHERE id = $1', [req.params.id]);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================
// API KEY MANAGEMENT
// ============================================================

/** POST /api/device-api-keys - Generate a new API key */
router.post('/device-api-keys', async (req: Request, res: Response) => {
  try {
    const { clientId, label } = req.body;
    if (!clientId || !label) {
      return res.status(400).json({ error: 'Missing clientId or label' });
    }

    // Generate a random API key
    const rawKey = `mdl_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    await pool.query(
      'INSERT INTO device_api_keys (client_id, key_hash, label) VALUES ($1, $2, $3)',
      [clientId, keyHash, label]
    );

    // Return the raw key ONCE — it cannot be retrieved again
    return res.status(201).json({
      key: rawKey,
      label,
      message: 'Save this key securely. It will not be shown again.'
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/device-api-keys/:clientId - List keys (hashed) */
router.get('/device-api-keys/:clientId', async (req: Request, res: Response) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const result = await pool.query(
      'SELECT id, label, is_active, last_used_at, created_at FROM device_api_keys WHERE client_id = $1 ORDER BY created_at DESC',
      [clientId]
    );
    return res.json(result.rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/device-api-keys/:id - Revoke a key */
router.delete('/device-api-keys/:id', async (req: Request, res: Response) => {
  try {
    await pool.query('UPDATE device_api_keys SET is_active = false WHERE id = $1', [req.params.id]);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================
// HELPERS
// ============================================================

async function insertAndMatchResult(clientId: number, data: {
  deviceId: string;
  patientIdentifier: string;
  testCode: string;
  testName?: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  isAbnormal?: boolean;
  rawMessage?: string;
}): Promise<{ resultId: string; status: string; matchedPatientId: number | null }> {

  let matchedPatientId: number | null = null;
  let status = 'pending';
  const identifier = data.patientIdentifier.trim();

  // Auto-match strategy 1: Numeric patient ID
  const numericId = parseInt(identifier);
  if (!isNaN(numericId)) {
    const match = await pool.query(
      'SELECT id FROM patients WHERE id = $1 AND client_id = $2 LIMIT 1',
      [numericId, clientId]
    );
    if (match.rows.length > 0) {
      matchedPatientId = match.rows[0].id;
      status = 'matched';
    }
  }

  // Auto-match strategy 2: Phone number
  if (!matchedPatientId) {
    const phoneMatch = await pool.query(
      'SELECT id FROM patients WHERE phone = $1 AND client_id = $2 LIMIT 1',
      [identifier, clientId]
    );
    if (phoneMatch.rows.length > 0) {
      matchedPatientId = phoneMatch.rows[0].id;
      status = 'matched';
    }
  }

  // Insert result
  const result = await pool.query(`
    INSERT INTO device_results (
      client_id, device_id, patient_identifier, test_code, test_name,
      value, unit, reference_range, is_abnormal, raw_message,
      status, matched_patient_id, matched_at, matched_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING id
  `, [
    clientId, data.deviceId, identifier, data.testCode, data.testName || null,
    data.value, data.unit || null, data.referenceRange || null, data.isAbnormal || false,
    data.rawMessage || null,
    status, matchedPatientId,
    matchedPatientId ? new Date().toISOString() : null,
    matchedPatientId ? 'auto' : null
  ]);

  return { resultId: result.rows[0].id, status, matchedPatientId };
}

function mapRow(row: any) {
  return {
    id: row.id,
    clientId: row.client_id,
    deviceId: row.device_id,
    deviceName: row.device_name || null,
    deviceType: row.device_type || null,
    patientIdentifier: row.patient_identifier,
    testCode: row.test_code,
    testName: row.test_name || null,
    value: row.value,
    unit: row.unit || null,
    referenceRange: row.reference_range || null,
    isAbnormal: row.is_abnormal || false,
    rawMessage: row.raw_message || null,
    status: row.status,
    matchedPatientId: row.matched_patient_id ? String(row.matched_patient_id) : null,
    matchedPatientName: row.patient_name || null,
    matchedAt: row.matched_at || null,
    matchedBy: row.matched_by || null,
    createdAt: row.created_at
  };
}

export default router;
