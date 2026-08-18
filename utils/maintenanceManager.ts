import AsyncStorage from '@react-native-async-storage/async-storage';

export type MalfunctionType = 
  | 'FTF'           // Failure to Feed
  | 'FTE'           // Failure to Extract
  | 'stovepipe'     // Failure to Eject / Stovepipe
  | 'double_feed'   // Double Feed
  | 'light_strike'  // Light Primer Strike
  | 'squib_warning';// Squib / Delayed Hangfire

export type SuspectedCause = 
  | 'ammo_profile_mismatch' // e.g. Flat-nose catching on ramp
  | 'low_pressure_cycling'  // e.g. Weak 115gr with compensator / stiff spring
  | 'dirty_powder_fouling'  // e.g. Carbon buildup after high round count
  | 'steel_case_expansion'  // e.g. Lacquer coated steel stuck in chamber
  | 'magazine_spring'       // e.g. Weak mag follower spring
  | 'unknown';

export interface MalfunctionRecord {
  type: MalfunctionType;
  count: number;
  magId?: string;
  ammoId?: number;
  suspectedCause?: SuspectedCause;
  notes?: string;
}

export interface ComponentWearStatus {
  name: string;
  currentRounds: number;
  thresholdRounds: number;
  status: 'good' | 'warning' | 'overdue';
  percentage: number;
}

export interface AmmoMatchRating {
  ammoId: number;
  manufacturer: string;
  caliber: string;
  projectile?: string;
  roundsFired: number;
  malfunctionCount: number;
  reliabilityRate: number; // e.g. 99.5%
  status: 'flawless' | 'caution' | 'disliked';
  notes?: string;
}

export interface FirearmHealthReport {
  firearmId: number;
  totalRounds: number;
  cleanlinessStatus: 'clean' | 'moderate' | 'cleaning_due';
  roundsSinceClean: number;
  recoilSpring: ComponentWearStatus;
  extractor: ComponentWearStatus;
  opticBatteryDays?: number;
  overallReliability: number; // MRBF score
  ammoRatings: AmmoMatchRating[];
}

const STORAGE_KEY_MAINTENANCE = 'firearm_maintenance_records';
const STORAGE_KEY_MALFUNCTIONS = 'firearm_malfunction_logs';

/**
 * Calculates component wear lifecycle for a firearm based on total round count and recorded service resets.
 */
export function calculateFirearmWear(
  totalRounds: number, 
  roundsSinceClean: number = 0, 
  roundsSinceSpring: number = 0,
  recoilSpringThreshold: number = 4000,
  cleanThreshold: number = 500
): { recoilSpring: ComponentWearStatus; deepClean: ComponentWearStatus } {
  const springRounds = roundsSinceSpring > 0 ? roundsSinceSpring : (totalRounds % recoilSpringThreshold);
  const cleanRounds = roundsSinceClean > 0 ? roundsSinceClean : (totalRounds % cleanThreshold);

  const springPct = Math.min(100, Math.round((springRounds / recoilSpringThreshold) * 100));
  const cleanPct = Math.min(100, Math.round((cleanRounds / cleanThreshold) * 100));

  return {
    recoilSpring: {
      name: 'Recoil Spring Assembly',
      currentRounds: springRounds,
      thresholdRounds: recoilSpringThreshold,
      status: springPct >= 100 ? 'overdue' : springPct >= 80 ? 'warning' : 'good',
      percentage: springPct
    },
    deepClean: {
      name: 'Clean & Lube Service',
      currentRounds: cleanRounds,
      thresholdRounds: cleanThreshold,
      status: cleanPct >= 100 ? 'overdue' : cleanPct >= 75 ? 'warning' : 'good',
      percentage: cleanPct
    }
  };
}

/**
 * Calculates Gun-Ammo Match Score (Reliability %) across all past sessions.
 */
export function computeAmmoMatchScore(
  roundsFired: number,
  malfunctions: number,
  suspectedCauses: string[] = []
): { reliabilityRate: number; status: 'flawless' | 'caution' | 'disliked'; recommendation: string } {
  if (roundsFired <= 0) {
    return { reliabilityRate: 100, status: 'flawless', recommendation: 'No test history' };
  }

  const failRate = (malfunctions / roundsFired) * 100;
  const reliabilityRate = Number((100 - failRate).toFixed(1));

  if (malfunctions === 0 && roundsFired >= 50) {
    return {
      reliabilityRate: 100,
      status: 'flawless',
      recommendation: '🟢 Flawless Match • Highly Reliable'
    };
  }

  if (reliabilityRate >= 98.0) {
    return {
      reliabilityRate,
      status: 'caution',
      recommendation: '🟡 Good • Minor occasional failure'
    };
  }

  // Determine specific reason if disliked
  let reason = '🔴 Gun dislikes this ammo load';
  if (suspectedCauses.includes('low_pressure_cycling')) {
    reason = '🔴 Low Pressure: Gun requires 124gr+ or +P to cycle';
  } else if (suspectedCauses.includes('ammo_profile_mismatch')) {
    reason = '🔴 Feed Ramp Hangup: Gun dislikes flat-nose / wide hollow point';
  } else if (suspectedCauses.includes('steel_case_expansion')) {
    reason = '🔴 Chamber Sticking: Gun dislikes steel-cased ammo';
  } else if (suspectedCauses.includes('dirty_powder_fouling')) {
    reason = '🔴 Dirty Powder: High carbon residue causes sluggish cycling';
  }

  return {
    reliabilityRate,
    status: 'disliked',
    recommendation: reason
  };
}
