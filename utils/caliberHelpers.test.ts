import {
  formatAmmoSubtitle,
  formatShotgunSpecs,
  formatShotSizeName,
  getStandardBuckshotPelletCount,
  isShotgunAmmo,
} from './caliberHelpers';

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

    it('identifies shotgun ammo by raw caliber string', () => {
      expect(isShotgunAmmo('12 Gauge')).toBe(true);
      expect(isShotgunAmmo('20ga')).toBe(true);
      expect(isShotgunAmmo('.410 Bore')).toBe(true);
      expect(isShotgunAmmo('9mm')).toBe(false);
      expect(isShotgunAmmo('')).toBe(false);
      expect(isShotgunAmmo(undefined)).toBe(false);
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
  });

  describe('formatShotSizeName', () => {
    it('formats buckshot shot sizes', () => {
      expect(formatShotSizeName('00 Buck')).toBe('00 Buckshot');
      expect(formatShotSizeName('000 Buck')).toBe('000 Buckshot');
      expect(formatShotSizeName('4 Buck')).toBe('4 Buckshot');
    });

    it('formats slugs', () => {
      expect(formatShotSizeName('Slug')).toBe('Rifled Slug');
      expect(formatShotSizeName('Sabot Slug')).toBe('Sabot Slug');
    });

    it('formats target and birdshot', () => {
      expect(formatShotSizeName('8')).toBe('#8 Target / Clay');
      expect(formatShotSizeName('7 1/2')).toBe('#7 1/2 Target');
      expect(formatShotSizeName('9')).toBe('#9 Skeet');
      expect(formatShotSizeName('6')).toBe('#6 Game & Field');
      expect(formatShotSizeName('BB')).toBe('BB Shot');
    });
  });

  describe('getStandardBuckshotPelletCount', () => {
    it('returns standard pellet counts for 12 Gauge 00 Buck', () => {
      expect(getStandardBuckshotPelletCount('12 Gauge', '2 3/4"', '00 Buck')).toBe(9);
      expect(getStandardBuckshotPelletCount('12 Gauge', '3"', '00 Buck')).toBe(12);
      expect(getStandardBuckshotPelletCount('12 Gauge', '3 1/2"', '00 Buck')).toBe(15);
    });

    it('returns standard pellet counts for 4 Buck', () => {
      expect(getStandardBuckshotPelletCount('12 Gauge', '2 3/4"', '4 Buck')).toBe(27);
    });
  });

  describe('formatShotgunSpecs', () => {
    it('classifies and formats Buckshot with pellet count', () => {
      const specs = formatShotgunSpecs({
        caliber: '12 Gauge',
        shell_length: '2 3/4"',
        shot_size: '00 Buck',
        pellet_count: 9,
      });
      expect(specs.shotType).toBe('Buckshot');
      expect(specs.badgeText).toBe('BUCKSHOT');
      expect(specs.pelletCount).toBe('9 Pellets');
      expect(specs.summary).toBe('2 3/4" • 00 Buckshot • 9 Pellets');
      expect(specs.specLine).toBe('00 Buckshot (9 Pellets)');
    });

    it('classifies and formats Target / Clay loads with payload and NO pellet count', () => {
      const specs = formatShotgunSpecs({
        caliber: '12 Gauge',
        shell_length: '2 3/4"',
        shot_size: '8',
        oz_payload: '1 1/8 oz',
      });
      expect(specs.shotType).toBe('Target / Clay');
      expect(specs.badgeText).toBe('TARGET LOAD');
      expect(specs.pelletCount).toBeUndefined();
      expect(specs.payload).toBe('1 1/8 oz');
      expect(specs.summary).toBe('2 3/4" • #8 Target / Clay • 1 1/8 oz');
      expect(specs.specLine).toBe('#8 Target / Clay (1 1/8 oz)');
    });

    it('classifies and formats Slugs with payload weight and NO pellet count', () => {
      const specs = formatShotgunSpecs({
        caliber: '12 Gauge',
        shell_length: '2 3/4"',
        shot_size: 'Slug',
        oz_payload: '1 oz',
      });
      expect(specs.shotType).toBe('Slug');
      expect(specs.badgeText).toBe('SLUG');
      expect(specs.pelletCount).toBeUndefined();
      expect(specs.payload).toBe('1 oz');
      expect(specs.summary).toBe('2 3/4" • Rifled Slug • 1 oz');
      expect(specs.specLine).toBe('1 oz Rifled Slug');
    });

    it('infers buckshot specifications from projectile and notes when direct fields are missing', () => {
      const specs = formatShotgunSpecs({
        caliber: '12 Gauge',
        projectile: '00 Buckshot',
        notes: '2 3/4 inch 9 pellet defensive shell',
      });
      expect(specs.shotType).toBe('Buckshot');
      expect(specs.shellLength).toBe('2 3/4"');
      expect(specs.pelletCount).toBe('9 Pellets');
      expect(specs.summary).toBe('2 3/4" • 00 Buckshot • 9 Pellets');
    });

    it('infers slug specifications from projectile and notes', () => {
      const specs = formatShotgunSpecs({
        caliber: '12 Gauge',
        projectile: 'Rifled Slug',
        notes: '1 oz hollow point slug',
      });
      expect(specs.shotType).toBe('Slug');
      expect(specs.payload).toBe('1 oz');
      expect(specs.specLine).toBe('1 oz Rifled Slug');
    });
  });

  describe('formatAmmoSubtitle', () => {
    it('formats factory shotgun subtitle matching desktop application', () => {
      const sub = formatAmmoSubtitle({
        manufacturer: 'Federal',
        caliber: '12 Gauge',
        shell_length: '2 3/4"',
        shot_size: '00 Buck',
        pellet_count: 9,
      });
      expect(sub).toBe('Federal - 00 Buckshot (9 Pellets)');
    });

    it('formats target load shotgun subtitle matching desktop application', () => {
      const sub = formatAmmoSubtitle({
        manufacturer: 'Winchester',
        caliber: '12 Gauge',
        shell_length: '2 3/4"',
        shot_size: '8',
        oz_payload: '1 1/8 oz',
      });
      expect(sub).toBe('Winchester - #8 Target / Clay (1 1/8 oz)');
    });

    it('formats slug shotgun subtitle matching desktop application', () => {
      const sub = formatAmmoSubtitle({
        manufacturer: 'Remington',
        caliber: '12 Gauge',
        shell_length: '2 3/4"',
        shot_size: 'Slug',
        oz_payload: '1 oz',
      });
      expect(sub).toBe('Remington - 1 oz Rifled Slug');
    });

    it('formats handload shotgun subtitle', () => {
      const sub = formatAmmoSubtitle({
        caliber: '12 Gauge',
        type: 'handload',
        shell_length: '2 3/4"',
        shot_size: '00 Buck',
        pellet_count: 9,
        powder: 'Blue Dot',
        powderCharge: 24,
      });
      expect(sub).toBe('00 Buckshot (9 Pellets) - Blue Dot (24gr)');
    });

    it('formats rifle and pistol ammo properly', () => {
      expect(
        formatAmmoSubtitle({
          manufacturer: 'Federal',
          caliber: '9mm Luger',
          grain: 124,
          projectile: 'HST JHP',
        })
      ).toBe('Federal - 124gr HST JHP');

      expect(
        formatAmmoSubtitle({
          caliber: '5.56 NATO',
          grain: 62,
          projectile: 'Green Tip',
        })
      ).toBe('62gr Green Tip');
    });
  });
});
