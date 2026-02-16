/**
 * Serial Port Listener for Medical Devices
 * 
 * Connects to devices via RS-232 serial port (COM port on Windows).
 * Supports two data modes:
 *   1. HL7 mode — device sends HL7 v2.x messages over serial
 *   2. Raw mode — device sends custom delimited data (CSV, proprietary)
 * 
 * Requires: npm install serialport
 * 
 * Common medical device serial settings:
 *   Baud Rate: 9600 (most common), 19200, 38400, 115200
 *   Data Bits: 8
 *   Parity: None
 *   Stop Bits: 1
 *   Flow Control: None or Hardware (RTS/CTS)
 */

let SerialPort;
let ReadlineParser;
let DelimiterParser;

try {
  const sp = require('serialport');
  SerialPort = sp.SerialPort;
  ReadlineParser = sp.ReadlineParser;
  DelimiterParser = sp.DelimiterParser;
} catch (e) {
  // serialport is optional — will check at runtime
}

const { parseHL7Message, hl7ToDeviceResults, MLLP_START, MLLP_END, MLLP_CR } = require('./hl7-parser');

/**
 * Create a serial port listener
 * @param {object} config
 * @param {string} config.comPort - Serial port path (e.g. 'COM3', '/dev/ttyUSB0')
 * @param {number} config.baudRate - Baud rate (default 9600)
 * @param {number} config.dataBits - Data bits (default 8)
 * @param {string} config.parity - Parity: none/even/odd (default 'none')
 * @param {number} config.stopBits - Stop bits: 1 or 2 (default 1)
 * @param {string} config.mode - 'hl7' or 'raw' (default 'hl7')
 * @param {string} config.rawDelimiter - Delimiter for raw mode (default '\n')
 * @param {string} config.deviceId - Device UUID
 * @param {function} config.onResult - Callback for each parsed result
 * @param {function} config.onError - Error callback
 * @param {function} config.onRawLine - Callback for raw serial data (both modes)
 * @param {object} config.rawMapping - Mapping for raw mode: { patientIdIndex, testCodeIndex, valueIndex, unitIndex, ... }
 * @returns {object} { port, close, isOpen }
 */
