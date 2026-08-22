import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  Pressable, 
  Platform, 
  Keyboard, 
  Modal, 
  Switch, 
  Animated, 
  ScrollView,
  KeyboardAvoidingView
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useSync } from '../context/SyncContext';
import { useDialog } from '../context/DialogContext';
import {
  parseStorageUri,
  getStorageCapacityUtilization,
  StorageLocation,
  StorageCapacityUtilization,
} from '../utils/storageCapacity';
import {
  SafeIcon,
  AmmoCanIcon,
  CabinetIcon,
  GunCaseIcon,
  VehicleVaultIcon,
  CartridgesIcon,
  GunpowderIcon,
} from './components/CustomMobileIcons';

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const router = useRouter();
  const { type: expectedType } = useLocalSearchParams<{type: string}>();
  
  const { addToQueue, setServerIp, removeFromQueue, offlineQueue, storageLocations } = useSync();
  const { showSuccess, showError, showToast } = useDialog();

  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [continuousMode, setContinuousMode] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Cached Inventory for live matching & search
  const [cachedInventory, setCachedInventory] = useState<any>(null);

  // Manual search drawer state
  const [searchDrawerOpen, setSearchDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Adjustment Modal State
  const [promptVisible, setPromptVisible] = useState(false);
  const [pendingScan, setPendingScan] = useState<{type: string, id: string, caliber?: string} | null>(null);
  const [itemMatchInfo, setItemMatchInfo] = useState<{ title: string; subtitle?: string; stock?: number; caliber?: string } | null>(null);
  const [scanAction, setScanAction] = useState<'add' | 'remove'>('add');

  // Package multiplier inputs (Boxes * Rounds per Box)
  const [boxCount, setBoxCount] = useState('1');
  const [roundsPerBox, setRoundsPerBox] = useState('50');
  const [measurement, setMeasurement] = useState('box');

  // Storage Location Modal State
  const [storageModalVisible, setStorageModalVisible] = useState(false);
  const [scannedStorageData, setScannedStorageData] = useState<{
    location: StorageLocation;
    capUtil: StorageCapacityUtilization;
    firearms: any[];
    ammo: any[];
    accessories: any[];
    components: any[];
  } | null>(null);

  // Animated Laser Line
  const laserAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadCachedInventory();

    // Start sweeping laser animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(laserAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(laserAnim, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    ).start();

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

  const loadCachedInventory = async () => {
    try {
      const cacheStr = await AsyncStorage.getItem('inventory_cache');
      if (cacheStr) {
        setCachedInventory(JSON.parse(cacheStr));
      }
    } catch (e) {
      console.error('Error loading inventory cache', e);
    }
  };

  // Compute smart presets based on caliber (e.g. 25 for defensive pistol, 20 for rifle)
  const smartRoundPresets = useMemo(() => {
    const cal = (itemMatchInfo?.caliber || itemMatchInfo?.title || '').toLowerCase();
    
    // Rifle calibers: standard box is 20 rds
    if (cal.includes('5.56') || cal.includes('.223') || cal.includes('.308') || cal.includes('7.62') || cal.includes('6.5') || cal.includes('.30-06') || cal.includes('.300')) {
      return [20, 50, 100, 200, 500, 1000];
    }
    // Defensive handgun calibers: 20 or 25 rds/box standard, 50 for range ammo
    if (cal.includes('9mm') || cal.includes('.45') || cal.includes('.40') || cal.includes('10mm') || cal.includes('.380') || cal.includes('.38') || cal.includes('.357')) {
      return [20, 25, 50, 100, 250, 500, 1000];
    }
    // Shotgun: 5 slugs/buckshot, 25 target hulls
    if (cal.includes('gauge') || cal.includes('ga') || cal.includes('.410')) {
      return [5, 10, 25, 100, 250];
    }
    // Rimfire: 50, 100, 325, 500 (brick), 1000
    if (cal.includes('.22 lr') || cal.includes('.22lr') || cal.includes('.17 hmr') || cal.includes('.22 wmr')) {
      return [50, 100, 325, 500, 1000];
    }

    return [20, 25, 50, 100, 250, 500, 1000];
  }, [itemMatchInfo]);

  // Total calculated units/rounds
  const totalCalculatedQuantity = useMemo(() => {
    const boxes = parseInt(boxCount) || 1;
    const rpb = parseInt(roundsPerBox) || 1;
    return Math.max(1, boxes * rpb);
  }, [boxCount, roundsPerBox]);

  const handleBarcodeScanned = async ({ type, data }: { type: string, data: string }) => {
    if (scanned || promptVisible) return;
    setScanned(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // 0. Storage Location QR Code (armoryvault://storage/, AV-STORAGE-, storage:)
      const storageId = parseStorageUri(data);
      if (storageId !== null) {
        const allLocations: StorageLocation[] = storageLocations && storageLocations.length > 0
          ? storageLocations
          : (cachedInventory?.storageLocations || []);
        const foundLoc = allLocations.find((l: any) => l.id === storageId);

        if (foundLoc) {
          const locFirearms = (cachedInventory?.firearms || []).filter((f: any) => (foundLoc.firearmIds || []).includes(f.id));
          const locAmmo = (cachedInventory?.ammo || []).filter((a: any) => (foundLoc.ammoIds || []).includes(a.id));
          const locAccs = (cachedInventory?.accessories || []).filter((a: any) => (foundLoc.accessoryIds || []).includes(a.id));
          const locComps = (cachedInventory?.components || []).filter((c: any) => (foundLoc.componentIds || []).includes(c.id));

          const capUtil = getStorageCapacityUtilization(
            foundLoc,
            locFirearms.length,
            locAccs.length,
            locAmmo.length,
            locComps.length
          );

          setScannedStorageData({
            location: foundLoc,
            capUtil,
            firearms: locFirearms,
            ammo: locAmmo,
            accessories: locAccs,
            components: locComps,
          });
          setStorageModalVisible(true);
          return;
        } else {
          showToast({
            title: 'Storage QR Scanned',
            message: `Storage Location #${storageId} detected. Sync with desktop to load items.`,
            type: 'info',
          });
          router.push('/inventory');
          return;
        }
      }

      // 1. Pairing QR Code
      if (data.startsWith('armoryvault://sync')) {
        const url = new URL(data);
        const ip = url.searchParams.get('ip');
        const port = url.searchParams.get('port');
        const token = url.searchParams.get('token');
        if (ip && port) {
          await setServerIp(`http://${ip}:${port}`, token || undefined);
          showSuccess('Paired with Desktop', `Successfully connected to ${ip}:${port}`);
          router.replace('/');
          return;
        }
      }

      // 2. Firearm QR Code (AV-FIREARM- or armoryvault://firearm/)
      if (data.startsWith('AV-FIREARM-') || data.startsWith('armoryvault://firearm/')) {
        const id = data.replace('AV-FIREARM-', '').split('/').pop();
        router.replace(`/firearms`);
        return;
      }

      // 2b. Handload Recipe Batch QR Code (AV-RECIPE-)
      if (data.startsWith('AV-RECIPE-')) {
        const recipeId = data.replace('AV-RECIPE-', '').trim();
        const savedRecipesStr = await AsyncStorage.getItem('reloading_recipes_cache');
        if (savedRecipesStr) {
          const recipes = JSON.parse(savedRecipesStr);
          const found = recipes.find((r: any) => r.id === recipeId || r.lotNumber === recipeId);
          if (found) {
            showSuccess('Handload Batch Scanned', `${found.name} (LOT #${found.lotNumber})`);
            router.push('/inventory');
            return;
          }
        }
      }

      // 3. Ammo QR Code (AV-AMMO- or armoryvault://ammo/)
      if (data.startsWith('AV-AMMO-') || data.startsWith('armoryvault://ammo/')) {
        const id = data.replace('AV-AMMO-', '').split('/').pop() || '';
        let matchTitle = `Ammo #${id}`;
        let stockCount: number | undefined;
        let caliber: string | undefined;

        if (cachedInventory && cachedInventory.ammo) {
          const found = cachedInventory.ammo.find((a: any) => String(a.id) === id);
          if (found) {
            matchTitle = `${found.manufacturer || ''} ${found.caliber || ''} ${found.grain ? found.grain + 'gr ' : ''}${found.projectile || ''}`.trim();
            stockCount = found.count;
            caliber = found.caliber;
          }
        }

        // Set default rounds/box (25 for defensive, 20 for rifle, 50 for general)
        const defaultRpb = (caliber || '').toLowerCase().includes('5.56') || (caliber || '').toLowerCase().includes('.223') || (caliber || '').toLowerCase().includes('.308') ? '20' : '50';
        setRoundsPerBox(defaultRpb);
        setBoxCount('1');
        setItemMatchInfo({ title: matchTitle, subtitle: `Ammo ID: ${id}`, stock: stockCount, caliber });
        setPendingScan({ type: 'ammo_adjustment', id, caliber });
        setPromptVisible(true);
        return;
      }

      // 4. Component QR Code (AV-COMP- or armoryvault://component/)
      if (data.startsWith('AV-COMP-') || data.startsWith('armoryvault://component/')) {
        const id = data.replace('AV-COMP-', '').split('/').pop() || '';
        let matchTitle = `Component #${id}`;
        let stockCount: number | undefined;

        if (cachedInventory && cachedInventory.components) {
          const found = cachedInventory.components.find((c: any) => String(c.id) === id);
          if (found) {
            matchTitle = `${found.manufacturer || ''} ${found.name || ''} (${found.type})`.trim();
            stockCount = found.quantity;
          }
        }

        setBoxCount('1');
        setRoundsPerBox('100');
        setItemMatchInfo({ title: matchTitle, subtitle: `Component ID: ${id}`, stock: stockCount });
        setPendingScan({ type: 'component_adjustment', id });
        setPromptVisible(true);
        return;
      }

      // 5. Generic UPC / Barcode / Custom SKU Matching
      let matchedType = expectedType ? (expectedType === 'ammo' ? 'ammo_adjustment' : 'component_adjustment') : 'universal_scan';
      let matchTitle = `Barcode: ${data}`;
      let stockCount: number | undefined;
      let targetId = data;
      let caliber: string | undefined;

      if (cachedInventory) {
        // Check Custom SKUs first
        if (cachedInventory.skus && cachedInventory.skus[data]) {
          const skuInfo = cachedInventory.skus[data];
          matchTitle = `${skuInfo.manufacturer || ''} ${skuInfo.name || ''} ${skuInfo.caliber || ''}`.trim();
          caliber = skuInfo.caliber;
          if (skuInfo.type === 'Ammo') matchedType = 'ammo_adjustment';
          else if (skuInfo.type === 'Component') matchedType = 'component_adjustment';
        }

        // Check Ammo by UPC or ID
        if (cachedInventory.ammo) {
          const foundAmmo = cachedInventory.ammo.find((a: any) => String(a.id) === data || a.upc_code === data);
          if (foundAmmo) {
            matchTitle = `${foundAmmo.manufacturer || ''} ${foundAmmo.caliber || ''} ${foundAmmo.grain ? foundAmmo.grain + 'gr ' : ''}${foundAmmo.projectile || ''}`.trim();
            stockCount = foundAmmo.count;
            caliber = foundAmmo.caliber;
            matchedType = 'ammo_adjustment';
            targetId = String(foundAmmo.id || data);
          }
        }

        // Check Components by UPC or ID
        if (matchedType === 'universal_scan' && cachedInventory.components) {
          const foundComp = cachedInventory.components.find((c: any) => String(c.id) === data || c.upc_code === data);
          if (foundComp) {
            matchTitle = `${foundComp.manufacturer || ''} ${foundComp.name || ''} (${foundComp.type})`.trim();
            stockCount = foundComp.quantity;
            matchedType = 'component_adjustment';
            targetId = String(foundComp.id || data);
          }
        }
      }

      const defaultRpb = (caliber || '').toLowerCase().includes('5.56') || (caliber || '').toLowerCase().includes('.223') || (caliber || '').toLowerCase().includes('.308') ? '20' : '50';
      setRoundsPerBox(defaultRpb);
      setBoxCount('1');
      setItemMatchInfo({ title: matchTitle, subtitle: `Scanned Barcode: ${data}`, stock: stockCount, caliber });
      setPendingScan({ type: matchedType, id: targetId, caliber });
      setPromptVisible(true);

    } catch (e) {
      console.error(e);
      showToast({ message: 'Invalid barcode or QR format', type: 'error' });
      setTimeout(() => setScanned(false), 2000);
    }
  };

  // Save Scan to Offline Outbox Queue
  const saveScanAdjustment = async () => {
    if (!pendingScan) return;
    const finalQuantity = totalCalculatedQuantity;

    const newLog = {
      type: pendingScan.type,
      upcOrId: pendingScan.id,
      action: scanAction,
      count: finalQuantity,
      measurement: measurement,
      boxes: parseInt(boxCount) || 1,
      roundsPerBox: parseInt(roundsPerBox) || 1,
      timestamp: new Date().toISOString()
    };

    await addToQueue(newLog);
    showToast({
      message: `Queued ${scanAction === 'remove' ? '-' : '+'}${finalQuantity} rds (${boxCount} ${measurement}${parseInt(boxCount) > 1 ? 's' : ''})`,
      type: 'success',
      action: {
        label: 'UNDO',
        onPress: () => {
          if (offlineQueue.length > 0) {
            removeFromQueue(offlineQueue.length - 1);
          }
        }
      }
    });

    setPromptVisible(false);
    setPendingScan(null);
    setItemMatchInfo(null);
    setBoxCount('1');
    setRoundsPerBox('50');
    setTimeout(() => setScanned(false), continuousMode ? 600 : 1200);
  };

  const cancelScanAdjustment = () => {
    setPromptVisible(false);
    setPendingScan(null);
    setItemMatchInfo(null);
    setBoxCount('1');
    setRoundsPerBox('50');
    setTimeout(() => setScanned(false), 800);
  };

  // Instant search results across cached inventory
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !cachedInventory) return [];
    const q = searchQuery.toLowerCase();
    const results: any[] = [];

    // Search Ammo
    (cachedInventory.ammo || []).forEach((a: any) => {
      const matchStr = `${a.manufacturer || ''} ${a.caliber || ''} ${a.projectile || ''} ${a.upc_code || ''}`.toLowerCase();
      if (matchStr.includes(q)) {
        results.push({
          type: 'ammo',
          id: a.id,
          title: `${a.manufacturer || ''} ${a.caliber || ''} ${a.grain ? `${a.grain}gr ` : ''}${a.projectile || ''}`,
          subtitle: `In Vault: ${a.count} rds • UPC: ${a.upc_code || 'N/A'}`,
          stock: a.count,
          caliber: a.caliber
        });
      }
    });

    // Search Components
    (cachedInventory.components || []).forEach((c: any) => {
      const matchStr = `${c.manufacturer || ''} ${c.name || ''} ${c.type || ''} ${c.upc_code || ''}`.toLowerCase();
      if (matchStr.includes(q)) {
        results.push({
          type: 'component',
          id: c.id,
          title: `${c.manufacturer || ''} ${c.name || ''} (${c.type})`,
          subtitle: `Quantity: ${c.quantity} • UPC: ${c.upc_code || 'N/A'}`,
          stock: c.quantity
        });
      }
    });

    return results.slice(0, 10);
  }, [searchQuery, cachedInventory]);

  const selectSearchResult = (item: any) => {
    Keyboard.dismiss();
    setSearchDrawerOpen(false);
    setSearchQuery('');
    
    const defaultRpb = (item.caliber || '').toLowerCase().includes('5.56') || (item.caliber || '').toLowerCase().includes('.223') || (item.caliber || '').toLowerCase().includes('.308') ? '20' : '50';
    setRoundsPerBox(defaultRpb);
    setBoxCount('1');
    setItemMatchInfo({
      title: item.title,
      subtitle: item.subtitle,
      stock: item.stock,
      caliber: item.caliber
    });
    setPendingScan({
      type: item.type === 'ammo' ? 'ammo_adjustment' : 'component_adjustment',
      id: String(item.id),
      caliber: item.caliber
    });
    setPromptVisible(true);
  };

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', marginBottom: 20, color: '#fff', fontSize: 16 }}>
          Camera permission is required to scan barcodes.
        </Text>
        <Pressable style={styles.permissionBtn} onPress={() => Linking.openSettings()}>
          <Text style={styles.permissionBtnText}>Open Device Settings</Text>
        </Pressable>
      </View>
    );
  }

  // Calculate laser position
  const laserTranslateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 120]
  });

  return (
    <View style={styles.container}>
      {/* Live Camera View */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torchOn}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'upc_a', 'upc_e', 'ean13', 'ean8', 'code39', 'code128', 'pdf417'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      {/* Viewfinder Overlay with Animated Scanning Laser */}
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.scanTarget}>
          {/* Corner brackets */}
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />

          {/* Animated Sweeping Laser Line */}
          <Animated.View 
            style={[
              styles.laserLine, 
              { transform: [{ translateY: laserTranslateY }] }
            ]} 
          />
        </View>
        <Text style={styles.scanInstructionText}>
          Align barcode, QR code, or DL label inside reticle
        </Text>
      </View>
      
      {/* Top Floating Controls */}
      <View style={styles.topBar}>
        <Pressable 
          onPress={() => setTorchOn(!torchOn)} 
          style={[styles.topIconBtn, torchOn && styles.topIconBtnActive]}
        >
          <Ionicons name={torchOn ? "flash" : "flash-outline"} size={18} color={torchOn ? "#38bdf8" : "#fff"} />
          <Text style={[styles.topBarText, torchOn && { color: '#38bdf8' }]}>
            {torchOn ? 'Torch ON' : 'Torch'}
          </Text>
        </Pressable>

        <Pressable 
          onPress={() => setSearchDrawerOpen(true)} 
          style={styles.topIconBtn}
        >
          <Ionicons name="search" size={18} color="#38bdf8" />
          <Text style={[styles.topBarText, { color: '#38bdf8' }]}>Lookup</Text>
        </Pressable>

        <View style={styles.continuousContainer}>
          <Text style={styles.topBarText}>Continuous</Text>
          <Switch 
            value={continuousMode} 
            onValueChange={setContinuousMode} 
            trackColor={{ false: '#475569', true: '#3b82f6' }}
            thumbColor="#f8fafc"
          />
        </View>
      </View>

      {/* Bottom Manual Entry Drawer Button */}
      <View style={[styles.bottomBar, { bottom: keyboardHeight + 95 }]}>
        <Pressable 
          style={styles.manualDrawerTrigger}
          onPress={() => setSearchDrawerOpen(true)}
        >
          <Ionicons name="barcode-outline" size={20} color="#38bdf8" style={{ marginRight: 8 }} />
          <Text style={styles.manualDrawerText}>Manual UPC / SKU Lookup Drawer</Text>
          <Ionicons name="chevron-up" size={18} color="#94a3b8" />
        </Pressable>
      </View>

      {/* Manual Search & Lookup Drawer Modal */}
      <Modal visible={searchDrawerOpen} transparent animationType="slide">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.drawerOverlay}
        >
          <View style={styles.drawerCard}>
            <View style={styles.drawerHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="search" size={20} color="#38bdf8" style={{ marginRight: 8 }} />
                <Text style={styles.drawerTitle}>Inventory Quick Lookup</Text>
              </View>
              <Pressable onPress={() => setSearchDrawerOpen(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color="#94a3b8" />
              </Pressable>
            </View>

            <View style={styles.searchInputRow}>
              <Ionicons name="search" size={18} color="#64748b" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.drawerSearchInput}
                placeholder="Type UPC, caliber, manufacturer, or SKU..."
                placeholderTextColor="#64748b"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#94a3b8" />
                </Pressable>
              )}
            </View>

            {/* Direct manual UPC submit button */}
            {searchQuery.trim().length > 0 && searchResults.length === 0 && (
              <Pressable 
                style={styles.directUpcBtn}
                onPress={() => {
                  const data = searchQuery.trim();
                  setSearchDrawerOpen(false);
                  setSearchQuery('');
                  handleBarcodeScanned({ type: 'manual', data });
                }}
              >
                <Ionicons name="add-circle-outline" size={18} color="#38bdf8" style={{ marginRight: 6 }} />
                <Text style={styles.directUpcBtnText}>Add as Barcode "{searchQuery.trim()}"</Text>
              </Pressable>
            )}

            {/* Search Results List */}
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {searchResults.map((item, idx) => (
                <Pressable
                  key={idx}
                  style={styles.searchResultItem}
                  onPress={() => selectSearchResult(item)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchResultTitle}>{item.title}</Text>
                    <Text style={styles.searchResultSub}>{item.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#38bdf8" />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Smart Inventory Adjustment Pop-Up Dialog */}
      <Modal visible={promptVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header / Scanned Item Details */}
            {itemMatchInfo && (
              <View style={styles.itemHeaderCard}>
                <Text style={styles.modalTitle} numberOfLines={2}>{itemMatchInfo.title}</Text>
                {itemMatchInfo.stock !== undefined && (
                  <View style={[styles.stockBadge, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                    <Ionicons name="cube-outline" size={11} color="#60a5fa" />
                    <Text style={styles.stockBadgeText}>
                      In Vault: {itemMatchInfo.stock} rds
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Action Toggle (+ Add vs - Deduct) */}
            <View style={styles.actionToggleRow}>
              <Pressable
                style={[styles.actionToggleBtn, scanAction === 'add' && styles.actionToggleAddActive]}
                onPress={() => setScanAction('add')}
              >
                <Ionicons name="add-circle" size={18} color={scanAction === 'add' ? '#fff' : '#94a3b8'} style={{ marginRight: 6 }} />
                <Text style={[styles.actionToggleText, scanAction === 'add' && styles.actionToggleTextActive]}>
                  + Add Stock
                </Text>
              </Pressable>
              <Pressable
                style={[styles.actionToggleBtn, scanAction === 'remove' && styles.actionToggleRemoveActive]}
                onPress={() => setScanAction('remove')}
              >
                <Ionicons name="remove-circle" size={18} color={scanAction === 'remove' ? '#fff' : '#94a3b8'} style={{ marginRight: 6 }} />
                <Text style={[styles.actionToggleText, scanAction === 'remove' && styles.actionToggleTextActive]}>
                  - Deduct Stock
                </Text>
              </Pressable>
            </View>

            {/* Package Calculation Inputs (Boxes * Rounds per Box) */}
            <View style={styles.multiplierCard}>
              <View style={styles.multiplierRow}>
                {/* Number of Boxes/Packages */}
                <View style={{ flex: 1 }}>
                  <Text style={styles.multiplierLabel}>Number of Boxes</Text>
                  <View style={styles.stepperInputRow}>
                    <Pressable 
                      style={styles.stepperBtn} 
                      onPress={() => setBoxCount(String(Math.max(1, (parseInt(boxCount) || 1) - 1)))}
                    >
                      <Text style={styles.stepperBtnText}>-</Text>
                    </Pressable>
                    <TextInput
                      style={styles.stepperInput}
                      keyboardType="numeric"
                      value={boxCount}
                      onChangeText={setBoxCount}
                    />
                    <Pressable 
                      style={styles.stepperBtn} 
                      onPress={() => setBoxCount(String((parseInt(boxCount) || 1) + 1))}
                    >
                      <Text style={styles.stepperBtnText}>+</Text>
                    </Pressable>
                  </View>
                </View>

                <Text style={styles.mathOperator}>×</Text>

                {/* Rounds Per Box */}
                <View style={{ flex: 1 }}>
                  <Text style={styles.multiplierLabel}>Rounds / Box</Text>
                  <TextInput
                    style={styles.roundsPerBoxInput}
                    keyboardType="numeric"
                    value={roundsPerBox}
                    onChangeText={setRoundsPerBox}
                  />
                </View>
              </View>

              {/* Quick Rounds/Box Presets (20 rifle, 25 defensive pistol, 50, 100, 500) */}
              <Text style={styles.presetHeading}>Quick Preset per Box:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetRow}>
                {smartRoundPresets.map(presetAmt => {
                  const isSelected = roundsPerBox === String(presetAmt);
                  return (
                    <Pressable
                      key={presetAmt}
                      style={[styles.presetChip, isSelected && styles.presetChipSelected]}
                      onPress={() => setRoundsPerBox(String(presetAmt))}
                    >
                      <Text style={[styles.presetChipText, isSelected && styles.presetChipTextSelected]}>
                        {presetAmt} rds
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Total Calculation Banner */}
              <View style={styles.totalBanner}>
                <Text style={styles.totalBannerLabel}>Total Quantity to Queue:</Text>
                <Text style={[styles.totalBannerValue, { color: scanAction === 'remove' ? '#f87171' : '#34d399' }]}>
                  {scanAction === 'remove' ? '-' : '+'}{totalCalculatedQuantity} rounds
                </Text>
              </View>
            </View>

            {/* Packaging Unit Chips */}
            <View style={styles.unitRow}>
              {['box', 'can', 'case', 'brick', 'sleeve', 'loose'].map(unit => (
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
                  ]}>{unit.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>

            {/* Modal Action Buttons */}
            <View style={styles.modalButtons}>
              <Pressable style={styles.cancelBtn} onPress={cancelScanAdjustment}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable 
                style={[
                  styles.confirmBtn, 
                  { backgroundColor: scanAction === 'remove' ? '#dc2626' : '#10b981' }
                ]} 
                onPress={saveScanAdjustment}
              >
                <Text style={styles.confirmBtnText}>
                  {scanAction === 'remove' ? `Deduct ${totalCalculatedQuantity} rds` : `Add ${totalCalculatedQuantity} rds`}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Storage Location Inspection Dialog */}
      <Modal visible={storageModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            {scannedStorageData && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <View style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)'
                  }}>
                    {scannedStorageData.location.type === 'Safe' ? (
                      <SafeIcon size={26} color="#34d399" />
                    ) : scannedStorageData.location.type === 'AmmoCan' ? (
                      <AmmoCanIcon size={26} color="#f59e0b" />
                    ) : scannedStorageData.location.type === 'Cabinet' ? (
                      <CabinetIcon size={26} color="#38bdf8" />
                    ) : scannedStorageData.location.type === 'Case' ? (
                      <GunCaseIcon size={26} color="#a78bfa" />
                    ) : scannedStorageData.location.type === 'Vehicle' ? (
                      <VehicleVaultIcon size={26} color="#fb7185" />
                    ) : (
                      <Ionicons name="cube-outline" size={26} color="#94a3b8" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#f8fafc', fontSize: 17, fontWeight: '700' }} numberOfLines={1}>
                      {scannedStorageData.location.name}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 3 }}>
                      <View style={{
                        backgroundColor: 'rgba(56, 189, 248, 0.15)',
                        borderColor: 'rgba(56, 189, 248, 0.3)',
                        borderWidth: 1,
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                        borderRadius: 4
                      }}>
                        <Text style={{ color: '#38bdf8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
                          {scannedStorageData.location.type}
                        </Text>
                      </View>
                      <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                        ID: #{scannedStorageData.location.id}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Capacity Progress Meter */}
                {scannedStorageData.capUtil.max ? (
                  <View style={{
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.08)',
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 14
                  }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600' }}>
                        {scannedStorageData.capUtil.unitLabel} Capacity
                      </Text>
                      <Text style={{
                        color: scannedStorageData.capUtil.isOverCapacity || (scannedStorageData.capUtil.percent && scannedStorageData.capUtil.percent >= 90) ? '#f87171' : '#34d399',
                        fontSize: 12,
                        fontWeight: '700'
                      }}>
                        {scannedStorageData.capUtil.used} / {scannedStorageData.capUtil.max} {scannedStorageData.capUtil.unitLabel} ({scannedStorageData.capUtil.percent}%)
                      </Text>
                    </View>
                    <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                      <View style={{
                        width: `${Math.min(100, scannedStorageData.capUtil.percent || 0)}%`,
                        height: '100%',
                        backgroundColor: scannedStorageData.capUtil.isOverCapacity || (scannedStorageData.capUtil.percent && scannedStorageData.capUtil.percent >= 90) ? '#ef4444' : '#38bdf8',
                        borderRadius: 3
                      }} />
                    </View>
                  </View>
                ) : null}

                {/* Breakdown Pills (Guns, Accs, Ammo, Powders) */}
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
                  <View style={{ flex: 1, backgroundColor: 'rgba(167, 139, 250, 0.1)', borderWidth: 1, borderColor: 'rgba(167, 139, 250, 0.25)', borderRadius: 8, padding: 8, alignItems: 'center' }}>
                    <Text style={{ color: '#c4b5fd', fontSize: 10, fontWeight: '700' }}>GUNS</Text>
                    <Text style={{ color: '#f8fafc', fontSize: 16, fontWeight: '700', marginTop: 2 }}>{scannedStorageData.firearms.length}</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: 'rgba(96, 165, 250, 0.1)', borderWidth: 1, borderColor: 'rgba(96, 165, 250, 0.25)', borderRadius: 8, padding: 8, alignItems: 'center' }}>
                    <Text style={{ color: '#93c5fd', fontSize: 10, fontWeight: '700' }}>ACCS</Text>
                    <Text style={{ color: '#f8fafc', fontSize: 16, fontWeight: '700', marginTop: 2 }}>{scannedStorageData.accessories.length}</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: 'rgba(245, 158, 11, 0.1)', borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.25)', borderRadius: 8, padding: 8, alignItems: 'center' }}>
                    <Text style={{ color: '#fcd34d', fontSize: 10, fontWeight: '700' }}>AMMO</Text>
                    <Text style={{ color: '#f8fafc', fontSize: 16, fontWeight: '700', marginTop: 2 }}>{scannedStorageData.ammo.length}</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: 'rgba(192, 132, 252, 0.1)', borderWidth: 1, borderColor: 'rgba(192, 132, 252, 0.25)', borderRadius: 8, padding: 8, alignItems: 'center' }}>
                    <Text style={{ color: '#e9d5ff', fontSize: 10, fontWeight: '700' }}>POWDERS</Text>
                    <Text style={{ color: '#f8fafc', fontSize: 16, fontWeight: '700', marginTop: 2 }}>{scannedStorageData.components.length}</Text>
                  </View>
                </View>

                {/* Stored Items Preview */}
                {scannedStorageData.firearms.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>Stored Firearms:</Text>
                    {scannedStorageData.firearms.map((f: any, i: number) => (
                      <View key={f.id || i} style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: 8, borderRadius: 6, marginBottom: 4, flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: '#f1f5f9', fontSize: 13, fontWeight: '600' }}>{f.make} {f.model}</Text>
                        <Text style={{ color: '#a78bfa', fontSize: 12 }}>{f.caliber}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {scannedStorageData.ammo.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>Stored Ammunition:</Text>
                    {scannedStorageData.ammo.map((a: any, i: number) => (
                      <View key={a.id || i} style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: 8, borderRadius: 6, marginBottom: 4, flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: '#f1f5f9', fontSize: 13 }}>{a.manufacturer || ''} {a.caliber}</Text>
                        <Text style={{ color: '#f59e0b', fontSize: 12, fontWeight: '700' }}>{a.count} rds</Text>
                      </View>
                    ))}
                  </View>
                )}

                {scannedStorageData.capUtil.totalItems === 0 && (
                  <View style={{ padding: 16, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 8, marginBottom: 14 }}>
                    <Text style={{ color: '#64748b', fontSize: 13, fontStyle: 'italic' }}>This storage container is currently empty.</Text>
                  </View>
                )}

                {/* Modal Buttons */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                  <Pressable
                    style={{ flex: 1, backgroundColor: '#334155', padding: 12, borderRadius: 8, alignItems: 'center' }}
                    onPress={() => {
                      setStorageModalVisible(false);
                      setScannedStorageData(null);
                      setScanned(false);
                    }}
                  >
                    <Text style={{ color: '#f8fafc', fontWeight: '600' }}>Close</Text>
                  </Pressable>
                  <Pressable
                    style={{ flex: 1, backgroundColor: '#38bdf8', padding: 12, borderRadius: 8, alignItems: 'center' }}
                    onPress={() => {
                      const locId = scannedStorageData.location.id;
                      setStorageModalVisible(false);
                      setScannedStorageData(null);
                      setScanned(false);
                      router.push(`/inventory?storageId=${locId}` as any);
                    }}
                  >
                    <Text style={{ color: '#0f172a', fontWeight: '700' }}>View in Inventory</Text>
                  </Pressable>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  scanTarget: {
    width: 270,
    height: 270,
    backgroundColor: 'transparent',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#38bdf8',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  laserLine: {
    width: '92%',
    height: 3,
    backgroundColor: '#38bdf8',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 8,
    borderRadius: 2,
  },
  scanInstructionText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  topBar: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  topIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  topIconBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  continuousContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topBarText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bottomBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 20,
  },
  manualDrawerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  manualDrawerText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
  },
  permissionBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'center',
  },
  permissionBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  // Modal & Drawer Styles
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  drawerCard: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    maxHeight: '80%',
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  drawerTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  drawerSearchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 14,
  },
  directUpcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38bdf8',
    marginBottom: 10,
  },
  directUpcBtnText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: 'bold',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  searchResultTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  searchResultSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 16,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  itemHeaderCard: {
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8fafc',
    textAlign: 'center',
  },
  stockBadge: {
    marginTop: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  stockBadgeText: {
    color: '#34d399',
    fontWeight: 'bold',
    fontSize: 12,
  },
  actionToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  actionToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionToggleAddActive: {
    backgroundColor: '#059669',
    borderColor: '#10b981',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  actionToggleRemoveActive: {
    backgroundColor: '#dc2626',
    borderColor: '#ef4444',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  actionToggleText: {
    color: '#94a3b8',
    fontWeight: 'bold',
    fontSize: 13,
  },
  actionToggleTextActive: {
    color: '#ffffff',
  },
  multiplierCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
  },
  multiplierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  multiplierLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  stepperInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  stepperBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
    borderRadius: 6,
  },
  stepperBtnText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  stepperInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 6,
  },
  mathOperator: {
    color: '#64748b',
    fontSize: 20,
    fontWeight: 'bold',
    marginHorizontal: 10,
    marginTop: 18,
  },
  roundsPerBoxInput: {
    backgroundColor: '#1e293b',
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetHeading: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  presetRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  presetChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetChipSelected: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  presetChipText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  presetChipTextSelected: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  totalBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  totalBannerLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  totalBannerValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  unitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 16,
  },
  measurementChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
  },
  measurementChipActive: {
    borderColor: '#38bdf8',
    backgroundColor: '#0284c7',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  measurementText: {
    color: '#94a3b8',
    fontWeight: 'bold',
    fontSize: 11,
  },
  measurementTextActive: {
    color: '#ffffff',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#f1f5f9',
    fontWeight: 'bold',
    fontSize: 14,
  },
  confirmBtn: {
    flex: 1.5,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  }
});
