import { SyncQueueItem } from '../types';

export interface DepletionResult {
  remaining: number;
  exceedsStock: boolean;
  actualDepleted: number;
}

/**
 * Resolves a scanned barcode or QR code string against cached ammunition inventory.
 * Supports:
 * - Direct ID format: `AV-AMMO-12` or `armoryvault://ammo/12`
 * - Direct numeric ID: `12`
 * - Commercial UPC-A / EAN barcodes: `ammo.upc_code === code`
 * - Custom SKU dictionary matching: `skus[code]`
 */
export function resolveScannedAmmo(
  code: string,
  ammoList: any[],
  skus: Record<string, any> = {}
): any | null {
  if (!code || !Array.isArray(ammoList)) return null;
  const cleanData = code.trim();

  // 1. Check direct Ammo ID URI schemes
  let targetId: string | null = null;
  if (cleanData.startsWith('AV-AMMO-')) {
    targetId = cleanData.replace('AV-AMMO-', '').trim();
  } else if (cleanData.startsWith('armoryvault://ammo/')) {
    targetId = cleanData.replace('armoryvault://ammo/', '').trim();
  }

  if (targetId) {
    const found = ammoList.find((a) => String(a.id) === targetId);
    if (found) return found;
  }

  // 2. Check by exact UPC barcode or numeric ID
  const foundByUpcOrId = ammoList.find(
    (a) => a.upc_code === cleanData || String(a.id) === cleanData
  );
  if (foundByUpcOrId) return foundByUpcOrId;

  // 3. Check custom SKU dictionary
  if (skus && skus[cleanData]) {
    const sku = skus[cleanData];
    const foundBySku = ammoList.find(
      (a) =>
        a.caliber === sku.caliber &&
        (a.manufacturer === sku.manufacturer || a.name === sku.name)
    );
    if (foundBySku) return foundBySku;
  }

  return null;
}

/**
 * Computes remaining stock and validates if requested depletion exceeds recorded vault stock.
 */
export function calculateStockDepletion(
  currentStock: number,
  depleteAmount: number
): DepletionResult {
  const stock = Math.max(0, Number(currentStock) || 0);
  const amount = Math.max(0, Number(depleteAmount) || 0);
  const remaining = Math.max(0, stock - amount);
  const exceedsStock = amount > stock;

  return {
    remaining,
    exceedsStock,
    actualDepleted: amount,
  };
}

/**
 * Returns sensible default rounds per box based on caliber.
 * E.g., Rifle & Shotgun rounds are typically packaged in 20 or 25 round boxes;
 * Handgun/pistol calibers in 50 round boxes.
 */
export function getDefaultDepleteAmount(caliber?: string): number {
  if (!caliber) return 50;
  const cal = caliber.toLowerCase().trim();
  const isRifleOrShotgun =
    cal.includes('5.56') ||
    cal.includes('.223') ||
    cal.includes('.308') ||
    cal.includes('6.5') ||
    cal.includes('7.62') ||
    cal.includes('30-06') ||
    cal.includes('12 gauge') ||
    cal.includes('20 gauge') ||
    cal.includes('gauge') ||
    cal.includes('.300 win');

  return isRifleOrShotgun ? 20 : 50;
}

/**
 * Formats a clean sync item payload for ammo depletion to sync with Desktop.
 */
export function buildAmmoDepletionSyncItem(params: {
  ammoId: number | string;
  count: number;
  caliber?: string;
  manufacturer?: string;
  firearmId?: number;
  firearmName?: string;
}): SyncQueueItem {
  const notes = params.firearmName
    ? `Fired ${params.count} rds through ${params.firearmName}`
    : `Rapid bench depletion: -${params.count} rds`;

  return {
    type: 'ammo_adjustment',
    upcOrId: String(params.ammoId),
    action: 'remove',
    count: params.count,
    measurement: 'rds',
    firearmId: params.firearmId || undefined,
    firearm_id: params.firearmId || undefined,
    timestamp: new Date().toISOString(),
    notes,
    data: {
      caliber: params.caliber,
      manufacturer: params.manufacturer,
      firearmId: params.firearmId || undefined,
      rounds_fired: params.count,
    },
  };
}
