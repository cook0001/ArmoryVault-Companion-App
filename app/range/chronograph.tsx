import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSync } from '../../context/SyncContext';
import { useDialog } from '../../context/DialogContext';

export default function ChronographScreen() {
  const router = useRouter();
  const { addToQueue, syncedIp } = useSync();
  const { showToast, showSuccess } = useDialog();

  const [firearms, setFirearms] = useState<any[]>([]);
  const [ammoList, setAmmoList] = useState<any[]>([]);
  const [selectedFirearmId, setSelectedFirearmId] = useState<number | null>(null);
  const [selectedAmmoId, setSelectedAmmoId] = useState<number | null>(null);

  // Velocity entries
  const [velocities, setVelocities] = useState<number[]>([]);
  const [currentVelocity, setCurrentVelocity] = useState('');
  const [temperature, setTemperature] = useState('');
  const [distance, setDistance] = useState('15');
  const [notes, setNotes] = useState('');
  
  // Animation tracking
  const animValues = useRef<Map<number, Animated.Value>>(new Map());
  const entryCounter = useRef(0);

  useFocusEffect(
    useCallback(() => {
      loadInventory();
    }, [])
  );

  const loadInventory = async () => {
    try {
      const cacheStr = await AsyncStorage.getItem('inventory_cache');
      if (cacheStr) {
        const cache = JSON.parse(cacheStr);
        setFirearms(cache.firearms || []);
        setAmmoList(cache.ammo || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const addVelocity = () => {
    const vel = parseInt(currentVelocity);
    if (isNaN(vel) || vel <= 0) {
      showToast({ message: 'Enter a valid velocity in fps', type: 'warning' });
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    
    // Create animation for new entry
    const key = entryCounter.current++;
    const animVal = new Animated.Value(0);
    animValues.current.set(key, animVal);
    
    setVelocities(prev => [...prev, vel]);
    setCurrentVelocity('');
    
    // Trigger slide-in spring animation
    Animated.spring(animVal, {
      toValue: 1,
      friction: 7,
      tension: 80,
      useNativeDriver: true,
    }).start();
  };

  const removeVelocity = (index: number) => {
    setVelocities(prev => prev.filter((_, i) => i !== index));
  };

  // Statistics
  const avg = velocities.length > 0 ? Math.round(velocities.reduce((a, b) => a + b, 0) / velocities.length) : 0;
  const es = velocities.length > 1 ? Math.max(...velocities) - Math.min(...velocities) : 0;
  const sd = velocities.length > 1 ? Math.round(Math.sqrt(velocities.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / (velocities.length - 1)) * 10) / 10 : 0;

  const selectedFirearm = firearms.find(f => f.id === selectedFirearmId);

  const handleSave = async () => {
    if (velocities.length < 3) {
      showToast({ message: 'Record at least 3 shots for meaningful statistics', type: 'warning' });
      return;
    }
    if (!selectedFirearmId) {
      showToast({ message: 'Please select a firearm', type: 'warning' });
      return;
    }

    const chronoData = {
      type: 'chrono_string',
      firearm_id: selectedFirearmId,
      ammo_id: selectedAmmoId || undefined,
      chrono_data: {
        firearmId: selectedFirearmId,
        ammoId: selectedAmmoId || undefined,
        ammoLabel: selectedAmmoId
          ? (() => {
              const a = ammoList.find(am => am.id === selectedAmmoId);
              return a ? `${a.manufacturer || ''} ${a.caliber} ${a.grain ? a.grain + 'gr' : ''}`.trim() : '';
            })()
          : undefined,
        shotVelocities: velocities,
        averageVelocity: avg,
        standardDeviation: sd,
        extremeSpread: es,
        temperature: temperature ? parseFloat(temperature) : undefined,
        distanceYards: distance ? parseFloat(distance) : 15,
        date: new Date().toISOString().split('T')[0],
        notes: notes.trim() || undefined,
      },
      timestamp: new Date().toISOString(),
    };

    // If connected, also POST directly to desktop chrono endpoint
    if (syncedIp) {
      try {
        await fetch(`http://${syncedIp}:3456/api/chrono`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chronoData.chrono_data),
        });
      } catch { /* Will queue anyway */ }
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await addToQueue(chronoData, `Chrono: ${velocities.length} shots • Avg ${avg} fps • SD ${sd}`);
    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderColor: '#34d399' }]}>
          <Text style={styles.statValue}>{avg || '—'}</Text>
          <Text style={styles.statLabel}>AVG fps</Text>
        </View>
        <View style={[styles.statCard, { borderColor: sd <= 10 ? '#34d399' : sd <= 20 ? '#f59e0b' : '#ef4444' }]}>
          <Text style={[styles.statValue, { color: sd <= 10 ? '#34d399' : sd <= 20 ? '#f59e0b' : '#ef4444' }]}>{sd || '—'}</Text>
          <Text style={styles.statLabel}>SD</Text>
        </View>
        <View style={[styles.statCard, { borderColor: '#60a5fa' }]}>
          <Text style={styles.statValue}>{es || '—'}</Text>
          <Text style={styles.statLabel}>ES fps</Text>
        </View>
        <View style={[styles.statCard, { borderColor: '#a78bfa' }]}>
          <Text style={styles.statValue}>{velocities.length}</Text>
          <Text style={styles.statLabel}>Shots</Text>
        </View>
      </View>

      {/* Firearm Selector */}
      <Text style={styles.sectionHeader}>Firearm</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
        {firearms.map(f => (
          <Pressable
            key={f.id}
            style={[styles.selectorCard, selectedFirearmId === f.id && styles.selectorCardActive]}
            onPress={() => { setSelectedFirearmId(f.id); setSelectedAmmoId(null); }}
          >
            <Text style={[styles.selectorTitle, selectedFirearmId === f.id && { color: '#fff' }]}>{f.make} {f.model}</Text>
            <Text style={styles.selectorSub}>{f.caliber}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Ammo Selector */}
      <Text style={styles.sectionHeader}>Ammo (Optional)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
        <Pressable
          style={[styles.selectorCard, selectedAmmoId === null && styles.selectorCardActive]}
          onPress={() => setSelectedAmmoId(null)}
        >
          <Text style={[styles.selectorTitle, selectedAmmoId === null && { color: '#fff' }]}>No Selection</Text>
        </Pressable>
        {ammoList
          .filter(a => {
            if (!selectedFirearm) return false;
            const fCal = (selectedFirearm.caliber || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const aCal = (a.caliber || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return aCal.includes(fCal) || fCal.includes(aCal);
          })
          .map(a => (
            <Pressable
              key={a.id}
              style={[styles.selectorCard, selectedAmmoId === a.id && styles.selectorCardActive]}
              onPress={() => setSelectedAmmoId(a.id)}
            >
              <Text style={[styles.selectorTitle, selectedAmmoId === a.id && { color: '#fff' }]}>
                {a.manufacturer || ''} {a.grain ? `${a.grain}gr` : ''} {a.projectile || ''}
              </Text>
              <Text style={styles.selectorSub}>{a.count} rds</Text>
            </Pressable>
          ))}
      </ScrollView>

      {/* Velocity Input */}
      <Text style={styles.sectionHeader}>Record Velocities (fps)</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Enter velocity fps"
          placeholderTextColor="#64748b"
          keyboardType="numeric"
          value={currentVelocity}
          onChangeText={setCurrentVelocity}
          onSubmitEditing={addVelocity}
          returnKeyType="done"
        />
        <Pressable style={styles.addButton} onPress={addVelocity}>
          <Ionicons name="add-circle" size={28} color="#34d399" />
        </Pressable>
      </View>

      {/* Velocity List */}
      {velocities.length > 0 && (
        <View style={styles.velocityList}>
          {velocities.map((vel, i) => {
            const animVal = animValues.current.get(i) || new Animated.Value(1);
            const translateX = animVal.interpolate({ inputRange: [0, 1], outputRange: [60, 0] });
            const opacity = animVal.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
            return (
              <Animated.View
                key={i}
                style={[styles.velocityItem, { transform: [{ translateX }], opacity }]}
              >
                <Text style={styles.velocityIndex}>#{i + 1}</Text>
                <Text style={styles.velocityValue}>{vel} fps</Text>
                <Pressable onPress={() => removeVelocity(i)}>
                  <Ionicons name="close-circle" size={20} color="#ef4444" />
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      )}

      {/* Environment */}
      <Text style={styles.sectionHeader}>Conditions (Optional)</Text>
      <View style={styles.inputRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Temperature (°F)</Text>
          <TextInput
            style={styles.input}
            placeholder="72"
            placeholderTextColor="#64748b"
            keyboardType="numeric"
            value={temperature}
            onChangeText={setTemperature}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Chrono Distance (ft)</Text>
          <TextInput
            style={styles.input}
            placeholder="15"
            placeholderTextColor="#64748b"
            keyboardType="numeric"
            value={distance}
            onChangeText={setDistance}
          />
        </View>
      </View>

      <Text style={styles.fieldLabel}>Notes</Text>
      <TextInput
        style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
        placeholder="Lot #, conditions, barrel temp..."
        placeholderTextColor="#64748b"
        multiline
        value={notes}
        onChangeText={setNotes}
      />

      {/* Save Button */}
      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Ionicons name="speedometer" size={20} color="#000" />
        <Text style={styles.saveButtonText}>
          Save Chrono String ({velocities.length} shots)
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 8 },
  statCard: {
    flex: 1, backgroundColor: 'rgba(30,41,59,0.8)', borderRadius: 12, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(100,116,139,0.3)',
  },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '800', fontFamily: 'monospace' },
  statLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '600', marginTop: 2 },
  sectionHeader: { color: '#94a3b8', fontSize: 13, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  selectorCard: {
    backgroundColor: 'rgba(30,41,59,0.8)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    marginRight: 10, borderWidth: 1, borderColor: 'rgba(100,116,139,0.3)', minWidth: 120,
  },
  selectorCardActive: { backgroundColor: 'rgba(52,211,153,0.2)', borderColor: '#34d399' },
  selectorTitle: { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },
  selectorSub: { color: '#64748b', fontSize: 11, marginTop: 2 },
  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'flex-end' },
  input: {
    backgroundColor: 'rgba(30,41,59,0.8)', borderRadius: 10, borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.3)', paddingHorizontal: 14, paddingVertical: 10,
    color: '#fff', fontSize: 15, marginBottom: 8,
  },
  fieldLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  addButton: { padding: 4, marginBottom: 8 },
  velocityList: { marginBottom: 16, gap: 4 },
  velocityItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(30,41,59,0.6)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
  },
  velocityIndex: { color: '#64748b', fontSize: 12, fontWeight: '700', width: 28 },
  velocityValue: { color: '#fff', fontSize: 15, fontWeight: '600', fontFamily: 'monospace', flex: 1 },
  saveButton: {
    backgroundColor: '#34d399', borderRadius: 12, paddingVertical: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16,
  },
  saveButtonText: { color: '#000', fontSize: 15, fontWeight: '700' },
});
