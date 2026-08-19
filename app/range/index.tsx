import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Image } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSync } from '../../context/SyncContext';
import { useDialog } from '../../context/DialogContext';

export default function RangeSessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ firearmId?: string }>();
  const { addToQueue } = useSync();
  const { showToast, showError } = useDialog();

  const [firearms, setFirearms] = useState<any[]>([]);
  const [ammoList, setAmmoList] = useState<any[]>([]);

  const [selectedFirearmId, setSelectedFirearmId] = useState<number | null>(
    params.firearmId ? Number(params.firearmId) : null
  );
  const [selectedAmmoId, setSelectedAmmoId] = useState<number | null>(null);
  const [roundsFired, setRoundsFired] = useState('50');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [moaMetrics, setMoaMetrics] = useState<any | null>(null);

  // Environmental & Advanced Details (Collapsible for advanced users)
  const [showAdvancedEnv, setShowAdvancedEnv] = useState(false);
  const [temperatureF, setTemperatureF] = useState('72');
  const [windSpeedMph, setWindSpeedMph] = useState('5');
  const [windDirection, setWindDirection] = useState('3 o\'clock');
  const [targetDistanceYds, setTargetDistanceYds] = useState('100');

  // Malfunctions state
  const [malfunctions, setMalfunctions] = useState<{ [key: string]: number }>({
    FTF: 0,
    FTE: 0,
    stovepipe: 0,
    double_feed: 0,
    light_strike: 0,
  });
  const [suspectedCause, setSuspectedCause] = useState<string>('unknown');
  const [magId, setMagId] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadInventory();
      checkPendingMoa();
    }, [])
  );

  const totalMalfunctions = Object.values(malfunctions).reduce((a, b) => a + b, 0);

  const incrementMalfunction = (type: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setMalfunctions(prev => ({ ...prev, [type]: (prev[type] || 0) + 1 }));
  };

  const decrementMalfunction = (type: string) => {
    setMalfunctions(prev => ({ ...prev, [type]: Math.max(0, (prev[type] || 0) - 1) }));
  };

  const checkPendingMoa = async () => {
    try {
      const moaStr = await AsyncStorage.getItem('pending_moa_analysis');
      if (moaStr) {
        const data = JSON.parse(moaStr);
        if (data.groupMetrics) {
          setMoaMetrics(data.groupMetrics);
        }
        await AsyncStorage.removeItem('pending_moa_analysis');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadInventory = async () => {
    try {
      const cacheStr = await AsyncStorage.getItem('inventory_cache');
      if (cacheStr) {
        const cache = JSON.parse(cacheStr);
        const fList = cache.firearms || [];
        const aList = cache.ammo || [];
        setFirearms(fList);
        setAmmoList(aList);

        if (!selectedFirearmId && fList.length > 0) {
          setSelectedFirearmId(fList[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const selectedFirearm = firearms.find(f => f.id === selectedFirearmId);
  const selectedAmmo = ammoList.find(a => a.id === selectedAmmoId);

  // Filter matching ammo by firearm caliber
  const matchingAmmo = ammoList.filter(a => {
    if (!selectedFirearm || !selectedFirearm.caliber || !a.caliber) return false;
    const fCal = selectedFirearm.caliber.toLowerCase().replace(/[^a-z0-9]/g, '');
    const aCal = a.caliber.toLowerCase().replace(/[^a-z0-9]/g, '');
    return aCal.includes(fCal) || fCal.includes(aCal);
  });

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const openGroupingCalculator = () => {
    if (!photo) {
      showToast({ message: 'Capture a target photo first', type: 'warning' });
      return;
    }
    router.push({
      pathname: '/range/grouping-calculator',
      params: { photoUri: photo, distanceYards: targetDistanceYds || '100' }
    });
  };

  // Quick incremental round adder
  const addIncrementalRounds = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const current = parseInt(roundsFired) || 0;
    setRoundsFired(String(Math.max(0, current + delta)));
  };

  const handleQueueRangeSession = async () => {
    if (!selectedFirearmId) {
      showToast({ message: 'Please select a firearm', type: 'warning' });
      return;
    }
    const rounds = parseInt(roundsFired) || 0;
    if (rounds <= 0) {
      showToast({ message: 'Please enter a valid rounds fired count', type: 'warning' });
      return;
    }

    try {
      const recordedMalfunctions = Object.entries(malfunctions)
        .filter(([_, count]) => count > 0)
        .map(([type, count]) => ({
          type,
          count,
          mag_id: magId || undefined,
          ammo_id: selectedAmmoId || undefined,
          suspected_cause: suspectedCause !== 'unknown' ? suspectedCause : undefined
        }));

      const newSession = {
        type: 'range_session',
        firearm_id: selectedFirearmId,
        ammo_id: selectedAmmoId || undefined,
        rounds_fired: rounds,
        date: new Date().toISOString().split('T')[0],
        notes: notes.trim(),
        photoBase64: photo,
        group_metrics: moaMetrics || undefined,
        malfunctions: recordedMalfunctions.length > 0 ? recordedMalfunctions : undefined,
        environmental: showAdvancedEnv ? {
          temperatureF: temperatureF ? parseFloat(temperatureF) : undefined,
          windSpeedMph: windSpeedMph ? parseFloat(windSpeedMph) : undefined,
          windDirection: windDirection || undefined,
          distanceYards: targetDistanceYds ? parseFloat(targetDistanceYds) : undefined,
        } : undefined,
        timestamp: new Date().toISOString()
      };

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const msg = `Queued range session: ${selectedFirearm?.make} ${selectedFirearm?.model} (${rounds} rds)${totalMalfunctions > 0 ? ` • ${totalMalfunctions} Malfunctions` : ''}`;
      await addToQueue(newSession, msg);
      router.back();
    } catch (e) {
      console.error(e);
      showError('Save Error', 'Failed to save range session');
    }
  };

  const parsedRounds = parseInt(roundsFired) || 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* 1. Firearm Selector */}
      <Text style={styles.sectionHeader}>1. Select Firearm</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorRow}>
        {firearms.map(f => (
          <Pressable
            key={f.id}
            style={[styles.firearmCard, selectedFirearmId === f.id && styles.firearmCardActive]}
            onPress={() => {
              setSelectedFirearmId(f.id);
              setSelectedAmmoId(null);
            }}
          >
            <Text style={[styles.firearmMakeText, selectedFirearmId === f.id && styles.activeText]}>
              {f.make}
            </Text>
            <Text style={[styles.firearmModelText, selectedFirearmId === f.id && styles.activeText]}>
              {f.model}
            </Text>
            <View style={styles.caliberBadge}>
              <Text style={styles.caliberBadgeText}>{f.caliber}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* 2. Ammunition Selector */}
      <Text style={styles.sectionHeader}>2. Ammunition Expended (Optional)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorRow}>
        <Pressable
          style={[styles.ammoCard, selectedAmmoId === null && styles.ammoCardActive]}
          onPress={() => setSelectedAmmoId(null)}
        >
          <Text style={[styles.ammoTitle, selectedAmmoId === null && styles.activeText]}>
            No Inventory Deduction
          </Text>
          <Text style={styles.ammoSubtitle}>Range / Handloaded ammo</Text>
        </Pressable>

        {matchingAmmo.map(ammo => (
          <Pressable
            key={ammo.id}
            style={[styles.ammoCard, selectedAmmoId === ammo.id && styles.ammoCardActive]}
            onPress={() => setSelectedAmmoId(ammo.id)}
          >
            <Text style={[styles.ammoTitle, selectedAmmoId === ammo.id && styles.activeText]}>
              {ammo.manufacturer || ''} {ammo.grain ? `${ammo.grain}gr ` : ''}{ammo.projectile || ''}
            </Text>
            <Text style={styles.ammoSubtitle}>
              In Stock: {ammo.count} rds
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Ammo Deduction Summary Pill */}
      {selectedAmmo && parsedRounds > 0 && (
        <View style={styles.deductionCard}>
          <Ionicons name="information-circle-outline" size={16} color="#38bdf8" style={{ marginRight: 6 }} />
          <Text style={styles.deductionText}>
            Deducting <Text style={{ color: '#f8fafc', fontWeight: 'bold' }}>{parsedRounds} rds</Text> from {selectedAmmo.manufacturer} {selectedAmmo.caliber} (Remaining: {Math.max(0, selectedAmmo.count - parsedRounds)} rds)
          </Text>
        </View>
      )}

      {/* 3. Rounds Fired */}
      <Text style={styles.sectionHeader}>3. Rounds Fired</Text>
      <View style={styles.roundsInputRow}>
        <TextInput
          style={styles.roundsInput}
          keyboardType="number-pad"
          value={roundsFired}
          onChangeText={setRoundsFired}
          placeholder="e.g. 50"
        />
        {/* Incremental Steppers (+10, +25, +50, +100) */}
        <View style={styles.incrementalRow}>
          {[10, 25, 50, 100].map(inc => (
            <Pressable
              key={inc}
              style={styles.incBtn}
              onPress={() => addIncrementalRounds(inc)}
            >
              <Text style={styles.incBtnText}>+{inc}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Absolute Rounds Presets */}
      <View style={styles.stepperRow}>
        {[20, 25, 50, 100, 150, 200, 250, 500].map(amt => (
          <Pressable
            key={amt}
            style={[styles.stepperChip, roundsFired === String(amt) && styles.stepperChipActive]}
            onPress={() => setRoundsFired(String(amt))}
          >
            <Text style={[styles.stepperText, roundsFired === String(amt) && styles.stepperTextActive]}>
              {amt} rds
            </Text>
          </Pressable>
        ))}
      </View>

      {/* 4. Malfunction & Reliability Diagnostics */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={styles.sectionHeader}>4. Reliability & Stoppages</Text>
        {totalMalfunctions > 0 && (
          <View style={styles.malfunctionPill}>
            <Text style={styles.malfunctionPillText}>⚠️ {totalMalfunctions} Total</Text>
          </View>
        )}
      </View>

      <View style={styles.malfunctionGrid}>
        {[
          { key: 'FTF', label: 'Feed (FTF)' },
          { key: 'FTE', label: 'Extract (FTE)' },
          { key: 'stovepipe', label: 'Stovepipe' },
          { key: 'double_feed', label: 'Dbl Feed' },
          { key: 'light_strike', label: 'Light Strike' },
        ].map(m => (
          <View key={m.key} style={[styles.malfunctionBox, malfunctions[m.key] > 0 && styles.malfunctionBoxActive]}>
            <Text style={styles.malfunctionLabel}>{m.label}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Pressable style={styles.miniCounterBtn} onPress={() => decrementMalfunction(m.key)}>
                <Text style={styles.miniCounterText}>-</Text>
              </Pressable>
              <Text style={[styles.counterValText, malfunctions[m.key] > 0 && { color: '#ef4444' }]}>
                {malfunctions[m.key]}
              </Text>
              <Pressable style={[styles.miniCounterBtn, { backgroundColor: '#ef4444' }]} onPress={() => incrementMalfunction(m.key)}>
                <Text style={[styles.miniCounterText, { color: '#fff' }]}>+</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      {totalMalfunctions > 0 && (
        <View style={styles.causeCard}>
          <Text style={styles.causeTitle}>Suspected Root Cause & Component Tag:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginVertical: 6 }}>
            {[
              { key: 'ammo_profile_mismatch', label: 'Bullet Profile (Flat Nose/JHP)' },
              { key: 'low_pressure_cycling', label: 'Low Pressure / Comp Short-Stroke' },
              { key: 'dirty_powder_fouling', label: 'Dirty Powder / Carbon Fouling' },
              { key: 'steel_case_expansion', label: 'Steel Case Sticking' },
              { key: 'magazine_spring', label: 'Magazine Feed Lips / Spring' },
              { key: 'unknown', label: 'Unknown / Random' },
            ].map(c => (
              <Pressable
                key={c.key}
                style={[styles.causeChip, suspectedCause === c.key && styles.causeChipActive]}
                onPress={() => setSuspectedCause(c.key)}
              >
                <Text style={[styles.causeChipText, suspectedCause === c.key && styles.causeChipTextActive]}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <TextInput
            style={styles.magInput}
            placeholder="Optional Mag ID (e.g. Mag #3 PMAG 30)..."
            placeholderTextColor="#64748b"
            value={magId}
            onChangeText={setMagId}
          />
        </View>
      )}

      {/* 5. Target Photo & Group Analysis */}
      <Text style={styles.sectionHeader}>5. Target Photo & MOA Analysis</Text>
      <Pressable style={styles.photoButton} onPress={takePhoto}>
        <Ionicons name="camera" size={18} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.photoBtnText}>{photo ? 'Retake Target Photo' : 'Capture Target / Grouping Photo'}</Text>
      </Pressable>

      {photo && (
        <View style={{ marginBottom: 16 }}>
          <Image source={{ uri: photo }} style={styles.previewImage} />
          
          <Pressable style={styles.moaToolBtn} onPress={openGroupingCalculator}>
            <Ionicons name="scan-outline" size={18} color="#38bdf8" style={{ marginRight: 6 }} />
            <Text style={styles.moaToolBtnText}>
              {moaMetrics ? '✏️ Re-Measure Group & Scope Adjustments' : '🎯 Measure Shot Group & MOA (Photo)'}
            </Text>
          </Pressable>

          {moaMetrics && (
            <View style={styles.moaBadgeCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={styles.moaBadgeTitle}>🎯 Measured Grouping</Text>
                <Text style={styles.moaValueText}>{moaMetrics.moa} MOA</Text>
              </View>
              <Text style={styles.moaDetailText}>
                Extreme Spread: {moaMetrics.extremeSpreadInches}" ({moaMetrics.extremeSpreadMm} mm) • {moaMetrics.shotCount} Shots • Mean Radius: {moaMetrics.meanRadiusInches}"
              </Text>
              {moaMetrics.turretAdjustment && (
                <Text style={styles.turretSummaryText}>
                  Scope Zero: Dial {moaMetrics.turretAdjustment.elevationDirection} {moaMetrics.turretAdjustment.elevationClicks} clicks, {moaMetrics.turretAdjustment.windageDirection} {moaMetrics.turretAdjustment.windageClicks} clicks ({moaMetrics.turretAdjustment.clickUnitLabel})
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* 6. Session Notes */}
      <Text style={styles.sectionHeader}>6. Target / Session Notes</Text>
      <TextInput
        style={styles.textArea}
        multiline
        numberOfLines={3}
        value={notes}
        onChangeText={setNotes}
        placeholder="e.g. 25 yards zeroing, tight 1-inch grouping, ran flawlessly..."
        placeholderTextColor="#64748b"
      />

      {/* 7. Advanced Environmental & Ballistics Details (Collapsible Drawer) */}
      <Pressable 
        style={styles.advancedToggle} 
        onPress={() => setShowAdvancedEnv(!showAdvancedEnv)}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="partly-sunny-outline" size={18} color="#38bdf8" style={{ marginRight: 8 }} />
          <Text style={styles.advancedToggleTitle}>Environmental & Weather Log</Text>
          <Text style={styles.advancedOptionalBadge}>Optional</Text>
        </View>
        <Ionicons name={showAdvancedEnv ? "chevron-up" : "chevron-down"} size={18} color="#94a3b8" />
      </Pressable>

      {showAdvancedEnv && (
        <View style={styles.advancedCard}>
          <View style={styles.envGrid}>
            <View style={styles.envField}>
              <Text style={styles.envLabel}>Distance (Yds)</Text>
              <TextInput
                style={styles.envInput}
                keyboardType="numeric"
                value={targetDistanceYds}
                onChangeText={setTargetDistanceYds}
                placeholder="100"
                placeholderTextColor="#64748b"
              />
            </View>

            <View style={styles.envField}>
              <Text style={styles.envLabel}>Temperature (°F)</Text>
              <TextInput
                style={styles.envInput}
                keyboardType="numeric"
                value={temperatureF}
                onChangeText={setTemperatureF}
                placeholder="72"
                placeholderTextColor="#64748b"
              />
            </View>

            <View style={styles.envField}>
              <Text style={styles.envLabel}>Wind (mph)</Text>
              <TextInput
                style={styles.envInput}
                keyboardType="numeric"
                value={windSpeedMph}
                onChangeText={setWindSpeedMph}
                placeholder="5"
                placeholderTextColor="#64748b"
              />
            </View>

            <View style={styles.envField}>
              <Text style={styles.envLabel}>Wind Direction</Text>
              <TextInput
                style={styles.envInput}
                value={windDirection}
                onChangeText={setWindDirection}
                placeholder="3 o'clock"
                placeholderTextColor="#64748b"
              />
            </View>
          </View>
        </View>
      )}

      {/* Submit Button */}
      <Pressable style={styles.submitBtn} onPress={handleQueueRangeSession}>
        <Ionicons name="cloud-upload-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.submitBtnText}>
          Queue Range Session ({roundsFired || 0} rds)
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 8,
  },
  selectorRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  firearmCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#334155',
    minWidth: 140,
  },
  firearmCardActive: {
    backgroundColor: '#065f46',
    borderColor: '#10b981',
  },
  firearmMakeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  firearmModelText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginVertical: 2,
  },
  caliberBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  caliberBadgeText: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: 'bold',
  },
  ammoCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#334155',
    minWidth: 150,
  },
  ammoCardActive: {
    backgroundColor: '#065f46',
    borderColor: '#10b981',
  },
  ammoTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  ammoSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  activeText: {
    color: '#fff',
  },
  deductionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    marginBottom: 8,
  },
  deductionText: {
    color: '#38bdf8',
    fontSize: 12,
    flex: 1,
  },
  roundsInputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  roundsInput: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    width: 110,
    textAlign: 'center',
  },
  incrementalRow: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
  },
  incBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  incBtnText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: 'bold',
  },
  stepperRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  stepperChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#1e293b',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  stepperChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38bdf8',
  },
  stepperText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepperTextActive: {
    color: '#38bdf8',
  },
  malfunctionPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  malfunctionPillText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: 'bold',
  },
  malfunctionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  malfunctionBox: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    width: '31%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  malfunctionBoxActive: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  malfunctionLabel: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: 'bold',
  },
  miniCounterBtn: {
    backgroundColor: '#334155',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCounterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  counterValText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: 'bold',
    minWidth: 16,
    textAlign: 'center',
  },
  causeCard: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  causeTitle: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  causeChip: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  causeChipActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#ef4444',
  },
  causeChipText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  causeChipTextActive: {
    color: '#ef4444',
    fontWeight: 'bold',
  },
  magInput: {
    backgroundColor: '#0f172a',
    color: '#fff',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 6,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  photoBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 8,
  },
  moaToolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38bdf8',
    marginBottom: 8,
  },
  moaToolBtnText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: 'bold',
  },
  moaBadgeCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  moaBadgeTitle: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: 'bold',
  },
  moaValueText: {
    color: '#34d399',
    fontSize: 16,
    fontWeight: 'bold',
  },
  moaDetailText: {
    color: '#cbd5e1',
    fontSize: 11,
    marginTop: 2,
  },
  turretSummaryText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  textArea: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
    textAlignVertical: 'top',
  },
  advancedToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 14,
  },
  advancedToggleTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: 'bold',
  },
  advancedOptionalBadge: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: 'bold',
    backgroundColor: '#0f172a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
    textTransform: 'uppercase',
  },
  advancedCard: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 6,
  },
  envGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  envField: {
    width: '48%',
  },
  envLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  envInput: {
    backgroundColor: '#1e293b',
    color: '#fff',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 18,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
