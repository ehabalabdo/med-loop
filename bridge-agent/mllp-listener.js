/**
 * MLLP (Minimal Lower Layer Protocol) Listener
 * 
 * TCP server that receives HL7 v2.x messages from medical devices.
 * 
 * MLLP Framing Protocol:
 *   Start: \x0B (VT - Vertical Tab)
 *   End:   \x1C (FS - File Separator) + \x0D (CR - Carriage Return)
 * 
 * Flow:
 *   Device connects via TCP → sends MLLP-framed HL7 message →
 *   Server parses → converts to MedLoop format → enqueues →
 *   Server sends MLLP-framed ACK → keeps connection alive
 * 
 * Supports:
 *   - Persistent connections (devices can send multiple messages)
 *   - Multi-message buffering
 *   - Auto-ACK on successful parse
 *   - Error ACK (AE) on parse failure
 *   - Connection tracking and cleanup
 */

const net = require('net');
const { parseHL7Message, hl7ToDeviceResults, generateACK, wrapMLLP, stripMLLP, MLLP_START, MLLP_END, MLLP_CR } = require('./hl7-parser');

/**
 * Create and start an MLLP listener
 * @param {object} config - Configuration
 * @param {number} config.port - TCP port to listen on (default 2575)
 * @param {string} config.host - Host to bind to (default 0.0.0.0)
 * @param {string} config.deviceId - Default device UUID for results 
 * @param {function} config.onResult - Callback for each parsed result payload
 * @param {function} config.onBatch - Callback for batch of results from one message
 * @param {function} config.onError - Callback for errors
 * @param {function} config.onConnection - Callback when device connects
 * @param {function} config.onDisconnect - Callback when device disconnects
 * @returns {object} Server control object { server, close, getConnections }
 */