function createSerialListener(config) {
  if (!SerialPort) {
    console.error('[SERIAL] serialport package is not installed.');
    console.error('[SERIAL] Install it with: npm install serialport');
    console.error('[SERIAL] On Windows, you may also need: npm install @serialport/bindings-cpp');
    if (config.onError) config.onError(new Error('serialport package not installed'));
    return {
      port: null,
      close: () => {},
      isOpen: () => false
    };
  }

  const comPort = config.comPort || 'COM1';
  const baudRate = config.baudRate || 9600;
  const mode = config.mode || 'hl7';
  const deviceId = config.deviceId || '';
  const onResult = config.onResult || (() => {});
  const onError = config.onError || ((err) => console.error('[SERIAL] Error:', err.message));
  const onRawLine = config.onRawLine || null;
  const rawMapping = config.rawMapping || null;

  console.log(`[SERIAL] Opening ${comPort} at ${baudRate} baud (${mode} mode)...`);

  const port = new SerialPort({
    path: comPort,
    baudRate: baudRate,
    dataBits: config.dataBits || 8,
    parity: config.parity || 'none',
    stopBits: config.stopBits || 1,
    autoOpen: true
  });

  let hl7Buffer = '';

  if (mode === 'hl7') {
    // HL7 mode: buffer data and look for MLLP framing or segment markers
    port.on('data', (data) => {
      hl7Buffer += data.toString('utf8');

      // Try MLLP framing first
      let startIdx = hl7Buffer.indexOf(MLLP_START);
      let endIdx = hl7Buffer.indexOf(MLLP_END);

      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        // Complete MLLP message
        const message = hl7Buffer.substring(startIdx + 1, endIdx);
        hl7Buffer = hl7Buffer.substring(endIdx + 1);
        if (hl7Buffer.startsWith(MLLP_CR)) hl7Buffer = hl7Buffer.substring(1);
        processHL7(message, data.toString('utf8'));
        return;
      }

      // Fallback: check for MSH without MLLP framing  
      // Some devices send HL7 over serial without MLLP
      // Detect by looking for double-CR (end of message)
      if (hl7Buffer.includes('MSH|') && (hl7Buffer.endsWith('\r\r') || hl7Buffer.endsWith('\n\n') || hl7Buffer.endsWith('\r\n\r\n'))) {
        const message = hl7Buffer.trim();
        hl7Buffer = '';
        processHL7(message, data.toString('utf8'));
        return;
      }

      // Guard against buffer overflow (max 1MB)
      if (hl7Buffer.length > 1024 * 1024) {
        console.warn('[SERIAL] Buffer overflow, clearing');
        hl7Buffer = '';
      }
    });
  } else {
    // Raw mode: line-by-line parsing
    const delimiter = config.rawDelimiter || '\n';
    const parser = port.pipe(new (delimiter === '\n' ? ReadlineParser : DelimiterParser)({ delimiter }));

    parser.on('data', (line) => {
      const trimmed = (typeof line === 'string' ? line : line.toString('utf8')).trim();
      if (!trimmed) return;

      if (onRawLine) onRawLine(trimmed);

      // If mapping provided, parse the raw line
      if (rawMapping) {
        try {
          const result = parseRawLine(trimmed, rawMapping, deviceId);
          if (result) onResult(result, null);
        } catch (err) {
          console.error('[SERIAL] Raw parse error:', err.message);
          onError(err);
        }
      }
    });
  }

  function processHL7(message, rawData) {
    try {
      const parsed = parseHL7Message(message);
      console.log(`[SERIAL] HL7 ${parsed.messageType} received from ${comPort}`);

      if (parsed.msh && parsed.msh.messageTypeCode === 'ORU') {
        const results = hl7ToDeviceResults(parsed, deviceId);
        console.log(`[SERIAL] Extracted ${results.length} result(s)`);
        for (const result of results) {
          onResult(result, parsed);
        }
      } else {
        console.log(`[SERIAL] Non-ORU message type: ${parsed.messageType} — skipped`);
      }
    } catch (err) {
      console.error('[SERIAL] HL7 parse error:', err.message);
      onError(err);
    }
  }

  // Port events
  port.on('open', () => {
    console.log(`[SERIAL] Port ${comPort} opened successfully at ${baudRate} baud`);
  });

  port.on('error', (err) => {
    console.error(`[SERIAL] Port ${comPort} error:`, err.message);
    onError(err);
  });

  port.on('close', () => {
    console.log(`[SERIAL] Port ${comPort} closed`);
  });

  return {
    port,
    close: () => {
      if (port.isOpen) {
        port.close();
        console.log(`[SERIAL] Closing ${comPort}`);
      }
    },
    isOpen: () => port.isOpen
  };
}

/**
 * Parse a raw delimited line into a device result payload
 * @param {string} line - Raw data line
 * @param {object} mapping - Column mapping
 * @param {string} deviceId - Device UUID
 */
function parseRawLine(line, mapping, deviceId) {
  const sep = mapping.separator || ',';
  const parts = line.split(sep).map(s => s.trim());

  // Validate minimum fields
  if (parts.length < 2) return null;

  const result = {
    deviceId: deviceId,
    patientIdentifier: mapping.patientIdIndex != null ? (parts[mapping.patientIdIndex] || '') : '',
    testCode: mapping.testCodeIndex != null ? (parts[mapping.testCodeIndex] || '') : '',
    testName: mapping.testNameIndex != null ? (parts[mapping.testNameIndex] || '') : '',
    value: mapping.valueIndex != null ? (parts[mapping.valueIndex] || '') : '',
    unit: mapping.unitIndex != null ? (parts[mapping.unitIndex] || '') : '',
    referenceRange: mapping.referenceRangeIndex != null ? (parts[mapping.referenceRangeIndex] || '') : '',
    isAbnormal: false,
    rawMessage: line
  };

  // Detect abnormal by flag column or value comparison
  if (mapping.abnormalFlagIndex != null) {
    const flag = (parts[mapping.abnormalFlagIndex] || '').toUpperCase();
    result.isAbnormal = flag !== '' && flag !== 'N' && flag !== 'NORMAL';
  }

  // Need at least a value
  if (!result.value) return null;

  return result;
}

/**
 * List available serial ports on the system
 */
async function listSerialPorts() {
  if (!SerialPort) {
    console.error('[SERIAL] serialport package not installed');
    return [];
  }
  try {
    const ports = await SerialPort.list();
    return ports.map(p => ({
      path: p.path,
      manufacturer: p.manufacturer || '',
      serialNumber: p.serialNumber || '',
      vendorId: p.vendorId || '',
      productId: p.productId || ''
    }));
  } catch (err) {
    console.error('[SERIAL] Failed to list ports:', err.message);
    return [];
  }
}

module.exports = { createSerialListener, listSerialPorts, parseRawLine };
