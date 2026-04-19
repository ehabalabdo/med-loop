/**
 * MedLoop Clinic Bridge Agent
 * 
 * This is a lightweight HTTP bridge that runs inside the clinic LAN.
 * It collects results from medical devices and pushes them to the MedLoop API.
 * 
 * Installation:
 *   1. npm install
 *   2. Configure .env with your API key and server URL
 *   3. node bridge-agent.js
 * 
 * Supported input methods:
 *   - HTTP POST from devices with network capability
 *   - File watcher for devices that export to shared folders (.json, .hl7)
 *   - HL7 v2.x MLLP listener (TCP port for HL7 lab devices)
 *   - Serial port listener RS-232 (COM port for legacy devices)
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { parseHL7Message, hl7ToDeviceResults } = require('./hl7-parser');
const { createMLLPListener } = require('./mllp-listener');

// Serial port is optional (requires npm install serialport)
let createSerialListener, listSerialPorts;
try {
  const serial = require('./serial-listener');
  createSerialListener = serial.createSerialListener;
  listSerialPorts = serial.listSerialPorts;
} catch (e) {
  // Serial module loads, but if serialport npm not installed it handles gracefully
  try {
    createSerialListener = require('./serial-listener').createSerialListener;
    listSerialPorts = require('./serial-listener').listSerialPorts;
  } catch (_) {}
}

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
  // MedLoop API endpoint
  API_URL: process.env.MEDLOOP_API_URL || 'https://medloop-api.onrender.com',
  
  // API key for authentication (generated from MedLoop admin panel)
  // Bridge Agent shared key — sent as X-Bridge-Key header to MedLoop API.
  // Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  // Then store SHA-256(this) in clients.bridge_key_hash on the server.
  API_KEY: process.env.MEDLOOP_API_KEY || '',

  // Numeric client_id (tenant) this bridge belongs to. Optional but speeds
  // up the server-side key lookup; the key still must hash-match.
  CLIENT_ID: parseInt(process.env.MEDLOOP_CLIENT_ID || '0', 10) || null,
  
  // Bridge agent HTTP server port (devices POST results here)
  BRIDGE_PORT: parseInt(process.env.BRIDGE_PORT || '9090'),
  
  // Default device ID (if device doesn't specify)
  DEFAULT_DEVICE_ID: process.env.DEFAULT_DEVICE_ID || '',
  
  // Folder to watch for result files (optional)
  WATCH_FOLDER: process.env.WATCH_FOLDER || '',
  
  // HL7 MLLP port (0 = disabled)
  HL7_PORT: parseInt(process.env.HL7_PORT || '2575'),
  HL7_ENABLED: (process.env.HL7_ENABLED || 'true').toLowerCase() === 'true',
  HL7_DEVICE_ID: process.env.HL7_DEVICE_ID || process.env.DEFAULT_DEVICE_ID || '',

  // SECURITY: comma-separated CIDR/IPs allowed to connect to MLLP/HTTP listeners.
  // Example: '10.0.0.0/8,192.168.1.50'. Empty = allow all (LAN-only assumption).
  ALLOWED_IPS: (process.env.BRIDGE_ALLOWED_IPS || '').split(',').map(s => s.trim()).filter(Boolean),

  // Serial port (empty = disabled)
  SERIAL_PORT: process.env.SERIAL_PORT || '',  // e.g. 'COM3' or '/dev/ttyUSB0'
  SERIAL_BAUD: parseInt(process.env.SERIAL_BAUD || '9600'),
  SERIAL_MODE: process.env.SERIAL_MODE || 'hl7',  // 'hl7' or 'raw'
  SERIAL_DEVICE_ID: process.env.SERIAL_DEVICE_ID || process.env.DEFAULT_DEVICE_ID || '',

  // Heartbeat interval (ms)
  HEARTBEAT_INTERVAL: 60000,
  
  // Retry config
  MAX_RETRIES: 3,
  RETRY_DELAY: 5000
};

// ============================================================
// RESULT QUEUE (with retry logic)
// ============================================================

const pendingQueue = [];
let isProcessing = false;

async function enqueueResult(payload) {
  pendingQueue.push(payload);
  processQueue();
}

async function processQueue() {
  if (isProcessing || pendingQueue.length === 0) return;
  isProcessing = true;

  while (pendingQueue.length > 0) {
    const payload = pendingQueue[0];
    let success = false;

    for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
      try {
        await sendToAPI('/bridge/device-results', payload);
        console.log(`[✓] Result sent: ${payload.testCode} = ${payload.value} ${payload.unit || ''}`);
        success = true;
        break;
      } catch (err) {
        console.error(`[✗] Attempt ${attempt}/${CONFIG.MAX_RETRIES} failed:`, err.message);
        if (attempt < CONFIG.MAX_RETRIES) {
          await sleep(CONFIG.RETRY_DELAY * attempt);
        }
      }
    }

    if (success) {
      pendingQueue.shift();
    } else {
      // Move to dead letter queue
      console.error(`[!] Giving up on result: ${JSON.stringify(payload)}`);
      const deadLetter = pendingQueue.shift();
      fs.appendFileSync(
        path.join(__dirname, 'dead-letters.json'),
        JSON.stringify({ ...deadLetter, failedAt: new Date().toISOString() }) + '\n'
      );
    }
  }

  isProcessing = false;
}

// ============================================================
// IP allowlist helper
// ============================================================

function isIpAllowed(ip) {
  if (!CONFIG.ALLOWED_IPS.length) return true; // not configured = allow all (LAN trust)
  if (!ip) return false;
  // Strip IPv6 prefix for IPv4 mapped addresses
  const clean = ip.replace(/^::ffff:/, '');
  for (const entry of CONFIG.ALLOWED_IPS) {
    if (entry === clean) return true;
    if (entry.includes('/')) {
      // very lightweight CIDR check (IPv4 only)
      const [base, bitsStr] = entry.split('/');
      const bits = parseInt(bitsStr, 10);
      if (!Number.isFinite(bits)) continue;
      const toInt = (a) => a.split('.').reduce((n, p) => (n << 8) | (parseInt(p, 10) & 0xff), 0) >>> 0;
      try {
        const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
        if ((toInt(clean) & mask) === (toInt(base) & mask)) return true;
      } catch { /* skip */ }
    }
  }
  return false;
}

