import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Dimensions,
  ScrollView,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Circle, Line, Text as SvgText, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import {
  Point,
  CalibrationScale,
  PRESET_CALIBRATIONS,
  calculatePixelsPerInch,
  calculateShotGrouping,
  GroupingMetrics,
  getDistance,
} from '../../utils/moaCalculator';
import { useDialog } from '../../context/DialogContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CANVAS_WIDTH = SCREEN_WIDTH - 32;

export default function GroupingCalculatorScreen() {
  const router = useRouter();
  const { photoUri, distanceYards: initialDist } = useLocalSearchParams<{
    photoUri: string;
    distanceYards: string;
  }>();
  const { showToast } = useDialog();

  const [activeStep, setActiveStep] = useState<'calibrate' | 'poa' | 'shots' | 'results'>('calibrate');
  const [distanceYards, setDistanceYards] = useState(initialDist ? String(initialDist) : '100');
  const [turretType, setTurretType] = useState<'1/4_moa' | '1/2_moa' | '1/8_moa' | '0.1_mil'>('1/4_moa');

  // Dynamic canvas height to match exact photo aspect ratio (no letterboxing)
  const [canvasHeight, setCanvasHeight] = useState(Math.round(CANVAS_WIDTH * 1.2));

  // Calibration State
  const [selectedCalibration, setSelectedCalibration] = useState<CalibrationScale>(PRESET_CALIBRATIONS[0]);
  const [customDistanceInput, setCustomDistanceInput] = useState('1.0');
  const [calPoint1, setCalPoint1] = useState<Point>({ x: Math.round(CANVAS_WIDTH * 0.25), y: 140 });
  const [calPoint2, setCalPoint2] = useState<Point>({ x: Math.round(CANVAS_WIDTH * 0.65), y: 140 });
  const [activeCalAnchor, setActiveCalAnchor] = useState<1 | 2>(1);

  // Shot & Reticle State
  const [poa, setPoa] = useState<Point | null>(null);
  const [shots, setShots] = useState<Point[]>([]);
  const [excludedShotIndices, setExcludedShotIndices] = useState<number[]>([]);
  const [selectedShotIndex, setSelectedShotIndex] = useState<number | null>(null);

  // Measure true image aspect ratio
  useEffect(() => {
    if (photoUri) {
      Image.getSize(
        photoUri,
        (width, height) => {
          if (width > 0 && height > 0) {
            const calculatedHeight = Math.round(CANVAS_WIDTH * (height / width));
            setCanvasHeight(calculatedHeight);
          }
        },
        (err) => console.log('Image getSize error:', err)
      );
    }
  }, [photoUri]);

  // Calculate Pixels Per Inch
  const pixelsPerInch = useMemo(() => {
    const knownInches =
      selectedCalibration.type === 'custom_2pt'
        ? parseFloat(customDistanceInput) || 1.0
        : selectedCalibration.knownDistanceInches;
    return calculatePixelsPerInch(calPoint1, calPoint2, knownInches);
  }, [calPoint1, calPoint2, selectedCalibration, customDistanceInput]);

  // Filtered active shots (excluding user-flagged flyers)
  const activeShots = useMemo(() => {
    return shots.filter((_, idx) => !excludedShotIndices.includes(idx));
  }, [shots, excludedShotIndices]);

  // Calculate Full Grouping Metrics
  const metrics: GroupingMetrics | null = useMemo(() => {
    const dist = parseFloat(distanceYards) || 100;
    return calculateShotGrouping(activeShots, pixelsPerInch, dist, poa, turretType);
  }, [activeShots, pixelsPerInch, distanceYards, poa, turretType]);

  // Find two shots defining Extreme Spread
  const extremeSpreadPair = useMemo(() => {
    if (activeShots.length < 2) return null;
    let maxDist = 0;
    let pair: [Point, Point] | null = null;
    for (let i = 0; i < activeShots.length; i++) {
      for (let j = i + 1; j < activeShots.length; j++) {
        const d = getDistance(activeShots[i], activeShots[j]);
        if (d > maxDist) {
          maxDist = d;
          pair = [activeShots[i], activeShots[j]];
        }
      }
    }
    return pair;
  }, [activeShots]);

  // Robust touch handler using clean overlay Pressable coordinates
  const handleCanvasPress = (e: any) => {
    const { locationX, locationY } = e.nativeEvent;
    const touchPoint: Point = { x: Math.round(locationX), y: Math.round(locationY) };

    if (activeStep === 'calibrate') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (activeCalAnchor === 1) {
        setCalPoint1(touchPoint);
      } else {
        setCalPoint2(touchPoint);
      }
    } else if (activeStep === 'poa') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setPoa(touchPoint);
      showToast({ message: 'Point of Aim (POA) set', type: 'info', durationMs: 1200 });
    } else if (activeStep === 'shots') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setShots((prev) => [...prev, touchPoint]);
      setSelectedShotIndex(shots.length);
    }
  };

  const handleNudge = (dx: number, dy: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (activeStep === 'calibrate') {
      if (activeCalAnchor === 1) {
        setCalPoint1((p) => ({ x: p.x + dx, y: p.y + dy }));
      } else {
        setCalPoint2((p) => ({ x: p.x + dx, y: p.y + dy }));
      }
    } else if (activeStep === 'poa' && poa) {
      setPoa((p) => (p ? { x: p.x + dx, y: p.y + dy } : null));
    } else if (activeStep === 'shots' && selectedShotIndex !== null && shots[selectedShotIndex]) {
      setShots((prev) =>
        prev.map((s, idx) => (idx === selectedShotIndex ? { x: s.x + dx, y: s.y + dy } : s))
      );
    }
  };

  const handleToggleFlyer = (idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setExcludedShotIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const handleDeleteSelectedShot = () => {
    if (selectedShotIndex === null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setShots((prev) => prev.filter((_, idx) => idx !== selectedShotIndex));
    setExcludedShotIndices((prev) =>
      prev
        .filter((i) => i !== selectedShotIndex)
        .map((i) => (i > selectedShotIndex ? i - 1 : i))
    );
    setSelectedShotIndex(null);
  };

  const handleUndoShot = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setShots((prev) => prev.slice(0, prev.length - 1));
    setSelectedShotIndex(null);
  };

  const handleClearShots = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setShots([]);
    setExcludedShotIndices([]);
    setSelectedShotIndex(null);
  };

  const handleApplyResults = async () => {
    if (!metrics || activeShots.length === 0) {
      showToast({ message: 'Place at least one active shot on the target', type: 'warning' });
      return;
    }

    try {
      const payload = {
        groupMetrics: metrics,
        calculatedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem('pending_moa_analysis', JSON.stringify(payload));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast({
        message: `Group attached: ${metrics.moa} MOA (${metrics.extremeSpreadInches}")`,
        type: 'success',
      });
      router.back();
    } catch (e) {
      console.error('Error saving MOA analysis:', e);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 110 }}>
      {/* Step Tabs Header */}
      <View style={styles.tabBar}>
        {[
          { key: 'calibrate', label: '1. Scale' },
          { key: 'poa', label: '2. Aim Point' },
          { key: 'shots', label: `3. Shots (${activeShots.length})` },
          { key: 'results', label: '4. Zero Report' },
        ].map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.stepTab, activeStep === tab.key && styles.stepTabActive]}
            onPress={() => {
              setActiveStep(tab.key as any);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }}
          >
            <Text
              style={[
                styles.stepTabText,
                activeStep === tab.key && styles.stepTabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Target Image & Clean Layered Canvas */}
      <View style={[styles.canvasContainer, { height: canvasHeight }]}>
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            style={styles.targetImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderTarget}>
            <Ionicons name="scan-circle-outline" size={64} color="#334155" />
            <Text style={{ color: '#64748b', marginTop: 8 }}>Target Preview Canvas</Text>
          </View>
        )}

        {/* SVG Drawing Layer (pointerEvents="none" to prevent coordinate interception) */}
        <Svg height={canvasHeight} width={CANVAS_WIDTH} style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* Step 1: Calibration Ruler */}
          {activeStep === 'calibrate' && (
            <G>
              <Line
                x1={calPoint1.x}
                y1={calPoint1.y}
                x2={calPoint2.x}
                y2={calPoint2.y}
                stroke="#38bdf8"
                strokeWidth="2.5"
                strokeDasharray="4, 4"
              />
              <Circle
                cx={calPoint1.x}
                cy={calPoint1.y}
                r="16"
                fill={activeCalAnchor === 1 ? 'rgba(56, 189, 248, 0.5)' : 'rgba(56, 189, 248, 0.2)'}
                stroke="#38bdf8"
                strokeWidth={activeCalAnchor === 1 ? '3' : '1.5'}
              />
              <SvgText
                x={calPoint1.x}
                y={calPoint1.y + 4.5}
                fill="#fff"
                fontSize="12"
                fontWeight="bold"
                textAnchor="middle"
              >
                A
              </SvgText>

              <Circle
                cx={calPoint2.x}
                cy={calPoint2.y}
                r="16"
                fill={activeCalAnchor === 2 ? 'rgba(56, 189, 248, 0.5)' : 'rgba(56, 189, 248, 0.2)'}
                stroke="#38bdf8"
                strokeWidth={activeCalAnchor === 2 ? '3' : '1.5'}
              />
              <SvgText
                x={calPoint2.x}
                y={calPoint2.y + 4.5}
                fill="#fff"
                fontSize="12"
                fontWeight="bold"
                textAnchor="middle"
              >
                B
              </SvgText>

              {/* Scale Label */}
              <SvgText
                x={(calPoint1.x + calPoint2.x) / 2}
                y={(calPoint1.y + calPoint2.y) / 2 - 12}
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
              <Circle cx={poa.x} cy={poa.y} r="18" fill="none" stroke="#06b6d4" strokeWidth="2.5" />
              <Line x1={poa.x - 24} y1={poa.y} x2={poa.x + 24} y2={poa.y} stroke="#06b6d4" strokeWidth="2" />
              <Line x1={poa.x} y1={poa.y - 24} x2={poa.x} y2={poa.y + 24} stroke="#06b6d4" strokeWidth="2" />
              <Circle cx={poa.x} cy={poa.y} r="3" fill="#06b6d4" />
              <SvgText x={poa.x} y={poa.y - 22} fill="#06b6d4" fontSize="10" fontWeight="bold" textAnchor="middle">
                POA
              </SvgText>
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
              strokeWidth="2.5"
              strokeDasharray="4, 4"
            />
          )}

          {/* Group Center (Centroid) */}
          {metrics && activeShots.length > 1 && (
            <G>
              <Circle
                cx={metrics.groupCenter.x}
                cy={metrics.groupCenter.y}
                r={Math.max(14, (metrics.extremeSpreadInches * pixelsPerInch) / 2)}
                fill="rgba(16, 185, 129, 0.12)"
                stroke="#10b981"
                strokeWidth="1.5"
              />
              <Line
                x1={metrics.groupCenter.x - 8}
                y1={metrics.groupCenter.y}
                x2={metrics.groupCenter.x + 8}
                y2={metrics.groupCenter.y}
                stroke="#10b981"
                strokeWidth="2"
              />
              <Line
                x1={metrics.groupCenter.x}
                y1={metrics.groupCenter.y - 8}
                x2={metrics.groupCenter.x}
                y2={metrics.groupCenter.y + 8}
                stroke="#10b981"
                strokeWidth="2"
              />
            </G>
          )}

          {/* Numbered Shot Impact Points */}
          {shots.map((shot, idx) => {
            const isExcluded = excludedShotIndices.includes(idx);
            const isSelected = selectedShotIndex === idx;
            return (
              <G key={idx} opacity={isExcluded ? 0.35 : 1.0}>
                <Circle
                  cx={shot.x}
                  cy={shot.y}
                  r={isSelected ? 13 : 11}
                  fill={isExcluded ? '#64748b' : '#f97316'}
                  stroke={isSelected ? '#38bdf8' : '#fff'}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                />
                <SvgText
                  x={shot.x}
                  y={shot.y + 4}
                  fill="#fff"
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {isExcluded ? '✕' : idx + 1}
                </SvgText>
              </G>
            );
          })}
        </Svg>

        {/* Dedicated Transparent Touch Overlay with guaranteed clean coordinate mapping */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleCanvasPress}
        />
      </View>

      {/* Fine-Tuning Precision Nudge Controls */}
      <View style={styles.nudgeBar}>
        <Text style={styles.nudgeLabel}>
          {activeStep === 'calibrate'
            ? `Nudge Anchor ${activeCalAnchor === 1 ? 'A' : 'B'}:`
            : activeStep === 'poa'
            ? 'Nudge POA Crosshair:'
            : selectedShotIndex !== null
            ? `Nudge Shot #${selectedShotIndex + 1}:`
            : 'Precision Nudge (1px):'}
        </Text>
        <View style={styles.nudgeButtons}>
          <Pressable style={styles.nudgeBtn} onPress={() => handleNudge(-1, 0)}>
            <Ionicons name="chevron-back" size={16} color="#38bdf8" />
          </Pressable>
          <Pressable style={styles.nudgeBtn} onPress={() => handleNudge(0, -1)}>
            <Ionicons name="chevron-up" size={16} color="#38bdf8" />
          </Pressable>
          <Pressable style={styles.nudgeBtn} onPress={() => handleNudge(0, 1)}>
            <Ionicons name="chevron-down" size={16} color="#38bdf8" />
          </Pressable>
          <Pressable style={styles.nudgeBtn} onPress={() => handleNudge(1, 0)}>
            <Ionicons name="chevron-forward" size={16} color="#38bdf8" />
          </Pressable>
        </View>
      </View>

      {/* Step 1: Calibration Control Deck */}
      {activeStep === 'calibrate' && (
        <View style={styles.deckCard}>
          <Text style={styles.deckTitle}>Step 1: Scale Calibration</Text>
          <Text style={styles.deckDesc}>
            Select a reference scale preset below, then choose Anchor A or B and tap on the target image to set its position.
          </Text>

          {/* Explicit Anchor Selector to eliminate accidental switching */}
          <View style={styles.anchorSelectorRow}>
            <Pressable
              style={[styles.anchorTab, activeCalAnchor === 1 && styles.anchorTabActive]}
              onPress={() => setActiveCalAnchor(1)}
            >
              <Ionicons name="locate-outline" size={14} color={activeCalAnchor === 1 ? '#38bdf8' : '#94a3b8'} style={{ marginRight: 4 }} />
              <Text style={[styles.anchorTabText, activeCalAnchor === 1 && styles.anchorTabTextActive]}>
                Anchor A ({calPoint1.x}, {calPoint1.y})
              </Text>
            </Pressable>

            <Pressable
              style={[styles.anchorTab, activeCalAnchor === 2 && styles.anchorTabActive]}
              onPress={() => setActiveCalAnchor(2)}
            >
              <Ionicons name="locate-outline" size={14} color={activeCalAnchor === 2 ? '#38bdf8' : '#94a3b8'} style={{ marginRight: 4 }} />
              <Text style={[styles.anchorTabText, activeCalAnchor === 2 && styles.anchorTabTextActive]}>
                Anchor B ({calPoint2.x}, {calPoint2.y})
              </Text>
            </Pressable>
          </View>

          <View style={styles.chipRow}>
            {PRESET_CALIBRATIONS.map((preset) => (
              <Pressable
                key={preset.type}
                style={[
                  styles.chip,
                  selectedCalibration.type === preset.type && styles.chipActive,
                ]}
                onPress={() => {
                  setSelectedCalibration(preset);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedCalibration.type === preset.type && styles.chipTextActive,
                  ]}
                >
                  {preset.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {selectedCalibration.type === 'custom_2pt' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <Text style={{ color: '#94a3b8', fontSize: 13 }}>Distance (inches):</Text>
              <TextInput
                style={styles.miniInput}
                keyboardType="numeric"
                value={customDistanceInput}
                onChangeText={setCustomDistanceInput}
              />
            </View>
          )}

          <Pressable
            style={styles.actionBtnPrimary}
            onPress={() => setActiveStep('poa')}
          >
            <Text style={styles.actionBtnText}>Confirm Scale ({pixelsPerInch.toFixed(0)} px/in) → Set Aim</Text>
          </Pressable>
        </View>
      )}

      {/* Step 2: Point of Aim Control Deck */}
      {activeStep === 'poa' && (
        <View style={styles.deckCard}>
          <Text style={styles.deckTitle}>Step 2: Point of Aim (POA)</Text>
          <Text style={styles.deckDesc}>
            Tap on the target bullseye or optic reticle location to calculate exact scope zeroing click adjustments.
          </Text>

          {poa ? (
            <View style={styles.poaInfoBox}>
              <Ionicons name="checkmark-circle" size={16} color="#06b6d4" style={{ marginRight: 6 }} />
              <Text style={{ color: '#06b6d4', fontWeight: 'bold', fontSize: 13 }}>
                POA Set at ({poa.x}, {poa.y})
              </Text>
            </View>
          ) : (
            <View style={styles.poaPromptBox}>
              <Ionicons name="information-circle-outline" size={16} color="#38bdf8" style={{ marginRight: 6 }} />
              <Text style={{ color: '#94a3b8', fontSize: 12.5 }}>
                Tap on the bullseye above to set your Point of Aim.
              </Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Pressable
              style={[styles.actionBtnSecondary, { flex: 1 }]}
              onPress={() => {
                setPoa(null);
                setActiveStep('shots');
              }}
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

      {/* Step 3: Shots Control Deck */}
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
            Tap directly on bullet holes on the image. Tap a shot chip below to select, nudge, or toggle flyer exclusion.
          </Text>

          {/* Shot Chips for Flyer / Outlier Exclusion */}
          {shots.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
              {shots.map((_, idx) => {
                const isExcluded = excludedShotIndices.includes(idx);
                const isSelected = selectedShotIndex === idx;
                return (
                  <Pressable
                    key={idx}
                    style={[
                      styles.shotChip,
                      isSelected && styles.shotChipSelected,
                      isExcluded && styles.shotChipExcluded,
                    ]}
                    onPress={() => setSelectedShotIndex(idx)}
                  >
                    <Text
                      style={[
                        styles.shotChipText,
                        isExcluded && { textDecorationLine: 'line-through', color: '#64748b' },
                      ]}
                    >
                      Shot #{idx + 1}
                    </Text>
                    <Pressable onPress={() => handleToggleFlyer(idx)} style={{ marginLeft: 4 }}>
                      <Ionicons
                        name={isExcluded ? 'eye-off' : 'eye'}
                        size={13}
                        color={isExcluded ? '#ef4444' : '#38bdf8'}
                      />
                    </Pressable>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {selectedShotIndex !== null && (
            <View style={styles.selectedShotBar}>
              <Text style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: 12 }}>
                Shot #{selectedShotIndex + 1} Selected
              </Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable
                  style={styles.shotActionBtn}
                  onPress={() => handleToggleFlyer(selectedShotIndex)}
                >
                  <Text style={styles.shotActionBtnText}>
                    {excludedShotIndices.includes(selectedShotIndex) ? 'Include in Group' : 'Exclude (Flyer)'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.shotActionBtn, { borderColor: 'rgba(239, 68, 68, 0.4)' }]}
                  onPress={handleDeleteSelectedShot}
                >
                  <Ionicons name="trash-outline" size={12} color="#ef4444" />
                </Pressable>
              </View>
            </View>
          )}

          {/* Quick HUD Metrics Bar */}
          {metrics && activeShots.length > 1 && (
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

      {/* Step 4: Results & Zeroing Report */}
      {activeStep === 'results' && (
        <View style={styles.deckCard}>
          <Text style={styles.deckTitle}>Group Accuracy & Zeroing Analysis</Text>

          {/* Distance Config */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 10 }}>
            <Text style={{ color: '#94a3b8', fontWeight: 'bold', fontSize: 13 }}>Target Distance:</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {['25', '50', '100', '200', '300'].map((d) => (
                <Pressable
                  key={d}
                  style={[styles.distChip, distanceYards === d && styles.distChipActive]}
                  onPress={() => setDistanceYards(d)}
                >
                  <Text style={[styles.distChipText, distanceYards === d && styles.distChipTextActive]}>
                    {d}y
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Turret Format Selector */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Text style={{ color: '#94a3b8', fontWeight: 'bold', fontSize: 13 }}>Optic Turret:</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {(['1/4_moa', '1/2_moa', '1/8_moa', '0.1_mil'] as const).map((t) => (
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="disc-outline" size={13} color="#38bdf8" />
                  <Text style={styles.reportLabel}>Extreme Spread (Group Size):</Text>
                </View>
                <Text style={styles.reportValue}>
                  {metrics.extremeSpreadInches} in ({metrics.extremeSpreadMm} mm)
                </Text>
              </View>

              <View style={styles.reportRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="calculator-outline" size={13} color="#34d399" />
                  <Text style={styles.reportLabel}>Minute of Angle (MOA):</Text>
                </View>
                <Text style={[styles.reportValue, { color: '#34d399', fontSize: 15 }]}>
                  {metrics.moa} MOA ({metrics.mil} MIL)
                </Text>
              </View>

              <View style={styles.reportRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="resize-outline" size={13} color="#fbbf24" />
                  <Text style={styles.reportLabel}>Horizontal × Vertical Spread:</Text>
                </View>
                <Text style={styles.reportValue}>
                  {metrics.horizontalSpreadInches}" W × {metrics.verticalSpreadInches}" H
                </Text>
              </View>

              <View style={styles.reportRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="locate-outline" size={13} color="#c084fc" />
                  <Text style={styles.reportLabel}>Mean Radius (MR) & Radial SD:</Text>
                </View>
                <Text style={styles.reportValue}>
                  {metrics.meanRadiusInches}" (SD: {metrics.radialSdInches}")
                </Text>
              </View>

              {/* Point of Aim & Scope Turret Click Recommendations */}
              {metrics.poaOffsetInches && metrics.turretAdjustment && (
                <View style={styles.turretBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Ionicons name="scan-outline" size={15} color="#38bdf8" />
                    <Text style={styles.turretTitle}>Scope Zeroing Click Adjustments</Text>
                  </View>
                  <Text style={styles.turretOffset}>
                    Impact Bias: {Math.abs(metrics.poaOffsetInches.elevation)}" {metrics.poaOffsetInches.elevation >= 0 ? 'HIGH' : 'LOW'}, {Math.abs(metrics.poaOffsetInches.windage)}" {metrics.poaOffsetInches.windage >= 0 ? 'RIGHT' : 'LEFT'}
                  </Text>

                  <View style={styles.clickCardRow}>
                    <View style={styles.clickCard}>
                      <Text style={styles.clickDir}>
                        {metrics.turretAdjustment.elevationDirection === 'DOWN'
                          ? '▼ DIAL DOWN'
                          : metrics.turretAdjustment.elevationDirection === 'UP'
                          ? '▲ DIAL UP'
                          : 'ELEVATION ZEROED'}
                      </Text>
                      <Text style={styles.clickNumber}>
                        {metrics.turretAdjustment.elevationClicks} CLICKS ({metrics.turretAdjustment.clickUnitLabel})
                      </Text>
                    </View>

                    <View style={styles.clickCard}>
                      <Text style={styles.clickDir}>
                        {metrics.turretAdjustment.windageDirection === 'LEFT'
                          ? '◄ DIAL LEFT'
                          : metrics.turretAdjustment.windageDirection === 'RIGHT'
                          ? '► DIAL RIGHT'
                          : 'WINDAGE ZEROED'}
                      </Text>
                      <Text style={styles.clickNumber}>
                        {metrics.turretAdjustment.windageClicks} CLICKS ({metrics.turretAdjustment.clickUnitLabel})
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Action Button */}
          <Pressable style={styles.actionBtnPrimary} onPress={handleApplyResults}>
            <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.actionBtnText}>Attach Group Analysis to Range Session</Text>
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
    marginBottom: 10,
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
  anchorSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 8,
  },
  anchorTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  anchorTabActive: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  anchorTabText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  anchorTabTextActive: {
    color: '#38bdf8',
    fontWeight: 'bold',
  },
  poaInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
  },
  poaPromptBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
  },
  nudgeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  nudgeLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  nudgeButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  nudgeBtn: {
    backgroundColor: '#0f172a',
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
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
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  deckDesc: {
    color: '#94a3b8',
    fontSize: 12.5,
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
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  chipText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  shotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  shotChipSelected: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  shotChipExcluded: {
    borderColor: '#475569',
  },
  shotChipText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '600',
  },
  selectedShotBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  shotActionBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  shotActionBtnText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  distChip: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  distChipActive: {
    backgroundColor: '#059669',
    borderColor: '#10b981',
  },
  distChipText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  distChipTextActive: {
    color: '#ffffff',
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
    fontSize: 12.5,
    fontWeight: '600',
  },
  reportValue: {
    color: '#f8fafc',
    fontSize: 12.5,
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
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  actionBtnPrimary: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 8,
    marginTop: 12,
  },
  actionBtnSecondary: {
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 8,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13.5,
  },
  actionBtnSecondaryText: {
    color: '#cbd5e1',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
