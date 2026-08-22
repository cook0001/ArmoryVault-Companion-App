import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

export default function FirearmScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [logType, setLogType] = useState<'range' | 'maintenance' | 'photo'>('range');
  const [notes, setNotes] = useState('');
  const [roundCount, setRoundCount] = useState('50');
  const [photo, setPhoto] = useState<string | null>(null);

  const [firearmData, setFirearmData] = useState<any | null>(null);
  const [availableAmmo, setAvailableAmmo] = useState<any[]>([]);
  const [selectedAmmoId, setSelectedAmmoId] = useState<number | null>(null);

  useEffect(() => {
    loadCachedFirearm();
  }, [id]);

  const loadCachedFirearm = async () => {
    try {
      const cacheStr = await AsyncStorage.getItem('inventory_cache');
      if (cacheStr) {
        const cache = JSON.parse(cacheStr);
        const fId = String(id);

        if (cache.firearms) {
          const found = cache.firearms.find((f: any) => String(f.id) === fId);
          if (found) {
            setFirearmData(found);

            // Filter matching caliber ammo
            if (cache.ammo && found.caliber) {
              const cleanCal = found.caliber.toLowerCase().replace(/[^a-z0-9]/g, '');
              const matched = cache.ammo.filter((a: any) => {
                if (!a.caliber) return false;
                const ammoCal = a.caliber.toLowerCase().replace(/[^a-z0-9]/g, '');
                return ammoCal.includes(cleanCal) || cleanCal.includes(ammoCal);
              });
              setAvailableAmmo(matched);
              if (matched.length > 0) {
                setSelectedAmmoId(matched[0].id);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('Error loading cached firearm:', e);
    }
  };

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

  const handleSaveOffline = async () => {
    try {
      let newLog: any;
      
      if (logType === 'photo') {
        if (!photo) {
          alert('Please take a photo first');
          return;
        }
        newLog = {
          type: 'firearm_photo',
          firearmId: id,
          photoBase64: photo,
          timestamp: new Date().toISOString()
        };
      } else if (logType === 'range') {
        const parsedRounds = parseInt(roundCount) || 0;
        if (parsedRounds <= 0) {
          alert('Enter a valid round count');
          return;
        }

        newLog = {
          type: 'range_session',
          firearm_id: Number(id),
          ammo_id: selectedAmmoId || undefined,
          rounds_fired: parsedRounds,
          date: new Date().toISOString().split('T')[0],
          notes,
          photoBase64: photo,
          timestamp: new Date().toISOString()
        };
      } else {
        newLog = {
          type: 'firearm_log',
          firearmId: id,
          logType: 'maintenance',
          notes,
          roundCount: 0,
          photoBase64: photo,
          timestamp: new Date().toISOString()
        };
      }

      const queueStr = await AsyncStorage.getItem('offline_queue');
      const queue = queueStr ? JSON.parse(queueStr) : [];
      queue.push(newLog);
      await AsyncStorage.setItem('offline_queue', JSON.stringify(queue));

      alert(logType === 'range' ? `Queued range session (${roundCount} rds)!` : 'Saved offline!');
      router.back();
    } catch (e) {
      console.error(e);
      alert('Failed to save');
    }
  };

  return (
    <ScrollView style={styles.container}>
      {firearmData ? (
        <View style={styles.card}>
          <Text style={styles.firearmMake}>{firearmData.make}</Text>
          <Text style={styles.firearmModel}>{firearmData.model}</Text>
          <View style={styles.badgeRow}>
            {firearmData.caliber && (
              <View style={styles.caliberBadge}>
                <Text style={styles.caliberBadgeText}>{firearmData.caliber}</Text>
              </View>
            )}
            {firearmData.serial_number && (
              <View style={styles.serialBadge}>
                <Text style={styles.serialBadgeText}>S/N: {firearmData.serial_number}</Text>
              </View>
            )}
            <View style={[styles.roundsBadge, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
              <Ionicons name="locate-outline" size={11} color="#34d399" />
              <Text style={styles.roundsBadgeText}>{firearmData.total_rounds || 0} rds</Text>
            </View>
          </View>
        </View>
      ) : (
        <Text style={styles.title}>Firearm #{id}</Text>
      )}
      
      <View style={styles.tabContainer}>
        <Pressable 
          style={[styles.tab, logType === 'range' && styles.activeTab]} 
          onPress={() => setLogType('range')}
        >
          <Text style={[styles.tabText, logType === 'range' && styles.activeTabText]}>Range Session</Text>
        </Pressable>
        <Pressable 
          style={[styles.tab, logType === 'maintenance' && styles.activeTab]} 
          onPress={() => setLogType('maintenance')}
        >
          <Text style={[styles.tabText, logType === 'maintenance' && styles.activeTabText]}>Maintenance</Text>
        </Pressable>
        <Pressable 
          style={[styles.tab, logType === 'photo' && styles.activeTab]} 
          onPress={() => setLogType('photo')}
        >
          <Text style={[styles.tabText, logType === 'photo' && styles.activeTabText]}>Add Photo</Text>
        </Pressable>
      </View>

      {logType === 'range' && (
        <>
          <Text style={styles.label}>Rounds Fired</Text>
          <TextInput 
            style={styles.input} 
            keyboardType="numeric" 
            value={roundCount}
            onChangeText={setRoundCount}
            placeholder="e.g. 100"
          />

          {/* Quick Steppers */}
          <View style={styles.stepperContainer}>
            {[20, 50, 100, 150, 200, 250, 500].map(amt => (
              <Pressable
                key={amt}
                style={styles.stepperChip}
                onPress={() => setRoundCount(String(amt))}
              >
                <Text style={styles.stepperText}>{amt} rds</Text>
              </Pressable>
            ))}
          </View>

          {/* Ammunition Selection */}
          {availableAmmo.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={styles.label}>Deduct Ammunition (Optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  style={[styles.ammoChip, selectedAmmoId === null && styles.ammoChipActive]}
                  onPress={() => setSelectedAmmoId(null)}
                >
                  <Text style={[styles.ammoChipText, selectedAmmoId === null && styles.ammoChipTextActive]}>
                    None (Don't Deduct)
                  </Text>
                </Pressable>
                {availableAmmo.map(ammo => (
                  <Pressable
                    key={ammo.id}
                    style={[styles.ammoChip, selectedAmmoId === ammo.id && styles.ammoChipActive]}
                    onPress={() => setSelectedAmmoId(ammo.id)}
                  >
                    <Text style={[styles.ammoChipText, selectedAmmoId === ammo.id && styles.ammoChipTextActive]}>
                      {ammo.manufacturer} {ammo.grain ? `${ammo.grain}gr ` : ''}{ammo.projectile || ''} ({ammo.count} rds)
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </>
      )}

      {logType !== 'photo' && (
        <>
          <Text style={styles.label}>Notes / Description</Text>
          <TextInput 
            style={styles.textArea} 
            multiline 
            numberOfLines={3} 
            value={notes}
            onChangeText={setNotes}
            placeholder={logType === 'range' ? 'Target groupings, zeroing, malfunctions...' : 'Cleaning, parts inspected...'}
          />
        </>
      )}

      {logType === 'photo' && (
        <Text style={{ marginBottom: 16, color: '#64748b' }}>
          Take a new photo of this firearm to add to its inspection card gallery.
        </Text>
      )}

      <Pressable style={styles.photoButton} onPress={takePhoto}>
        <Text style={styles.buttonText}>{photo ? 'Retake Photo' : 'Capture Photo (Optional)'}</Text>
      </Pressable>

      {photo && (
        <Image source={{ uri: photo }} style={styles.previewImage} />
      )}

      <Pressable 
        style={[styles.saveButton, { backgroundColor: logType === 'range' ? '#10b981' : '#3b82f6' }]} 
        onPress={handleSaveOffline}
      >
        <Text style={styles.saveButtonText}>
          {logType === 'range' ? `Queue Range Session (${roundCount || 0} rds)` : 'Save Offline'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#0f172a',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#f8fafc',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    padding: 4,
  },
  tab: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#f8fafc',
  },
  label: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#cbd5e1',
  },
  input: {
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    height: 100,
    textAlignVertical: 'top',
  },
  photoButton: {
    backgroundColor: '#334155',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#f8fafc',
    fontWeight: 'bold',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 40,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },
  firearmMake: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  firearmModel: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginTop: 2,
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  caliberBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: '#3b82f6',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  caliberBadgeText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: 'bold',
  },
  serialBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  serialBadgeText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  roundsBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roundsBadgeText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepperContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
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
  ammoChip: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  ammoChipActive: {
    backgroundColor: '#065f46',
    borderColor: '#10b981',
  },
  ammoChipText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  ammoChipTextActive: {
    color: '#ffffff',
  }
});
