export interface Point {
  x: number;
  y: number;
}

export interface CalibrationScale {
  type: 'grid_1in' | 'grid_half_in' | 'quarter_coin' | 'target_paster_1in' | 'custom_2pt';
  knownDistanceInches: number;
  label: string;
}

export interface GroupingMetrics {
  shotCount: number;
  extremeSpreadInches: number;
  extremeSpreadMm: number;
  moa: number;
  mil: number;
  meanRadiusInches: number;
  groupCenter: Point;
  poaOffsetInches?: {
    elevation: number; // positive = HIGH, negative = LOW
    windage: number;   // positive = RIGHT, negative = LEFT
  };
  poaOffsetMoa?: {
    elevation: number;
    windage: number;
  };
  turretAdjustment?: {
    elevationClicks: number;
    elevationDirection: 'UP' | 'DOWN' | 'CENTER';
    windageClicks: number;
    windageDirection: 'LEFT' | 'RIGHT' | 'CENTER';
    clickUnitLabel: string;
  };
}

export const PRESET_CALIBRATIONS: CalibrationScale[] = [
  { type: 'grid_1in', knownDistanceInches: 1.0, label: '1-Inch Target Grid' },
  { type: 'grid_half_in', knownDistanceInches: 0.5, label: '0.5-Inch Target Grid' },
  { type: 'target_paster_1in', knownDistanceInches: 1.0, label: '1-Inch Target Paster / Bullseye' },
  { type: 'quarter_coin', knownDistanceInches: 0.955, label: 'US Quarter Coin (0.955")' },
  { type: 'custom_2pt', knownDistanceInches: 1.0, label: 'Custom 2-Point Measure' },
];

/**
 * Calculates Euclidean distance between two 2D points.
 */
