/**
 * Comprehensive Universal AAMVA & Florida DHSMV Driver's License Parser
 * Supports all AAMVA specifications (2000-2026), magnetic tracks, and single-strip 2D barcodes.
 */
export interface ParsedLicenseData {
  firstName: string;
  middleName: string;
  lastName: string;
  fullName: string;
  addressStreet: string;
  city: string;
  state: string;
  zipCode: string;
  licenseNumber: string;
  dateOfBirth: string;
  expirationDate: string;
  rawText: string;
  scanFormat?: string;
  isFull2D: boolean;
}

export function normalizeFloridaName(rawName: string): { firstName: string, middleName: string, lastName: string, fullName: string } {
  let clean = rawName.replace(/^(?:DL|ID)[: -]+/i, '').trim();

  // If "DOE, JOHN MICHAEL" or "DOE, JOHN, M"
  if (clean.includes(',')) {
    const parts = clean.split(',').map(s => s.trim());
    const lastName = parts[0] || '';
    const firstName = parts[1] || '';
    const middleName = parts[2] || '';
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
    return { firstName, middleName, lastName, fullName };
  }

  // If "DOE JOHN MICHAEL" (Last First Middle)
  const tokens = clean.split(/\s+/);
  if (tokens.length === 3) {
    const lastName = tokens[0];
    const firstName = tokens[1];
    const middleName = tokens[2];
    const fullName = `${firstName} ${middleName} ${lastName}`;
    return { firstName, middleName, lastName, fullName };
  } else if (tokens.length === 2) {
    const lastName = tokens[0];
    const firstName = tokens[1];
    const fullName = `${firstName} ${lastName}`;
    return { firstName, middleName: '', lastName, fullName };
  }

  return { firstName: '', middleName: '', lastName: clean, fullName: clean };
}

const ALL_AAMVA_CODES = [
  'DCS', 'DAC', 'DAD', 'DAB', 'DCT', 'DAA', 'DAG', 'DAH', 'DAI', 'DAJ', 'DAK',
  'DAQ', 'DBB', 'DBA', 'DBC', 'DBD', 'DBE', 'DBF', 'DBG', 'DCA', 'DCB', 'DCC',
  'DCD', 'DCE', 'DCF', 'DCG', 'DCH', 'DCI', 'DCJ', 'DCK', 'DCL', 'DCM', 'DCN',
  'DCO', 'DCP', 'DCQ', 'DCR', 'DCU', 'DDA', 'DDB', 'DDC', 'DDD', 'DDE', 'DDF',
  'DDG', 'DDH', 'DDI', 'DDJ', 'DDK', 'DDL', 'PAA', 'PAB', 'PAC', 'PAD', 'ZAA', 'ZAB'
];

