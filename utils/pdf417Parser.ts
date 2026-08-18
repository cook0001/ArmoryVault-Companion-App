/**
 * AAMVA Standard 2D Barcode (PDF417) Parser for Driver's Licenses and State IDs.
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
}

export function parseDriverLicenseBarcode(rawBarcode: string): ParsedLicenseData | null {
  if (!rawBarcode || (!rawBarcode.includes('ANSI ') && !rawBarcode.includes('AAMVA') && !rawBarcode.includes('DAQ'))) {
    return null;
  }

  const getField = (prefix: string): string => {
    const regex = new RegExp(`${prefix}([^\n\r]+)`);
    const match = rawBarcode.match(regex);
    return match ? match[1].trim() : '';
  };

  const firstName = getField('DAC') || getField('DCT') || '';
  const middleName = getField('DAD') || '';
  const lastName = getField('DCS') || getField('DAB') || '';
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');

  const addressStreet = getField('DAG') || '';
  const city = getField('DAI') || '';
  const state = getField('DAJ') || '';
  const zipCode = (getField('DAK') || '').slice(0, 5);
  const licenseNumber = getField('DAQ') || '';

  // Format DOB (YYYYMMDD or MMDDYYYY)
  let rawDob = getField('DBB') || '';
  let formattedDob = rawDob;
  if (rawDob.length === 8) {
    if (rawDob.startsWith('19') || rawDob.startsWith('20')) {
      formattedDob = `${rawDob.slice(4, 6)}/${rawDob.slice(6, 8)}/${rawDob.slice(0, 4)}`;
    } else {
      formattedDob = `${rawDob.slice(0, 2)}/${rawDob.slice(2, 4)}/${rawDob.slice(4, 8)}`;
    }
  }

  // Format Expiration Date
  let rawExp = getField('DBA') || '';
  let formattedExp = rawExp;
  if (rawExp.length === 8) {
    if (rawExp.startsWith('19') || rawExp.startsWith('20')) {
      formattedExp = `${rawExp.slice(4, 6)}/${rawExp.slice(6, 8)}/${rawExp.slice(0, 4)}`;
    } else {
      formattedExp = `${rawExp.slice(0, 2)}/${rawExp.slice(2, 4)}/${rawExp.slice(4, 8)}`;
    }
  }

  return {
    firstName,
    middleName,
    lastName,
    fullName: fullName || lastName,
    addressStreet,
    city,
    state,
    zipCode,
    licenseNumber,
    dateOfBirth: formattedDob,
    expirationDate: formattedExp,
    rawText: rawBarcode
  };
}
