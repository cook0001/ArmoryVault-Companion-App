import { View, Text, StyleSheet, Button, TextInput, Pressable, Platform, Keyboard } from 'react-native';
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
        <Text style={{ textAlign: 'center', marginBottom: 20 }}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="Grant Permission" />
      </View>
    );
  }

  const handleBarcodeScanned = async ({ type, data }: { type: string, data: string }) => {
    if (scanned) return;
    setScanned(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (data.startsWith('armoryvault://sync')) {
        // Parse IP and port
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
      } else if (data.startsWith('armoryvault://ammo/')) {
        const id = data.split('/').pop();
        router.replace(`/ammo/${id}`);
        return;
      } else {
        // Assume UPC barcode
        router.replace(`/ammo/${data}`);
        return;
      }
    } catch (e) {
      console.error(e);
      alert('Invalid barcode');
    }

    setTimeout(() => setScanned(false), 2000);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'upc_a', 'upc_e', 'ean13', 'ean8', 'code39', 'code128'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.scanTarget} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
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
  }
});
