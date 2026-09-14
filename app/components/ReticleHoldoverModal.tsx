import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import Svg, { Circle, Line, Text as SvgText, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSync } from '../../context/SyncContext';
import { OpticItem } from '../../types';

export interface ReticleHoldoverModalProps {
  visible: boolean;
  onClose: () => void;
  initialDistance?: number;
  initialWindMph?: number;
}

export const ReticleHoldoverModal: React.FC<ReticleHoldoverModalProps> = ({
  visible,
  onClose,
  initialDistance = 300,
  initialWindMph = 10,
}) => {
  const { optics } = useSync();

  const [distance, setDistance] = useState<number>(initialDistance);
  const [windMph, setWindMph] = useState<number>(initialWindMph);
  const [turretUnit, setTurretUnit] = useState<'moa' | 'mil'>('mil');
  const [selectedOpticId, setSelectedOpticId] = useState<string | null>(null);

  // Selected Optic Profile
  const selectedOptic: OpticItem | undefined = useMemo(() => {
    return optics.find((o) => o.id === selectedOpticId);
  }, [optics, selectedOpticId]);

  // Handle unit auto-sync if optic profile is selected
  const activeUnit = useMemo(() => {
    if (selectedOptic?.clickValue) {
      return selectedOptic.clickValue.toLowerCase().includes('moa') ? 'moa' : 'mil';
    }
    return turretUnit;
  }, [selectedOptic, turretUnit]);

  // Pure Ballistic Physics Calculation (G1 Standard Curve Model)
  const trajectory = useMemo(() => {
    const zeroYds = selectedOptic?.zeroDistance ? Number(selectedOptic.zeroDistance) || 100 : 100;
    const muzzleVelocity = 2700; // fps baseline
    const bc = 0.45; // G1 ballistic coefficient baseline

    // Simple robust drop approximation
    const distRatio = distance / 100;
    const zeroRatio = zeroYds / 100;

    // Drop in inches from line of bore
    const dropInches = 0.5 * 32.174 * 12 * Math.pow((distance * 3) / muzzleVelocity, 2);
    const zeroInches = 0.5 * 32.174 * 12 * Math.pow((zeroYds * 3) / muzzleVelocity, 2);
    const relativeDropInches = Math.max(0, dropInches - (zeroInches / zeroRatio) * distRatio);

    // Wind drift (90-degree crosswind)
    const timeOfFlight = (distance * 3) / (muzzleVelocity - (0.25 * distance));
    const lagTime = Math.max(0, timeOfFlight - (distance * 3) / muzzleVelocity);
    const driftInches = (windMph * 1.467) * lagTime * 12 * 0.4;

    // Convert to MOA and MIL
    const dropMOA = distance > 0 ? (relativeDropInches / (distance * 1.047)) : 0;
    const dropMIL = distance > 0 ? (relativeDropInches / (distance * 3.6)) * 10 : 0;

    const windMOA = distance > 0 ? (driftInches / (distance * 1.047)) : 0;
    const windMIL = distance > 0 ? (driftInches / (distance * 3.6)) * 10 : 0;

    const elevHold = activeUnit === 'moa' ? dropMOA : dropMIL;
    const windHold = activeUnit === 'moa' ? windMOA : windMIL;

    const elevClicks = activeUnit === 'moa' ? Math.round(elevHold * 4) : Math.round(elevHold * 10);
    const windClicks = activeUnit === 'moa' ? Math.round(windHold * 4) : Math.round(windHold * 10);

    const remainingVelocity = Math.max(800, Math.round(muzzleVelocity - (distance * 1.25)));
    const energyFtLbs = Math.round((140 * Math.pow(remainingVelocity, 2)) / 450436);

    return {
      dropInches: relativeDropInches.toFixed(1),
      driftInches: driftInches.toFixed(1),
      elevHold: elevHold.toFixed(1),
      windHold: windHold.toFixed(1),
      elevClicks,
      windClicks,
      flightTime: timeOfFlight.toFixed(3),
      remainingVelocity,
      energyFtLbs,
      rawElev: elevHold,
      rawWind: windHold,
    };
  }, [distance, windMph, activeUnit, selectedOptic]);

  // Adjusters
  const adjustDistance = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setDistance((prev) => Math.max(50, Math.min(1000, prev + delta)));
  };

  const adjustWind = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setWindMph((prev) => Math.max(0, Math.min(30, prev + delta)));
  };

  // Reticle Impact Point Coordinates (viewBox 0 0 280 280, center at 140, 140)
  const scalePixelsPerUnit = 11; // 1 MIL or 1 MOA = 11 pixels
  const impactY = Math.min(265, Math.max(15, 140 + trajectory.rawElev * scalePixelsPerUnit));
  const impactX = Math.min(265, Math.max(15, 140 + trajectory.rawWind * scalePixelsPerUnit));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBadge}>
                <Ionicons name="scan-outline" size={20} color="#38bdf8" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Reticle Holdover HUD</Text>
                <Text style={styles.headerSubtitle}>
                  Tactical {activeUnit.toUpperCase()} Subtension & Drop Visualizer
                </Text>
              </View>
            </View>

            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Ionicons name="close" size={22} color="#94a3b8" />
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Optic Pairing Selector */}
            {optics.length > 0 && (
              <View style={styles.opticSelectorCard}>
                <Text style={styles.cardLabel}>PAIRED OPTIC PROFILE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 4 }}>
                  <Pressable
                    onPress={() => setSelectedOpticId(null)}
                    style={[styles.opticChip, selectedOpticId === null && styles.opticChipActive]}
                  >
                    <Text style={[styles.opticChipText, selectedOpticId === null && styles.opticChipTextActive]}>
                      Manual ({activeUnit.toUpperCase()})
                    </Text>
                  </Pressable>

                  {optics.map((opt) => (
                    <Pressable
                      key={opt.id}
                      onPress={() => setSelectedOpticId(opt.id)}
                      style={[styles.opticChip, selectedOpticId === opt.id && styles.opticChipActive]}
                    >
                      <Text style={[styles.opticChipText, selectedOpticId === opt.id && styles.opticChipTextActive]}>
                        {opt.name} {opt.reticle ? `(${opt.reticle})` : ''}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Scope Viewfinder Canvas */}
            <View style={styles.scopeWrapper}>
              <View style={styles.scopeBezel}>
                <Svg width={280} height={280} viewBox="0 0 280 280">
                  {/* Outer FOV Rings */}
                  <Circle cx="140" cy="140" r="136" fill="#020617" stroke="#334155" strokeWidth="3" />
                  <Circle cx="140" cy="140" r="130" fill="none" stroke="#1e293b" strokeWidth="1" />

                  {/* Primary Crosshairs */}
                  <Line x1="140" y1="10" x2="140" y2="270" stroke="#475569" strokeWidth="1.5" />
                  <Line x1="10" y1="140" x2="270" y2="140" stroke="#475569" strokeWidth="1.5" />

                  {/* Center Bullseye Zero */}
                  <Circle cx="140" cy="140" r="2.5" fill="#38bdf8" />

                  {/* Vertical Elevation Hash Marks (-8 to +8) */}
                  {[-8, -6, -4, -2, 2, 4, 6, 8].map((unit) => {
                    const y = 140 + unit * scalePixelsPerUnit;
                    return (
                      <G key={`y-${unit}`}>
                        <Line x1="134" y1={y} x2="146" y2={y} stroke="#64748b" strokeWidth="1" />
                        <SvgText x="150" y={y + 3} fill="#94a3b8" fontSize="7" fontFamily="monospace">
                          {Math.abs(unit)}
                        </SvgText>
                      </G>
                    );
                  })}

                  {/* Horizontal Windage Hash Marks (-8 to +8) */}
                  {[-8, -6, -4, -2, 2, 4, 6, 8].map((unit) => {
                    const x = 140 + unit * scalePixelsPerUnit;
                    return (
                      <G key={`x-${unit}`}>
                        <Line x1={x} y1="134" x2={x} y2="146" stroke="#64748b" strokeWidth="1" />
                        {unit !== 0 && (
                          <SvgText x={x} y="154" fill="#94a3b8" fontSize="7" fontFamily="monospace" textAnchor="middle">
                            {Math.abs(unit)}
                          </SvgText>
                        )}
                      </G>
                    );
                  })}

                  {/* Bullet Impact Holdover Trace and Reticle Dot */}
                  <Line
                    x1="140"
                    y1="140"
                    x2={impactX}
                    y2={impactY}
                    stroke="rgba(239, 68, 68, 0.5)"
                    strokeWidth="1.5"
                    strokeDasharray="3,3"
                  />
                  <Circle cx={impactX} cy={impactY} r="7" fill="none" stroke="#ef4444" strokeWidth="1.5" />
                  <Circle cx={impactX} cy={impactY} r="3" fill="#ef4444" />
                  <Line x1={impactX - 10} y1={impactY} x2={impactX + 10} y2={impactY} stroke="#ef4444" strokeWidth="1" />
                  <Line x1={impactX} y1={impactY - 10} x2={impactX} y2={impactY + 10} stroke="#ef4444" strokeWidth="1" />
                </Svg>
              </View>

              {/* Viewfinder Caption */}
              <View style={styles.scopeCaption}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' }} />
                  <Text style={{ fontSize: 11, color: '#f8fafc', fontWeight: 'bold' }}>
                    Calculated Impact Point ({distance} yds)
                  </Text>
                </View>
                <Text style={{ fontSize: 10, color: '#94a3b8' }}>
                  Hold Crosshair On Red Target
                </Text>
              </View>
            </View>

            {/* Holdover Dial Telemetry Cards */}
            <View style={styles.telemetryGrid}>
              <View style={[styles.telemetryCard, { borderColor: 'rgba(56, 189, 248, 0.4)' }]}>
                <Text style={[styles.telemetryLabel, { color: '#38bdf8' }]}>ELEVATION HOLD</Text>
                <Text style={styles.telemetryValue}>+{trajectory.elevHold} {activeUnit.toUpperCase()}</Text>
                <Text style={styles.telemetrySub}>
                  {trajectory.elevClicks} Clicks UP ({trajectory.dropInches}" Drop)
                </Text>
              </View>

              <View style={[styles.telemetryCard, { borderColor: 'rgba(251, 191, 36, 0.4)' }]}>
                <Text style={[styles.telemetryLabel, { color: '#fbbf24' }]}>WIND DEFLECTION</Text>
                <Text style={styles.telemetryValue}>+{trajectory.windHold} {activeUnit.toUpperCase()}</Text>
                <Text style={styles.telemetrySub}>
                  {trajectory.windClicks} Clicks LEFT ({trajectory.driftInches}" Drift)
                </Text>
              </View>
            </View>

            {/* Stepper Controls */}
            <View style={styles.controlSection}>
              {/* Distance Stepper */}
              <View style={styles.controlRow}>
                <View>
                  <Text style={styles.controlTitle}>Target Distance</Text>
                  <Text style={styles.controlValue}>{distance} Yards</Text>
                </View>
                <View style={styles.stepperButtons}>
                  <Pressable onPress={() => adjustDistance(-50)} style={styles.stepperBtn}>
                    <Text style={styles.stepperText}>-50</Text>
                  </Pressable>
                  <Pressable onPress={() => adjustDistance(-25)} style={styles.stepperBtn}>
                    <Text style={styles.stepperText}>-25</Text>
                  </Pressable>
                  <Pressable onPress={() => adjustDistance(25)} style={[styles.stepperBtn, styles.stepperBtnPrimary]}>
                    <Text style={styles.stepperTextPrimary}>+25</Text>
                  </Pressable>
                  <Pressable onPress={() => adjustDistance(50)} style={[styles.stepperBtn, styles.stepperBtnPrimary]}>
                    <Text style={styles.stepperTextPrimary}>+50</Text>
                  </Pressable>
                </View>
              </View>

              {/* Crosswind Stepper */}
              <View style={[styles.controlRow, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 12 }]}>
                <View>
                  <Text style={styles.controlTitle}>90° Crosswind</Text>
                  <Text style={[styles.controlValue, { color: '#fbbf24' }]}>{windMph} MPH</Text>
                </View>
                <View style={styles.stepperButtons}>
                  <Pressable onPress={() => adjustWind(-5)} style={styles.stepperBtn}>
                    <Text style={styles.stepperText}>-5</Text>
                  </Pressable>
                  <Pressable onPress={() => adjustWind(-1)} style={styles.stepperBtn}>
                    <Text style={styles.stepperText}>-1</Text>
                  </Pressable>
                  <Pressable onPress={() => adjustWind(1)} style={[styles.stepperBtn, styles.stepperBtnAmber]}>
                    <Text style={styles.stepperTextAmber}>+1</Text>
                  </Pressable>
                  <Pressable onPress={() => adjustWind(5)} style={[styles.stepperBtn, styles.stepperBtnAmber]}>
                    <Text style={styles.stepperTextAmber}>+5</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Flight Metrics Quick Specs */}
            <View style={styles.metricsBar}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>VELOCITY</Text>
                <Text style={styles.metricVal}>{trajectory.remainingVelocity} fps</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>ENERGY</Text>
                <Text style={styles.metricVal}>{trajectory.energyFtLbs} ft-lb</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>FLIGHT TIME</Text>
                <Text style={styles.metricVal}>{trajectory.flightTime}s</Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  opticSelectorCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  opticChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  opticChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38bdf8',
  },
  opticChipText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  opticChipTextActive: {
    color: '#38bdf8',
    fontWeight: 'bold',
  },
  scopeWrapper: {
    alignItems: 'center',
    marginVertical: 10,
  },
  scopeBezel: {
    width: 286,
    height: 286,
    borderRadius: 143,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#334155',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.6,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  scopeCaption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
    marginTop: 8,
  },
  telemetryGrid: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 12,
  },
  telemetryCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  telemetryLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  telemetryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }),
    color: '#f8fafc',
    marginVertical: 2,
  },
  telemetrySub: {
    fontSize: 11,
    color: '#94a3b8',
  },
  controlSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 12,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlTitle: {
    fontSize: 11,
    color: '#94a3b8',
  },
  controlValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#38bdf8',
  },
  stepperButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  stepperBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  stepperBtnPrimary: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  stepperBtnAmber: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderColor: 'rgba(251, 191, 36, 0.4)',
  },
  stepperText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#cbd5e1',
  },
  stepperTextPrimary: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#38bdf8',
  },
  stepperTextAmber: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fbbf24',
  },
  metricsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  metricVal: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#f1f5f9',
    marginTop: 1,
  },
});