// ============================================================
// HTTP BRIDGE SERVER (devices POST results here)
// ============================================================

const server = http.createServer(async (req, res) => {
  // SECURITY: enforce IP allowlist if configured (LAN-only)
  const remoteIp = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  if (!isIpAllowed(remoteIp)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'ip_not_allowed' }));
    return;
  }

  // CORS — same-LAN devices only; reflect Origin if it's an internal/private host,
  // otherwise no CORS headers (so browsers from outside cannot call us).
  const origin = req.headers.origin || '';
  const isLanOrigin = !origin || /^https?:\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(origin);
  if (isLanOrigin && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/result') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        
        const payload = {
          deviceId: data.deviceId || CONFIG.DEFAULT_DEVICE_ID,
          patientIdentifier: data.patientId || data.patientIdentifier || data.mrn || '',
          testCode: data.testCode || data.code || '',
          testName: data.testName || data.name || '',
          value: String(data.value || data.result || ''),
          unit: data.unit || '',
          referenceRange: data.referenceRange || data.range || '',
          isAbnormal: data.isAbnormal || data.abnormal || false,
          rawMessage: JSON.stringify(data)
        };

        if (!payload.patientIdentifier || !payload.testCode || !payload.value) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing patientIdentifier, testCode, or value' }));
          return;
        }

        await enqueueResult(payload);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, queued: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON: ' + err.message }));
      }
    });
    return;
  }

  // Batch endpoint
  if (req.method === 'POST' && req.url === '/results') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const results = data.results || data;
        
        if (!Array.isArray(results)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Expected array of results' }));
          return;
        }

        let queued = 0;
        for (const r of results) {
          const payload = {
            deviceId: r.deviceId || data.deviceId || CONFIG.DEFAULT_DEVICE_ID,
            patientIdentifier: r.patientId || r.patientIdentifier || r.mrn || data.patientIdentifier || '',
            testCode: r.testCode || r.code || '',
            testName: r.testName || '',
            value: String(r.value || r.result || ''),
            unit: r.unit || '',
            referenceRange: r.referenceRange || '',
            isAbnormal: r.isAbnormal || false,
            rawMessage: JSON.stringify(r)
          };
          if (payload.patientIdentifier && payload.testCode && payload.value) {
            await enqueueResult(payload);
            queued++;
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, queued }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'running',
      pendingQueue: pendingQueue.length,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      hl7: {
        enabled: CONFIG.HL7_ENABLED,
        port: CONFIG.HL7_PORT,
        connections: mllpServer ? mllpServer.getConnectionCount() : 0
      },
      serial: {
        enabled: !!CONFIG.SERIAL_PORT,
        port: CONFIG.SERIAL_PORT || null,
        open: serialConnection ? serialConnection.isOpen() : false
      },
      fileWatcher: {
        enabled: !!CONFIG.WATCH_FOLDER,
        folder: CONFIG.WATCH_FOLDER || null
      }
    }));
    return;
  }

  // HL7 connections status
  if (req.method === 'GET' && req.url === '/hl7/connections') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      connections: mllpServer ? mllpServer.getConnections() : [],
      count: mllpServer ? mllpServer.getConnectionCount() : 0
    }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// ============================================================
