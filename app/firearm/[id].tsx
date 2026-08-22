import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSync } from '../../context/SyncContext';
import { useDialog } from '../../context/DialogContext';
import { calculateFirearmWear } from '../../utils/maintenanceManager';

export default function FirearmScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { addToQueue } = useSync();
  const { showToast, showError } = useDialog();
  
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
      let toastMsg = '';
      
      if (logType === 'photo') {
        if (!photo) {
          showToast({ message: 'Please capture a photo first', type: 'warning' });
          return;
        }
        newLog = {
          type: 'firearm_photo',
          firearmId: id,
          photoBase64: photo,
          timestamp: new Date().toISOString()
        };
        toastMsg = `Queued new photo for ${firearmData?.make || 'Firearm'} ${firearmData?.model || id}`;
      } else if (logType === 'range') {
        const parsedRounds = parseInt(roundCount) || 0;
        if (parsedRounds <= 0) {
          showToast({ message: 'Please enter a valid round count', type: 'warning' });
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
        toastMsg = `Queued range session: ${parsedRounds} rds (${firearmData?.make || ''} ${firearmData?.model || id})`;
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
        toastMsg = `Saved maintenance log for ${firearmData?.make || 'Firearm'} ${firearmData?.model || id}`;
      }

      await addToQueue(newLog, toastMsg);
      router.back();
    } catch (e) {
      console.error(e);
      showError('Save Failed', 'Could not queue firearm log');
    }
  };

  const totalRounds = firearmData?.total_rounds || 0;
  const wearStatus = calculateFirearmWear(totalRounds);

  const handleQuickServiceReset = async (serviceName: string, serviceType: string) => {
    try {
      const newLog = {
        type: 'firearm_maintenance',
        firearm_id: Number(id),
        service_type: serviceType,
        notes: `Performed ${serviceName} service reset`,
        reset_counter: true,
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString()
      };
      await addToQueue(newLog, `Logged ${serviceName} for ${firearmData?.make} ${firearmData?.model}`);
      showToast({ message: `Reset ${serviceName} counter`, type: 'success' });
    } catch (e) {
      console.error(e);
      showError('Service Error', 'Failed to log service reset');
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
              <Ionicons name="disc-outline" size={12} color="#38bdf8" />
              <Text style={styles.roundsBadgeText}>{totalRounds} rds</Text>
            </View>
          </View>

          {/* Component Wear Progress Gauges */}
          <View style={styles.wearContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Ionicons name="construct-outline" size={15} color="#38bdf8" />
              <Text style={styles.wearHeader}>Component Wear Lifecycle</Text>
            </View>

            {/* Recoil Spring */}
            <View style={styles.wearItem}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={styles.wearLabel}>{wearStatus.recoilSpring.name}</Text>
                <Text style={[styles.wearVal, wearStatus.recoilSpring.status === 'overdue' ? { color: '#ef4444' } : wearStatus.recoilSpring.status === 'warning' ? { color: '#f59e0b' } : { color: '#10b981' }]}>
                  {wearStatus.recoilSpring.currentRounds} / {wearStatus.recoilSpring.thresholdRounds} rds ({wearStatus.recoilSpring.percentage}%)
                </Text>
              </View>
              <View style={styles.wearTrack}>
                <View style={[styles.wearFill, { width: `${wearStatus.recoilSpring.percentage}%`, backgroundColor: wearStatus.recoilSpring.status === 'overdue' ? '#ef4444' : wearStatus.recoilSpring.status === 'warning' ? '#f59e0b' : '#10b981' }]} />
              </View>
              <Pressable style={styles.resetWearBtn} onPress={() => handleQuickServiceReset('Recoil Spring Replacement', 'recoil_spring')}>
                <Ionicons name="refresh-circle-outline" size={14} color="#38bdf8" />
                <Text style={styles.resetWearBtnText}>Log Spring Replacement</Text>
              </Pressable>
            </View>

            {/* Clean & Lube */}
            <View style={[styles.wearItem, { marginTop: 10 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={styles.wearLabel}>{wearStatus.deepClean.name}</Text>
                <Text style={[styles.wearVal, wearStatus.deepClean.status === 'overdue' ? { color: '#ef4444' } : wearStatus.deepClean.status === 'warning' ? { color: '#f59e0b' } : { color: '#10b981' }]}>
                  {wearStatus.deepClean.currentRounds} / {wearStatus.deepClean.thresholdRounds} rds ({wearStatus.deepClean.percentage}%)
                </Text>
              </View>
              <View style={styles.wearTrack}>
                <View style={[styles.wearFill, { width: `${wearStatus.deepClean.percentage}%`, backgroundColor: wearStatus.deepClean.status === 'overdue' ? '#ef4444' : wearStatus.deepClean.status === 'warning' ? '#f59e0b' : '#10b981' }]} />
              </View>
              <Pressable style={styles.resetWearBtn} onPress={() => handleQuickServiceReset('Clean & Lube', 'deep_clean')}>
                <Ionicons name="sparkles-outline" size={14} color="#38bdf8" />
                <Text style={styles.resetWearBtnText}>Log Clean & Lube</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        <Text style={styles.title}>Firearm #{id}</Text>
      )}

      {/* Mode Tabs */}
      <View style={styles.tabContainer}>
        <Pressable 
          style={[styles.tab, logType === 'range' && styles.activeTab, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]} 
          onPress={() => setLogType('range')}
        >
          <Ionicons name="disc-outline" size={15} color={logType === 'range' ? '#38bdf8' : '#94a3b8'} />
          <Text style={[styles.tabText, logType === 'range' && styles.activeTabText]}>Range Session</Text>
        </Pressable>
        <Pressable 
          style={[styles.tab, logType === 'maintenance' && styles.activeTab, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]} 
          onPress={() => setLogType('maintenance')}
        >
          <Ionicons name="build-outline" size={15} color={logType === 'maintenance' ? '#38bdf8' : '#94a3b8'} />
          <Text style={[styles.tabText, logType === 'maintenance' && styles.activeTabText]}>Maintenance</Text>
        </Pressable>
        <Pressable 
          style={[styles.tab, logType === 'photo' && styles.activeTab, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]} 
          onPress={() => setLogType('photo')}
        >
          <Ionicons name="camera-outline" size={15} color={logType === 'photo' ? '#38bdf8' : '#94a3b8'} />
          <Text style={[styles.tabText, logType === 'photo' && styles.activeTabText]}>Photo</Text>
        </Pressable>
      </View>

      {logType === 'range' && (
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.label}>Rounds Fired</Text>
          <TextInput 
            style={styles.input} 
            keyboardType="numeric" 
            value={roundCount}
            onChangeText={setRoundCount}
            placeholder="e.g. 50"
          />

          {/* Quick Round Steppers */}
          <View style={styles.stepperContainer}>
            {[25, 50, 100, 200].map(amt => (
              <Pressable
                key={amt}
                style={styles.stepperChip}
                onPress={() => setRoundCount(String(amt))}
              >
                <Text style={styles.stepperText}>{amt} rds</Text>
              </Pressable>
            ))}
          </View>

          {availableAmmo.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={styles.label}>Deduct Matching Ammunition</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                <Pressable
                  style={[styles.ammoChip, selectedAmmoId === null && styles.ammoChipActive]}
                  onPress={() => setSelectedAmmoId(null)}
                >
                  <Text style={[styles.ammoChipText, selectedAmmoId === null && styles.ammoChipTextActive]}>
                    No Deduction
                  </Text>
                </Pressable>
                {availableAmmo.map(a => (
                  <Pressable
                    key={a.id}
                    style={[styles.ammoChip, selectedAmmoId === a.id && styles.ammoChipActive]}
                    onPress={() => setSelectedAmmoId(a.id)}
                  >
                    <Text style={[styles.ammoChipText, selectedAmmoId === a.id && styles.ammoChipTextActive]}>
                      {a.manufacturer || ''} {a.grain ? `${a.grain}gr` : ''} ({a.count} rds)
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      )}

      {logType !== 'photo' && (
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.label}>Notes & Observations</Text>
          <TextInput 
            style={styles.textArea} 
            multiline 
            numberOfLines={4}
            value={notes}
            onChangeText={setNotes}
            placeholder={logType === 'range' ? "Target groupings, ammo performance, zeroing..." : "Deep clean, oiling, parts replaced..."}
            placeholderTextColor="#64748b"
          />
        </View>
      )}

      {/* Target or Maintenance Photo */}
      <View style={{ marginBottom: 20 }}>
        <Pressable style={styles.photoButton} onPress={takePhoto}>
          <Text style={styles.photoButtonText}>
            {photo ? '📷 Retake Photo' : logType === 'photo' ? '📷 Capture Firearm Photo' : '📷 Attach Target / Log Photo'}
          </Text>
        </Pressable>

        {photo && (
          <Image source={{ uri: photo }} style={styles.previewImage} />
        )}
      </View>

      <Pressable style={styles.saveButton} onPress={handleSaveOffline}>
        <Text style={styles.saveButtonText}>
          {logType === 'range' ? `Queue Range Session (${roundCount} rds)` : logType === 'photo' ? 'Save New Photo' : 'Queue Maintenance Log'}
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
  card: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  firearmMake: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  firearmModel: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginVertical: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
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
  title: {
    fontSize: 20,
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
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#3b82f6',
  },
  tabText: {
    color: '#94a3b8',
    fontWeight: 'bold',
    fontSize: 12,
  },
  activeTabText: {
    color: '#fff',
  },
  label: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#cbd5e1',
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    fontSize: 22,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  stepperContainer: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
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
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  ammoChipActive: {
    backgroundColor: '#065f46',
    borderColor: '#10b981',
  },
  ammoChipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  ammoChipTextActive: {
    color: '#34d399',
    fontWeight: 'bold',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    height: 90,
    textAlignVertical: 'top',
  },
  photoButton: {
    backgroundColor: '#334155',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  photoButtonText: {
    color: '#f8fafc',
    fontWeight: 'bold',
    fontSize: 14,
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginTop: 12,
  },
  saveButton: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 40,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  wearContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  wearHeader: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  wearItem: {
    marginTop: 4,
  },
  wearLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  wearVal: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  wearTrack: {
    height: 6,
    backgroundColor: '#1e293b',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 2,
  },
  wearFill: {
    height: '100%',
    borderRadius: 3,
  },
  resetWearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 6,
    gap: 4,
  },
  resetWearBtnText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: 'bold',
  }
});
