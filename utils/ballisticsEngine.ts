/**
 * Standard Factory Ammunition Ballistic Profiles & Physics Engine
 */
export interface BarrelPreset {
  label: string;
  lengthInches: number;
}

export interface FactoryAmmoProfile {
  id: string;
  name: string;
  category: 'handgun' | 'rifle' | 'precision' | 'rimfire_shotgun';
  caliber: string;
  bulletWeightGr: number;
  muzzleVelocityFps: number;
  ballisticCoefficientG1: number;
  zeroDistanceYards: number;
  sightHeightInches: number; // e.g. 1.5" for AR, 0.8" for pistol, 1.5" for scoped rifle
  testBarrelLengthInches: number; // Manufacturer standard test barrel length
  fpsPerInch: number; // Empirical velocity change per inch of barrel
  barrelPresets: BarrelPreset[];
  description: string;
}

export const FACTORY_BALLISTIC_PROFILES: FactoryAmmoProfile[] = [
  // ==========================================
  // 1. HANDGUNS & PCCS
  // ==========================================
  {
    id: '9mm_115',
    name: '9mm Luger 115gr FMJ (Standard)',
    category: 'handgun',
    caliber: '9mm',
    bulletWeightGr: 115,
    muzzleVelocityFps: 1180,
    ballisticCoefficientG1: 0.140,
    zeroDistanceYards: 25,
    sightHeightInches: 0.8,
    testBarrelLengthInches: 4.0,
    fpsPerInch: 25,
    barrelPresets: [
      { label: '3.1" (Micro)', lengthInches: 3.1 },
      { label: '3.7" (Compact)', lengthInches: 3.7 },
      { label: '4.0" (Std)', lengthInches: 4.0 },
      { label: '4.5" (Duty)', lengthInches: 4.5 },
      { label: '5.0" (Full)', lengthInches: 5.0 },
      { label: '8.0" (Subgun)', lengthInches: 8.0 },
      { label: '16.0" (PCC)', lengthInches: 16.0 }
    ],
    description: 'Standard 115gr target/range commercial load'
  },
  {
    id: '9mm_124',
    name: '9mm Luger 124gr NATO / FMJ',
    category: 'handgun',
    caliber: '9mm',
    bulletWeightGr: 124,
    muzzleVelocityFps: 1150,
    ballisticCoefficientG1: 0.155,
    zeroDistanceYards: 25,
    sightHeightInches: 0.8,
    testBarrelLengthInches: 4.0,
    fpsPerInch: 25,
    barrelPresets: [
      { label: '3.1" (Micro)', lengthInches: 3.1 },
      { label: '3.7" (Compact)', lengthInches: 3.7 },
      { label: '4.0" (Std)', lengthInches: 4.0 },
      { label: '4.5" (Duty)', lengthInches: 4.5 },
      { label: '5.0" (Full)', lengthInches: 5.0 },
      { label: '8.0" (Subgun)', lengthInches: 8.0 },
      { label: '16.0" (PCC)', lengthInches: 16.0 }
    ],
    description: 'Standard 124gr duty & NATO pressure load'
  },
  {
    id: '9mm_124_p',
    name: '9mm Luger 124gr +P Gold Dot JHP',
    category: 'handgun',
    caliber: '9mm',
    bulletWeightGr: 124,
    muzzleVelocityFps: 1220,
    ballisticCoefficientG1: 0.160,
    zeroDistanceYards: 25,
    sightHeightInches: 0.8,
    testBarrelLengthInches: 4.0,
    fpsPerInch: 28,
    barrelPresets: [
      { label: '3.1" (Micro)', lengthInches: 3.1 },
      { label: '3.7" (Compact)', lengthInches: 3.7 },
      { label: '4.0" (Std)', lengthInches: 4.0 },
      { label: '4.5" (Duty)', lengthInches: 4.5 },
      { label: '5.0" (Full)', lengthInches: 5.0 },
      { label: '16.0" (PCC)', lengthInches: 16.0 }
    ],
    description: 'High-pressure +P defensive hollow point load'
  },
  {
    id: '9mm_147_sub',
    name: '9mm Luger 147gr Subsonic HST',
    category: 'handgun',
    caliber: '9mm',
    bulletWeightGr: 147,
    muzzleVelocityFps: 1000,
    ballisticCoefficientG1: 0.190,
    zeroDistanceYards: 25,
    sightHeightInches: 0.8,
    testBarrelLengthInches: 4.0,
    fpsPerInch: 18,
    barrelPresets: [
      { label: '3.1" (Micro)', lengthInches: 3.1 },
      { label: '4.0" (Std)', lengthInches: 4.0 },
      { label: '4.5" (Duty)', lengthInches: 4.5 },
      { label: '5.0" (Full)', lengthInches: 5.0 },
      { label: '8.0" (Subgun)', lengthInches: 8.0 }
    ],
    description: 'Heavy subsonic suppressor load'
  },
  {
    id: '40sw_165',
    name: '.40 S&W 165gr FMJ',
    category: 'handgun',
    caliber: '.40 S&W',
    bulletWeightGr: 165,
    muzzleVelocityFps: 1150,
    ballisticCoefficientG1: 0.145,
    zeroDistanceYards: 25,
    sightHeightInches: 0.8,
    testBarrelLengthInches: 4.0,
    fpsPerInch: 25,
    barrelPresets: [
      { label: '3.5" (Subcompact)', lengthInches: 3.5 },
      { label: '4.0" (Std)', lengthInches: 4.0 },
      { label: '4.5" (Duty)', lengthInches: 4.5 }
    ],
    description: 'Standard 165gr high velocity .40 load'
  },
  {
    id: '40sw_180',
    name: '.40 S&W 180gr FMJ / JHP',
    category: 'handgun',
    caliber: '.40 S&W',
    bulletWeightGr: 180,
    muzzleVelocityFps: 1000,
    ballisticCoefficientG1: 0.160,
    zeroDistanceYards: 25,
    sightHeightInches: 0.8,
    testBarrelLengthInches: 4.0,
    fpsPerInch: 20,
    barrelPresets: [
      { label: '3.5" (Subcompact)', lengthInches: 3.5 },
      { label: '4.0" (Std)', lengthInches: 4.0 },
      { label: '4.5" (Duty)', lengthInches: 4.5 }
    ],
    description: 'Standard 180gr law enforcement duty specification'
  },
  {
    id: '10mm_180',
    name: '10mm Auto 180gr FMJ (Target)',
    category: 'handgun',
    caliber: '10mm Auto',
    bulletWeightGr: 180,
    muzzleVelocityFps: 1050,
    ballisticCoefficientG1: 0.165,
    zeroDistanceYards: 25,
    sightHeightInches: 0.8,
    testBarrelLengthInches: 4.6,
    fpsPerInch: 25,
    barrelPresets: [
      { label: '3.8" (Compact)', lengthInches: 3.8 },
      { label: '4.6" (Std)', lengthInches: 4.6 },
      { label: '5.0" (Full)', lengthInches: 5.0 },
      { label: '6.0" (Hunter)', lengthInches: 6.0 }
    ],
    description: 'Standard commercial target power 10mm load'
  },
  {
    id: '10mm_200_bear',
    name: '10mm Auto 200gr Hard Cast (Full Power)',
    category: 'handgun',
    caliber: '10mm Auto',
    bulletWeightGr: 200,
    muzzleVelocityFps: 1200,
    ballisticCoefficientG1: 0.185,
    zeroDistanceYards: 50,
    sightHeightInches: 0.8,
    testBarrelLengthInches: 5.0,
    fpsPerInch: 30,
    barrelPresets: [
      { label: '4.0" (Compact)', lengthInches: 4.0 },
      { label: '4.6" (G20)', lengthInches: 4.6 },
      { label: '5.0" (Full)', lengthInches: 5.0 },
      { label: '6.0" (Long Slide)', lengthInches: 6.0 }
    ],
    description: 'Full-power heavy dangerous game / woods defense load'
  },
  {
    id: '45acp_230',
    name: '.45 ACP 230gr Military FMJ',
    category: 'handgun',
    caliber: '.45 ACP',
    bulletWeightGr: 230,
    muzzleVelocityFps: 850,
    ballisticCoefficientG1: 0.185,
    zeroDistanceYards: 25,
    sightHeightInches: 0.8,
    testBarrelLengthInches: 5.0,
    fpsPerInch: 20,
    barrelPresets: [
      { label: '3.3" (Subcompact)', lengthInches: 3.3 },
      { label: '4.0" (Commander)', lengthInches: 4.0 },
      { label: '4.5" (Duty)', lengthInches: 4.5 },
      { label: '5.0" (Gov 1911)', lengthInches: 5.0 }
    ],
    description: 'Standard 230gr military ball specification'
  },
  {
    id: '45acp_185_p',
    name: '.45 ACP 185gr +P JHP',
    category: 'handgun',
    caliber: '.45 ACP',
    bulletWeightGr: 185,
    muzzleVelocityFps: 1100,
    ballisticCoefficientG1: 0.145,
    zeroDistanceYards: 25,
    sightHeightInches: 0.8,
    testBarrelLengthInches: 5.0,
    fpsPerInch: 25,
    barrelPresets: [
      { label: '3.3" (Subcompact)', lengthInches: 3.3 },
      { label: '4.0" (Commander)', lengthInches: 4.0 },
      { label: '5.0" (Gov 1911)', lengthInches: 5.0 }
    ],
    description: 'High velocity +P defensive hollow point'
  },
  {
    id: '380acp_95',
    name: '.380 ACP 95gr FMJ',
    category: 'handgun',
    caliber: '.380 ACP',
    bulletWeightGr: 95,
    muzzleVelocityFps: 950,
    ballisticCoefficientG1: 0.110,
    zeroDistanceYards: 15,
    sightHeightInches: 0.7,
    testBarrelLengthInches: 3.5,
    fpsPerInch: 20,
    barrelPresets: [
      { label: '2.7" (Pocket LCP)', lengthInches: 2.7 },
      { label: '3.5" (Std)', lengthInches: 3.5 },
      { label: '3.8" (Duty)', lengthInches: 3.8 }
    ],
    description: 'Standard pocket pistol self-defense caliber'
  },
  {
    id: '38spl_130',
    name: '.38 Special 130gr FMJ',
    category: 'handgun',
    caliber: '.38 Special',
    bulletWeightGr: 130,
    muzzleVelocityFps: 800,
    ballisticCoefficientG1: 0.130,
    zeroDistanceYards: 20,
    sightHeightInches: 0.8,
    testBarrelLengthInches: 4.0,
    fpsPerInch: 20,
    barrelPresets: [
      { label: '1.87" (Snubnose)', lengthInches: 1.87 },
      { label: '3.0" (Combat)', lengthInches: 3.0 },
      { label: '4.0" (Service)', lengthInches: 4.0 },
      { label: '6.0" (Target)', lengthInches: 6.0 }
    ],
    description: 'Standard target/plinking revolver load'
  },
  {
    id: '357mag_158',
    name: '.357 Magnum 158gr JSP',
    category: 'handgun',
    caliber: '.357 Magnum',
    bulletWeightGr: 158,
    muzzleVelocityFps: 1240,
    ballisticCoefficientG1: 0.170,
    zeroDistanceYards: 50,
    sightHeightInches: 0.8,
    testBarrelLengthInches: 4.0,
    fpsPerInch: 35,
    barrelPresets: [
      { label: '2.5" (Snub)', lengthInches: 2.5 },
      { label: '4.0" (Service)', lengthInches: 4.0 },
      { label: '6.0" (Target)', lengthInches: 6.0 },
      { label: '16.0" (Lever Action)', lengthInches: 16.0 }
    ],
    description: 'Full magnum power revolver and lever action cartridge'
  },
  {
    id: '44mag_240',
    name: '.44 Magnum 240gr JSP',
    category: 'handgun',
    caliber: '.44 Magnum',
    bulletWeightGr: 240,
    muzzleVelocityFps: 1350,
    ballisticCoefficientG1: 0.190,
    zeroDistanceYards: 50,
    sightHeightInches: 0.9,
    testBarrelLengthInches: 7.5,
    fpsPerInch: 35,
    barrelPresets: [
      { label: '4.0" (Mountain)', lengthInches: 4.0 },
      { label: '6.0" (Combat)', lengthInches: 6.0 },
      { label: '7.5" (Hunter)', lengthInches: 7.5 },
      { label: '16.0" (Lever Carbine)', lengthInches: 16.0 }
    ],
    description: 'Heavy hunting and wilderness protection revolver load'
  },
  {
    id: '57x28_40',
    name: '5.7x28mm 40gr Hornady V-MAX',
    category: 'handgun',
    caliber: '5.7x28mm',
    bulletWeightGr: 40,
    muzzleVelocityFps: 2034,
    ballisticCoefficientG1: 0.207,
    zeroDistanceYards: 50,
    sightHeightInches: 0.9,
    testBarrelLengthInches: 4.8,
    fpsPerInch: 40,
    barrelPresets: [
      { label: '4.8" (Five-seveN)', lengthInches: 4.8 },
      { label: '10.4" (P90 SBR)', lengthInches: 10.4 },
      { label: '16.0" (PS90 Carbine)', lengthInches: 16.0 }
    ],
    description: 'High-velocity armor-piercing heritage PDW & handgun round'
  },
  {
    id: '357sig_125',
    name: '.357 SIG 125gr FMJ',
    category: 'handgun',
    caliber: '.357 SIG',
    bulletWeightGr: 125,
    muzzleVelocityFps: 1350,
    ballisticCoefficientG1: 0.155,
    zeroDistanceYards: 25,
    sightHeightInches: 0.8,
    testBarrelLengthInches: 4.0,
    fpsPerInch: 30,
    barrelPresets: [
      { label: '3.6" (Subcompact)', lengthInches: 3.6 },
      { label: '4.0" (Service)', lengthInches: 4.0 },
      { label: '4.5" (Full Size)', lengthInches: 4.5 }
    ],
    description: 'Bottleneck high velocity duty cartridge mimicking .357 Mag'
  },

  // ==========================================
  // 2. CENTERFIRE RIFLES & CARBINES
  // ==========================================
  {
    id: '556_55_m193',
    name: '5.56 NATO / .223 55gr M193',
    category: 'rifle',
    caliber: '5.56 NATO',
    bulletWeightGr: 55,
    muzzleVelocityFps: 3240,
    ballisticCoefficientG1: 0.243,
    zeroDistanceYards: 100,
    sightHeightInches: 2.6, // AR-15 standard height over bore
    testBarrelLengthInches: 20.0,
    fpsPerInch: 38,
    barrelPresets: [
      { label: '7.5" (PDW)', lengthInches: 7.5 },
      { label: '10.5" (CQB)', lengthInches: 10.5 },
      { label: '11.5" (SBR)', lengthInches: 11.5 },
      { label: '14.5" (M4)', lengthInches: 14.5 },
      { label: '16.0" (Carbine)', lengthInches: 16.0 },
      { label: '18.0" (SPR)', lengthInches: 18.0 },
      { label: '20.0" (Rifle)', lengthInches: 20.0 },
      { label: '24.0" (Varmint)', lengthInches: 24.0 }
    ],
    description: 'Standard 55gr military FMJ ball ammo'
  },
  {
    id: '556_62_m855',
    name: '5.56 NATO 62gr M855 Green Tip',
    category: 'rifle',
    caliber: '5.56 NATO',
    bulletWeightGr: 62,
    muzzleVelocityFps: 3020,
    ballisticCoefficientG1: 0.304,
    zeroDistanceYards: 100,
    sightHeightInches: 2.6,
    testBarrelLengthInches: 20.0,
    fpsPerInch: 35,
    barrelPresets: [
      { label: '10.5" (CQB)', lengthInches: 10.5 },
      { label: '11.5" (SBR)', lengthInches: 11.5 },
      { label: '14.5" (M4)', lengthInches: 14.5 },
      { label: '16.0" (Carbine)', lengthInches: 16.0 },
      { label: '20.0" (Rifle)', lengthInches: 20.0 }
    ],
    description: 'Steel penetrator 62gr military duty load'
  },
  {
    id: '556_77_otm',
    name: '5.56 NATO / .223 77gr OTM / MK262',
    category: 'rifle',
    caliber: '5.56 NATO',
    bulletWeightGr: 77,
    muzzleVelocityFps: 2750,
    ballisticCoefficientG1: 0.372,
    zeroDistanceYards: 100,
    sightHeightInches: 2.6,
    testBarrelLengthInches: 20.0,
    fpsPerInch: 30,
    barrelPresets: [
      { label: '11.5" (SBR)', lengthInches: 11.5 },
      { label: '14.5" (M4)', lengthInches: 14.5 },
      { label: '16.0" (Carbine)', lengthInches: 16.0 },
      { label: '18.0" (MK12 SPR)', lengthInches: 18.0 },
      { label: '20.0" (Rifle)', lengthInches: 20.0 }
    ],
    description: 'Heavy precision match load for SPR & DMR'
  },
  {
    id: '300blk_110_sup',
    name: '.300 BLK 110gr V-MAX (Supersonic)',
    category: 'rifle',
    caliber: '.300 Blackout',
    bulletWeightGr: 110,
    muzzleVelocityFps: 2350,
    ballisticCoefficientG1: 0.290,
    zeroDistanceYards: 100,
    sightHeightInches: 2.6,
    testBarrelLengthInches: 16.0,
    fpsPerInch: 25,
    barrelPresets: [
      { label: '5.5" (Rattler)', lengthInches: 5.5 },
      { label: '7.5" (PDW)', lengthInches: 7.5 },
      { label: '9.0" (Optimized)', lengthInches: 9.0 },
      { label: '10.5" (SBR)', lengthInches: 10.5 },
      { label: '16.0" (Carbine)', lengthInches: 16.0 }
    ],
    description: 'High velocity defensive / hunting load'
  },
  {
    id: '300blk_220_sub',
    name: '.300 BLK 220gr OTM (Subsonic)',
    category: 'rifle',
    caliber: '.300 Blackout',
    bulletWeightGr: 220,
    muzzleVelocityFps: 1020,
    ballisticCoefficientG1: 0.608,
    zeroDistanceYards: 100,
    sightHeightInches: 2.6,
    testBarrelLengthInches: 16.0,
    fpsPerInch: 12,
    barrelPresets: [
      { label: '5.5" (Rattler)', lengthInches: 5.5 },
      { label: '7.5" (PDW)', lengthInches: 7.5 },
      { label: '9.0" (Optimized)', lengthInches: 9.0 },
      { label: '10.5" (SBR)', lengthInches: 10.5 },
      { label: '16.0" (Carbine)', lengthInches: 16.0 }
    ],
    description: 'Heavy subsonic round optimized for silencer use'
  },
  {
    id: '762x39_123',
    name: '7.62x39mm 123gr FMJ Ball',
    category: 'rifle',
    caliber: '7.62x39mm',
    bulletWeightGr: 123,
    muzzleVelocityFps: 2360,
    ballisticCoefficientG1: 0.285,
    zeroDistanceYards: 100,
    sightHeightInches: 1.8,
    testBarrelLengthInches: 16.3,
    fpsPerInch: 25,
    barrelPresets: [
      { label: '8.3" (Krink/Mini)', lengthInches: 8.3 },
      { label: '11.5" (Short AK)', lengthInches: 11.5 },
      { label: '16.3" (Standard AK)', lengthInches: 16.3 },
      { label: '20.0" (SKS)', lengthInches: 20.0 }
    ],
    description: 'Standard AK-47 / SKS military carbine load'
  },
  {
    id: '65_grendel_123',
    name: '6.5 Grendel 123gr ELD Match',
    category: 'rifle',
    caliber: '6.5 Grendel',
    bulletWeightGr: 123,
    muzzleVelocityFps: 2580,
    ballisticCoefficientG1: 0.506,
    zeroDistanceYards: 100,
    sightHeightInches: 2.6,
    testBarrelLengthInches: 24.0,
    fpsPerInch: 25,
    barrelPresets: [
      { label: '12.0" (SBR)', lengthInches: 12.0 },
      { label: '16.0" (Carbine)', lengthInches: 16.0 },
      { label: '18.0" (Recce)', lengthInches: 18.0 },
      { label: '20.0" (DMR)', lengthInches: 20.0 },
      { label: '24.0" (Match)', lengthInches: 24.0 }
    ],
    description: 'AR-15 platform long-range cartridge'
  },
  {
    id: '6mm_arc_108',
    name: '6mm ARC 108gr ELD Match',
    category: 'rifle',
    caliber: '6mm ARC',
    bulletWeightGr: 108,
    muzzleVelocityFps: 2750,
    ballisticCoefficientG1: 0.536,
    zeroDistanceYards: 100,
    sightHeightInches: 2.6,
    testBarrelLengthInches: 24.0,
    fpsPerInch: 28,
    barrelPresets: [
      { label: '12.5" (SBR)', lengthInches: 12.5 },
      { label: '16.0" (Carbine)', lengthInches: 16.0 },
      { label: '18.0" (DMR)', lengthInches: 18.0 },
      { label: '20.0" (Match)', lengthInches: 20.0 },
      { label: '24.0" (Long Range)', lengthInches: 24.0 }
    ],
    description: 'Advanced DoD high-BC long range AR-15 round'
  },

  // ==========================================
  // 3. PRECISION & LONG RANGE RIFLES
  // ==========================================
  {
    id: '308_168_bthp',
    name: '.308 Win 168gr BTHP Match',
    category: 'precision',
    caliber: '.308 Win',
    bulletWeightGr: 168,
    muzzleVelocityFps: 2650,
    ballisticCoefficientG1: 0.462,
    zeroDistanceYards: 100,
    sightHeightInches: 1.75,
    testBarrelLengthInches: 24.0,
    fpsPerInch: 25,
    barrelPresets: [
      { label: '16.0" (Patrol)', lengthInches: 16.0 },
      { label: '18.0" (Tactical)', lengthInches: 18.0 },
      { label: '20.0" (Standard)', lengthInches: 20.0 },
      { label: '24.0" (Match)', lengthInches: 24.0 },
      { label: '26.0" (F-Class)', lengthInches: 26.0 }
    ],
    description: 'Standard Gold Medal match precision rifle load'
  },
  {
    id: '308_175_smk',
    name: '.308 Win 175gr Sierra MatchKing (M118LR)',
    category: 'precision',
    caliber: '.308 Win',
    bulletWeightGr: 175,
    muzzleVelocityFps: 2600,
    ballisticCoefficientG1: 0.505,
    zeroDistanceYards: 100,
    sightHeightInches: 1.75,
    testBarrelLengthInches: 24.0,
    fpsPerInch: 22,
    barrelPresets: [
      { label: '16.0" (Patrol)', lengthInches: 16.0 },
      { label: '20.0" (M24)', lengthInches: 20.0 },
      { label: '24.0" (Match)', lengthInches: 24.0 }
    ],
    description: 'Military long-range sniper cartridge specification'
  },
  {
    id: '308_147_m80',
    name: '7.62 NATO / .308 147gr M80 Ball',
    category: 'precision',
    caliber: '.308 Win',
    bulletWeightGr: 147,
    muzzleVelocityFps: 2780,
    ballisticCoefficientG1: 0.398,
    zeroDistanceYards: 100,
    sightHeightInches: 1.75,
    testBarrelLengthInches: 24.0,
    fpsPerInch: 25,
    barrelPresets: [
      { label: '16.0" (Patrol)', lengthInches: 16.0 },
      { label: '20.0" (Rifle)', lengthInches: 20.0 },
      { label: '24.0" (Standard)', lengthInches: 24.0 }
    ],
    description: 'Standard military ball cartridge'
  },
  {
    id: '65_creedmoor_140',
    name: '6.5 Creedmoor 140gr ELD Match',
    category: 'precision',
    caliber: '6.5 Creedmoor',
    bulletWeightGr: 140,
    muzzleVelocityFps: 2710,
    ballisticCoefficientG1: 0.646,
    zeroDistanceYards: 100,
    sightHeightInches: 1.75,
    testBarrelLengthInches: 24.0,
    fpsPerInch: 28,
    barrelPresets: [
      { label: '18.0" (Compact)', lengthInches: 18.0 },
      { label: '20.0" (Standard)', lengthInches: 20.0 },
      { label: '22.0" (Hunter)', lengthInches: 22.0 },
      { label: '24.0" (Match)', lengthInches: 24.0 },
      { label: '26.0" (PRS)', lengthInches: 26.0 }
    ],
    description: 'Ultra-low drag long-range precision match load'
  },
  {
    id: '3006_150_sp',
    name: '.30-06 Springfield 150gr SP',
    category: 'precision',
    caliber: '.30-06 Springfield',
    bulletWeightGr: 150,
    muzzleVelocityFps: 2910,
    ballisticCoefficientG1: 0.338,
    zeroDistanceYards: 100,
    sightHeightInches: 1.75,
    testBarrelLengthInches: 24.0,
    fpsPerInch: 28,
    barrelPresets: [
      { label: '20.0" (Carbine)', lengthInches: 20.0 },
      { label: '22.0" (Hunter)', lengthInches: 22.0 },
      { label: '24.0" (Standard)', lengthInches: 24.0 }
    ],
    description: 'Traditional American big game hunting cartridge'
  },
  {
    id: '300wm_190_smk',
    name: '.300 Win Mag 190gr Sierra MatchKing',
    category: 'precision',
    caliber: '.300 Win Mag',
    bulletWeightGr: 190,
    muzzleVelocityFps: 2900,
    ballisticCoefficientG1: 0.533,
    zeroDistanceYards: 100,
    sightHeightInches: 1.75,
    testBarrelLengthInches: 24.0,
    fpsPerInch: 32,
    barrelPresets: [
      { label: '24.0" (Standard)', lengthInches: 24.0 },
      { label: '26.0" (Long Range)', lengthInches: 26.0 }
    ],
    description: 'Heavy magnum long range precision cartridge'
  },
  {
    id: '338_lapua_250',
    name: '.338 Lapua Mag 250gr Scenar Match',
    category: 'precision',
    caliber: '.338 Lapua',
    bulletWeightGr: 250,
    muzzleVelocityFps: 2950,
    ballisticCoefficientG1: 0.675,
    zeroDistanceYards: 100,
    sightHeightInches: 2.0,
    testBarrelLengthInches: 27.5,
    fpsPerInch: 32,
    barrelPresets: [
      { label: '24.0" (Compact)', lengthInches: 24.0 },
      { label: '27.5" (Standard)', lengthInches: 27.5 },
      { label: '30.0" (ELR)', lengthInches: 30.0 }
    ],
    description: 'Extreme long range 1,500m+ precision sniper load'
  },
  {
    id: '762x54r_148',
    name: '7.62x54mmR 148gr LPS Light Ball',
    category: 'precision',
    caliber: '7.62x54mmR',
    bulletWeightGr: 148,
    muzzleVelocityFps: 2750,
    ballisticCoefficientG1: 0.380,
    zeroDistanceYards: 100,
    sightHeightInches: 1.8,
    testBarrelLengthInches: 24.0,
    fpsPerInch: 25,
    barrelPresets: [
      { label: '20.5" (Carbine)', lengthInches: 20.5 },
      { label: '24.0" (SVD Dragunov)', lengthInches: 24.0 },
      { label: '28.7" (Mosin 91/30)', lengthInches: 28.7 }
    ],
    description: 'Eastern Bloc military sniper and rifle round'
  },
  {
    id: '4570_300_jhp',
    name: '.45-70 Gov 300gr JHP',
    category: 'precision',
    caliber: '.45-70 Gov',
    bulletWeightGr: 300,
    muzzleVelocityFps: 1810,
    ballisticCoefficientG1: 0.207,
    zeroDistanceYards: 100,
    sightHeightInches: 1.5,
    testBarrelLengthInches: 22.0,
    fpsPerInch: 25,
    barrelPresets: [
      { label: '16.5" (Guide Gun)', lengthInches: 16.5 },
      { label: '18.5" (Trapper)', lengthInches: 18.5 },
      { label: '22.0" (Standard)', lengthInches: 22.0 }
    ],
    description: 'Heavy lever-action big bore cartridge'
  },
  {
    id: '50bmg_660_m33',
    name: '.50 BMG 660gr M33 Military Ball',
    category: 'precision',
    caliber: '.50 BMG',
    bulletWeightGr: 660,
    muzzleVelocityFps: 2910,
    ballisticCoefficientG1: 0.670,
    zeroDistanceYards: 200,
    sightHeightInches: 3.0,
    testBarrelLengthInches: 36.0,
    fpsPerInch: 30,
    barrelPresets: [
      { label: '29.0" (Barrett M107)', lengthInches: 29.0 },
      { label: '32.0" (Heavy)', lengthInches: 32.0 },
      { label: '36.0" (Full Length)', lengthInches: 36.0 }
    ],
    description: 'Heavy anti-materiel and extreme distance cartridge'
  },

  // ==========================================
  // 4. RIMFIRE & SHOTGUN
  // ==========================================
  {
    id: '22lr_40_std',
    name: '.22 LR 40gr Standard Velocity (Subsonic)',
    category: 'rimfire_shotgun',
    caliber: '.22 LR',
    bulletWeightGr: 40,
    muzzleVelocityFps: 1070,
    ballisticCoefficientG1: 0.130,
    zeroDistanceYards: 50,
    sightHeightInches: 1.5,
    testBarrelLengthInches: 18.5,
    fpsPerInch: 10,
    barrelPresets: [
      { label: '4.0" (Pistol)', lengthInches: 4.0 },
      { label: '16.0" (Carbine)', lengthInches: 16.0 },
      { label: '18.5" (Rifle)', lengthInches: 18.5 },
      { label: '20.0" (Target)', lengthInches: 20.0 }
    ],
    description: 'Subsonic match and target rimfire ammunition'
  },
  {
    id: '22lr_40_hv',
    name: '.22 LR 40gr High Velocity',
    category: 'rimfire_shotgun',
    caliber: '.22 LR',
    bulletWeightGr: 40,
    muzzleVelocityFps: 1250,
    ballisticCoefficientG1: 0.125,
    zeroDistanceYards: 50,
    sightHeightInches: 1.5,
    testBarrelLengthInches: 18.5,
    fpsPerInch: 15,
    barrelPresets: [
      { label: '4.0" (Pistol)', lengthInches: 4.0 },
      { label: '16.0" (Carbine)', lengthInches: 16.0 },
      { label: '18.5" (Rifle)', lengthInches: 18.5 }
    ],
    description: 'Standard 40gr rimfire target/plinking round'
  },
  {
    id: '22lr_32_stinger',
    name: '.22 LR 32gr CCI Stinger Hyper-Velocity',
    category: 'rimfire_shotgun',
    caliber: '.22 LR',
    bulletWeightGr: 32,
    muzzleVelocityFps: 1640,
    ballisticCoefficientG1: 0.105,
    zeroDistanceYards: 50,
    sightHeightInches: 1.5,
    testBarrelLengthInches: 18.5,
    fpsPerInch: 22,
    barrelPresets: [
      { label: '4.0" (Pistol)', lengthInches: 4.0 },
      { label: '16.0" (Carbine)', lengthInches: 16.0 },
      { label: '18.5" (Rifle)', lengthInches: 18.5 }
    ],
    description: 'Ultra-high velocity varmint rimfire cartridge'
  },
  {
    id: '22wmr_40',
    name: '.22 WMR (.22 Mag) 40gr JHP',
    category: 'rimfire_shotgun',
    caliber: '.22 WMR',
    bulletWeightGr: 40,
    muzzleVelocityFps: 1875,
    ballisticCoefficientG1: 0.140,
    zeroDistanceYards: 75,
    sightHeightInches: 1.5,
    testBarrelLengthInches: 18.5,
    fpsPerInch: 25,
    barrelPresets: [
      { label: '4.5" (Pistol)', lengthInches: 4.5 },
      { label: '16.0" (Carbine)', lengthInches: 16.0 },
      { label: '18.5" (Rifle)', lengthInches: 18.5 }
    ],
    description: 'High power magnum rimfire small game load'
  },
  {
    id: '17hmr_17',
    name: '.17 HMR 17gr Hornady V-MAX',
    category: 'rimfire_shotgun',
    caliber: '.17 HMR',
    bulletWeightGr: 17,
    muzzleVelocityFps: 2550,
    ballisticCoefficientG1: 0.125,
    zeroDistanceYards: 100,
    sightHeightInches: 1.5,
    testBarrelLengthInches: 24.0,
    fpsPerInch: 30,
    barrelPresets: [
      { label: '18.0" (Compact)', lengthInches: 18.0 },
      { label: '20.0" (Standard)', lengthInches: 20.0 },
      { label: '24.0" (Varmint)', lengthInches: 24.0 }
    ],
    description: 'Laser-flat trajectory rimfire varmint round'
  },
  {
    id: '12ga_slug_1oz',
    name: '12 Gauge 1 oz Rifled Slug',
    category: 'rimfire_shotgun',
    caliber: '12 Gauge',
    bulletWeightGr: 437.5,
    muzzleVelocityFps: 1600,
    ballisticCoefficientG1: 0.110,
    zeroDistanceYards: 50,
    sightHeightInches: 1.0,
    testBarrelLengthInches: 28.0,
    fpsPerInch: 15,
    barrelPresets: [
      { label: '14.0" (SBS)', lengthInches: 14.0 },
      { label: '18.5" (Tactical)', lengthInches: 18.5 },
      { label: '24.0" (Deer Bbl)', lengthInches: 24.0 },
      { label: '28.0" (Field)', lengthInches: 28.0 }
    ],
    description: 'Standard 2-3/4" 1-ounce shotgun slug'
  },
  {
    id: '12ga_00_buck',
    name: '12 Gauge 00 Buckshot (9 Pellets)',
    category: 'rimfire_shotgun',
    caliber: '12 Gauge',
    bulletWeightGr: 484, // 9 x 53.8gr
    muzzleVelocityFps: 1325,
    ballisticCoefficientG1: 0.080,
    zeroDistanceYards: 25,
    sightHeightInches: 1.0,
    testBarrelLengthInches: 28.0,
    fpsPerInch: 12,
    barrelPresets: [
      { label: '14.0" (SBS)', lengthInches: 14.0 },
      { label: '18.5" (Tactical)', lengthInches: 18.5 },
      { label: '28.0" (Field)', lengthInches: 28.0 }
    ],
    description: 'Standard 9-pellet defensive and duty buckshot'
  }
];

