
import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.SOCKET_URL || 'https://medloop-api.onrender.com';
const SOCKET_PATH = '/ws';

interface UseDeviceSocketOptions {
  clientId: number | null;
  onNewResult?: (data: any) => void;
  onNewBatch?: (data: any) => void;
  onResultMatched?: (data: any) => void;
  enabled?: boolean;
}

/**
 * Hook for real-time device result notifications via Socket.IO.
 * Auto-connects and joins the tenant room on mount.
 */
export function useDeviceSocket(options: UseDeviceSocketOptions) {
  const { clientId, onNewResult, onNewBatch, onResultMatched, enabled = true } = options;
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled || !clientId) return;

    const socket = io(SOCKET_URL, {
      path: SOCKET_PATH,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[DeviceSocket] Connected:', socket.id);
      setConnected(true);
      socket.emit('join_client', { clientId });
    });

    socket.on('disconnect', () => {
      console.log('[DeviceSocket] Disconnected');
      setConnected(false);
    });

    // Listen for device events
    socket.on('new_lab_result', (data) => {
      console.log('[DeviceSocket] New result:', data);
      onNewResult?.(data);
    });

    socket.on('new_lab_result_batch', (data) => {
      console.log('[DeviceSocket] New batch:', data);
      onNewBatch?.(data);
    });

    socket.on('device_result_matched', (data) => {
      console.log('[DeviceSocket] Result matched:', data);
      onResultMatched?.(data);
    });

    return () => {
      socket.off('new_lab_result');
      socket.off('new_lab_result_batch');
      socket.off('device_result_matched');
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [clientId, enabled]);

  // Re-bind callbacks without reconnecting
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.off('new_lab_result');
    socket.off('new_lab_result_batch');
    socket.off('device_result_matched');

    if (onNewResult) socket.on('new_lab_result', onNewResult);
    if (onNewBatch) socket.on('new_lab_result_batch', onNewBatch);
    if (onResultMatched) socket.on('device_result_matched', onResultMatched);
  }, [onNewResult, onNewBatch, onResultMatched]);

  return { connected, socket: socketRef.current };
}
