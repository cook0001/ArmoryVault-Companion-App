import { View, Text, StyleSheet, Button, TextInput, Pressable, Platform, Keyboard, Modal, Switch } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';
import * as Haptics from 'expo-haptics';

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const router = useRouter();
  const [scanned, setScanned] = useState(false);
  const [manualUpc, setManualUpc] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [continuousMode, setContinuousMode] = useState(false);
  const [promptVisible, setPromptVisible] = useState(false);
  const [pendingScan, setPendingScan] = useState<{type: string, id: string} | null>(null);
  const [quantity, setQuantity] = useState('1');

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
      router.replace(`/ammo/${manualUpc.trim()}`);
    }
  };

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', marginBottom: 20, color: '#fff' }}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="Grant Permission" />
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
        const id = data.split('/').pop();
        if (continuousMode && id) {
          setPendingScan({ type: 'component_adjustment', id });
          setPromptVisible(true);
        } else {
          router.replace(`/component/${id}`);
          return;
        }
      } else if (data.startsWith('armoryvault://ammo/')) {
        const id = data.split('/').pop();
        if (continuousMode && id) {
          setPendingScan({ type: 'ammo_adjustment', id });
          setPromptVisible(true);
        } else {
          router.replace(`/ammo/${id}`);
          return;
        }
      } else {
        // Assume UPC barcode
        if (continuousMode) {
          setPendingScan({ type: 'ammo_adjustment', id: data });
          setPromptVisible(true);
        } else {
          router.replace(`/ammo/${data}`);
          return;
        }
      }
    } catch (e) {
      console.error(e);
      alert('Invalid barcode');
      setTimeout(() => setScanned(false), 2000);
    }

    if (!continuousMode) {
      setTimeout(() => setScanned(false), 2000);
    }
  };

  const saveContinuousScan = async () => {
    if (!pendingScan) return;
    const parsedQuantity = parseInt(quantity) || 0;
    if (parsedQuantity <= 0) {
      alert("Invalid quantity");
      return;
    }

    try {
      const newLog = {
        type: pendingScan.type,
        upcOrId: pendingScan.id,
        action: 'add',
        count: parsedQuantity,
        timestamp: new Date().toISOString()
      };

      const queueStr = await AsyncStorage.getItem('offline_queue');
      const queue = queueStr ? JSON.parse(queueStr) : [];
      queue.push(newLog);
      await AsyncStorage.setItem('offline_queue', JSON.stringify(queue));
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error(e);
      alert("Failed to save scan");
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

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'upc_a', 'upc_e', 'ean13', 'ean8', 'code39', 'code128'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.scanTarget} />
      </View>
      
      <View style={styles.topBar}>
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

      <Modal visible={promptVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Scan Success!</Text>
            <Text style={styles.modalSubtitle}>How many items to add?</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={quantity}
              onChangeText={setQuantity}
              selectTextOnFocus
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Pressable style={[styles.modalBtn, { backgroundColor: '#64748b' }]} onPress={cancelContinuousScan}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: '#10b981' }]} onPress={saveContinuousScan}>
                <Text style={styles.modalBtnText}>Queue Addition</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
  }
});