export interface AtmosphericConditions {
  altitudeFt: number;
  temperatureF: number;
  barometricPressureInHg: number;
  humidityPct: number;
  windSpeedMph: number;
  windAngleDegrees: number; // 90 = full value right crosswind, 0 = headwind
  inclineAngleDegrees: number; // uphill/downhill angle
}

export const STANDARD_ATMOSPHERE: AtmosphericConditions = {
  altitudeFt: 0,
  temperatureF: 59,
  barometricPressureInHg: 29.92,
  humidityPct: 50,
  windSpeedMph: 10,
  windAngleDegrees: 90,
  inclineAngleDegrees: 0
};

export interface DopeEntry {
  distanceYards: number;
  velocityFps: number;
  energyFtLbs: number;
  dropInches: number;
  holdoverInches: number;
  elevationMoa: number;
  elevationMil: number;
  elevationClicks14Moa: number;
  elevationClicks01Mil: number;
  windDriftInches: number;
  windDriftMoa: number;
  windDriftMil: number;
  flightTimeSeconds: number;
}

/**
 * Calculates adjusted muzzle velocity based on actual firearm barrel length.
 */
export function calculateVelocityForBarrelLength(
  profile: FactoryAmmoProfile,
  actualBarrelInches: number
): {
  adjustedVelocityFps: number;
  velocityDeltaFps: number;
  fpsPerInch: number;
} {
  const deltaInches = actualBarrelInches - profile.testBarrelLengthInches;
  let fpsPerInch = profile.fpsPerInch;

  // Non-linear scaling for extreme short rifle barrels (<12")
  if (profile.category === 'rifle' && actualBarrelInches < 12.0) {
    fpsPerInch = Math.round(profile.fpsPerInch * 1.35); // Greater velocity loss per inch in SBRs
  }

  const velocityDeltaFps = Math.round(deltaInches * fpsPerInch);
  const adjustedVelocityFps = Math.max(300, profile.muzzleVelocityFps + velocityDeltaFps);

  return {
    adjustedVelocityFps,
    velocityDeltaFps,
    fpsPerInch
  };
}

