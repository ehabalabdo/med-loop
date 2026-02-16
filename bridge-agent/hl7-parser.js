/**
 * HL7 v2.x Parser
 * 
 * Parses HL7 v2.x pipe-delimited messages into structured JSON.
 * Supports message types: ORU^R01 (lab results), ADT (patient), ORM (orders).
 * 
 * HL7 v2.x Structure:
 *   MSH — Message Header (sender, receiver, type, timestamp)
 *   PID — Patient Identification (ID, name, DOB, gender)
 *   OBR — Observation Request (order info, test panel)
 *   OBX — Observation Result (individual test result)
 *   NK1 — Next of Kin
 *   PV1 — Patient Visit
 * 
 * MLLP Framing:
 *   \x0B (VT) + HL7 message + \x1C (FS) + \x0D (CR)
 */

// MLLP frame characters
const MLLP_START = '\x0B';  // Vertical Tab - Start Block
const MLLP_END = '\x1C';    // File Separator - End Block  
const MLLP_CR = '\x0D';     // Carriage Return

// HL7 default delimiters
const DEFAULT_FIELD_SEP = '|';
const DEFAULT_COMPONENT_SEP = '^';
const DEFAULT_REPETITION_SEP = '~';
const DEFAULT_ESCAPE_CHAR = '\\';
const DEFAULT_SUBCOMPONENT_SEP = '&';

/**
 * Parse a raw HL7 v2.x message string into a structured object
 */
function parseHL7Message(rawMessage) {
  // Strip MLLP framing if present
  let message = rawMessage;
  if (message.startsWith(MLLP_START)) message = message.substring(1);
  if (message.endsWith(MLLP_CR)) message = message.slice(0, -1);
  if (message.endsWith(MLLP_END)) message = message.slice(0, -1);
  message = message.trim();

  if (!message.startsWith('MSH')) {
    throw new Error('Invalid HL7 message: must start with MSH segment');
  }

  // Extract delimiter from MSH segment (character at position 3)
  const fieldSep = message.charAt(3) || DEFAULT_FIELD_SEP;
  const encodingChars = message.substring(4, 8);
  const componentSep = encodingChars[0] || DEFAULT_COMPONENT_SEP;
  const repetitionSep = encodingChars[1] || DEFAULT_REPETITION_SEP;
  const escapeChar = encodingChars[2] || DEFAULT_ESCAPE_CHAR;
  const subcomponentSep = encodingChars[3] || DEFAULT_SUBCOMPONENT_SEP;

  const delimiters = { fieldSep, componentSep, repetitionSep, escapeChar, subcomponentSep };

  // Split into segments (by \r, \n, or \r\n)
  const segmentLines = message.split(/\r\n|\r|\n/).filter(line => line.trim().length > 0);

  const parsed = {
    raw: rawMessage,
    delimiters,
    segments: {},
    msh: null,
    pid: null,
    obr: [],
    obx: [],
    pv1: null,
    messageType: '',
    messageId: '',
    timestamp: '',
    sendingApp: '',
    sendingFacility: ''
  };

  for (const line of segmentLines) {
    const segmentType = line.substring(0, 3);
    const fields = splitHL7Fields(line, fieldSep, segmentType === 'MSH');

    // Store raw segment
    if (!parsed.segments[segmentType]) parsed.segments[segmentType] = [];
    parsed.segments[segmentType].push(fields);

    switch (segmentType) {
      case 'MSH':
        parsed.msh = parseMSH(fields, componentSep);
        parsed.messageType = parsed.msh.messageType;
        parsed.messageId = parsed.msh.messageControlId;
        parsed.timestamp = parsed.msh.dateTime;
        parsed.sendingApp = parsed.msh.sendingApplication;
        parsed.sendingFacility = parsed.msh.sendingFacility;
        break;
      case 'PID':
        parsed.pid = parsePID(fields, componentSep);
        break;
      case 'OBR':
        parsed.obr.push(parseOBR(fields, componentSep));
        break;
      case 'OBX':
        parsed.obx.push(parseOBX(fields, componentSep));
        break;
      case 'PV1':
        parsed.pv1 = parsePV1(fields, componentSep);
        break;
    }
  }

  return parsed;
}

