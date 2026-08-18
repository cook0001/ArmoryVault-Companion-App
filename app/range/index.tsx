import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Image } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
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
      params: { photoUri: photo, distanceYards: '100' }
    });
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
        notes,
        photoBase64: photo,
        group_metrics: moaMetrics || undefined,
        malfunctions: recordedMalfunctions.length > 0 ? recordedMalfunctions : undefined,
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

  return (
    <ScrollView style={styles.container}>
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
            No Ammo Deduction
          </Text>
          <Text style={styles.ammoSubtitle}>Range / Reloaded ammo</Text>
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

      {/* 3. Rounds Fired */}
      <Text style={styles.sectionHeader}>3. Rounds Fired</Text>
      <TextInput
        style={styles.roundsInput}
        keyboardType="number-pad"
        value={roundsFired}
        onChangeText={setRoundsFired}
        placeholder="e.g. 50"
      />

      <View style={styles.stepperRow}>
        {[25, 50, 100, 150, 200, 250, 500].map(amt => (
          <Pressable
            key={amt}
            style={styles.stepperChip}
            onPress={() => setRoundsFired(String(amt))}
          >
            <Text style={styles.stepperText}>{amt} rds</Text>
          </Pressable>
        ))}
      </View>

      {/* 4. Malfunction & Reliability Diagnostics */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={styles.sectionHeader}>4. Reliability & Malfunctions</Text>
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

      {/* 5. Notes */}
      <Text style={styles.sectionHeader}>5. Target / Session Notes</Text>
      <TextInput
        style={styles.textArea}
        multiline
        numberOfLines={3}
        value={notes}
        onChangeText={setNotes}
        placeholder="e.g. 25 yards zeroing, tight 1-inch grouping, ran flawlessly..."
        placeholderTextColor="#64748b"
      />

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
    marginTop: 4,
  },
  activeText: {
    color: '#ffffff',
  },
  roundsInput: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    color: '#f8fafc',
    borderRadius: 8,
    padding: 14,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  stepperRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 12,
  },
  stepperChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#334155',
  },
  stepperText: {
    color: '#f8fafc',
    fontWeight: 'bold',
    fontSize: 12,
  },
  textArea: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    color: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
    padding: 14,
    borderRadius: 8,
    marginBottom: 14,
  },
  photoBtnText: {
    color: '#f8fafc',
    fontWeight: 'bold',
    fontSize: 14,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  moaToolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    borderColor: '#38bdf8',
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  moaToolBtnText: {
    color: '#38bdf8',
    fontWeight: 'bold',
    fontSize: 13,
  },
  moaBadgeCard: {
    backgroundColor: '#0f172a',
    borderColor: '#10b981',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  moaBadgeTitle: {
    color: '#cbd5e1',
    fontWeight: 'bold',
    fontSize: 13,
  },
  moaValueText: {
    color: '#34d399',
    fontWeight: 'bold',
    fontSize: 15,
  },
  moaDetailText: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 16,
  },
  turretSummaryText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },
  malfunctionPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#ef4444',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  malfunctionPillText: {
    color: '#ef4444',
    fontWeight: 'bold',
    fontSize: 11,
  },
  malfunctionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  malfunctionBox: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  malfunctionBoxActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: '#ef4444',
  },
  malfunctionLabel: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  miniCounterBtn: {
    backgroundColor: '#334155',
    width: 22,
    height: 22,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCounterText: {
    color: '#f8fafc',
    fontSize: 12,
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
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  causeTitle: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: 'bold',
  },
  causeChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  causeChipActive: {
    backgroundColor: '#991b1b',
    borderColor: '#ef4444',
  },
  causeChipText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
  },
  causeChipTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  magInput: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 11,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  submitBtn: {
    flexDirection: 'row',
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    marginTop: 6,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  }
});
