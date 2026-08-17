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
  const [itemMatchInfo, setItemMatchInfo] = useState<{ title: string; subtitle?: string; stock?: number } | null>(null);
  const [scanAction, setScanAction] = useState<'add' | 'remove'>('add');

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
      // 1. Pairing QR Code
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
      }

      // 2. Firearm QR Code (AV-FIREARM- or armoryvault://firearm/)
      if (data.startsWith('AV-FIREARM-') || data.startsWith('armoryvault://firearm/')) {
        const id = data.replace('AV-FIREARM-', '').split('/').pop();
        router.replace(`/firearm/${id}`);
        return;
      }

      // 3. Load Offline Cache for Smart Matching
      let cachedData: any = null;
      try {
        const cacheStr = await AsyncStorage.getItem('inventory_cache');
        if (cacheStr) cachedData = JSON.parse(cacheStr);
      } catch (e) {
        console.error('Cache load error', e);
      }

      // 4. Ammo QR Code (AV-AMMO- or armoryvault://ammo/)
      if (data.startsWith('AV-AMMO-') || data.startsWith('armoryvault://ammo/')) {
        const id = data.replace('AV-AMMO-', '').split('/').pop() || '';
        let matchTitle = `Ammo #${id}`;
        let stockCount: number | undefined;

        if (cachedData && cachedData.ammo) {
          const found = cachedData.ammo.find((a: any) => String(a.id) === id);
          if (found) {
            matchTitle = `${found.manufacturer || ''} ${found.caliber || ''} ${found.grain ? found.grain + 'gr ' : ''}${found.projectile || ''}`.trim();
            stockCount = found.count;
          }
        }

        setItemMatchInfo({ title: matchTitle, subtitle: `Ammo ID: ${id}`, stock: stockCount });
        setPendingScan({ type: 'ammo_adjustment', id });
        setPromptVisible(true);
        return;
      }

      // 5. Component QR Code (AV-COMP- or armoryvault://component/)
      if (data.startsWith('AV-COMP-') || data.startsWith('armoryvault://component/')) {
        const id = data.replace('AV-COMP-', '').split('/').pop() || '';
        let matchTitle = `Component #${id}`;
        let stockCount: number | undefined;

        if (cachedData && cachedData.components) {
          const found = cachedData.components.find((c: any) => String(c.id) === id);
          if (found) {
            matchTitle = `${found.manufacturer || ''} ${found.name || ''} (${found.type})`.trim();
            stockCount = found.quantity;
          }
        }

        setItemMatchInfo({ title: matchTitle, subtitle: `Component ID: ${id}`, stock: stockCount });
        setPendingScan({ type: 'component_adjustment', id });
        setPromptVisible(true);
        return;
      }

      // 6. Generic UPC / Barcode / Custom SKU Matching
      let matchedType = expectedType ? (expectedType === 'ammo' ? 'ammo_adjustment' : 'component_adjustment') : 'universal_scan';
      let matchTitle = `Barcode: ${data}`;
      let stockCount: number | undefined;
      let targetId = data;

      if (cachedData) {
        // Check Custom SKUs first
        if (cachedData.skus && cachedData.skus[data]) {
          const skuInfo = cachedData.skus[data];
          matchTitle = `${skuInfo.manufacturer || ''} ${skuInfo.name || ''} ${skuInfo.caliber || ''}`.trim();
          if (skuInfo.type === 'Ammo') matchedType = 'ammo_adjustment';
          else if (skuInfo.type === 'Component') matchedType = 'component_adjustment';
        }

        // Check Ammo by UPC or ID
        if (cachedData.ammo) {
          const foundAmmo = cachedData.ammo.find((a: any) => String(a.id) === data || a.upc_code === data);
          if (foundAmmo) {
            matchTitle = `${foundAmmo.manufacturer || ''} ${foundAmmo.caliber || ''} ${foundAmmo.grain ? foundAmmo.grain + 'gr ' : ''}${foundAmmo.projectile || ''}`.trim();
            stockCount = foundAmmo.count;
            matchedType = 'ammo_adjustment';
            targetId = String(foundAmmo.id || data);
          }
        }

        // Check Components by UPC or ID
        if (matchedType === 'universal_scan' && cachedData.components) {
          const foundComp = cachedData.components.find((c: any) => String(c.id) === data || c.upc_code === data);
          if (foundComp) {
            matchTitle = `${foundComp.manufacturer || ''} ${foundComp.name || ''} (${foundComp.type})`.trim();
            stockCount = foundComp.quantity;
            matchedType = 'component_adjustment';
            targetId = String(foundComp.id || data);
          }
        }
      }

      setItemMatchInfo({ title: matchTitle, subtitle: `Scanned: ${data}`, stock: stockCount });
      setPendingScan({ type: matchedType, id: targetId });
      setPromptVisible(true);

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
        action: scanAction,
        count: parsedQuantity,
        measurement: measurement,
        timestamp: new Date().toISOString()
      };

      const queueStr = await AsyncStorage.getItem('offline_queue');
      const queue = queueStr ? JSON.parse(queueStr) : [];
      queue.push(newLog);
      await AsyncStorage.setItem('offline_queue', JSON.stringify(queue));
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setUndoToast({ message: `Queued ${scanAction === 'remove' ? '-' : '+'}${parsedQuantity} item(s)`, id: pendingScan.id });
      setTimeout(() => setUndoToast(null), 5000);
    } catch (e) {
      console.error(e);
      setUndoToast({ message: 'Failed to save scan', id: '' });
      setTimeout(() => setUndoToast(null), 2000);
    }

    setPromptVisible(false);
    setPendingScan(null);
    setItemMatchInfo(null);
    setQuantity('1');
    setTimeout(() => setScanned(false), 1000);
  };

  const cancelContinuousScan = () => {
    setPromptVisible(false);
    setPendingScan(null);
    setItemMatchInfo(null);
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
            {itemMatchInfo && (
              <View style={{ marginBottom: 12, alignItems: 'center' }}>
                <Text style={styles.modalTitle} numberOfLines={2}>{itemMatchInfo.title}</Text>
                {itemMatchInfo.stock !== undefined && (
                  <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 13, marginTop: 2 }}>
                    Current Stock: {itemMatchInfo.stock} rds
                  </Text>
                )}
              </View>
            )}
            {!itemMatchInfo && (
              <>
                <Text style={styles.modalTitle}>Inventory Adjustment</Text>
                <Text style={styles.modalSubtitle}>Enter quantity and measurement</Text>
              </>
            )}

            {/* Action Toggle (Add vs Remove) */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15, width: '100%' }}>
              <Pressable
                style={[styles.actionToggleBtn, scanAction === 'add' && styles.actionToggleAddActive]}
                onPress={() => setScanAction('add')}
              >
                <Text style={[styles.actionToggleText, scanAction === 'add' && styles.actionToggleTextActive]}>+ Add</Text>
              </Pressable>
              <Pressable
                style={[styles.actionToggleBtn, scanAction === 'remove' && styles.actionToggleRemoveActive]}
                onPress={() => setScanAction('remove')}
              >
                <Text style={[styles.actionToggleText, scanAction === 'remove' && styles.actionToggleTextActive]}>- Deduct</Text>
              </Pressable>
            </View>
            
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12, width: '100%' }}>
              <TextInput 
                style={[styles.modalInput, { flex: 1, marginBottom: 0 }]}
                keyboardType="number-pad"
                value={quantity}
                onChangeText={setQuantity}
                autoFocus
              />
            </View>

            {/* Quick Steppers */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 14 }}>
              {[20, 50, 100, 250, 500, 1400].map(amt => (
                <Pressable
                  key={amt}
                  style={styles.stepperChip}
                  onPress={() => setQuantity(String(amt))}
                >
                  <Text style={styles.stepperText}>{amt}</Text>
                </Pressable>
              ))}
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
              <Pressable 
                style={[styles.modalBtn, { backgroundColor: scanAction === 'remove' ? '#ef4444' : '#10b981' }]} 
                onPress={saveContinuousScan}
              >
                <Text style={styles.modalBtnText}>{scanAction === 'remove' ? 'Deduct Stock' : 'Add Stock'}</Text>
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
  },
  actionToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionToggleAddActive: {
    backgroundColor: '#065f46',
    borderColor: '#10b981',
  },
  actionToggleRemoveActive: {
    backgroundColor: '#991b1b',
    borderColor: '#ef4444',
  },
  actionToggleText: {
    color: '#94a3b8',
    fontWeight: 'bold',
    fontSize: 14,
  },
  actionToggleTextActive: {
    color: '#ffffff',
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
  }
});
