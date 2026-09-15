import type {
  BillOfSaleSyncItem,
  FirearmMaintenanceSyncItem,
  OpticZeroUpdateSyncItem,
  RangeSessionSyncItem,
  ComponentAdjustmentSyncItem,
  AmmoAdjustmentSyncItem,
} from '../types';

describe('ArmoryVault Companion Module Payloads & LAN Contract', () => {
  describe('Payload schema validation', () => {
    it('generates a valid bill_of_sale_transfer payload', () => {
      const payload: BillOfSaleSyncItem = {
        type: 'bill_of_sale_transfer',
        timestamp: '2026-09-14T12:00:00.000Z',
        transfer_id: 'BOS-12345',
        firearm_id: 42,
        serial_number: 'SN-987654',
        date: '2026-09-14',
        buyer_name: 'John Doe',
        seller_name: 'Jane Smith',
        sale_price: 750,
        payment_method: 'Cash',
      };

      expect(payload.type).toBe('bill_of_sale_transfer');
      expect(payload.firearm_id).toBe(42);
      expect(payload.sale_price).toBe(750);
    });

    it('generates a valid firearm_maintenance payload', () => {
      const payload: FirearmMaintenanceSyncItem = {
        type: 'firearm_maintenance',
        timestamp: '2026-09-14T12:00:00.000Z',
        firearm_id: 10,
        date: '2026-09-14',
        task_name: 'Deep Clean & Lubricate',
        service_type: 'Cleaning',
        rounds_at_service: 1250,
        notes: 'CLP and bore snake',
      };

      expect(payload.type).toBe('firearm_maintenance');
      expect(payload.rounds_at_service).toBe(1250);
    });

    it('generates a valid optic_zero_update payload', () => {
      const payload: OpticZeroUpdateSyncItem = {
        type: 'optic_zero_update',
        timestamp: '2026-09-14T12:00:00.000Z',
        optic_id: 'opt-5',
        firearm_id: 10,
        zero_distance: 100,
        click_unit: '0.1 MRAD',
        date: '2026-09-14',
      };

      expect(payload.type).toBe('optic_zero_update');
      expect(payload.zero_distance).toBe(100);
      expect(payload.click_unit).toBe('0.1 MRAD');
    });

    it('generates a valid component_adjustment payload', () => {
      const payload: ComponentAdjustmentSyncItem = {
        type: 'component_adjustment',
        timestamp: '2026-09-14T12:00:00.000Z',
        upcOrId: '7001',
        component_id: 7001,
        count: 100,
        action: 'remove',
        measurement: 'rds',
        notes: 'Loaded into 9mm batch',
      };

      expect(payload.type).toBe('component_adjustment');
      expect(payload.action).toBe('remove');
      expect(payload.count).toBe(100);
    });

    it('generates a valid ammo_adjustment payload', () => {
      const payload: AmmoAdjustmentSyncItem = {
        type: 'ammo_adjustment',
        timestamp: '2026-09-14T12:00:00.000Z',
        upcOrId: '9002',
        count: 50,
        action: 'add',
        measurement: 'rds',
        notes: 'Handload Batch: 9mm Subsonic',
      };

      expect(payload.type).toBe('ammo_adjustment');
      expect(payload.action).toBe('add');
      expect(payload.count).toBe(50);
    });
  });

  describe('Multi-candidate QR Code & Auto-reconnect parsing', () => {
    it('correctly parses multi-candidate QR code payloads', () => {
      const rawQr =
        'armoryvault://pair?host=Daniels-MacBook-Pro&ip=192.168.1.189&port=3456&token=test-token&fallbacks=192.168.1.190,10.0.0.5';

      const url = new URL(rawQr.replace('armoryvault://', 'http://dummy.com/'));
      const ip = url.searchParams.get('ip');
      const port = url.searchParams.get('port');
      const token = url.searchParams.get('token');
      const host = url.searchParams.get('host');
      const fallbacksStr = url.searchParams.get('fallbacks');
      const fallbacks = fallbacksStr ? fallbacksStr.split(',').filter(Boolean) : [];

      expect(ip).toBe('192.168.1.189');
      expect(port).toBe('3456');
      expect(token).toBe('test-token');
      expect(host).toBe('Daniels-MacBook-Pro');
      expect(fallbacks).toEqual(['192.168.1.190', '10.0.0.5']);
    });
  });
});
