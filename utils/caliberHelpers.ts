import type { Ammo } from '../types';

/**
 * Shotgun Shell Types
 */
export type ShotgunShellType =
  | 'Buckshot'
  | 'Target / Clay'
  | 'Birdshot / Field'
  | 'Waterfowl'
  | 'Slug'
  | 'Turkey'
  | 'Shotgun Shell';

export interface ShotgunSpecs {
  shellLength?: string;
  shotSize?: string;
  shotType: ShotgunShellType;
  badgeText: string;
  pelletCount?: string; // Strictly for Buckshot per user instruction
  payload?: string;     // Specifically for Birdshot / Target / Clays / Slugs
  summary: string;
  specLine: string;
}

/**
 * Standard pellet count reference for common buckshot loads.
 */
export const getStandardBuckshotPelletCount = (
  caliber?: string,
  shellLength?: string,
  shotSize?: string
): number | undefined => {
  if (!caliber && !shotSize) return undefined;
  const cal = (caliber || '').toLowerCase();
  const len = (shellLength || '').trim().replace(/"/g, '');
  const shot = (shotSize || '').trim().toLowerCase();

  const isSuperMag = len.includes('3 1/2') || len.includes('3.5');
  const isMagnum = !isSuperMag && /\b3(?!\/|\s*1\/2)/.test(len);

  if (cal.includes('12') || !cal) {
    if (shot.includes('000 buck') || shot === '000') {
      return isMagnum ? 10 : 8;
    }
    if (shot.includes('00 buck') || shot === '00') {
      if (isSuperMag) return 15;
      if (isMagnum) return 12;
      return 9;
    }
    if (shot.includes('0 buck') || shot === '0') return 12;
    if (shot.includes('1 buck') || shot === '1') return isMagnum ? 24 : 16;
    if (shot.includes('4 buck') || shot === '4') return isMagnum ? 41 : 27;
  }
  if (cal.includes('20')) {
    if (shot.includes('2 buck') || shot === '2') return isMagnum ? 18 : 12;
    if (shot.includes('3 buck') || shot === '3') return 20;
    if (shot.includes('4 buck') || shot === '4') return 24;
  }
  if (cal.includes('410')) {
    if (shot.includes('000 buck') || shot === '000') return isMagnum ? 5 : 3;
    if (shot.includes('4 buck') || shot === '4') return 9;
  }
  return undefined;
};

/**
 * Accurately determines if an ammunition item or caliber string represents a shotgun shell.
 */
export const isShotgunAmmo = (ammoOrCaliber?: Partial<Ammo> | string | null): boolean => {
  if (!ammoOrCaliber) return false;
  if (typeof ammoOrCaliber === 'string') {
    const cal = ammoOrCaliber.toLowerCase();
    return (
      cal.includes('ga') ||
      cal.includes('gauge') ||
      cal.includes('.410') ||
      cal.includes('410') ||
      cal.includes('bore')
    );
  }
  if (ammoOrCaliber.category === 'Shotgun') return true;
  const cal = (ammoOrCaliber.caliber || '').toLowerCase();
  return (
    cal.includes('ga') ||
    cal.includes('gauge') ||
    cal.includes('.410') ||
    cal.includes('410') ||
    cal.includes('bore')
  );
};

/**
 * Formats standard shot sizes into user-friendly names.
 */
export const formatShotSizeName = (rawSize: string): string => {
  const s = rawSize.trim();
  const lower = s.toLowerCase();

  // Buckshot
  if (lower === '000 buck' || lower === '000') return '000 Buckshot';
  if (lower === '00 buck' || lower === '00') return '00 Buckshot';
  if (lower === '0 buck' || lower === '0') return '0 Buckshot';
  if (lower === '1 buck' || lower === '1') return '1 Buckshot';
  if (lower === '2 buck' || lower === '2') return '2 Buckshot';
  if (lower === '3 buck' || lower === '3') return '3 Buckshot';
  if (lower === '4 buck' || lower === '4') return '4 Buckshot';
  if (lower.includes('buck') && !lower.includes('buckshot')) return s.replace(/buck/i, 'Buckshot');

  // Slugs
  if (lower === 'slug') return 'Rifled Slug';
  if (lower.includes('slug')) return s;

  // Waterfowl
  if (lower === 'bb') return 'BB Shot';
  if (lower === 'bbb') return 'BBB Shot';
  if (lower === 't') return 'T Shot';

  // Target & Clay
  if (lower === '7 1/2' || lower === '7.5') return '#7 1/2 Target';
  if (lower === '8' || lower === '#8') return '#8 Target / Clay';
  if (lower === '8 1/2' || lower === '8.5') return '#8 1/2 Target';
  if (lower === '9' || lower === '#9') return '#9 Skeet';

  // Game & Field
  if (lower === '2' || lower === '#2') return '#2 Game & Field';
  if (lower === '4' || lower === '#4') return '#4 Game & Field';
  if (lower === '5' || lower === '#5') return '#5 Game & Field';
  if (lower === '6' || lower === '#6') return '#6 Game & Field';

  return s;
};

/**
 * Classifies shotgun ammunition into specific types and extracts full specs.
 */
export const formatShotgunSpecs = (ammo?: Partial<Ammo> | null): ShotgunSpecs => {
  if (!ammo) {
    return {
      shotType: 'Shotgun Shell',
      badgeText: 'SHOTGUN',
      summary: 'Shotgun Shell',
      specLine: 'Shotgun Shell',
    };
  }

  // Combine text fields to search for embedded clues if direct fields are absent
  const textCorpus = `${ammo.shot_size || ''} ${ammo.projectile || ''} ${ammo.notes || ''} ${ammo.caliber || ''}`.toLowerCase();

  // 1. Shell Length
  let shellLength = ammo.shell_length?.trim();
  if (!shellLength) {
    if (textCorpus.includes('3 1/2') || textCorpus.includes('3.5"')) shellLength = '3 1/2"';
    else if (textCorpus.includes('2 3/4') || textCorpus.includes('2.75"')) shellLength = '2 3/4"';
    else if (textCorpus.includes('1 3/4') || textCorpus.includes('1.75"')) shellLength = '1 3/4"';
    else if (textCorpus.includes('2 1/2') || textCorpus.includes('2.5"')) shellLength = '2 1/2"';
    else if (/\b3"/i.test(textCorpus) || /\b3\s*inch\b/i.test(textCorpus)) shellLength = '3"';
  }

  // 2. Shot Size & Classification
  let shotSize = ammo.shot_size?.trim();
  let shotType: ShotgunShellType = 'Shotgun Shell';

  // Detect Slugs
  if (textCorpus.includes('slug') || textCorpus.includes('sabot') || textCorpus.includes('brenneke')) {
    shotType = 'Slug';
    if (!shotSize) {
      if (textCorpus.includes('sabot')) shotSize = 'Sabot Slug';
      else if (textCorpus.includes('rifled')) shotSize = 'Rifled Slug';
      else shotSize = 'Slug';
    }
  }
  // Detect Buckshot
  else if (
    textCorpus.includes('buck') ||
    /\b00\b/.test(textCorpus) ||
    /\b000\b/.test(textCorpus) ||
    /\b0 buck\b/.test(textCorpus) ||
    /\b1 buck\b/.test(textCorpus) ||
    /\b4 buck\b/.test(textCorpus)
  ) {
    shotType = 'Buckshot';
    if (!shotSize) {
      if (textCorpus.includes('000')) shotSize = '000 Buck';
      else if (textCorpus.includes('00')) shotSize = '00 Buck';
      else if (textCorpus.includes('0 buck')) shotSize = '0 Buck';
      else if (textCorpus.includes('1 buck')) shotSize = '1 Buck';
      else if (textCorpus.includes('2 buck')) shotSize = '2 Buck';
      else if (textCorpus.includes('3 buck')) shotSize = '3 Buck';
      else if (textCorpus.includes('4 buck')) shotSize = '4 Buck';
      else shotSize = 'Buckshot';
    }
  }
  // Detect Turkey Loads
  else if (textCorpus.includes('turkey') || textCorpus.includes('tss')) {
    shotType = 'Turkey';
    if (!shotSize) {
      if (textCorpus.includes('#9') || textCorpus.includes('9')) shotSize = '#9 TSS Turkey';
      else if (textCorpus.includes('#7') || textCorpus.includes('7')) shotSize = '#7 TSS Turkey';
      else shotSize = 'Turkey Load';
    }
  }
  // Detect Waterfowl Loads
  else if (
    textCorpus.includes('waterfowl') ||
    textCorpus.includes('steel') ||
    /\bbb\b/.test(textCorpus) ||
    /\bbbb\b/.test(textCorpus)
  ) {
    shotType = 'Waterfowl';
    if (!shotSize) {
      if (textCorpus.includes('bbb')) shotSize = 'BBB';
      else if (textCorpus.includes('bb')) shotSize = 'BB';
      else shotSize = 'Waterfowl Steel';
    }
  }
  // Detect Target & Clay Loads
  else if (
    textCorpus.includes('target') ||
    textCorpus.includes('clay') ||
    textCorpus.includes('skeet') ||
    textCorpus.includes('trap') ||
    textCorpus.includes('7 1/2') ||
    textCorpus.includes('7.5') ||
    /\b#?8\b/.test(textCorpus) ||
    /\b#?9\b/.test(textCorpus)
  ) {
    shotType = 'Target / Clay';
    if (!shotSize) {
      if (textCorpus.includes('7 1/2') || textCorpus.includes('7.5')) shotSize = '7 1/2';
      else if (textCorpus.includes('8')) shotSize = '8';
      else if (textCorpus.includes('9')) shotSize = '9';
      else shotSize = 'Target / Clay';
    }
  }
  // Detect Game / Field Birdshot
  else if (
    textCorpus.includes('field') ||
    textCorpus.includes('game') ||
    textCorpus.includes('upland') ||
    textCorpus.includes('dove') ||
    /\b#?4\b/.test(textCorpus) ||
    /\b#?5\b/.test(textCorpus) ||
    /\b#?6\b/.test(textCorpus)
  ) {
    shotType = 'Birdshot / Field';
    if (!shotSize) {
      if (textCorpus.includes('6')) shotSize = '6';
      else if (textCorpus.includes('5')) shotSize = '5';
      else if (textCorpus.includes('4')) shotSize = '4';
      else shotSize = 'Field Load';
    }
  } else if (ammo.projectile) {
    shotSize = ammo.projectile;
  }

  // 3. Pellet Count (Specifically for Buckshot per user instruction)
  let pelletCountStr: string | undefined;
  if (shotType === 'Buckshot') {
    let countNum = ammo.pellet_count;
    if (!countNum) {
      const match = textCorpus.match(/(\d+)\s*(?:pellet|plts|pl)/i);
      if (match) {
        countNum = parseInt(match[1], 10);
      } else {
        countNum = getStandardBuckshotPelletCount(ammo.caliber, shellLength, shotSize);
      }
    }
    if (countNum) {
      pelletCountStr = `${countNum} Pellets`;
    }
  }

  // 4. Payload Weight (for Birdshot, Target, Slugs, Waterfowl, Turkey)
  let payloadStr = ammo.oz_payload?.trim();
  if (!payloadStr) {
    const match = textCorpus.match(/(\d+(?:\s+\d+\/\d+|\/\d+|\.\d+)?)\s*oz/i);
    if (match) {
      payloadStr = `${match[1]} oz`;
    }
  } else if (!payloadStr.toLowerCase().includes('oz')) {
    payloadStr = `${payloadStr} oz`;
  }

  // Determine Badge Text
  let badgeText = 'SHOTGUN';
  if (shotType === 'Buckshot') badgeText = 'BUCKSHOT';
  else if (shotType === 'Slug') badgeText = 'SLUG';
  else if (shotType === 'Target / Clay') badgeText = 'TARGET LOAD';
  else if (shotType === 'Birdshot / Field') badgeText = 'BIRDSHOT';
  else if (shotType === 'Waterfowl') badgeText = 'WATERFOWL';
  else if (shotType === 'Turkey') badgeText = 'TURKEY LOAD';

  // Format Display Names
  const formattedShotName = shotSize ? formatShotSizeName(shotSize) : undefined;

  // Build Summary String (e.g. 2 3/4" • 00 Buckshot • 9 Pellets)
  const summaryParts: string[] = [];
  if (shellLength) summaryParts.push(shellLength);
  if (formattedShotName) summaryParts.push(formattedShotName);
  if (shotType === 'Buckshot' && pelletCountStr) {
    summaryParts.push(pelletCountStr);
  } else if (payloadStr) {
    summaryParts.push(payloadStr);
  }

  const summary = summaryParts.join(' • ') || (shotType !== 'Shotgun Shell' ? shotType : 'Shotgun Shell');

  // Build SpecLine (e.g. "00 Buckshot (9 Pellets)" or "#8 Target (1 1/8 oz)" or "1 oz Rifled Slug")
  let specLine = formattedShotName || shotType;
  if (shotType === 'Buckshot' && pelletCountStr) {
    specLine = `${specLine} (${pelletCountStr})`;
  } else if (payloadStr) {
    if (shotType === 'Slug' && !specLine.includes(payloadStr)) {
      specLine = `${payloadStr} ${specLine}`;
    } else {
      specLine = `${specLine} (${payloadStr})`;
    }
  }

  return {
    shellLength,
    shotSize: formattedShotName || shotSize,
    shotType,
    badgeText,
    pelletCount: pelletCountStr,
    payload: payloadStr,
    summary,
    specLine,
  };
};

/**
 * Formats the ammo subtitle for inventory cards, lists, and scanners to match Desktop ArmoryVault.
 * Shotgun: "Federal - 00 Buckshot (9 Pellets)" or "Winchester - #8 Target (1 1/8 oz)" or "2 3/4\" • 1 oz Rifled Slug".
 * Handload: "00 Buckshot - Blue Dot (22gr)" or "115gr JHP - Power Pistol (5.8gr)".
 * Cartridges: "115gr FMJ" or "Federal - 55gr XM193".
 */
export const formatAmmoSubtitle = (ammo?: Partial<Ammo> | null, defaultFallback = ''): string => {
  if (!ammo) return defaultFallback;

  if (isShotgunAmmo(ammo)) {
    const specs = formatShotgunSpecs(ammo);
    const mfg = ammo.manufacturer?.trim();

    if (ammo.type === 'handload') {
      const loadPart = specs.specLine || specs.summary;
      const powderPart = ammo.powder
        ? ` - ${ammo.powder}${ammo.powderCharge ? ` (${ammo.powderCharge}gr)` : ''}`
        : '';
      return `${loadPart}${powderPart}`.trim();
    }

    if (mfg) {
      return `${mfg} - ${specs.specLine}`.trim();
    }
    return specs.summary || defaultFallback || 'Shotgun Shell';
  }

  // Rifle / Pistol / Rimfire
  const mfg = ammo.manufacturer?.trim();
  const grainPart = ammo.grain ? `${ammo.grain}gr ` : '';
  const projPart = ammo.projectile || defaultFallback || (ammo.type === 'handload' ? 'Handload' : '');

  if (ammo.type === 'handload') {
    const bulletPart = `${ammo.bullet_manufacturer ? `${ammo.bullet_manufacturer} ` : ''}${grainPart}${projPart}`.trim();
    const powderPart = ammo.powder
      ? ` - ${ammo.powder}${ammo.powderCharge ? ` (${ammo.powderCharge}gr)` : ''}`
      : '';
    return `${bulletPart}${powderPart}`.trim() || 'Handload';
  }

  const combined = `${grainPart}${projPart}`.trim();
  if (mfg && combined) {
    return `${mfg} - ${combined}`;
  }
  return combined || defaultFallback || 'Standard Load';
};