export function parseDriverLicenseBarcode(rawBarcode: string): ParsedLicenseData | null {
  if (!rawBarcode || typeof rawBarcode !== 'string' || rawBarcode.trim().length < 2) {
    return null;
  }

  const clean = rawBarcode.trim();
  const fields: Record<string, string> = {};

  // Method 1: Tokenize by standard AAMVA line delimiters
  const lines = clean.split(/[\r\n\x00-\x1f<^|]+/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length >= 4) {
      const match = trimmed.match(/^([A-Z]{3})(.*)$/);
      if (match) {
        const code = match[1];
        const val = match[2].trim();
        if (val && !fields[code]) {
          fields[code] = val;
        }
      }
      if (trimmed.includes('DAQ')) {
        const daqMatch = trimmed.match(/DAQ([A-Za-z0-9-]+)/);
        if (daqMatch && !fields['DAQ']) {
          fields['DAQ'] = daqMatch[1].trim();
        }
      }
    }
  }

  // Method 2: Position-Sorted Index Scanning (Handles non-delimited or continuous single-strip 2D barcodes)
  const occurrences: { code: string; index: number }[] = [];
  for (const code of ALL_AAMVA_CODES) {
    let pos = 0;
    while (pos < clean.length) {
      const idx = clean.indexOf(code, pos);
      if (idx === -1) break;
      occurrences.push({ code, index: idx });
      pos = idx + code.length;
    }
  }

  occurrences.sort((a, b) => a.index - b.index);

  for (let i = 0; i < occurrences.length; i++) {
    const cur = occurrences[i];
    const valStart = cur.index + cur.code.length;
    let valEnd = clean.length;

    if (i + 1 < occurrences.length) {
      valEnd = occurrences[i + 1].index;
    }

    let chunk = clean.substring(valStart, valEnd);
    chunk = chunk.replace(/[\r\n\x00-\x1f<^|,]+$/g, '').replace(/^[\r\n\x00-\x1f<^|,]+/g, '').trim();

    if (chunk && !fields[cur.code]) {
      fields[cur.code] = chunk;
    }
  }

  // Method 3: Regex fallbacks for Core Fields
  const CORE_CODES = ['DAQ', 'DCS', 'DAC', 'DAD', 'DAA', 'DAG', 'DAH', 'DAI', 'DAJ', 'DAK', 'DBB', 'DBA', 'DBC', 'DCF', 'DCT', 'DAB'];
  for (const code of CORE_CODES) {
    if (!fields[code]) {
      const reg = new RegExp(`(?:^|[\\r\\n\\x00-\\x1f<^|])${code}([^\\r\\n\\x00-\\x1f<^|]+)`, 'i');
      const m = clean.match(reg);
      if (m && m[1]) {
        fields[code] = m[1].trim();
      }
    }
  }

  // Method 4: DAQ / DL# Fallback matching Florida pattern
  if (!fields['DAQ']) {
    const daqReg = /DAQ([A-Za-z0-9-]+?)(?=[\r\n\x00-\x1f<^|]|D[A-Z]{2}|$)/i;
    const daqM = clean.match(daqReg);
    if (daqM && daqM[1]) {
      fields['DAQ'] = daqM[1].trim();
    } else {
      const flPattern = /([A-Z]\d{12})/i;
      const flM = clean.match(flPattern);
      if (flM) {
        fields['DAQ'] = flM[1];
      }
    }
  }

  // 1. Name Parsing
  let firstName = fields['DAC'] || fields['DCT'] || '';
  let middleName = fields['DAD'] || '';
  let lastName = fields['DCS'] || fields['DAB'] || '';
  let fullName = '';

  const daa = fields['DAA'];
  if (daa) {
    const norm = normalizeFloridaName(daa);
    if (!lastName) lastName = norm.lastName;
    if (!firstName) firstName = norm.firstName;
    if (!middleName) middleName = norm.middleName;
    fullName = norm.fullName;
  }

  if (!fullName) {
    fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim();
  }

  // 2. Address Parsing
  const street1 = fields['DAG'] || '';
  const street2 = fields['DAH'] || '';
  const addressStreet = [street1, street2].filter(Boolean).join(' ').trim();
  const city = fields['DAI'] || '';
  let state = fields['DAJ'] || (clean.includes('FL') ? 'FL' : '');
  let zipCode = fields['DAK'] || '';
  if (zipCode.length > 5) zipCode = zipCode.slice(0, 5);

  // 3. Date of Birth (DBB)
  const rawDob = fields['DBB'] || '';
  let formattedDob = '';
  if (rawDob) {
    const cleanDob = rawDob.replace(/\D/g, '');
    if (cleanDob.length === 8) {
      if (cleanDob.startsWith('19') || cleanDob.startsWith('20')) {
        formattedDob = `${cleanDob.slice(4, 6)}/${cleanDob.slice(6, 8)}/${cleanDob.slice(0, 4)}`;
      } else {
        formattedDob = `${cleanDob.slice(0, 2)}/${cleanDob.slice(2, 4)}/${cleanDob.slice(4, 8)}`;
      }
    }
  }

  // 4. Expiration Date (DBA)
  const rawExp = fields['DBA'] || '';
  let formattedExp = '';
  if (rawExp) {
    const cleanExp = rawExp.replace(/\D/g, '');
    if (cleanExp.length === 8) {
      if (cleanExp.startsWith('19') || cleanExp.startsWith('20')) {
        formattedExp = `${cleanExp.slice(4, 6)}/${cleanExp.slice(6, 8)}/${cleanExp.slice(0, 4)}`;
      } else {
        formattedExp = `${cleanExp.slice(0, 2)}/${cleanExp.slice(2, 4)}/${cleanExp.slice(4, 8)}`;
      }
    }
  }

  const licenseNumber = fields['DAQ'] || '';
  const isFull2D = Boolean(addressStreet || city || (formattedDob && licenseNumber) || clean.includes('ANSI') || clean.includes('AAMVA'));

  if (fullName || licenseNumber || addressStreet || city) {
    return {
      firstName,
      middleName,
      lastName,
      fullName: fullName || lastName || '',
      addressStreet,
      city,
      state: state || (isFull2D ? 'FL' : ''),
      zipCode,
      licenseNumber,
      dateOfBirth: formattedDob,
      expirationDate: formattedExp,
      rawText: rawBarcode,
      scanFormat: isFull2D ? 'AAMVA 2D PDF417' : '1D Barcode / Partial',
      isFull2D
    };
  }

  // Fallback 1D Barcode with DL# & Name: e.g. "D123456789012 DOE JOHN MICHAEL"
  const fl1DRegex = /^(?:(?:DL|ID|FL)[- :]+)?([A-Z]\d{12}|\d{9}|\d{8}|\d{7})\s+([A-Z\s,.'-]+)$/i;
  const match1D = clean.match(fl1DRegex);
  if (match1D) {
    const lic = match1D[1];
    const rawName = match1D[2].trim();
    const norm = normalizeFloridaName(rawName);
    return {
      firstName: norm.firstName,
      middleName: norm.middleName,
      lastName: norm.lastName,
      fullName: norm.fullName,
      addressStreet: '',
      city: '',
      state: '',
      zipCode: '',
      licenseNumber: lic,
      dateOfBirth: '',
      expirationDate: '',
      rawText: rawBarcode,
      scanFormat: '1D Linear Barcode',
      isFull2D: false
    };
  }

  // Fallback Name Only: e.g. "DL DOE JOHN MICHAEL" or "DOE JOHN MICHAEL"
  const norm = normalizeFloridaName(clean);
  if (norm.fullName && norm.fullName.length > 2) {
    return {
      firstName: norm.firstName,
      middleName: norm.middleName,
      lastName: norm.lastName,
      fullName: norm.fullName,
      addressStreet: '',
      city: '',
      state: '',
      zipCode: '',
      licenseNumber: '',
      dateOfBirth: '',
      expirationDate: '',
      rawText: rawBarcode,
      scanFormat: '1D Barcode (Name Only)',
      isFull2D: false
    };
  }

  return null;
}
