import { formatAmmoSubtitle, formatShotgunSpecs, isShotgunAmmo } from './caliberHelpers';

describe('caliberHelpers', () => {
  describe('isShotgunAmmo', () => {
    it('identifies shotgun ammo by caliber or gauge strings', () => {
      expect(isShotgunAmmo({ caliber: '12 Gauge' })).toBe(true);
      expect(isShotgunAmmo({ caliber: '20 Gauge' })).toBe(true);
      expect(isShotgunAmmo({ caliber: '16 ga' })).toBe(true);
      expect(isShotgunAmmo({ caliber: '28 GA' })).toBe(true);
      expect(isShotgunAmmo({ caliber: '.410 Bore' })).toBe(true);
      expect(isShotgunAmmo({ caliber: '410 Gauge' })).toBe(true);
    });

    it('identifies shotgun ammo by category', () => {
      expect(isShotgunAmmo({ category: 'Shotgun', caliber: 'Special Flare' })).toBe(true);
    });

    it('returns false for rifle and pistol calibers', () => {
      expect(isShotgunAmmo({ caliber: '9mm Luger' })).toBe(false);
      expect(isShotgunAmmo({ caliber: '.45 ACP' })).toBe(false);
      expect(isShotgunAmmo({ caliber: '5.56x45mm NATO' })).toBe(false);
      expect(isShotgunAmmo({ caliber: '.308 Winchester' })).toBe(false);
      expect(isShotgunAmmo(null)).toBe(false);
    });

    it('identifies shotgun ammo by raw caliber string', () => {
      expect(isShotgunAmmo('12 Gauge')).toBe(true);
      expect(isShotgunAmmo('20ga')).toBe(true);
      expect(isShotgunAmmo('.410 Bore')).toBe(true);
      expect(isShotgunAmmo('9mm')).toBe(false);
      expect(isShotgunAmmo('')).toBe(false);
      expect(isShotgunAmmo(undefined)).toBe(false);
    });
  });

  describe('formatShotgunSpecs', () => {
    it('formats full specs with shell length, shot size, and pellet count', () => {
      const specs = formatShotgunSpecs({
        shell_length: '2 3/4"',
        shot_size: '00 Buck',
        pellet_count: 9,
      });
      expect(specs.summary).toBe('2 3/4" • 00 Buck • 9 Pellets');
    });

    it('formats specs with shell length, shot size, and oz payload', () => {
      const specs = formatShotgunSpecs({
        shell_length: '2 3/4"',
        shot_size: '#8 Shot',
        oz_payload: '1 1/8 oz',
      });
      expect(specs.summary).toBe('2 3/4" • #8 Shot • 1 1/8 oz');
    });

    it('appends oz unit if missing in oz_payload', () => {
      const specs = formatShotgunSpecs({
        shot_size: 'Slug',
        oz_payload: '1',
      });
      expect(specs.summary).toBe('Slug • 1 oz');
    });

    it('falls back to projectile if no other specs', () => {
      const specs = formatShotgunSpecs({
        projectile: '00 Buckshot',
      });
      expect(specs.summary).toBe('00 Buckshot');
    });
  });

  describe('formatAmmoSubtitle', () => {
    it('formats shotgun shells accurately without ever saying FMJ / Target', () => {
      const sub1 = formatAmmoSubtitle({
        category: 'Shotgun',
        caliber: '12 Gauge',
        shell_length: '2 3/4"',
        shot_size: '00 Buck',
        pellet_count: 9,
      });
      expect(sub1).toBe('2 3/4" • 00 Buck • 9 Pellets');
      expect(sub1).not.toContain('FMJ');

      const sub2 = formatAmmoSubtitle({
        caliber: '12 Gauge',
        shell_length: '3"',
        shot_size: 'Slug',
        oz_payload: '1 oz',
      });
      expect(sub2).toBe('3" • Slug • 1 oz');
      expect(sub2).not.toContain('FMJ');

      const sub3 = formatAmmoSubtitle({
        caliber: '20 Gauge',
      });
      expect(sub3).toBe('Shotgun Shell');
      expect(sub3).not.toContain('FMJ');
    });

    it('formats rifle and pistol ammo accurately', () => {
      expect(
        formatAmmoSubtitle({
          caliber: '9mm Luger',
          grain: 115,
          projectile: 'FMJ',
        })
      ).toBe('115gr FMJ');

      expect(
        formatAmmoSubtitle({
          caliber: '5.56x45mm NATO',
          grain: 62,
          projectile: 'Green Tip M855',
        })
      ).toBe('62gr Green Tip M855');

      expect(
        formatAmmoSubtitle({
          caliber: '.45 ACP',
          grain: 230,
        })
      ).toBe('230gr');
    });
  });
});
