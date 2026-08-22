import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSync } from '../../context/SyncContext';
import { useDialog } from '../../context/DialogContext';
import { StorageLocation, NewFirearmPayload } from '../../types';
import { SafeIcon } from '../components/CustomMobileIcons';

const TOP_MANUFACTURERS = [
  'Ruger',
  'Glock',
  'Sig Sauer',
  'Smith & Wesson',
  'Colt',
  'Winchester',
  'Springfield Armory',
  'Beretta',
  'Remington',
  'Mossberg',
  'Henry',
  'CZ-USA',
  'Daniel Defense',
  'Taurus',
  'Walther',
  'FN Herstal',
  'Kimber',
];

const POPULAR_CALIBERS = [
  '9mm Luger',
  '.45 ACP',
  '5.56x45mm NATO',
  '.223 Remington',
  '.308 Winchester',
  '12 Gauge',
  '.22 LR',
  '.380 ACP',
  '.357 Magnum',
  '.38 Special',
  '6.5 Creedmoor',
  '7.62x39mm',
  '.300 AAC Blackout',
  '20 Gauge',
  '10mm Auto',
];

const FIREARM_TYPES = ['Pistol', 'Rifle', 'Shotgun', 'Revolver', 'Rimfire', 'NFA / Other'];

const ACTION_TYPES = [
  'Semi-Automatic',
  'Bolt Action',
  'Lever Action',
  'Revolver (DA/SA)',
  'Revolver (SAO)',
  'Pump Action',
  'Break Action',
  'Other',
];

const CONDITIONS = ['New', 'Excellent', 'Very Good', 'Good', 'Fair', 'Poor', 'C&R Collectible'];

