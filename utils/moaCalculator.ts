export interface Point {
  x: number;
  y: number;
}

export interface CalibrationScale {
  type: 'grid_1in' | 'grid_half_in' | 'target_paster_1in' | 'quarter_coin' | 'dime_coin' | 'rim_9mm' | 'casehead_223' | 'custom_2pt';
  knownDistanceInches: number;
  label: string;
}

export interface GroupingMetrics {
  shotCount: number;
  extremeSpreadInches: number;
  extremeSpreadMm: number;
  horizontalSpreadInches: number;
  verticalSpreadInches: number;
  moa: number;
  mil: number;
  meanRadiusInches: number;
  radialSdInches: number;
  groupCenter: Point;
  flyerIndex?: number;
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
  { type: 'grid_1in', knownDistanceInches: 1.0, label: '1" Target Grid' },
  { type: 'grid_half_in', knownDistanceInches: 0.5, label: '0.5" Target Grid' },
  { type: 'target_paster_1in', knownDistanceInches: 1.0, label: '1" Paster / Bullseye' },
  { type: 'quarter_coin', knownDistanceInches: 0.955, label: 'US Quarter (0.955")' },
  { type: 'dime_coin', knownDistanceInches: 0.705, label: 'US Dime (0.705")' },
  { type: 'rim_9mm', knownDistanceInches: 0.392, label: '9mm Case Rim (0.392")' },
  { type: 'casehead_223', knownDistanceInches: 0.378, label: '5.56/.223 Head (0.378")' },
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
      horizontalSpreadInches: 0,
      verticalSpreadInches: 0,
      moa: 0,
      mil: 0,
      meanRadiusInches: 0,
      radialSdInches: 0,
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

  // 2. Horizontal and Vertical Spread
  const minX = Math.min(...shots.map(s => s.x));
  const maxX = Math.max(...shots.map(s => s.x));
  const minY = Math.min(...shots.map(s => s.y));
  const maxY = Math.max(...shots.map(s => s.y));
  const horizontalSpreadInches = (maxX - minX) / pixelsPerInch;
  const verticalSpreadInches = (maxY - minY) / pixelsPerInch;

  // 3. MOA and MIL conversions (1 MOA @ 100 yds = 1.04719755 inches)
  const safeDistanceYards = Math.max(1, targetDistanceYards);
  const inchesPerMoaAtDistance = safeDistanceYards * 0.0104719755;
  const moa = extremeSpreadInches / inchesPerMoaAtDistance;
  const mil = moa / 3.4377;

  // 4. Group Center (Centroid)
  const sumX = shots.reduce((acc, s) => acc + s.x, 0);
  const sumY = shots.reduce((acc, s) => acc + s.y, 0);
  const groupCenter: Point = {
    x: sumX / shots.length,
    y: sumY / shots.length
  };

  // 5. Mean Radius (MR) and Radial Standard Deviation
  const distancesFromCenter = shots.map(s => getDistance(s, groupCenter) / pixelsPerInch);
  const meanRadiusInches = distancesFromCenter.reduce((a, b) => a + b, 0) / shots.length;
  
  const variance = distancesFromCenter.reduce((acc, d) => acc + Math.pow(d - meanRadiusInches, 2), 0) / shots.length;
  const radialSdInches = Math.sqrt(variance);

  // 6. Identify potential flyer (shot furthest from group center exceeding 1.8x mean radius)
  let flyerIndex: number | undefined;
  let maxDistFromCenter = 0;
  shots.forEach((s, idx) => {
    const d = getDistance(s, groupCenter) / pixelsPerInch;
    if (d > maxDistFromCenter) {
      maxDistFromCenter = d;
      if (d > meanRadiusInches * 1.8 && shots.length >= 4) {
        flyerIndex = idx;
      }
    }
  });

  // 7. Point of Aim (POA) Offset and Scope Turret Zeroing Assistant
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
      clickValMoa = 0.3438; // 0.1 mil in MOA (1 MIL = 3.438 MOA)
      label = '0.1 MIL';
    }

    // If shots hit HIGH (elevation > 0), dial DOWN
    // If shots hit LOW (elevation < 0), dial UP
    const elevClicks = Math.round(Math.abs(elevationMoa) / clickValMoa);
    const elevDir: 'UP' | 'DOWN' | 'CENTER' = 
      Math.abs(elevationMoa) < 0.05 ? 'CENTER' : elevationMoa > 0 ? 'DOWN' : 'UP';

    // If shots hit RIGHT (windage > 0), dial LEFT
    // If shots hit LEFT (windage < 0), dial RIGHT
    const windClicks = Math.round(Math.abs(windageMoa) / clickValMoa);
    const windDir: 'LEFT' | 'RIGHT' | 'CENTER' = 
      Math.abs(windageMoa) < 0.05 ? 'CENTER' : windageMoa > 0 ? 'LEFT' : 'RIGHT';

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
    horizontalSpreadInches: Number(horizontalSpreadInches.toFixed(2)),
    verticalSpreadInches: Number(verticalSpreadInches.toFixed(2)),
    moa: Number(moa.toFixed(2)),
    mil: Number(mil.toFixed(2)),
    meanRadiusInches: Number(meanRadiusInches.toFixed(2)),
    radialSdInches: Number(radialSdInches.toFixed(2)),
    groupCenter,
    flyerIndex,
    poaOffsetInches,
    poaOffsetMoa,
    turretAdjustment
  };
}
