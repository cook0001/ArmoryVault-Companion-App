// Mirror of desktop src/utils/StorageSync.ts — keep capacity logic and URI parsing in sync
export type StorageLocationType =
  | 'Safe'
  | 'Cabinet'
  | 'AmmoCan'
  | 'Case'
  | 'Vehicle'
  | 'Other';

export type StorageCapacityMode = 'firearms' | 'ammo' | 'all';

export interface StorageLocation {
  id?: number;
  name: string;
  type: StorageLocationType;
  capacity?: number;
  capacityMode?: StorageCapacityMode;
  notes?: string;
  firearmIds?: number[];
  accessoryIds?: number[];
  ammoIds?: number[];
  componentIds?: number[];
}

export interface StorageCapacityUtilization {
  mode: StorageCapacityMode;
  used: number;
  max: number | null;
  percent: number | null;
  unitLabel: string;
  isOverCapacity: boolean;
  totalItems: number;
  summaryText: string;
}

export const getStorageTypeDefaultMode = (
  type: StorageLocationType
): StorageCapacityMode => {
  switch (type) {
    case 'Safe':
    case 'Cabinet':
    case 'Case':
    case 'Vehicle':
      return 'firearms';
    case 'AmmoCan':
      return 'ammo';
    case 'Other':
    default:
      return 'all';
  }
};

export const getStorageCapacityUtilization = (
  location: Partial<StorageLocation>,
  firearmsCount: number,
  accessoriesCount: number,
  ammoCount: number,
  componentsCount: number
): StorageCapacityUtilization => {
  const totalItems = firearmsCount + accessoriesCount + ammoCount + componentsCount;
  const mode =
    location.capacityMode ||
    (location.type ? getStorageTypeDefaultMode(location.type) : 'firearms');
  const max = location.capacity && location.capacity > 0 ? location.capacity : null;

  let used = 0;
  let unitLabel = 'Items';

  switch (mode) {
    case 'firearms':
      used = firearmsCount;
      unitLabel = location.type === 'Case' ? 'Firearms' : 'Guns';
      break;
    case 'ammo':
      used = ammoCount;
      unitLabel = 'Ammo Lots';
      break;
    case 'all':
    default:
      used = totalItems;
      unitLabel = 'Items';
      break;
  }

  const percent = max !== null ? Math.round((used / max) * 100) : null;
  const isOverCapacity = max !== null && used > max;

  const parts: string[] = [];
  if (firearmsCount > 0) parts.push(`${firearmsCount} ${firearmsCount === 1 ? 'Gun' : 'Guns'}`);
  if (accessoriesCount > 0) parts.push(`${accessoriesCount} Accs`);
  if (ammoCount > 0) parts.push(`${ammoCount} Ammo`);
  if (componentsCount > 0) parts.push(`${componentsCount} Powders`);

  const summaryText = parts.length > 0 ? parts.join(' • ') : 'Empty';

  return {
    mode,
    used,
    max,
    percent,
    unitLabel,
    isOverCapacity,
    totalItems,
    summaryText,
  };
};

export const parseStorageUri = (input?: string | null): number | null => {
  if (!input || typeof input !== 'string') return null;
  const clean = input.trim();

  // Match armoryvault://storage/{id} or armoryvault://location/{id}
  const avMatch = clean.match(/^armoryvault:\/\/(?:storage|location)\/(\d+)$/i);
  if (avMatch) {
    const id = parseInt(avMatch[1], 10);
    return isNaN(id) ? null : id;
  }

  // Match AV-STORAGE-{id} or AV-LOCATION-{id}
  const avPrefixMatch = clean.match(/^AV-(?:STORAGE|LOCATION)-(\d+)$/i);
  if (avPrefixMatch) {
    const id = parseInt(avPrefixMatch[1], 10);
    return isNaN(id) ? null : id;
  }

  // Match storage:{id} or location:{id} or storage/{id} or location/{id}
  const simpleMatch = clean.match(/^(?:storage|location)[:/](\d+)$/i);
  if (simpleMatch) {
    const id = parseInt(simpleMatch[1], 10);
    return isNaN(id) ? null : id;
  }

  return null;
};
