/**
 * Socket.io Integration for Device Results
 * 
 * Events:
 * - new_lab_result:       Single result received from bridge agent
 * - new_lab_result_batch: Multiple results received (e.g., CBC panel)
 * - device_result_matched: A pending result was matched to a patient
 * - device_online:        Device heartbeat received
 * - device_offline:       Device stopped sending heartbeats
 * 
 * Room strategy:
 * - Each client (tenant) has room: `client_{clientId}`
 * - Doctors/staff auto-join their client room on connect
 * - Bridge agents join via API key lookup
 */

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { Pool } from 'pg';
import crypto from 'crypto';

let io: SocketIOServer;

export function initSocketIO(httpServer: HttpServer, pool: Pool): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    path: '/ws'
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // Staff joins their client room
    socket.on('join_client', async (data: { clientId: number; userId?: string }) => {
      if (!data.clientId) return;
      const room = `client_${data.clientId}`;
      socket.join(room);
      console.log(`[Socket] ${socket.id} joined room ${room}`);
    });

    // Bridge agent joins via API key
    socket.on('join_bridge', async (data: { apiKey: string }) => {
      if (!data.apiKey) return;
      try {
        const keyHash = crypto.createHash('sha256').update(data.apiKey).digest('hex');
        const result = await pool.query(
          'SELECT client_id FROM device_api_keys WHERE key_hash = $1 AND is_active = true LIMIT 1',
          [keyHash]
        );
        if (result.rows.length > 0) {
          const room = `client_${result.rows[0].client_id}`;
          socket.join(room);
          socket.emit('bridge_authenticated', { ok: true, clientId: result.rows[0].client_id });
          console.log(`[Socket] Bridge agent joined room ${room}`);
        } else {
          socket.emit('bridge_authenticated', { ok: false, error: 'Invalid API key' });
        }
      } catch (err) {
        console.error('[Socket] Bridge auth error:', err);
        socket.emit('bridge_authenticated', { ok: false, error: 'Auth failed' });
      }
    });

    // Leave room on explicit leave
    socket.on('leave_client', (data: { clientId: number }) => {
      if (data.clientId) {
        socket.leave(`client_${data.clientId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });

  return io;
}

/** Emit a new lab result event to a specific client room */
export function emitLabResult(clientId: number, data: any) {
  if (io) {
    io.to(`client_${clientId}`).emit('new_lab_result', data);
  }
}

/** Emit a batch lab result event */
export function emitLabResultBatch(clientId: number, data: any) {
  if (io) {
    io.to(`client_${clientId}`).emit('new_lab_result_batch', data);
  }
}

/** Emit when a result is manually matched */
export function emitResultMatched(clientId: number, data: { resultId: string; patientId: number; matchedBy: string }) {
  if (io) {
    io.to(`client_${clientId}`).emit('device_result_matched', data);
  }
}

/** Get the Socket.IO server instance */
export function getIO(): SocketIOServer | null {
  return io || null;
}