function createMLLPListener(config) {
  const port = config.port || 2575;
  const host = config.host || '0.0.0.0';
  const deviceId = config.deviceId || '';
  const onResult = config.onResult || (() => {});
  const onBatch = config.onBatch || null;
  const onError = config.onError || ((err) => console.error('[MLLP] Error:', err.message));
  const onConnection = config.onConnection || (() => {});
  const onDisconnect = config.onDisconnect || (() => {});

  // Track active connections
  const connections = new Map();
  let connectionCounter = 0;

  const server = net.createServer((socket) => {
    const connId = ++connectionCounter;
    const remoteAddr = `${socket.remoteAddress}:${socket.remotePort}`;
    let buffer = Buffer.alloc(0);
    
    connections.set(connId, { socket, remoteAddr, connectedAt: new Date(), messagesReceived: 0 });
    console.log(`[MLLP] Device connected: #${connId} from ${remoteAddr}`);
    onConnection({ connId, remoteAddr });

    socket.on('data', (data) => {
      // Accumulate data in buffer
      buffer = Buffer.concat([buffer, data]);

      // Process complete MLLP messages in buffer
      // A complete message: \x0B ... \x1C \x0D
      let startIdx, endIdx;

      while (true) {
        const bufStr = buffer.toString('utf8');
        startIdx = bufStr.indexOf(MLLP_START);
        endIdx = bufStr.indexOf(MLLP_END + MLLP_CR);

        if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) break;

        // Extract complete message (without MLLP framing)
        const rawMessage = bufStr.substring(startIdx, endIdx + 2); // include \x1C\x0D for parser
        const hl7Data = bufStr.substring(startIdx + 1, endIdx); // clean HL7 content

        // Remove processed bytes from buffer
        buffer = Buffer.from(bufStr.substring(endIdx + 2), 'utf8');

        // Track
        const conn = connections.get(connId);
        if (conn) conn.messagesReceived++;

        // Process the message
        processHL7Message(socket, hl7Data, rawMessage, connId, remoteAddr);
      }
    });

    socket.on('error', (err) => {
      console.error(`[MLLP] Socket error on #${connId} (${remoteAddr}):`, err.message);
      onError(err);
    });

    socket.on('close', () => {
      const conn = connections.get(connId);
      const msgCount = conn ? conn.messagesReceived : 0;
      console.log(`[MLLP] Device disconnected: #${connId} (${remoteAddr}), ${msgCount} messages received`);
      connections.delete(connId);
      onDisconnect({ connId, remoteAddr, messagesReceived: msgCount });
    });

    socket.on('timeout', () => {
      console.log(`[MLLP] Socket timeout on #${connId} (${remoteAddr})`);
      socket.end();
    });

    // 5-minute idle timeout
    socket.setTimeout(5 * 60 * 1000);
  });

  /**
   * Process a single HL7 message received from a device
   */
  function processHL7Message(socket, hl7Data, rawMessage, connId, remoteAddr) {
    try {
      const parsed = parseHL7Message(hl7Data);
      console.log(`[MLLP] #${connId} Message: ${parsed.messageType} | Control: ${parsed.messageId} | From: ${parsed.sendingApp}/${parsed.sendingFacility}`);

      // Check message type
      if (!parsed.msh) {
        throw new Error('Missing MSH segment');
      }

      const msgType = parsed.msh.messageTypeCode;

      // Handle ORU (Observation Result) — lab results
      if (msgType === 'ORU') {
        const results = hl7ToDeviceResults(parsed, deviceId);
        
        if (results.length === 0) {
          console.log(`[MLLP] #${connId} ORU message parsed but no OBX results found`);
        } else {
          console.log(`[MLLP] #${connId} Extracted ${results.length} result(s): ${results.map(r => r.testCode).join(', ')}`);

          if (parsed.pid) {
            console.log(`[MLLP] #${connId} Patient: ${parsed.pid.fullName || parsed.pid.mrn} (MRN: ${parsed.pid.mrn})`);
          }

          // Call batch callback if available, otherwise individual
          if (onBatch && results.length > 1) {
            onBatch(results, parsed);
          } else {
            for (const result of results) {
              onResult(result, parsed);
            }
          }
        }

        // Send ACK
        const ack = generateACK(parsed, 'AA');
        const mllpAck = wrapMLLP(ack);
        socket.write(mllpAck);
        console.log(`[MLLP] #${connId} ACK sent (AA)`);

      } else if (msgType === 'ADT') {
        // ADT — Patient administration messages (admit/discharge/transfer)
        console.log(`[MLLP] #${connId} ADT message received (patient admin) — acknowledged but not processed`);
        const ack = generateACK(parsed, 'AA');
        socket.write(wrapMLLP(ack));

      } else if (msgType === 'ORM' || msgType === 'OML') {
        // ORM/OML — Order messages — typically sent TO a device, not FROM
        console.log(`[MLLP] #${connId} ${msgType} order message received — acknowledged`);
        const ack = generateACK(parsed, 'AA');
        socket.write(wrapMLLP(ack));

      } else if (msgType === 'QRY' || msgType === 'QBP') {
        // Query — device querying for patient/order info
        console.log(`[MLLP] #${connId} ${msgType} query received — not implemented`);
        const ack = generateACK(parsed, 'AR', 'Query not supported');
        socket.write(wrapMLLP(ack));

      } else {
        console.log(`[MLLP] #${connId} Unknown message type: ${msgType} — acknowledged`);
        const ack = generateACK(parsed, 'AA');
        socket.write(wrapMLLP(ack));
      }

    } catch (err) {
      console.error(`[MLLP] #${connId} Parse error:`, err.message);
      onError(err);

      // Try to send error ACK
      try {
        const errAck = `MSH|^~\\&|MEDLOOP|HQ||||${Date.now()}||ACK|ERR_${Date.now()}|P|2.5\rMSA|AE||${err.message}`;
        socket.write(wrapMLLP(errAck));
        console.log(`[MLLP] #${connId} Error ACK sent (AE)`);
      } catch (ackErr) {
        console.error(`[MLLP] #${connId} Failed to send error ACK:`, ackErr.message);
      }
    }
  }

  // Error handling for server itself
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[MLLP] Port ${port} is already in use. Cannot start MLLP listener.`);
    } else {
      console.error('[MLLP] Server error:', err.message);
    }
    onError(err);
  });

  // Start listening
  server.listen(port, host, () => {
    console.log(`[MLLP] HL7 listener started on ${host}:${port}`);
    console.log(`[MLLP] Waiting for device connections...`);
  });

  return {
    server,
    close: () => {
      // Close all active connections
      for (const [id, conn] of connections) {
        conn.socket.destroy();
      }
      connections.clear();
      server.close();
      console.log('[MLLP] Server stopped');
    },
    getConnections: () => {
      const list = [];
      for (const [id, conn] of connections) {
        list.push({
          id,
          remoteAddr: conn.remoteAddr,
          connectedAt: conn.connectedAt,
          messagesReceived: conn.messagesReceived
        });
      }
      return list;
    },
    getConnectionCount: () => connections.size
  };
}

module.exports = { createMLLPListener };