export function getDistance(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Computes pixels per inch based on two calibration anchor points and a known real-world distance.
 */
export function calculatePixelsPerInch(calPoint1: Point, calPoint2: Point, knownDistanceInches: number): number {
  const pixelDist = getDistance(calPoint1, calPoint2);
  if (knownDistanceInches <= 0 || pixelDist <= 0) return 1;
  return pixelDist / knownDistanceInches;
}

/**
 * Computes full statistical shot group metrics.
 * 
 * @param shots List of bullet impact points in pixels
 * @param pixelsPerInch Scale factor
 * @param targetDistanceYards Distance from firing line to target in yards
 * @param poa Optional Point of Aim (bullseye/crosshair center)
 * @param turretType Optional turret click format ('1/4_moa' | '1/2_moa' | '1/8_moa' | '0.1_mil')
 */
export function calculateShotGrouping(
  shots: Point[],
  pixelsPerInch: number,
  targetDistanceYards: number = 100,
  poa?: Point | null,
  turretType: '1/4_moa' | '1/2_moa' | '1/8_moa' | '0.1_mil' = '1/4_moa'
): GroupingMetrics | null {
  if (shots.length === 0 || pixelsPerInch <= 0) {
    return null;
  }

  // 1 Shot edge-case
  if (shots.length === 1) {
    return {
      shotCount: 1,
      extremeSpreadInches: 0,
      extremeSpreadMm: 0,
      moa: 0,
      mil: 0,
      meanRadiusInches: 0,
      groupCenter: shots[0]
    };
  }

  // 1. Extreme Spread (ES): Maximum distance between any two shots
  let maxPixelDist = 0;
  for (let i = 0; i < shots.length; i++) {
    for (let j = i + 1; j < shots.length; j++) {
      const d = getDistance(shots[i], shots[j]);
      if (d > maxPixelDist) {
        maxPixelDist = d;
      }
    }
  }

  const extremeSpreadInches = maxPixelDist / pixelsPerInch;
  const extremeSpreadMm = extremeSpreadInches * 25.4;

  // 2. MOA and MIL conversions
  // Standard ballistic constant: 1 MOA @ 100 yds = 1.04719755 inches
  const safeDistanceYards = Math.max(1, targetDistanceYards);
  const inchesPerMoaAtDistance = safeDistanceYards * 0.0104719755;
  const moa = extremeSpreadInches / inchesPerMoaAtDistance;

  // 1 MIL = 3.4377 MOA, or (cm / (meters * 0.1))
  const mil = moa / 3.4377;

  // 3. Group Center (Centroid)
  const sumX = shots.reduce((acc, s) => acc + s.x, 0);
  const sumY = shots.reduce((acc, s) => acc + s.y, 0);
  const groupCenter: Point = {
    x: sumX / shots.length,
    y: sumY / shots.length
  };

  // 4. Mean Radius (MR): Average distance of each shot from the group centroid
  const sumDistFromCenter = shots.reduce((acc, s) => acc + getDistance(s, groupCenter), 0);
  const meanRadiusInches = (sumDistFromCenter / shots.length) / pixelsPerInch;

  // 5. Point of Aim (POA) Offset and Scope Turret Zeroing Assistant
  let poaOffsetInches: { elevation: number; windage: number } | undefined;
  let poaOffsetMoa: { elevation: number; windage: number } | undefined;
  let turretAdjustment: GroupingMetrics['turretAdjustment'] | undefined;

  if (poa) {
    // In screen coordinates: Y is down (+y is lower on target, -y is higher)
    // Elevation: if groupCenter.y < poa.y -> shots hit ABOVE bullseye (HIGH)
    const elevationInches = (poa.y - groupCenter.y) / pixelsPerInch;
    // Windage: if groupCenter.x > poa.x -> shots hit RIGHT of bullseye
    const windageInches = (groupCenter.x - poa.x) / pixelsPerInch;

    poaOffsetInches = {
      elevation: Number(elevationInches.toFixed(2)),
      windage: Number(windageInches.toFixed(2))
    };

    const elevationMoa = elevationInches / inchesPerMoaAtDistance;
    const windageMoa = windageInches / inchesPerMoaAtDistance;

    poaOffsetMoa = {
      elevation: Number(elevationMoa.toFixed(2)),
      windage: Number(windageMoa.toFixed(2))
    };

    // Calculate Scope Click Adjustments
    let clickValMoa = 0.25;
    let label = '1/4 MOA';
    if (turretType === '1/2_moa') {
      clickValMoa = 0.50;
      label = '1/2 MOA';
    } else if (turretType === '1/8_moa') {
      clickValMoa = 0.125;
      label = '1/8 MOA';
    } else if (turretType === '0.1_mil') {
      clickValMoa = 0.3438; // 0.1 mil in MOA
      label = '0.1 MIL';
    }

    // If shots hit HIGH (elevation > 0), dial DOWN
    // If shots hit LOW (elevation < 0), dial UP
    const elevClicks = Math.round(Math.abs(elevationMoa) / clickValMoa);
    const elevDir: 'UP' | 'DOWN' | 'CENTER' = 
      Math.abs(elevationMoa) < 0.1 ? 'CENTER' : elevationMoa > 0 ? 'DOWN' : 'UP';

    // If shots hit RIGHT (windage > 0), dial LEFT
    // If shots hit LEFT (windage < 0), dial RIGHT
    const windClicks = Math.round(Math.abs(windageMoa) / clickValMoa);
    const windDir: 'LEFT' | 'RIGHT' | 'CENTER' = 
      Math.abs(windageMoa) < 0.1 ? 'CENTER' : windageMoa > 0 ? 'LEFT' : 'RIGHT';

    turretAdjustment = {
      elevationClicks: elevClicks,
      elevationDirection: elevDir,
      windageClicks: windClicks,
      windageDirection: windDir,
      clickUnitLabel: label
    };
  }

  return {
    shotCount: shots.length,
    extremeSpreadInches: Number(extremeSpreadInches.toFixed(2)),
    extremeSpreadMm: Number(extremeSpreadMm.toFixed(1)),
    moa: Number(moa.toFixed(2)),
    mil: Number(mil.toFixed(2)),
    meanRadiusInches: Number(meanRadiusInches.toFixed(2)),
    groupCenter,
    poaOffsetInches,
    poaOffsetMoa,
    turretAdjustment
  };
}