/**
 * Split HL7 fields, handling MSH special case where field separator IS field 1
 */
function splitHL7Fields(segment, fieldSep, isMSH) {
  const parts = segment.split(fieldSep);
  if (isMSH) {
    // MSH is special: MSH|^~\&| — the separator itself is MSH.1
    // So we shift to make MSH.1 = |, MSH.2 = ^~\& 
    return ['MSH', fieldSep, ...parts.slice(1)];
  }
  return parts;
}

/**
 * Split a field into components using ^ separator
 */
function splitComponents(field, componentSep) {
  if (!field) return [];
  return field.split(componentSep || DEFAULT_COMPONENT_SEP);
}

// ============================================================
// SEGMENT PARSERS
// ============================================================

function parseMSH(fields, cs) {
  const msgType = splitComponents(fields[9], cs);
  return {
    fieldSeparator: fields[1],
    encodingCharacters: fields[2],
    sendingApplication: fields[3] || '',
    sendingFacility: fields[4] || '',
    receivingApplication: fields[5] || '',
    receivingFacility: fields[6] || '',
    dateTime: fields[7] || '',
    security: fields[8] || '',
    messageType: msgType.join('^'),      // e.g. "ORU^R01"
    messageTypeCode: msgType[0] || '',   // e.g. "ORU"
    triggerEvent: msgType[1] || '',      // e.g. "R01"
    messageControlId: fields[10] || '',
    processingId: fields[11] || '',
    versionId: fields[12] || '2.5'
  };
}

function parsePID(fields, cs) {
  const patientId = splitComponents(fields[3], cs);
  const patientName = splitComponents(fields[5], cs);
  return {
    setId: fields[1] || '1',
    externalId: fields[2] || '',
    patientId: patientId[0] || fields[3] || '',
    patientIdList: fields[3] || '',
    altPatientId: fields[4] || '',
    // Name: Family^Given^Middle^Suffix^Prefix
    familyName: patientName[0] || '',
    givenName: patientName[1] || '',
    middleName: patientName[2] || '',
    fullName: [patientName[1], patientName[0]].filter(Boolean).join(' '),
    dateOfBirth: fields[7] || '',
    gender: mapGender(fields[8]),
    race: fields[10] || '',
    address: fields[11] || '',
    phone: fields[13] || '',
    email: fields[14] || '',
    mrn: patientId[0] || fields[3] || '' // Medical Record Number
  };
}

function parseOBR(fields, cs) {
  const universalServiceId = splitComponents(fields[4], cs);
  const orderingProvider = splitComponents(fields[16], cs);
  return {
    setId: fields[1] || '1',
    placerOrderNumber: fields[2] || '',
    fillerOrderNumber: fields[3] || '',
    testCode: universalServiceId[0] || '',
    testName: universalServiceId[1] || '',
    priority: fields[5] || '',
    requestedDateTime: fields[6] || '',
    observationDateTime: fields[7] || '',
    collectionDateTime: fields[7] || '',
    resultDateTime: fields[22] || '',
    orderingProviderId: orderingProvider[0] || '',
    orderingProviderName: [orderingProvider[2], orderingProvider[1]].filter(Boolean).join(' '),
    resultStatus: fields[25] || '',  // F=Final, P=Preliminary
    raw: fields
  };
}

function parseOBX(fields, cs) {
  const observationId = splitComponents(fields[3], cs);
  const referenceRange = fields[7] || '';
  const abnormalFlags = fields[8] || '';
  
  return {
    setId: fields[1] || '1',
    valueType: fields[2] || 'NM',       // NM=Numeric, ST=String, TX=Text, CE=Coded
    testCode: observationId[0] || '',
    testName: observationId[1] || '',
    testCodingSystem: observationId[2] || '',
    subId: fields[4] || '',
    value: fields[5] || '',
    unit: splitComponents(fields[6], cs)[0] || '',
    referenceRange: referenceRange,
    abnormalFlags: abnormalFlags,        // N=Normal, H=High, L=Low, HH=Critical High, LL=Critical Low
    isAbnormal: abnormalFlags !== '' && abnormalFlags !== 'N',
    probability: fields[9] || '',
    nature: fields[10] || '',
    resultStatus: fields[11] || 'F',    // F=Final, P=Preliminary, C=Correction
    observationDateTime: fields[14] || '',
    producerId: fields[15] || '',
    raw: fields
  };
}