// FILE WATCHER (for devices that export to shared folders)
// ============================================================

function startFileWatcher() {
  if (!CONFIG.WATCH_FOLDER || !fs.existsSync(CONFIG.WATCH_FOLDER)) {
    console.log('[FileWatcher] Disabled (no WATCH_FOLDER configured)');
    return;
  }

  console.log(`[FileWatcher] Watching: ${CONFIG.WATCH_FOLDER}`);
  
  fs.watch(CONFIG.WATCH_FOLDER, async (eventType, filename) => {
    if (eventType !== 'rename' || !filename) return;
    
    const filePath = path.join(CONFIG.WATCH_FOLDER, filename);
    if (!fs.existsSync(filePath)) return;

    try {
      const ext = path.extname(filename).toLowerCase();
      
      if (ext === '.json') {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        
        if (Array.isArray(data)) {
          data.forEach(r => enqueueResult(r));
        } else {
          enqueueResult(data);
        }
        moveToProcessed(filePath, filename);
        console.log(`[FileWatcher] Processed JSON: ${filename}`);

      } else if (ext === '.hl7') {
        // HL7 v2.x flat file — parse segments and extract results
        const content = fs.readFileSync(filePath, 'utf8');
        try {
          const parsed = parseHL7Message(content);
          const results = hl7ToDeviceResults(parsed, CONFIG.HL7_DEVICE_ID || CONFIG.DEFAULT_DEVICE_ID);
          if (results.length > 0) {
            console.log(`[FileWatcher] HL7 file: ${parsed.messageType} → ${results.length} result(s)`);
            for (const result of results) {
              await enqueueResult(result);
            }
          } else {
            console.log(`[FileWatcher] HL7 file parsed but no OBX results: ${filename}`);
          }
        } catch (hl7Err) {
          console.error(`[FileWatcher] HL7 parse error (${filename}):`, hl7Err.message);
        }
        moveToProcessed(filePath, filename);
        console.log(`[FileWatcher] Processed HL7: ${filename}`);

      } else if (ext === '.csv' || ext === '.txt') {
        // CSV/TXT — each line is a result (comma-separated)
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split(/\r?\n/).filter(l => l.trim());
        let count = 0;
        for (const line of lines) {
          // Skip header rows
          if (line.toLowerCase().startsWith('patient') || line.startsWith('#')) continue;
          const parts = line.split(',').map(s => s.trim());
          // Expected: patientId, testCode, testName, value, unit, referenceRange
          if (parts.length >= 4) {
            await enqueueResult({
              deviceId: CONFIG.DEFAULT_DEVICE_ID,
              patientIdentifier: parts[0] || '',
              testCode: parts[1] || '',
              testName: parts[2] || parts[1] || '',
              value: parts[3] || '',
              unit: parts[4] || '',
              referenceRange: parts[5] || '',
              isAbnormal: false,
              rawMessage: line
            });
            count++;
          }
        }
        moveToProcessed(filePath, filename);
        console.log(`[FileWatcher] Processed CSV/TXT: ${filename} (${count} results)`);
      }
    } catch (err) {
      console.error(`[FileWatcher] Error processing ${filename}:`, err.message);
    }
  });
}

