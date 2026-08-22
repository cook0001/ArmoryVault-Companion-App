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

  const handleQueueRangeSession = async () => {
    if (!selectedFirearmId) {
      showError('Firearm Required', 'Please select a firearm for this range session.');
      return;
    }
    const rounds = parseInt(roundsFired) || 0;
    if (rounds <= 0) {
      showError('Rounds Required', 'Please enter a valid count of rounds fired.');
      return;
    }

    try {
      const newSession = {
        type: 'range_session',
        firearm_id: selectedFirearmId,
        ammo_id: selectedAmmoId || undefined,
        rounds_fired: rounds,
        date: new Date().toISOString().split('T')[0],
        notes,
        photoBase64: photo,
        timestamp: new Date().toISOString()
      };

      await addToQueue(
        newSession,
        `Queued range session with ${selectedFirearm?.make} ${selectedFirearm?.model} (${rounds} rds)!`
      );

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      console.error(e);
      showError('Error', 'Failed to save range session');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 110 }}>
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
              {ammo.manufacturer} {ammo.caliber}
            </Text>
            <Text style={styles.ammoSubtitle}>
              {ammo.grain ? `${ammo.grain}gr ` : ''}{ammo.projectile || ''} • {ammo.count} rds in vault
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* 3. Rounds Fired */}
      <Text style={styles.sectionHeader}>3. Rounds Fired</Text>
      <TextInput
        style={styles.roundsInput}
        keyboardType="numeric"
        value={roundsFired}
        onChangeText={setRoundsFired}
        selectTextOnFocus
      />
      <View style={styles.stepperRow}>
        {['10', '20', '50', '100', '150', '200'].map(val => (
          <Pressable
            key={val}
            style={styles.stepperChip}
            onPress={() => setRoundsFired(val)}
          >
            <Text style={styles.stepperText}>+{val}</Text>
          </Pressable>
        ))}
      </View>

      {/* 4. Notes & Target Photo */}
      <Text style={styles.sectionHeader}>4. Notes & Target Image</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Session notes, zero adjustments, target groupings, conditions..."
        placeholderTextColor="#64748b"
        multiline
        numberOfLines={3}
        value={notes}
        onChangeText={setNotes}
      />

      <Pressable style={styles.photoButton} onPress={takePhoto}>
        <Ionicons name="camera" size={18} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.photoBtnText}>{photo ? 'Retake Target Photo' : 'Capture Target / Grouping Photo'}</Text>
      </Pressable>

      {photo && (
        <Image source={{ uri: photo }} style={styles.previewImage} />
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
    fontSize: 14,
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
    marginBottom: 16,
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
