import { View, Text, StyleSheet, Button, TextInput, Pressable, Platform, Keyboard, Modal, Switch } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const router = useRouter();
  const { type: expectedType } = useLocalSearchParams<{type: string}>();
  const [scanned, setScanned] = useState(false);
  const [manualUpc, setManualUpc] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [continuousMode, setContinuousMode] = useState(false);
  const [promptVisible, setPromptVisible] = useState(false);
  const [pendingScan, setPendingScan] = useState<{type: string, id: string} | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [measurement, setMeasurement] = useState('box');
  const [genericUpcData, setGenericUpcData] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [undoToast, setUndoToast] = useState<{message: string, id: string | null} | null>(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleManualEntry = () => {
    if (manualUpc.trim()) {
      const data = manualUpc.trim();
      setManualUpc('');
      Keyboard.dismiss();
      if (expectedType === 'ammo') {
        router.replace(`/ammo/${data}`);
      } else if (expectedType === 'component') {
        router.replace(`/component/${data}`);
      } else {
        setGenericUpcData(data);
      }
    }
  };

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', marginBottom: 20, color: '#fff', fontSize: 16 }}>Camera permission is required to scan barcodes.</Text>
        <Button onPress={() => Linking.openSettings()} title="Open Settings" color="#3b82f6" />
      </View>
    );
  }

  const handleBarcodeScanned = async ({ type, data }: { type: string, data: string }) => {
    if (scanned || promptVisible) return;
    setScanned(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (data.startsWith('armoryvault://sync')) {
        const url = new URL(data);
        const ip = url.searchParams.get('ip');
        const port = url.searchParams.get('port');
        if (ip && port) {
          await AsyncStorage.setItem('server_ip', `http://${ip}:${port}`);
          alert(`Successfully paired to ${ip}`);
          router.replace('/');
          return;
        }
      } else if (data.startsWith('armoryvault://firearm/')) {
        const id = data.split('/').pop();
        router.replace(`/firearm/${id}`);
        return;
      } else if (data.startsWith('armoryvault://component/')) {
        const id = data.split('/').pop() || '';
        setPendingScan({ type: 'component_adjustment', id });
        setPromptVisible(true);
      } else if (data.startsWith('armoryvault://ammo/')) {
        const id = data.split('/').pop() || '';
        setPendingScan({ type: 'ammo_adjustment', id });
        setPromptVisible(true);
      } else {
        // Assume UPC barcode
        if (expectedType === 'ammo') {
          setPendingScan({ type: 'ammo_adjustment', id: data });
        } else if (expectedType === 'component') {
          setPendingScan({ type: 'component_adjustment', id: data });
        } else {
          setPendingScan({ type: 'universal_scan', id: data });
        }
        setPromptVisible(true);
      }
    } catch (e) {
      console.error(e);
      setUndoToast({ message: 'Invalid barcode', id: '' });
      setTimeout(() => { setUndoToast(null); setScanned(false); }, 2000);
    }
  };

  const handleGenericUpcSelection = (type: 'ammo' | 'component') => {
    const data = genericUpcData;
    setGenericUpcData(null);
    if (!data) return;

    if (continuousMode) {
      autoSaveScan(type === 'ammo' ? 'ammo_adjustment' : 'component_adjustment', data);
    } else {
      if (type === 'ammo') {
        router.replace(`/ammo/${data}`);
      } else {
        router.replace(`/component/${data}`);
      }
    }
  };

  const autoSaveScan = async (type: string, id: string) => {
    try {
      const newLog = {
        type: type,
        upcOrId: id,
        action: 'add',
        count: 1,
        timestamp: new Date().toISOString()
      };

      const queueStr = await AsyncStorage.getItem('offline_queue');
      const queue = queueStr ? JSON.parse(queueStr) : [];
      queue.push(newLog);
      await AsyncStorage.setItem('offline_queue', JSON.stringify(queue));
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setUndoToast({ message: `Queued 1 item(s)`, id: id });
      setTimeout(() => setUndoToast(null), 3000);
    } catch (e) {
      console.error(e);
      setUndoToast({ message: 'Failed to save scan', id: '' });
      setTimeout(() => setUndoToast(null), 2000);
    }
    setTimeout(() => setScanned(false), 2000);
  };

  const saveContinuousScan = async () => {
    if (!pendingScan) return;
    const parsedQuantity = parseInt(quantity) || 0;
    if (parsedQuantity <= 0) {
      setUndoToast({ message: 'Invalid quantity', id: '' });
      setTimeout(() => setUndoToast(null), 2000);
      return;
    }

    try {
      const newLog = {
        type: pendingScan.type,
        upcOrId: pendingScan.id,
        action: 'add',
        count: parsedQuantity,
        measurement: measurement,
        timestamp: new Date().toISOString()
      };

      const queueStr = await AsyncStorage.getItem('offline_queue');
      const queue = queueStr ? JSON.parse(queueStr) : [];
      queue.push(newLog);
      await AsyncStorage.setItem('offline_queue', JSON.stringify(queue));
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setUndoToast({ message: `Queued ${parsedQuantity} item(s)`, id: pendingScan.id });
      setTimeout(() => setUndoToast(null), 5000);
    } catch (e) {
      console.error(e);
      setUndoToast({ message: 'Failed to save scan', id: '' });
      setTimeout(() => setUndoToast(null), 2000);
    }

    setPromptVisible(false);
    setPendingScan(null);
    setQuantity('1');
    setTimeout(() => setScanned(false), 1000);
  };

  const cancelContinuousScan = () => {
    setPromptVisible(false);
    setPendingScan(null);
    setQuantity('1');
    setTimeout(() => setScanned(false), 1000);
  };

  const handleUndo = async () => {
    try {
      const queueStr = await AsyncStorage.getItem('offline_queue');
      const queue = queueStr ? JSON.parse(queueStr) : [];
      if (queue.length > 0) {
        queue.pop();
        await AsyncStorage.setItem('offline_queue', JSON.stringify(queue));
      }
    } catch (e) {
      console.error(e);
    }
    setUndoToast(null);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torchOn}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'upc_a', 'upc_e', 'ean13', 'ean8', 'code39', 'code128'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.scanTarget} />
      </View>
      
      <View style={styles.topBar}>
        <Pressable onPress={() => setTorchOn(!torchOn)} style={{ marginRight: 15 }}>
           <Text style={styles.topBarText}>{torchOn ? 'Torch OFF' : 'Torch ON'}</Text>
        </Pressable>
        <Text style={styles.topBarText}>Continuous Mode</Text>
        <Switch 
          value={continuousMode} 
          onValueChange={setContinuousMode} 
          trackColor={{ false: '#767577', true: '#3b82f6' }}
        />
      </View>

      <View style={[styles.manualContainer, { bottom: keyboardHeight + 40 }]}>
        <TextInput 
          style={styles.input} 
          placeholder="Manual UPC/SKU Entry" 
          placeholderTextColor="#9ca3af"
          value={manualUpc} 
          onChangeText={setManualUpc}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable style={styles.submitBtn} onPress={handleManualEntry}>
          <Text style={styles.submitBtnText}>Submit</Text>
        </Pressable>
      </View>

      

      

      <Modal visible={promptVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>How much to add?</Text>
            <Text style={styles.modalSubtitle}>Enter quantity and measurement</Text>
            
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15, width: '100%' }}>
              <TextInput 
                style={[styles.modalInput, { flex: 1, marginBottom: 0 }]}
                keyboardType="number-pad"
                value={quantity}
                onChangeText={setQuantity}
                autoFocus
              />
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 20 }}>
              {['box', 'rds', 'lbs', 'brick'].map(unit => (
                <Pressable 
                  key={unit} 
                  style={[
                    styles.measurementChip, 
                    measurement === unit && styles.measurementChipActive
                  ]}
                  onPress={() => setMeasurement(unit)}
                >
                  <Text style={[
                    styles.measurementText,
                    measurement === unit && styles.measurementTextActive
                  ]}>{unit}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <Pressable style={[styles.modalBtn, { backgroundColor: '#475569' }]} onPress={cancelContinuousScan}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: '#3b82f6' }]} onPress={saveContinuousScan}>
                <Text style={styles.modalBtnText}>Save Scan</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {undoToast && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{undoToast.message}</Text>
          <Pressable onPress={handleUndo} style={styles.undoBtn}>
            <Text style={styles.undoBtnText}>UNDO</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    zIndex: 10,
  },
  scanTarget: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#3b82f6',
    backgroundColor: 'transparent',
  },
  topBar: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    padding: 10,
    borderRadius: 8,
    gap: 10,
  },
  topBarText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  manualContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    gap: 10,
    zIndex: 20,
  },
  input: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155'
  },
  submitBtn: {
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 12,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 5,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: '#0f172a',
    color: '#fff',
    width: '100%',
    textAlign: 'center',
    fontSize: 24,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  toastContainer: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    backgroundColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  toastText: {
    color: '#f8fafc',
    marginRight: 15,
  },
  undoBtn: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  undoBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  measurementChip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
  },
  measurementChipActive: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  measurementText: {
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  measurementTextActive: {
    color: '#3b82f6',
  }
});