// ============================================================
// HEARTBEAT
// ============================================================

function startHeartbeat() {
  if (!CONFIG.DEFAULT_DEVICE_ID) return;
  
  setInterval(async () => {
    try {
      await sendToAPI(`/api/devices/${CONFIG.DEFAULT_DEVICE_ID}/heartbeat`, {});
    } catch (err) {
      // Silent fail for heartbeat
    }
  }, CONFIG.HEARTBEAT_INTERVAL);
}

// ============================================================
// HELPERS
// ============================================================

function sendToAPI(endpoint, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(CONFIG.API_URL + endpoint);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const body = JSON.stringify(data);
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        // SECURITY: server validates X-Bridge-Key with constant-time hash compare.
        // X-Client-Id is just a hint to narrow the lookup — server still verifies.
        'X-Bridge-Key': CONFIG.API_KEY,
        ...(CONFIG.CLIENT_ID ? { 'X-Client-Id': String(CONFIG.CLIENT_ID) } : {})
      }
    };

    const req = client.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(responseBody || '{}'));
        } else {
          reject(new Error(`API ${res.statusCode}: ${responseBody}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.write(body);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Move processed file to processed/ subfolder
 */
function moveToProcessed(filePath, filename) {
  try {
    const processedDir = path.join(CONFIG.WATCH_FOLDER, 'processed');
    if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir, { recursive: true });
    fs.renameSync(filePath, path.join(processedDir, `${Date.now()}_${filename}`));
  } catch (err) {
    console.error(`[FileWatcher] Failed to move ${filename}:`, err.message);
  }
}

// ============================================================
// HL7 MLLP LISTENER
// ============================================================

let mllpServer = null;

function startHL7Listener() {
  if (!CONFIG.HL7_ENABLED || !CONFIG.HL7_PORT) {
    console.log('[HL7] Disabled (HL7_ENABLED=false or HL7_PORT=0)');
    return;
  }

  mllpServer = createMLLPListener({
    port: CONFIG.HL7_PORT,
    host: '0.0.0.0',
    deviceId: CONFIG.HL7_DEVICE_ID || CONFIG.DEFAULT_DEVICE_ID,
    onResult: (result, parsed) => {
      console.log(`[HL7] Result: ${result.testCode} = ${result.value} ${result.unit}`);
      enqueueResult(result);
    },
    onBatch: (results, parsed) => {
      console.log(`[HL7] Batch: ${results.length} results from ${parsed.sendingApp || 'unknown'}`);
      for (const result of results) {
        enqueueResult(result);
      }
    },
    onError: (err) => {
      console.error('[HL7] Error:', err.message);
    },
    onConnection: ({ connId, remoteAddr }) => {
      // SECURITY: drop connection from non-allowlisted IPs
      const ip = (remoteAddr || '').split(':')[0].replace(/^::ffff:/, '');
      if (!isIpAllowed(ip)) {
        console.warn(`[HL7] REJECTED connection #${connId} from ${remoteAddr} (not in allowlist)`);
        try { mllpServer.getConnections?.()?.get?.(connId)?.socket?.destroy(); } catch {}
        return;
      }
      console.log(`[HL7] Device connected: #${connId} from ${remoteAddr}`);
    },
    onDisconnect: ({ connId, remoteAddr, messagesReceived }) => {
      console.log(`[HL7] Device disconnected: #${connId} (${messagesReceived} msgs)`);
    }
  });
}

