import type { Ammo } from '../types';

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
 * Formats shotgun shell specifications (Shell Length, Shot Size, Pellet Count / Payload) for display.
 */
export const formatShotgunSpecs = (
  ammo?: Partial<Ammo> | null
): {
  shellLength?: string;
  shotSize?: string;
  pelletCount?: string;
  payload?: string;
  summary: string;
} => {
  if (!ammo) return { summary: '' };
  const parts: string[] = [];
  const shellLength = ammo.shell_length ? ammo.shell_length.trim() : undefined;
  const shotSize = ammo.shot_size ? ammo.shot_size.trim() : undefined;
  const pelletCount = ammo.pellet_count ? `${ammo.pellet_count} Pellets` : undefined;
  const payload = ammo.oz_payload
    ? `${ammo.oz_payload}${ammo.oz_payload.toLowerCase().includes('oz') ? '' : ' oz'}`
    : undefined;

  if (shellLength) parts.push(shellLength);
  if (shotSize) parts.push(shotSize);
  if (pelletCount) parts.push(pelletCount);
  else if (payload) parts.push(payload);

  return {
    shellLength,
    shotSize,
    pelletCount,
    payload,
    summary: parts.join(' • ') || ammo.projectile || 'Shotgun Shell',
  };
};

/**
 * Formats the ammo subtitle for inventory cards, lists, and scanners.
 * Shotgun shells: "2 3/4\" • 00 Buck • 9 Pellets" or "1 oz Slug" or "Shotgun Shell".
 * Rifles/Pistols: "115gr FMJ" or "55gr Ball" or "124gr".
 */
export const formatAmmoSubtitle = (ammo?: Partial<Ammo> | null, defaultFallback = ''): string => {
  if (!ammo) return defaultFallback;

  if (isShotgunAmmo(ammo)) {
    const specs = formatShotgunSpecs(ammo);
    if (specs.summary && specs.summary !== 'Shotgun Shell') {
      return specs.summary;
    }
    if (ammo.projectile) return ammo.projectile;
    return defaultFallback || 'Shotgun Shell';
  }

  // Rifle / Pistol / Rimfire
  const grainPart = ammo.grain ? `${ammo.grain}gr ` : '';
  const projPart = ammo.projectile || defaultFallback || (ammo.type === 'handload' ? 'Handload' : '');
  const combined = `${grainPart}${projPart}`.trim();
  return combined || 'Standard Load';
};