export default function FirearmFormScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { addToQueue } = useSync();
  const { showToast, showError, showSuccess } = useDialog();

  const isEditMode = !!id;

  // Form State
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [caliber, setCaliber] = useState('');
  const [firearmType, setFirearmType] = useState('Pistol');
  const [actionType, setActionType] = useState('Semi-Automatic');
  const [barrelLength, setBarrelLength] = useState('');
  const [finish, setFinish] = useState('');
  const [condition, setCondition] = useState('Excellent');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchasedFrom, setPurchasedFrom] = useState('');
  const [storageLocationId, setStorageLocationId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [isNfa, setIsNfa] = useState(false);
  const [nfaType, setNfaType] = useState('');

  // Photos State
  const [photos, setPhotos] = useState<{ uri: string; base64?: string; isExisting?: boolean }[]>([]);

  // Metadata State
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, [id]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // Load storage locations cache
      const locationsStr = await AsyncStorage.getItem('storage_locations_cache');
      if (locationsStr) {
        setStorageLocations(JSON.parse(locationsStr));
      }

      // Load inventory cache
      const cacheStr = await AsyncStorage.getItem('inventory_cache');
      if (cacheStr) {
        const cache = JSON.parse(cacheStr);
        if (cache.storageLocations && (!locationsStr || locationsStr === '[]')) {
          setStorageLocations(cache.storageLocations);
        }

        if (isEditMode && cache.firearms) {
          const found = cache.firearms.find((f: any) => String(f.id) === String(id));
          if (found) {
            setMake(found.make || '');
            setModel(found.model || '');
            setSerialNumber(found.serial_number || '');
            setCaliber(found.caliber || '');
            setFirearmType(found.firearm_type || found.type || 'Pistol');
            setActionType(found.action_type || found.action || 'Semi-Automatic');
            setBarrelLength(found.barrel_length ? String(found.barrel_length) : '');
            setFinish(found.finish || '');
            setCondition(found.condition || 'Excellent');
            setPurchasePrice(found.purchase_price !== null && found.purchase_price !== undefined ? String(found.purchase_price) : '');
            setPurchaseDate(found.purchase_date || '');
            setPurchasedFrom(found.purchased_from || '');
            setStorageLocationId(found.storageLocationId || null);
            setNotes(found.notes || '');
            setIsNfa(!!found.is_nfa);
            setNfaType(found.nfa_type || '');

            // Load existing photos
            const existingPhotos: { uri: string; isExisting: boolean }[] = [];
            if (found.photos && Array.isArray(found.photos)) {
              found.photos.forEach((p: string) => {
                existingPhotos.push({ uri: p, isExisting: true });
              });
            } else if (found.image_path) {
              existingPhotos.push({ uri: found.image_path, isExisting: true });
            }
            setPhotos(existingPhotos);
          }
        }
      }
    } catch (e) {
      console.error('Error loading firearm data:', e);
    }
    setIsLoading(false);
  };

  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showError('Permission Required', 'Access to photos is required to attach images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const base64Data = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : undefined;
        setPhotos(prev => [...prev, { uri: asset.uri, base64: base64Data, isExisting: false }]);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      console.error('Error picking image:', e);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showError('Permission Required', 'Camera permission is required to capture photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const base64Data = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : undefined;
        setPhotos(prev => [...prev, { uri: asset.uri, base64: base64Data, isExisting: false }]);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      console.error('Error taking photo:', e);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const trimmedMake = make.trim();
    const trimmedModel = model.trim();
    const trimmedCaliber = caliber.trim();

    if (!trimmedMake || !trimmedModel || !trimmedCaliber) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showError('Required Fields Missing', 'Please provide a Make/Manufacturer, Model, and Caliber.');
      return;
    }

    setIsSaving(true);

    try {
      const numericPrice = purchasePrice.trim() ? parseFloat(purchasePrice.replace(/[^0-9.]/g, '')) : null;

      // Extract new base64 photos for sync
      const newBase64Photos = photos.filter(p => !p.isExisting && p.base64).map(p => p.base64 as string);
      const primaryPhotoBase64 = newBase64Photos.length > 0 ? newBase64Photos[0] : undefined;

      const payload: NewFirearmPayload = {
        make: trimmedMake,
        model: trimmedModel,
        serial_number: serialNumber.trim(),
        caliber: trimmedCaliber,
        firearm_type: firearmType,
        action_type: actionType,
        barrel_length: barrelLength.trim() || undefined,
        finish: finish.trim() || undefined,
        condition,
        purchase_price: numericPrice,
        purchase_date: purchaseDate.trim() || undefined,
        purchased_from: purchasedFrom.trim() || undefined,
        storageLocationId: storageLocationId || undefined,
        notes: notes.trim() || undefined,
        is_nfa: isNfa,
        nfa_type: isNfa ? (nfaType.trim() || 'SBR') : undefined,
        photoBase64: primaryPhotoBase64,
        photosBase64: newBase64Photos.length > 0 ? newBase64Photos : undefined,
      };

      if (isEditMode) {
        // Dispatch firearm_update sync item
        await addToQueue({
          type: 'firearm_update',
          timestamp: new Date().toISOString(),
          firearmId: Number(id),
          data: {
            firearmId: Number(id),
            ...payload,
          },
        });

        // Optimistically update local inventory cache
        const cacheStr = await AsyncStorage.getItem('inventory_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          if (cache.firearms) {
            const idx = cache.firearms.findIndex((f: any) => String(f.id) === String(id));
            if (idx >= 0) {
              cache.firearms[idx] = {
                ...cache.firearms[idx],
                ...payload,
                // keep local preview photo if new one added
                image_path: photos.length > 0 ? photos[0].uri : cache.firearms[idx].image_path,
              };
              await AsyncStorage.setItem('inventory_cache', JSON.stringify(cache));
            }
          }
        }

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showSuccess('Firearm Updated', `${trimmedMake} ${trimmedModel} updates queued for desktop sync.`);
      } else {
        // Dispatch new_firearm sync item
        await addToQueue({
          type: 'new_firearm',
          timestamp: new Date().toISOString(),
          data: payload,
        });

        // Optimistically add to local inventory cache with temp ID
        const cacheStr = await AsyncStorage.getItem('inventory_cache');
        if (cacheStr) {
          const cache = JSON.parse(cacheStr);
          const tempFirearm = {
            id: Date.now(),
            ...payload,
            image_path: photos.length > 0 ? photos[0].uri : '',
            is_sold: false,
          };
          cache.firearms = [tempFirearm, ...(cache.firearms || [])];
          await AsyncStorage.setItem('inventory_cache', JSON.stringify(cache));
        }

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showSuccess('Firearm Added', `${trimmedMake} ${trimmedModel} queued for desktop sync.`);
      }

      router.replace('/firearms');
    } catch (e: any) {
      console.error('Error saving firearm:', e);
      showError('Save Failed', 'Could not queue firearm updates. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.headerButton}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Ionicons name="close" size={24} color="#94a3b8" />
        </Pressable>
        <Text style={styles.headerTitle}>{isEditMode ? 'Edit Firearm' : 'Add New Firearm'}</Text>
        <Pressable
          style={[styles.saveButton, isSaving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </Pressable>
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollInner}>
        {/* Photo Gallery Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Firearm Photos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoList}>
            {photos.map((item, idx) => (
              <View key={idx} style={styles.photoThumbContainer}>
                <Image source={{ uri: item.uri }} style={styles.photoThumb} />
                <Pressable
                  style={styles.photoRemoveBtn}
                  onPress={() => handleRemovePhoto(idx)}
                  hitSlop={6}
                >
                  <Ionicons name="close-circle" size={20} color="#ef4444" />
                </Pressable>
              </View>
            ))}

            <Pressable style={styles.addPhotoBtn} onPress={handleTakePhoto}>
              <Ionicons name="camera" size={24} color="#3b82f6" />
              <Text style={styles.addPhotoText}>Camera</Text>
            </Pressable>

            <Pressable style={styles.addPhotoBtn} onPress={handlePickImage}>
              <Ionicons name="images" size={24} color="#3b82f6" />
              <Text style={styles.addPhotoText}>Gallery</Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* Primary Identification */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Identification</Text>

          {/* Make / Manufacturer */}
          <Text style={styles.fieldLabel}>Make / Manufacturer *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Ruger, Glock, Sig Sauer"
            placeholderTextColor="#64748b"
            value={make}
            onChangeText={setMake}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {TOP_MANUFACTURERS.slice(0, 8).map(m => (
              <Pressable
                key={m}
                style={[styles.chip, make === m && styles.chipActive]}
                onPress={() => setMake(m)}
              >
                <Text style={[styles.chipText, make === m && styles.chipTextActive]}>{m}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Model */}
          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Model *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 10/22, G19 Gen5, P365"
            placeholderTextColor="#64748b"
            value={model}
            onChangeText={setModel}
          />

          {/* Caliber */}
          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Caliber / Gauge *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 9mm Luger, 5.56 NATO, 12 Gauge"
            placeholderTextColor="#64748b"
            value={caliber}
            onChangeText={setCaliber}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {POPULAR_CALIBERS.slice(0, 8).map(c => (
              <Pressable
                key={c}
                style={[styles.chip, caliber === c && styles.chipActive]}
                onPress={() => setCaliber(c)}
              >
                <Text style={[styles.chipText, caliber === c && styles.chipTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Serial Number */}
          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Serial Number</Text>
          <View style={styles.serialInputRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Serial Number"
              placeholderTextColor="#64748b"
              value={serialNumber}
              onChangeText={setSerialNumber}
              autoCapitalize="characters"
            />
          </View>
        </View>

        {/* Specifications */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Specifications</Text>

          {/* Firearm Type */}
          <Text style={styles.fieldLabel}>Firearm Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {FIREARM_TYPES.map(t => (
              <Pressable
                key={t}
                style={[styles.chip, firearmType === t && styles.chipActive]}
                onPress={() => setFirearmType(t)}
              >
                <Text style={[styles.chipText, firearmType === t && styles.chipTextActive]}>{t}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Action Type */}
          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Action Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {ACTION_TYPES.map(a => (
              <Pressable
                key={a}
                style={[styles.chip, actionType === a && styles.chipActive]}
                onPress={() => setActionType(a)}
              >
                <Text style={[styles.chipText, actionType === a && styles.chipTextActive]}>{a}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Barrel Length</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 16.5 in"
                placeholderTextColor="#64748b"
                value={barrelLength}
                onChangeText={setBarrelLength}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Finish</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Blued, Cerakote"
                placeholderTextColor="#64748b"
                value={finish}
                onChangeText={setFinish}
              />
            </View>
          </View>
        </View>

        {/* Storage Location Safe / Cabinet */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <SafeIcon size={18} color="#f59e0b" />
            <Text style={[styles.sectionTitle, { marginLeft: 8 }]}>Storage Safe / Location</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            <Pressable
              style={[styles.chip, storageLocationId === null && styles.chipActive]}
              onPress={() => setStorageLocationId(null)}
            >
              <Text style={[styles.chipText, storageLocationId === null && styles.chipTextActive]}>
                Unassigned
              </Text>
            </Pressable>

            {storageLocations.map(loc => (
              <Pressable
                key={loc.id}
                style={[styles.chip, storageLocationId === loc.id && styles.chipActive]}
                onPress={() => setStorageLocationId(loc.id || null)}
              >
                <Text
                  style={[
                    styles.chipText,
                    storageLocationId === loc.id && styles.chipTextActive,
                  ]}
                >
                  {loc.name} ({loc.type || 'Safe'})
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Condition & Acquisition */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Condition & Acquisition</Text>

          {/* Condition */}
          <Text style={styles.fieldLabel}>Condition</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {CONDITIONS.map(c => (
              <Pressable
                key={c}
                style={[styles.chip, condition === c && styles.chipActive]}
                onPress={() => setCondition(c)}
              >
                <Text style={[styles.chipText, condition === c && styles.chipTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Purchase Price ($)</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor="#64748b"
                keyboardType="numeric"
                value={purchasePrice}
                onChangeText={setPurchasePrice}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Purchase Date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#64748b"
                value={purchaseDate}
                onChangeText={setPurchaseDate}
              />
            </View>
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Purchased From</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Gun Store, Private Sale, GunBroker"
            placeholderTextColor="#64748b"
            value={purchasedFrom}
            onChangeText={setPurchasedFrom}
          />
        </View>

        {/* Notes */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Add sights, modifications, accessories, or history notes..."
            placeholderTextColor="#64748b"
            multiline
            numberOfLines={4}
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {/* NFA Classification */}
        <View style={[styles.sectionCard, { marginBottom: 40 }]}>
          <View style={styles.switchRow}>
            <View>
              <Text style={styles.sectionTitle}>NFA Firearm / Item</Text>
              <Text style={styles.fieldSubLabel}>SBR, SBS, Suppressor, Machine Gun, AOW</Text>
            </View>
            <Pressable
              style={[styles.toggleBtn, isNfa && styles.toggleBtnActive]}
              onPress={() => setIsNfa(!isNfa)}
            >
              <Ionicons
                name={isNfa ? 'checkbox' : 'square-outline'}
                size={24}
                color={isNfa ? '#3b82f6' : '#64748b'}
              />
            </Pressable>
          </View>

          {isNfa && (
            <View style={{ marginTop: 14 }}>
              <Text style={styles.fieldLabel}>NFA Classification Type</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Short Barreled Rifle (SBR)"
                placeholderTextColor="#64748b"
                value={nfaType}
                onChangeText={setNfaType}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0b0f19',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  headerButton: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 64,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 16,
    gap: 16,
  },
  sectionCard: {
    backgroundColor: '#131b2e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 6,
  },
  fieldSubLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  input: {
    backgroundColor: '#0b0f19',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    color: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    height: 88,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  serialInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipRow: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 4,
  },
  chip: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#3b82f6',
  },
  chipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  photoList: {
    flexDirection: 'row',
  },
  photoThumbContainer: {
    position: 'relative',
    marginRight: 10,
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0b0f19',
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#0f172a',
    borderRadius: 12,
  },
  addPhotoBtn: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderStyle: 'dashed',
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  addPhotoText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleBtn: {
    padding: 4,
  },
  toggleBtnActive: {
    opacity: 1,
  },
});