// ============================================================
// SERIAL PORT LISTENER
// ============================================================

let serialConnection = null;

function startSerialListener() {
  if (!CONFIG.SERIAL_PORT) {
    console.log('[Serial] Disabled (no SERIAL_PORT configured)');
    return;
  }

  if (!createSerialListener) {
    console.error('[Serial] Serial listener module not available');
    console.error('[Serial] Install: npm install serialport');
    return;
  }

  serialConnection = createSerialListener({
    comPort: CONFIG.SERIAL_PORT,
    baudRate: CONFIG.SERIAL_BAUD,
    mode: CONFIG.SERIAL_MODE,
    deviceId: CONFIG.SERIAL_DEVICE_ID || CONFIG.DEFAULT_DEVICE_ID,
    onResult: (result, parsed) => {
      console.log(`[Serial] Result: ${result.testCode} = ${result.value} ${result.unit}`);
      enqueueResult(result);
    },
    onError: (err) => {
      console.error('[Serial] Error:', err.message);
    }
  });
}

// ============================================================
// START
// ============================================================

if (!CONFIG.API_KEY) {
  console.error('❌ MEDLOOP_API_KEY is required. Set it in your environment variables.');
  console.error('   Generate one from MedLoop Admin Panel > Device Settings > API Keys');
  process.exit(1);
}

server.listen(CONFIG.BRIDGE_PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║        MedLoop Clinic Bridge Agent           ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  HTTP Bridge:  port ${String(CONFIG.BRIDGE_PORT).padEnd(25)}║`);
  console.log(`║  HL7 MLLP:    ${CONFIG.HL7_ENABLED ? 'port ' + String(CONFIG.HL7_PORT).padEnd(21) : 'disabled'.padEnd(26)}║`);
  console.log(`║  Serial:      ${(CONFIG.SERIAL_PORT || 'disabled').padEnd(26)}║`);
  console.log(`║  File Watch:  ${(CONFIG.WATCH_FOLDER || 'disabled').substring(0, 26).padEnd(26)}║`);
  console.log(`║  API Target:  ${CONFIG.API_URL.substring(0, 26).padEnd(26)}║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
  console.log('📡 Input Methods:');
  console.log(`  HTTP POST:   http://localhost:${CONFIG.BRIDGE_PORT}/result`);
  console.log(`  HTTP Batch:  http://localhost:${CONFIG.BRIDGE_PORT}/results`);
  console.log(`  Health:      http://localhost:${CONFIG.BRIDGE_PORT}/health`);
  if (CONFIG.HL7_ENABLED) {
    console.log(`  HL7 MLLP:    tcp://localhost:${CONFIG.HL7_PORT} (HL7 v2.x)`);
  }
  if (CONFIG.SERIAL_PORT) {
    console.log(`  Serial:      ${CONFIG.SERIAL_PORT} @ ${CONFIG.SERIAL_BAUD} baud (${CONFIG.SERIAL_MODE} mode)`);
  }
  if (CONFIG.WATCH_FOLDER) {
    console.log(`  File Watch:  ${CONFIG.WATCH_FOLDER} (.json, .hl7, .csv)`);
  }
  console.log('');
});

startFileWatcher();
startHeartbeat();
startHL7Listener();
startSerialListener();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Bridge] Shutting down...');
  if (mllpServer) mllpServer.close();
  if (serialConnection) serialConnection.close();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (mllpServer) mllpServer.close();
  if (serialConnection) serialConnection.close();
  server.close();
  process.exit(0);
});