function parsePV1(fields, cs) {
  const attendingDoctor = splitComponents(fields[7], cs);
  return {
    setId: fields[1] || '1',
    patientClass: fields[2] || '',       // I=Inpatient, O=Outpatient, E=Emergency
    assignedLocation: fields[3] || '',
    admissionType: fields[4] || '',
    attendingDoctorId: attendingDoctor[0] || '',
    attendingDoctorName: [attendingDoctor[2], attendingDoctor[1]].filter(Boolean).join(' '),
    visitNumber: fields[19] || '',
    admitDateTime: fields[44] || ''
  };
}

// ============================================================
// CONVERTERS - HL7 to MedLoop payloads
// ============================================================

/**
 * Convert a parsed HL7 ORU^R01 message into MedLoop device result payloads
 * Returns an array of payloads (one per OBX segment)
 */
function hl7ToDeviceResults(parsed, deviceId) {
  const results = [];
  const patientIdentifier = parsed.pid ? (parsed.pid.mrn || parsed.pid.patientId || parsed.pid.fullName) : '';
  
  for (const obx of parsed.obx) {
    // Skip non-result OBX (e.g., comments)
    if (!obx.testCode || !obx.value) continue;
    // Skip text-only entries that are notes
    if (obx.valueType === 'TX' && !obx.testCode) continue;

    results.push({
      deviceId: deviceId,
      patientIdentifier: patientIdentifier,
      testCode: obx.testCode,
      testName: obx.testName || obx.testCode,
      value: obx.value,
      unit: obx.unit || '',
      referenceRange: obx.referenceRange || '',
      isAbnormal: obx.isAbnormal,
      rawMessage: parsed.raw
    });
  }

  return results;
}

/**
 * Generate an HL7 ACK message (acknowledgement)
 * Devices expect ACK after sending a result
 */
function generateACK(parsedMessage, ackCode, errorMessage) {
  const code = ackCode || 'AA'; // AA=Accept, AE=Error, AR=Reject
  const now = new Date();
  const ts = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');

  const msh = parsedMessage.msh || {};
  
  let ack = '';
  ack += `MSH|^~\\&|MEDLOOP|HQ|${msh.sendingApplication || ''}|${msh.sendingFacility || ''}|${ts}||ACK^${msh.triggerEvent || 'R01'}|ACK_${msh.messageControlId || Date.now()}|P|${msh.versionId || '2.5'}\r`;
  ack += `MSA|${code}|${msh.messageControlId || ''}`;
  
  if (errorMessage) {
    ack += `\rERR|||${errorMessage}`;
  }

  return ack;
}

/**
 * Wrap an HL7 message in MLLP framing for TCP transmission
 */
function wrapMLLP(message) {
  return MLLP_START + message + MLLP_END + MLLP_CR;
}

/**
 * Strip MLLP framing from received data
 */
function stripMLLP(data) {
  let str = data;
  if (typeof data === 'object' && data instanceof Buffer) {
    str = data.toString('utf8');
  }
  if (str.startsWith(MLLP_START)) str = str.substring(1);
  if (str.endsWith(MLLP_CR)) str = str.slice(0, -1);
  if (str.endsWith(MLLP_END)) str = str.slice(0, -1);
  return str.trim();
}

// ============================================================
// HELPERS
// ============================================================

function mapGender(hl7Gender) {
  switch ((hl7Gender || '').toUpperCase()) {
    case 'M': return 'male';
    case 'F': return 'female';
    case 'O': return 'other';
    case 'U': return 'unknown';
    default: return hl7Gender || '';
  }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  parseHL7Message,
  hl7ToDeviceResults,
  generateACK,
  wrapMLLP,
  stripMLLP,
  splitComponents,
  MLLP_START,
  MLLP_END,
  MLLP_CR
};
