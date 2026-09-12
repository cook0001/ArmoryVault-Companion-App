import {
  getStorageCapacityUtilization,
  getStorageTypeDefaultMode,
  parseStorageUri,
  StorageLocation,
} from './storageCapacity';

describe('getStorageTypeDefaultMode', () => {
  it('returns firearms for Safe, Cabinet, Case, Vehicle', () => {
    expect(getStorageTypeDefaultMode('Safe')).toBe('firearms');
    expect(getStorageTypeDefaultMode('Cabinet')).toBe('firearms');
    expect(getStorageTypeDefaultMode('Case')).toBe('firearms');
    expect(getStorageTypeDefaultMode('Vehicle')).toBe('firearms');
  });

  it('returns ammo for AmmoCan', () => {
    expect(getStorageTypeDefaultMode('AmmoCan')).toBe('ammo');
  });

  it('returns all for Other and unknown', () => {
    expect(getStorageTypeDefaultMode('Other')).toBe('all');
  });
});

describe('getStorageCapacityUtilization', () => {
  it('calculates firearms mode for a Safe', () => {
    const loc: Partial<StorageLocation> = { type: 'Safe', capacity: 20 };
    const result = getStorageCapacityUtilization(loc, 5, 3, 2, 1);

    expect(result.mode).toBe('firearms');
    expect(result.used).toBe(5); // Only counts firearms
    expect(result.max).toBe(20);
    expect(result.percent).toBe(25); // 5/20 = 25%
    expect(result.unitLabel).toBe('Guns');
    expect(result.isOverCapacity).toBe(false);
    expect(result.totalItems).toBe(11); // 5+3+2+1
  });

  it('calculates ammo mode for an AmmoCan', () => {
    const loc: Partial<StorageLocation> = { type: 'AmmoCan', capacity: 5 };
    const result = getStorageCapacityUtilization(loc, 0, 0, 3, 0);

    expect(result.mode).toBe('ammo');
    expect(result.used).toBe(3);
    expect(result.max).toBe(5);
    expect(result.percent).toBe(60);
    expect(result.unitLabel).toBe('Ammo Lots');
    expect(result.isOverCapacity).toBe(false);
  });

  it('detects over-capacity', () => {
    const loc: Partial<StorageLocation> = { type: 'Safe', capacity: 3 };
    const result = getStorageCapacityUtilization(loc, 5, 0, 0, 0);

    expect(result.isOverCapacity).toBe(true);
    expect(result.percent).toBe(167); // 5/3 ≈ 167%
  });

  it('handles zero capacity (unlimited)', () => {
    const loc: Partial<StorageLocation> = { type: 'Safe', capacity: 0 };
    const result = getStorageCapacityUtilization(loc, 10, 0, 0, 0);

    expect(result.max).toBeNull();
    expect(result.percent).toBeNull();
    expect(result.isOverCapacity).toBe(false);
  });

  it('handles undefined capacity (unlimited)', () => {
    const loc: Partial<StorageLocation> = { type: 'Cabinet' };
    const result = getStorageCapacityUtilization(loc, 2, 1, 0, 0);

    expect(result.max).toBeNull();
    expect(result.percent).toBeNull();
    expect(result.isOverCapacity).toBe(false);
  });

  it('respects explicit capacityMode override', () => {
    const loc: Partial<StorageLocation> = { type: 'Safe', capacity: 10, capacityMode: 'all' };
    const result = getStorageCapacityUtilization(loc, 2, 3, 4, 1);

    expect(result.mode).toBe('all');
    expect(result.used).toBe(10); // All items: 2+3+4+1
    expect(result.unitLabel).toBe('Items');
  });

  it('uses "Firearms" label for Case type', () => {
    const loc: Partial<StorageLocation> = { type: 'Case', capacity: 4 };
    const result = getStorageCapacityUtilization(loc, 2, 0, 0, 0);

    expect(result.unitLabel).toBe('Firearms');
  });

  it('generates correct summary text', () => {
    const loc: Partial<StorageLocation> = { type: 'Safe', capacity: 20 };
    const result = getStorageCapacityUtilization(loc, 2, 1, 3, 0);

    expect(result.summaryText).toBe('2 Guns • 1 Accs • 3 Ammo');
  });

  it('returns "Empty" summary for empty container', () => {
    const loc: Partial<StorageLocation> = { type: 'Safe', capacity: 10 };
    const result = getStorageCapacityUtilization(loc, 0, 0, 0, 0);

    expect(result.summaryText).toBe('Empty');
    expect(result.used).toBe(0);
    expect(result.percent).toBe(0);
  });
});

describe('parseStorageUri', () => {
  it('parses armoryvault://storage/{id}', () => {
    expect(parseStorageUri('armoryvault://storage/42')).toBe(42);
  });

  it('parses armoryvault://location/{id}', () => {
    expect(parseStorageUri('armoryvault://location/7')).toBe(7);
  });

  it('parses AV-STORAGE-{id}', () => {
    expect(parseStorageUri('AV-STORAGE-15')).toBe(15);
  });

  it('parses AV-LOCATION-{id}', () => {
    expect(parseStorageUri('AV-LOCATION-3')).toBe(3);
  });

  it('parses storage:{id}', () => {
    expect(parseStorageUri('storage:99')).toBe(99);
  });

  it('parses location/{id}', () => {
    expect(parseStorageUri('location/5')).toBe(5);
  });

  it('is case-insensitive', () => {
    expect(parseStorageUri('ARMORYVAULT://STORAGE/10')).toBe(10);
    expect(parseStorageUri('av-storage-20')).toBe(20);
    expect(parseStorageUri('Storage:1')).toBe(1);
  });

  it('trims whitespace', () => {
    expect(parseStorageUri('  armoryvault://storage/5  ')).toBe(5);
  });

  it('returns null for invalid inputs', () => {
    expect(parseStorageUri(null)).toBeNull();
    expect(parseStorageUri(undefined)).toBeNull();
    expect(parseStorageUri('')).toBeNull();
    expect(parseStorageUri('random string')).toBeNull();
    expect(parseStorageUri('armoryvault://storage/')).toBeNull();
    expect(parseStorageUri('armoryvault://storage/abc')).toBeNull();
  });
});
