import {
  resolveScannedAmmo,
  calculateStockDepletion,
  getDefaultDepleteAmount,
  buildAmmoDepletionSyncItem,
} from './ammoDepletion';

describe('resolveScannedAmmo', () => {
  const mockAmmo = [
    { id: 1, caliber: '9mm Luger', manufacturer: 'Federal', count: 350, upc_code: '029465088225' },
    { id: 2, caliber: '5.56x45mm NATO', manufacturer: 'Winchester', count: 500, upc_code: '020892222345' },
    { id: 3, caliber: '.308 Winchester', manufacturer: 'Hornady', count: 120 },
  ];

  const mockSkus = {
    'CUSTOM-9MM-FED': { caliber: '9mm Luger', manufacturer: 'Federal' },
  };

  it('resolves by AV-AMMO QR code', () => {
    const res = resolveScannedAmmo('AV-AMMO-2', mockAmmo);
    expect(res).toBeDefined();
    expect(res?.id).toBe(2);
    expect(res?.caliber).toBe('5.56x45mm NATO');
  });

  it('resolves by armoryvault://ammo/ URI scheme', () => {
    const res = resolveScannedAmmo('armoryvault://ammo/1', mockAmmo);
    expect(res).toBeDefined();
    expect(res?.id).toBe(1);
    expect(res?.caliber).toBe('9mm Luger');
  });

  it('resolves by commercial UPC code', () => {
    const res = resolveScannedAmmo('020892222345', mockAmmo);
    expect(res).toBeDefined();
    expect(res?.id).toBe(2);
  });

  it('resolves by direct numeric ID', () => {
    const res = resolveScannedAmmo('3', mockAmmo);
    expect(res).toBeDefined();
    expect(res?.id).toBe(3);
  });

  it('resolves by custom SKU dictionary match', () => {
    const res = resolveScannedAmmo('CUSTOM-9MM-FED', mockAmmo, mockSkus);
    expect(res).toBeDefined();
    expect(res?.id).toBe(1);
  });

  it('returns null for unknown codes', () => {
    const res = resolveScannedAmmo('UNKNOWN-CODE-999', mockAmmo, mockSkus);
    expect(res).toBeNull();
  });
});

describe('calculateStockDepletion', () => {
  it('correctly calculates remaining stock when depletion is less than stock', () => {
    const res = calculateStockDepletion(500, 50);
    expect(res.remaining).toBe(450);
    expect(res.exceedsStock).toBe(false);
    expect(res.actualDepleted).toBe(50);
  });

  it('flags warning when depletion exceeds stock and clamps remaining to 0', () => {
    const res = calculateStockDepletion(30, 50);
    expect(res.remaining).toBe(0);
    expect(res.exceedsStock).toBe(true);
    expect(res.actualDepleted).toBe(50);
  });

  it('handles exact stock depletion to zero', () => {
    const res = calculateStockDepletion(50, 50);
    expect(res.remaining).toBe(0);
    expect(res.exceedsStock).toBe(false);
  });
});

describe('getDefaultDepleteAmount', () => {
  it('defaults to 20 for rifle and shotgun calibers', () => {
    expect(getDefaultDepleteAmount('5.56 NATO')).toBe(20);
    expect(getDefaultDepleteAmount('.223 Remington')).toBe(20);
    expect(getDefaultDepleteAmount('.308 Winchester')).toBe(20);
    expect(getDefaultDepleteAmount('6.5 Creedmoor')).toBe(20);
    expect(getDefaultDepleteAmount('12 Gauge')).toBe(20);
  });

  it('defaults to 50 for handgun calibers and general', () => {
    expect(getDefaultDepleteAmount('9mm Luger')).toBe(50);
    expect(getDefaultDepleteAmount('.45 ACP')).toBe(50);
    expect(getDefaultDepleteAmount('.40 S&W')).toBe(50);
    expect(getDefaultDepleteAmount('.380 ACP')).toBe(50);
    expect(getDefaultDepleteAmount('')).toBe(50);
  });
});

describe('buildAmmoDepletionSyncItem', () => {
  it('constructs well-formed sync item without firearm', () => {
    const item = buildAmmoDepletionSyncItem({
      ammoId: 1,
      count: 50,
      caliber: '9mm',
      manufacturer: 'Federal',
    });

    expect(item.type).toBe('ammo_adjustment');
    expect(item.action).toBe('remove');
    expect(item.count).toBe(50);
    expect(item.upcOrId).toBe('1');
    expect(item.measurement).toBe('rds');
    expect(item.notes).toContain('Rapid bench depletion: -50 rds');
  });

  it('constructs well-formed sync item with linked firearm', () => {
    const item = buildAmmoDepletionSyncItem({
      ammoId: 2,
      count: 20,
      caliber: '5.56',
      firearmId: 7,
      firearmName: 'Daniel Defense DDM4V7',
    });

    expect(item.firearmId).toBe(7);
    expect(item.notes).toBe('Fired 20 rds through Daniel Defense DDM4V7');
    expect(item.data?.rounds_fired).toBe(20);
  });
});
