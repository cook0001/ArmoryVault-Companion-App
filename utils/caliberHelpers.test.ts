import {
  formatAmmoSubtitle,
  formatShotgunSpecs,
  formatShotSizeName,
  getPlusPBadgeText,
  getStandardBuckshotPelletCount,
  isPlusPAmmo,
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
      expect(formatShotSizeName('2')).toBe('#2 Game & Field');
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

    it('classifies 15-round packaging as Buckshot and 25-round packaging as Target / Clay', () => {
      const buckSpecs = formatShotgunSpecs({
        caliber: '12 Gauge',
        manufacturer: 'Federal',
        count: 15,
      });
      expect(buckSpecs.shotType).toBe('Buckshot');
      expect(buckSpecs.badgeText).toBe('BUCKSHOT');
      expect(buckSpecs.shotSize).toBe('00 Buckshot');
      expect(buckSpecs.pelletCount).toBe('9 Pellets');

      const targetSpecs = formatShotgunSpecs({
        caliber: '12 Gauge',
        manufacturer: 'Winchester',
        count: 25,
      });
      expect(targetSpecs.shotType).toBe('Target / Clay');
      expect(targetSpecs.badgeText).toBe('TARGET LOAD');
      expect(targetSpecs.shotSize).toBe('#8 Target / Clay');
      expect(targetSpecs.payload).toBe('1 1/8 oz');
    });

    it('never defaults to "Shotgun Shell" for completely unspecified shotgun ammo', () => {
      const specs = formatShotgunSpecs({
        caliber: '12 Gauge',
      });
      expect(specs.shotType).not.toBe('Shotgun Shell');
      expect(specs.shotType).toBe('Target & Field Load');
      expect(specs.badgeText).toBe('TARGET LOAD');
      expect(specs.specLine).not.toContain('Shotgun Shell');
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

  describe('isPlusPAmmo and getPlusPBadgeText', () => {
    it('detects +P when isPlusP boolean is true', () => {
      const ammo = { caliber: '9mm Luger', isPlusP: true };
      expect(isPlusPAmmo(ammo)).toBe(true);
      expect(getPlusPBadgeText(ammo)).toBe('+P');
    });

    it('detects +P when isPlusP is numeric 1 or string "true" or "1"', () => {
      expect(getPlusPBadgeText({ caliber: '9mm Luger', isPlusP: 1 as any })).toBe('+P');
      expect(getPlusPBadgeText({ caliber: '9mm Luger', isPlusP: 'true' as any })).toBe('+P');
      expect(getPlusPBadgeText({ caliber: '9mm Luger', isPlusP: '1' as any })).toBe('+P');
    });

    it('detects +P in UPC code directly adjacent to grain weight numbers', () => {
      const ammo = { caliber: '.45 ACP', upc_code: '45ACP+P200GD20-NI' };
      expect(isPlusPAmmo(ammo)).toBe(true);
      expect(getPlusPBadgeText(ammo)).toBe('+P');
    });

    it('detects +P when specified in caliber string', () => {
      const ammo = { caliber: '9mm +P', isPlusP: false };
      expect(isPlusPAmmo(ammo)).toBe(true);
      expect(getPlusPBadgeText(ammo)).toBe('+P');
    });

    it('detects +P for .45 Colt Ruger-only high pressure loads', () => {
      const ammo1 = { caliber: '.45 Colt', notes: 'Ruger only load' };
      expect(isPlusPAmmo(ammo1)).toBe(true);
      expect(getPlusPBadgeText(ammo1)).toBe('+P');

      const ammo2 = { caliber: '.45 Colt', notes: 'Ruger & T/C only high pressure' };
      expect(isPlusPAmmo(ammo2)).toBe(true);
      expect(getPlusPBadgeText(ammo2)).toBe('+P');
    });

    it('detects +P+ when specified in projectile or notes', () => {
      const ammo1 = { caliber: '9mm Luger', projectile: '115gr JHP +P+' };
      expect(isPlusPAmmo(ammo1)).toBe(true);
      expect(getPlusPBadgeText(ammo1)).toBe('+P+');

      const ammo2 = { caliber: '9mm Luger', notes: 'High velocity +P+ law enforcement load' };
      expect(isPlusPAmmo(ammo2)).toBe(true);
      expect(getPlusPBadgeText(ammo2)).toBe('+P+');
    });

    it('detects "Plus P" phrasing', () => {
      const ammo = { caliber: '.38 Special', projectile: '125gr Plus P' };
      expect(isPlusPAmmo(ammo)).toBe(true);
      expect(getPlusPBadgeText(ammo)).toBe('+P');
    });

    it('returns false/null for standard non-+P ammunition', () => {
      expect(isPlusPAmmo({ caliber: '9mm Luger' })).toBe(false);
      expect(getPlusPBadgeText({ caliber: '9mm Luger' })).toBeNull();
      expect(getPlusPBadgeText({ caliber: '9mm Luger', isPlusP: false })).toBeNull();
      expect(getPlusPBadgeText({ caliber: '9mm Luger', isPlusP: 0 as any })).toBeNull();
      expect(isPlusPAmmo(null)).toBe(false);
      expect(getPlusPBadgeText(null)).toBeNull();
      expect(isPlusPAmmo(undefined)).toBe(false);
      expect(getPlusPBadgeText(undefined)).toBeNull();
    });
  });
});