/**
 * Calculates atmospheric air density correction factor.
 */
export function getAirDensityRatio(atm: AtmosphericConditions): number {
  const tempRankine = atm.temperatureF + 459.67;
  const standardRankine = 59 + 459.67;
  const altitudeFactor = Math.pow(1 - (0.0000068756 * atm.altitudeFt), 5.2559);
  const correctedPressure = atm.barometricPressureInHg * altitudeFactor;
  
  return (correctedPressure / 29.92) * (standardRankine / tempRankine);
}

/**
 * Numerical Point-Mass Trajectory Solver (G1 Drag Function).
 */
export function calculateDopeTable(
  muzzleVelocityFps: number,
  bulletWeightGr: number,
  ballisticCoefficientG1: number,
  zeroDistanceYards: number = 100,
  sightHeightInches: number = 1.5,
  atm: AtmosphericConditions = STANDARD_ATMOSPHERE,
  maxDistanceYards: number = 600,
  stepYards: number = 50
): DopeEntry[] {
  const table: DopeEntry[] = [];
  const g = 32.174; // gravitational acceleration ft/s^2
  const densityRatio = getAirDensityRatio(atm);
  const effectiveBC = Math.max(0.05, ballisticCoefficientG1 / densityRatio);
  const cosIncline = Math.cos((atm.inclineAngleDegrees * Math.PI) / 180);
  const effectiveWindSpeedFps = (atm.windSpeedMph * 1.46667) * Math.sin((atm.windAngleDegrees * Math.PI) / 180);

  // 1. Find the sight angle (alpha) required to zero at zeroDistanceYards
  const zeroFeet = zeroDistanceYards * 3;
  const sightHeightFeet = sightHeightInches / 12;
  
  const avgZeroVel = muzzleVelocityFps * (1 - (0.00007 * zeroDistanceYards / effectiveBC));
  const tZero = zeroFeet / Math.max(500, avgZeroVel);
  const dropZeroFeet = 0.5 * g * Math.pow(tZero, 2);
  const zeroElevationAngle = (dropZeroFeet + sightHeightFeet) / zeroFeet;

  // 2. Step through distances
  for (let dist = 25; dist <= maxDistanceYards; dist += (dist < 100 ? 25 : stepYards)) {
    const rangeFeet = dist * 3;
    
    // Velocity degradation formula based on G1 drag
    const velRatio = Math.exp(- (rangeFeet / (effectiveBC * 2400)));
    const currentVelocity = Math.max(200, Math.round(muzzleVelocityFps * velRatio));
    
    // Kinetic Energy = (Mass_grains * Velocity^2) / 450,437
    const energy = Math.round((bulletWeightGr * Math.pow(currentVelocity, 2)) / 450437);

    // Time of flight
    const avgVelocity = (muzzleVelocityFps + currentVelocity) / 2;
    const timeOfFlight = rangeFeet / avgVelocity;

    // Total gravity drop (un-zeroed)
    const gravityDropFeet = 0.5 * g * Math.pow(timeOfFlight, 2) * cosIncline;
    const totalDropInches = Number((gravityDropFeet * 12).toFixed(1));

    // Trajectory relative to sight line (Zeroed)
    const bulletPathFeet = -sightHeightFeet + (zeroElevationAngle * rangeFeet) - gravityDropFeet;
    const holdoverInches = Number((bulletPathFeet * 12).toFixed(1));

    // Angular adjustments in MOA and MILs
    const inchesPerMoa = dist * 0.0104719;
    const elevationMoa = Number((-holdoverInches / inchesPerMoa).toFixed(2));
    const elevationMil = Number((elevationMoa / 3.4377).toFixed(2));

    // Turret clicks
    const elevationClicks14Moa = Math.round(elevationMoa * 4);
    const elevationClicks01Mil = Math.round(elevationMil * 10);

    // Wind drift (Didion's formula)
    const vacuumTime = rangeFeet / muzzleVelocityFps;
    const driftFeet = effectiveWindSpeedFps * (timeOfFlight - vacuumTime);
    const windDriftInches = Number((Math.abs(driftFeet) * 12).toFixed(1));
    const windDriftMoa = Number((windDriftInches / inchesPerMoa).toFixed(2));
    const windDriftMil = Number((windDriftMoa / 3.4377).toFixed(2));

    table.push({
      distanceYards: dist,
      velocityFps: currentVelocity,
      energyFtLbs: energy,
      dropInches: totalDropInches,
      holdoverInches,
      elevationMoa,
      elevationMil,
      elevationClicks14Moa,
      elevationClicks01Mil,
      windDriftInches,
      windDriftMoa,
      windDriftMil,
      flightTimeSeconds: Number(timeOfFlight.toFixed(3))
    });
  }

  return table;
}
