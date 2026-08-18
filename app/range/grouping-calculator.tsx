import React, { useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Dimensions, ScrollView, TextInput, Alert, LayoutChangeEvent } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Circle, Line, Rect, Text as SvgText, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  Point, 
  CalibrationScale, 
  PRESET_CALIBRATIONS, 
  calculatePixelsPerInch, 
  calculateShotGrouping, 
  GroupingMetrics,
  getDistance 
} from '../../utils/moaCalculator';
import { useDialog } from '../../context/DialogContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CANVAS_WIDTH = SCREEN_WIDTH - 32;

export default function GroupingCalculatorScreen() {
  const router = useRouter();
  const { photoUri, distanceYards: initialDist } = useLocalSearchParams<{ photoUri: string; distanceYards: string }>();
  const { showToast } = useDialog();

  const [activeStep, setActiveStep] = useState<'calibrate' | 'poa' | 'shots' | 'results'>('calibrate');
  const [distanceYards, setDistanceYards] = useState(initialDist ? String(initialDist) : '100');
  const [turretType, setTurretType] = useState<'1/4_moa' | '1/2_moa' | '1/8_moa' | '0.1_mil'>('1/4_moa');
  
  // Calibration State
  const [selectedCalibration, setSelectedCalibration] = useState<CalibrationScale>(PRESET_CALIBRATIONS[0]);
  const [customDistanceInput, setCustomDistanceInput] = useState('1.0');
  const [calPoint1, setCalPoint1] = useState<Point>({ x: CANVAS_WIDTH * 0.2, y: 150 });
  const [calPoint2, setCalPoint2] = useState<Point>({ x: CANVAS_WIDTH * 0.5, y: 150 });
  const [activeCalAnchor, setActiveCalAnchor] = useState<1 | 2>(1);

  // Layout image dimensions
  const [canvasHeight, setCanvasHeight] = useState(CANVAS_WIDTH * 1.2);

  // Shot Points State
  const [poa, setPoa] = useState<Point | null>(null);
  const [shots, setShots] = useState<Point[]>([]);

  // Calculate Pixels Per Inch
  const pixelsPerInch = useMemo(() => {
    const knownInches = selectedCalibration.type === 'custom_2pt' 
      ? (parseFloat(customDistanceInput) || 1.0) 
      : selectedCalibration.knownDistanceInches;
    return calculatePixelsPerInch(calPoint1, calPoint2, knownInches);
  }, [calPoint1, calPoint2, selectedCalibration, customDistanceInput]);

  // Calculate Full Grouping Metrics
  const metrics: GroupingMetrics | null = useMemo(() => {
    const dist = parseFloat(distanceYards) || 100;
    return calculateShotGrouping(shots, pixelsPerInch, dist, poa, turretType);
  }, [shots, pixelsPerInch, distanceYards, poa, turretType]);

  // Find two shots defining Extreme Spread
  const extremeSpreadPair = useMemo(() => {
    if (shots.length < 2) return null;
    let maxDist = 0;
    let pair: [Point, Point] | null = null;
    for (let i = 0; i < shots.length; i++) {
      for (let j = i + 1; j < shots.length; j++) {
        const d = getDistance(shots[i], shots[j]);
        if (d > maxDist) {
          maxDist = d;
          pair = [shots[i], shots[j]];
        }
      }
    }
    return pair;
  }, [shots]);

  const handleCanvasTouch = (e: any) => {
    const { locationX, locationY } = e.nativeEvent;
    const touchPoint: Point = { x: locationX, y: locationY };

    if (activeStep === 'calibrate') {
      if (activeCalAnchor === 1) {
        setCalPoint1(touchPoint);
        setActiveCalAnchor(2);
      } else {
        setCalPoint2(touchPoint);
        setActiveCalAnchor(1);
      }
    } else if (activeStep === 'poa') {
      setPoa(touchPoint);
      showToast({ message: 'Point of Aim (POA) set', type: 'info', durationMs: 1500 });
      setActiveStep('shots');
    } else if (activeStep === 'shots') {
      setShots(prev => [...prev, touchPoint]);
    }
  };

  const handleUndoShot = () => {
    setShots(prev => prev.slice(0, prev.length - 1));
  };

  const handleClearShots = () => {
    setShots([]);
  };

  const handleApplyResults = async () => {
    if (!metrics || shots.length === 0) {
      showToast({ message: 'Place at least one shot on the target', type: 'warning' });
      return;
    }

    try {
      const payload = {
        groupMetrics: metrics,
        calculatedAt: new Date().toISOString()
      };
      await AsyncStorage.setItem('pending_moa_analysis', JSON.stringify(payload));
      showToast({ message: `Group saved: ${metrics.moa} MOA (${metrics.extremeSpreadInches}")`, type: 'success' });
      router.back();
    } catch (e) {
      console.error('Error saving MOA analysis:', e);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Step Tabs Header */}
      <View style={styles.tabBar}>
        <Pressable 
          style={[styles.stepTab, activeStep === 'calibrate' && styles.stepTabActive]} 
          onPress={() => setActiveStep('calibrate')}
        >
          <Text style={[styles.stepTabText, activeStep === 'calibrate' && styles.stepTabTextActive]}>
            1. Scale ({pixelsPerInch.toFixed(0)} px/in)
          </Text>
        </Pressable>

        <Pressable 
          style={[styles.stepTab, activeStep === 'poa' && styles.stepTabActive]} 
          onPress={() => setActiveStep('poa')}
        >
          <Text style={[styles.stepTabText, activeStep === 'poa' && styles.stepTabTextActive]}>
            2. Aim (POA)
          </Text>
        </Pressable>

        <Pressable 
          style={[styles.stepTab, activeStep === 'shots' && styles.stepTabActive]} 
          onPress={() => setActiveStep('shots')}
        >
          <Text style={[styles.stepTabText, activeStep === 'shots' && styles.stepTabTextActive]}>
            3. Shots ({shots.length})
          </Text>
        </Pressable>

        <Pressable 
          style={[styles.stepTab, activeStep === 'results' && styles.stepTabActive]} 
          onPress={() => setActiveStep('results')}
        >
          <Text style={[styles.stepTabText, activeStep === 'results' && styles.stepTabTextActive]}>
            4. Report
          </Text>
        </Pressable>
      </View>

      {/* Target Image & Canvas Overlay */}
      <View 
        style={[styles.canvasContainer, { height: canvasHeight }]}
        onTouchEnd={handleCanvasTouch}
      >
        {photoUri ? (
          <Image 
            source={{ uri: photoUri }} 
            style={styles.targetImage}
            resizeMode="contain"
            onLayout={(e: LayoutChangeEvent) => {
              const { width, height } = e.nativeEvent.layout;
              if (height > 100) setCanvasHeight(height);
            }}
          />
        ) : (
          <View style={styles.placeholderTarget}>
            <Ionicons name="scan-circle-outline" size={64} color="#334155" />
            <Text style={{ color: '#64748b', marginTop: 8 }}>Target Preview Canvas</Text>
          </View>
        )}

        {/* SVG Drawing Layer */}
        <Svg height={canvasHeight} width={CANVAS_WIDTH} style={StyleSheet.absoluteFill}>
          {/* Step 1: Calibration Ruler */}
          {activeStep === 'calibrate' && (
            <G>
              <Line 
                x1={calPoint1.x} 
                y1={calPoint1.y} 
                x2={calPoint2.x} 
                y2={calPoint2.y} 
                stroke="#38bdf8" 
                strokeWidth="3" 
                strokeDasharray="4, 4"
              />
              <Circle cx={calPoint1.x} cy={calPoint1.y} r="14" fill="rgba(56, 189, 248, 0.4)" stroke="#38bdf8" strokeWidth="2.5" />
              <SvgText x={calPoint1.x} y={calPoint1.y + 4} fill="#fff" fontSize="11" fontWeight="bold" textAnchor="middle">A</SvgText>
              
              <Circle cx={calPoint2.x} cy={calPoint2.y} r="14" fill="rgba(56, 189, 248, 0.4)" stroke="#38bdf8" strokeWidth="2.5" />
              <SvgText x={calPoint2.x} y={calPoint2.y + 4} fill="#fff" fontSize="11" fontWeight="bold" textAnchor="middle">B</SvgText>

              {/* Scale Label */}
              <SvgText 
                x={(calPoint1.x + calPoint2.x) / 2} 
                y={(calPoint1.y + calPoint2.y) / 2 - 10} 
                fill="#38bdf8" 
                fontSize="12" 
                fontWeight="bold" 
                textAnchor="middle"
              >
                {selectedCalibration.knownDistanceInches}" ({pixelsPerInch.toFixed(0)} px/in)
              </SvgText>
            </G>
          )}

          {/* Point of Aim (POA) Reticle */}
          {poa && (
            <G>
              <Circle cx={poa.x} cy={poa.y} r="18" fill="none" stroke="#06b6d4" strokeWidth="2" />
              <Line x1={poa.x - 24} y1={poa.y} x2={poa.x + 24} y2={poa.y} stroke="#06b6d4" strokeWidth="2" />
              <Line x1={poa.x} y1={poa.y - 24} x2={poa.x} y2={poa.y + 24} stroke="#06b6d4" strokeWidth="2" />
              <Circle cx={poa.x} cy={poa.y} r="3" fill="#06b6d4" />
              <SvgText x={poa.x} y={poa.y - 22} fill="#06b6d4" fontSize="10" fontWeight="bold" textAnchor="middle">POA</SvgText>
            </G>
          )}

          {/* Extreme Spread Line */}
          {extremeSpreadPair && (
            <Line 
              x1={extremeSpreadPair[0].x} 
              y1={extremeSpreadPair[0].y} 
              x2={extremeSpreadPair[1].x} 
              y2={extremeSpreadPair[1].y} 
              stroke="#ef4444" 
              strokeWidth="2" 
              strokeDasharray="3, 3"
            />
          )}

          {/* Group Center (Centroid) */}
          {metrics && shots.length > 1 && (
            <G>
              <Circle 
                cx={metrics.groupCenter.x} 
                cy={metrics.groupCenter.y} 
                r={Math.max(12, (metrics.extremeSpreadInches * pixelsPerInch) / 2)} 
                fill="rgba(16, 185, 129, 0.12)" 
                stroke="#10b981" 
                strokeWidth="1.5" 
              />
              <Line x1={metrics.groupCenter.x - 8} y1={metrics.groupCenter.y} x2={metrics.groupCenter.x + 8} y2={metrics.groupCenter.y} stroke="#10b981" strokeWidth="2" />
              <Line x1={metrics.groupCenter.x} y1={metrics.groupCenter.y - 8} x2={metrics.groupCenter.x} y2={metrics.groupCenter.y + 8} stroke="#10b981" strokeWidth="2" />
            </G>
          )}

          {/* Numbered Shot Impact Points */}
          {shots.map((shot, idx) => (
            <G key={idx}>
              <Circle cx={shot.x} cy={shot.y} r="10" fill="#f97316" stroke="#fff" strokeWidth="1.5" />
              <SvgText x={shot.x} y={shot.y + 3.5} fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle">
                {idx + 1}
              </SvgText>
            </G>
          ))}
        </Svg>
      </View>

      {/* Step Control Deck */}
      {activeStep === 'calibrate' && (
        <View style={styles.deckCard}>
          <Text style={styles.deckTitle}>Step 1: Calibrate Reference Scale</Text>
          <Text style={styles.deckDesc}>
            Tap anchors A and B across a known scale (like a 1" grid square or coin) on the target.
          </Text>

          <View style={styles.chipRow}>
            {PRESET_CALIBRATIONS.map(preset => (
              <Pressable
                key={preset.type}
                style={[styles.chip, selectedCalibration.type === preset.type && styles.chipActive]}
                onPress={() => setSelectedCalibration(preset)}
              >
                <Text style={[styles.chipText, selectedCalibration.type === preset.type && styles.chipTextActive]}>
                  {preset.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {selectedCalibration.type === 'custom_2pt' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <Text style={{ color: '#94a3b8' }}>Distance (inches):</Text>
              <TextInput
                style={styles.miniInput}
                keyboardType="numeric"
                value={customDistanceInput}
                onChangeText={setCustomDistanceInput}
              />
            </View>
          )}

          <Pressable style={styles.actionBtnPrimary} onPress={() => setActiveStep('poa')}>
            <Text style={styles.actionBtnText}>Confirm Scale & Set Aim Point →</Text>
          </Pressable>
        </View>
      )}

      {activeStep === 'poa' && (
        <View style={styles.deckCard}>
          <Text style={styles.deckTitle}>Step 2: Point of Aim (POA)</Text>
          <Text style={styles.deckDesc}>
            Tap the center bullseye or optic crosshair target location where you were aiming.
          </Text>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Pressable 
              style={[styles.actionBtnSecondary, { flex: 1 }]} 
              onPress={() => { setPoa(null); setActiveStep('shots'); }}
            >
              <Text style={styles.actionBtnSecondaryText}>Skip (Group Only)</Text>
            </Pressable>
            <Pressable 
              style={[styles.actionBtnPrimary, { flex: 1.5 }]} 
              onPress={() => setActiveStep('shots')}
            >
              <Text style={styles.actionBtnText}>Next: Plot Shots →</Text>
            </Pressable>
          </View>
        </View>
      )}

      {activeStep === 'shots' && (
        <View style={styles.deckCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.deckTitle}>Step 3: Plot Bullet Holes ({shots.length})</Text>
            {shots.length > 0 && (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable style={styles.miniToolBtn} onPress={handleUndoShot}>
                  <Ionicons name="arrow-undo" size={14} color="#38bdf8" />
                  <Text style={styles.miniToolText}>Undo</Text>
                </Pressable>
                <Pressable style={styles.miniToolBtn} onPress={handleClearShots}>
                  <Ionicons name="trash-outline" size={14} color="#ef4444" />
                  <Text style={[styles.miniToolText, { color: '#ef4444' }]}>Clear</Text>
                </Pressable>
              </View>
            )}
          </View>

          <Text style={styles.deckDesc}>
            Tap directly on each bullet hole on the target image to record impact locations.
          </Text>

          {/* Quick HUD Metrics Bar */}
          {metrics && shots.length > 1 && (
            <View style={styles.hudStatsRow}>
              <View style={styles.hudStat}>
                <Text style={styles.hudStatLabel}>SPREAD</Text>
                <Text style={styles.hudStatValue}>{metrics.extremeSpreadInches}"</Text>
              </View>
              <View style={styles.hudStat}>
                <Text style={styles.hudStatLabel}>MOA @ {distanceYards}Y</Text>
                <Text style={[styles.hudStatValue, { color: '#34d399' }]}>{metrics.moa} MOA</Text>
              </View>
              <View style={styles.hudStat}>
                <Text style={styles.hudStatLabel}>MEAN RADIUS</Text>
                <Text style={styles.hudStatValue}>{metrics.meanRadiusInches}"</Text>
              </View>
            </View>
          )}

          <Pressable 
            style={[styles.actionBtnPrimary, { marginTop: 14 }]} 
            onPress={() => setActiveStep('results')}
          >
            <Text style={styles.actionBtnText}>View Zeroing & Group Report →</Text>
          </Pressable>
        </View>
      )}

      {activeStep === 'results' && (
        <View style={styles.deckCard}>
          <Text style={styles.deckTitle}>Group Accuracy & Zeroing Analysis</Text>

          {/* Distance Config */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 10 }}>
            <Text style={{ color: '#94a3b8', fontWeight: 'bold' }}>Target Distance (yds):</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {['25', '50', '100', '200'].map(d => (
                <Pressable
                  key={d}
                  style={[styles.distChip, distanceYards === d && styles.distChipActive]}
                  onPress={() => setDistanceYards(d)}
                >
                  <Text style={[styles.distChipText, distanceYards === d && styles.distChipTextActive]}>{d}y</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Turret Format Selector */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Text style={{ color: '#94a3b8', fontWeight: 'bold' }}>Optic Turret:</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {(['1/4_moa', '1/2_moa', '0.1_mil'] as const).map(t => (
                <Pressable
                  key={t}
                  style={[styles.distChip, turretType === t && styles.distChipActive]}
                  onPress={() => setTurretType(t)}
                >
                  <Text style={[styles.distChipText, turretType === t && styles.distChipTextActive]}>
                    {t.replace('_', ' ').toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Metrics Dashboard */}
          {metrics && (
            <View style={styles.reportBox}>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>🎯 Extreme Spread (Group Size):</Text>
                <Text style={styles.reportValue}>{metrics.extremeSpreadInches} in ({metrics.extremeSpreadMm} mm)</Text>
              </View>

              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>📐 Minute of Angle (MOA):</Text>
                <Text style={[styles.reportValue, { color: '#34d399', fontSize: 16 }]}>
                  {metrics.moa} MOA ({metrics.mil} MIL)
                </Text>
              </View>

              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>📍 Mean Radius (MR):</Text>
                <Text style={styles.reportValue}>{metrics.meanRadiusInches} in</Text>
              </View>

              {/* Point of Aim & Scope Turret Click Recommendations */}
              {metrics.poaOffsetInches && metrics.turretAdjustment && (
                <View style={styles.turretBox}>
                  <Text style={styles.turretTitle}>🔭 Scope Zeroing Click Adjustments</Text>
                  <Text style={styles.turretOffset}>
                    Impact Bias: {Math.abs(metrics.poaOffsetInches.elevation)}" {metrics.poaOffsetInches.elevation >= 0 ? 'HIGH' : 'LOW'}, {Math.abs(metrics.poaOffsetInches.windage)}" {metrics.poaOffsetInches.windage >= 0 ? 'RIGHT' : 'LEFT'}
                  </Text>
                  
                  <View style={styles.clickCardRow}>
                    <View style={styles.clickCard}>
                      <Text style={styles.clickDir}>
                        {metrics.turretAdjustment.elevationDirection === 'DOWN' ? '▼ DIAL DOWN' : metrics.turretAdjustment.elevationDirection === 'UP' ? '▲ DIAL UP' : '✔ CENTERED'}
                      </Text>
                      <Text style={styles.clickNumber}>
                        {metrics.turretAdjustment.elevationClicks} CLICKS
                      </Text>
                    </View>

                    <View style={styles.clickCard}>
                      <Text style={styles.clickDir}>
                        {metrics.turretAdjustment.windageDirection === 'LEFT' ? '◄ DIAL LEFT' : metrics.turretAdjustment.windageDirection === 'RIGHT' ? '► DIAL RIGHT' : '✔ CENTERED'}
                      </Text>
                      <Text style={styles.clickNumber}>
                        {metrics.turretAdjustment.windageClicks} CLICKS
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Action Buttons */}
          <Pressable style={styles.actionBtnPrimary} onPress={handleApplyResults}>
            <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.actionBtnText}>Attach to Range Session</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
  },
  stepTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  stepTabActive: {
    backgroundColor: '#334155',
  },
  stepTabText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  stepTabTextActive: {
    color: '#38bdf8',
  },
  canvasContainer: {
    width: CANVAS_WIDTH,
    backgroundColor: '#020617',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
    position: 'relative',
  },
  targetImage: {
    width: '100%',
    height: '100%',
  },
  placeholderTarget: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  deckCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  deckTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  deckDesc: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 8,
  },
  chip: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38bdf8',
  },
  chipText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#38bdf8',
    fontWeight: 'bold',
  },
  distChip: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  distChipActive: {
    backgroundColor: '#065f46',
    borderColor: '#10b981',
  },
  distChipText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  distChipTextActive: {
    color: '#34d399',
  },
  miniInput: {
    backgroundColor: '#0f172a',
    color: '#fff',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 60,
    textAlign: 'center',
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: '#334155',
  },
  miniToolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  miniToolText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  hudStatsRow: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    gap: 8,
  },
  hudStat: {
    flex: 1,
    alignItems: 'center',
  },
  hudStatLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  hudStatValue: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  reportBox: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  reportLabel: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  reportValue: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: 'bold',
  },
  turretBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  turretTitle: {
    color: '#38bdf8',
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 2,
  },
  turretOffset: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 8,
  },
  clickCardRow: {
    flexDirection: 'row',
    gap: 10,
  },
  clickCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  clickDir: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  clickNumber: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  actionBtnPrimary: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 12,
  },
  actionBtnSecondary: {
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  actionBtnSecondaryText: {
    color: '#cbd5e1',
    fontWeight: 'bold',
    fontSize: 13,
  }
});
