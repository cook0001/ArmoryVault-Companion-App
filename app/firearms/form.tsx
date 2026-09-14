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

export type StudioAngleKey = 'left' | 'right' | 'serial' | 'proof' | 'extra';

export interface StudioPhotoItem {
  uri: string;
  base64?: string;
  isExisting?: boolean;
  angle: StudioAngleKey;
}

const STUDIO_SLOTS: {
  key: StudioAngleKey;
  label: string;
  badge: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    key: 'left',
    label: 'Left Profile',
    badge: 'Slot 1',
    subtitle: 'Full left-side view (receiver, barrel, stock/grip)',
    icon: 'camera-outline',
  },
  {
    key: 'right',
    label: 'Right Profile',
    badge: 'Slot 2',
    subtitle: 'Full right-side view (ejection port & action)',
    icon: 'camera-outline',
  },
  {
    key: 'serial',
    label: 'Rollmark & Serial',
    badge: 'Slot 3',
    subtitle: 'Clear macro shot of serial number & manufacturer stamp',
    icon: 'barcode-outline',
  },
  {
    key: 'proof',
    label: 'Proofs & Bore',
    badge: 'Slot 4',
    subtitle: 'Proof marks, acceptance stamps, or bore condition',
    icon: 'shield-checkmark-outline',
  },
];

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

  // Photos State - Standardized Studio Angles
  const [photos, setPhotos] = useState<StudioPhotoItem[]>([]);

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

            // Load existing photos with standardized angle assignments
            const existingPhotos: StudioPhotoItem[] = [];
            if (found.photos && Array.isArray(found.photos)) {
              found.photos.forEach((p: string, idx: number) => {
                const angle: StudioAngleKey =
                  idx === 0 ? 'left' : idx === 1 ? 'right' : idx === 2 ? 'serial' : idx === 3 ? 'proof' : 'extra';
                existingPhotos.push({ uri: p, isExisting: true, angle });
              });
            } else if (found.image_path) {
              existingPhotos.push({ uri: found.image_path, isExisting: true, angle: 'left' });
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

  const captureAnglePhoto = async (angle: StudioAngleKey, mode: 'camera' | 'library') => {
    try {
      if (mode === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          showError('Permission Required', 'Camera permission is required to capture photos.');
          return;
        }

        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.75,
          base64: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          const base64Data = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : undefined;
          setPhotos(prev => {
            const filtered = prev.filter(p => p.angle !== angle || angle === 'extra');
            return [...filtered, { uri: asset.uri, base64: base64Data, isExisting: false, angle }];
          });
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          showError('Permission Required', 'Access to photos is required to attach images.');
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.75,
          base64: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          const base64Data = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : undefined;
          setPhotos(prev => {
            const filtered = prev.filter(p => p.angle !== angle || angle === 'extra');
            return [...filtered, { uri: asset.uri, base64: base64Data, isExisting: false, angle }];
          });
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (e) {
      console.error('Error capturing studio photo:', e);
    }
  };

  const removeAnglePhoto = (angle: StudioAngleKey, uri?: string) => {
    if (angle === 'extra' && uri) {
      setPhotos(prev => prev.filter(p => p.uri !== uri));
    } else {
      setPhotos(prev => prev.filter(p => p.angle !== angle));
    }
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

      // Arrange photos in standard order: Left -> Right -> Serial -> Proof -> Extras
      const orderedPhotos: StudioPhotoItem[] = [];
      const standardKeys: StudioAngleKey[] = ['left', 'right', 'serial', 'proof'];
      for (const key of standardKeys) {
        const p = photos.find(item => item.angle === key);
        if (p) orderedPhotos.push(p);
      }
      const extras = photos.filter(item => item.angle === 'extra');
      orderedPhotos.push(...extras);

      // Extract new base64 photos for sync
      const newBase64Photos = orderedPhotos.filter(p => !p.isExisting && p.base64).map(p => p.base64 as string);
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

      // Strip base64 payloads from local cache storage to prevent AsyncStorage size explosion
      const { photoBase64: _p1, photosBase64: _p2, ...cleanLocalPayload } = payload;
      const previewPhotoUri = photos.length > 0 ? photos[0].uri : '';

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

        // Optimistically update local inventory cache safely without base64 bloat
        try {
          const cacheStr = await AsyncStorage.getItem('inventory_cache');
          if (cacheStr) {
            const cache = JSON.parse(cacheStr);
            if (cache.firearms && Array.isArray(cache.firearms)) {
              const idx = cache.firearms.findIndex((f: any) => String(f.id) === String(id));
              if (idx >= 0) {
                cache.firearms[idx] = {
                  ...cache.firearms[idx],
                  ...cleanLocalPayload,
                  image_path: previewPhotoUri || cache.firearms[idx].image_path,
                };
                await AsyncStorage.setItem('inventory_cache', JSON.stringify(cache));
              }
            }
          }
        } catch (cacheErr) {
          console.warn('Could not optimistically update local inventory cache:', cacheErr);
        }

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showSuccess('Firearm Updated', `${trimmedMake} ${trimmedModel} updates queued for desktop sync.`);
      } else {
        // Dispatch new_firearm sync item
        await addToQueue({
          type: 'new_firearm',
          timestamp: new Date().toISOString(),
          data: payload,
        });

        // Optimistically add to local inventory cache with temp ID
        try {
          const cacheStr = await AsyncStorage.getItem('inventory_cache');
          if (cacheStr) {
            const cache = JSON.parse(cacheStr);
            const tempFirearm = {
              id: Date.now(),
              ...cleanLocalPayload,
              image_path: previewPhotoUri,
              is_sold: false,
            };
            cache.firearms = [tempFirearm, ...(cache.firearms || [])];
            await AsyncStorage.setItem('inventory_cache', JSON.stringify(cache));
          }
        } catch (cacheErr) {
          console.warn('Could not optimistically add to local inventory cache:', cacheErr);
        }

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showSuccess('Firearm Added', `${trimmedMake} ${trimmedModel} queued for desktop sync.`);
      }

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/firearms');
      }
    } catch (e: any) {
      console.error('Error saving firearm:', e);
      showError('Save Failed', e?.message || 'Could not queue firearm updates. Please try again.');
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
        {/* Firearm Studio Photo Documentation */}
        <View style={styles.sectionCard}>
          <View style={styles.studioHeaderRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.sectionTitle}>Firearm Studio Photos</Text>
              <Text style={styles.studioSubtitle}>
                Standard 4-angle vault documentation for provenance, insurance, and grading.
              </Text>
            </View>
            <View style={styles.studioCountBadge}>
              <Text style={styles.studioCountText}>
                {['left', 'right', 'serial', 'proof'].filter(k => photos.some(p => p.angle === k)).length}/4 Standard
              </Text>
            </View>
          </View>

          {/* 4 Guided Angle Slots */}
          <View style={styles.studioGrid}>
            {STUDIO_SLOTS.map(slot => {
              const existing = photos.find(p => p.angle === slot.key);
              return (
                <View key={slot.key} style={[styles.studioSlotCard, existing ? styles.studioSlotCardFilled : null]}>
                  <View style={styles.slotTopRow}>
                    <View style={styles.slotLabelGroup}>
                      <View style={styles.slotTag}>
                        <Text style={styles.slotTagText}>{slot.badge}</Text>
                      </View>
                      <Text style={styles.slotTitle}>{slot.label}</Text>
                    </View>
                    {existing ? (
                      <View style={styles.slotStatusBadgeSuccess}>
                        <Ionicons name="checkmark-circle" size={13} color="#10b981" />
                        <Text style={styles.slotStatusTextSuccess}>Captured</Text>
                      </View>
                    ) : (
                      <View style={styles.slotStatusBadgePending}>
                        <Ionicons name="ellipse-outline" size={11} color="#64748b" />
                        <Text style={styles.slotStatusTextPending}>Empty</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.slotSubtitle} numberOfLines={2}>{slot.subtitle}</Text>

                  {existing ? (
                    <View style={styles.slotPreviewContainer}>
                      <Image source={{ uri: existing.uri }} style={styles.slotPreviewImage} />
                      <View style={styles.slotActionRow}>
                        <Pressable
                          style={styles.slotActionBtn}
                          onPress={() => captureAnglePhoto(slot.key, 'camera')}
                        >
                          <Ionicons name="camera" size={13} color="#38bdf8" />
                          <Text style={styles.slotActionBtnText}>Retake</Text>
                        </Pressable>
                        <Pressable
                          style={styles.slotActionBtn}
                          onPress={() => captureAnglePhoto(slot.key, 'library')}
                        >
                          <Ionicons name="images" size={13} color="#94a3b8" />
                          <Text style={styles.slotActionBtnText}>Library</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.slotActionBtn, styles.slotDeleteBtn]}
                          onPress={() => removeAnglePhoto(slot.key)}
                        >
                          <Ionicons name="trash-outline" size={13} color="#ef4444" />
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.slotEmptyActions}>
                      <Pressable
                        style={styles.slotEmptyPrimaryBtn}
                        onPress={() => captureAnglePhoto(slot.key, 'camera')}
                      >
                        <Ionicons name="camera" size={16} color="#38bdf8" />
                        <Text style={styles.slotEmptyPrimaryText}>Camera</Text>
                      </Pressable>
                      <Pressable
                        style={styles.slotEmptySecondaryBtn}
                        onPress={() => captureAnglePhoto(slot.key, 'library')}
                      >
                        <Ionicons name="images-outline" size={15} color="#94a3b8" />
                        <Text style={styles.slotEmptySecondaryText}>Gallery</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Additional Photos / Accessories */}
          <View style={styles.extraPhotosContainer}>
            <View style={styles.extraPhotosHeader}>
              <Text style={styles.extraPhotosTitle}>Additional Photos / Accessories</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable
                  style={styles.addExtraBtn}
                  onPress={() => captureAnglePhoto('extra', 'camera')}
                >
                  <Ionicons name="camera" size={13} color="#38bdf8" />
                  <Text style={styles.addExtraBtnText}>+ Camera</Text>
                </Pressable>
                <Pressable
                  style={styles.addExtraBtn}
                  onPress={() => captureAnglePhoto('extra', 'library')}
                >
                  <Ionicons name="images" size={13} color="#38bdf8" />
                  <Text style={styles.addExtraBtnText}>+ Gallery</Text>
                </Pressable>
              </View>
            </View>

            {photos.filter(p => p.angle === 'extra').length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoList}>
                {photos.filter(p => p.angle === 'extra').map((item, idx) => (
                  <View key={idx} style={styles.photoThumbContainer}>
                    <Image source={{ uri: item.uri }} style={styles.photoThumb} />
                    <Pressable
                      style={styles.photoRemoveBtn}
                      onPress={() => removeAnglePhoto('extra', item.uri)}
                      hitSlop={6}
                    >
                      <Ionicons name="close-circle" size={20} color="#ef4444" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.noExtraPhotosText}>No additional accessory or condition photos added.</Text>
            )}
          </View>
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
        <View style={[styles.sectionCard, { marginBottom: 48 }]}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.sectionTitle}>NFA Firearm / Item</Text>
              <Text style={styles.fieldSubLabel}>SBR, SBS, Suppressor, Machine Gun, AOW</Text>
            </View>
            <Pressable
              style={[styles.toggleBtn, isNfa && styles.toggleBtnActive]}
              onPress={() => setIsNfa(!isNfa)}
              hitSlop={12}
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
    paddingBottom: 100,
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
  studioHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  studioSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
    lineHeight: 16,
  },
  studioCountBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    alignSelf: 'flex-start',
  },
  studioCountText: {
    fontSize: 11,
    color: '#38bdf8',
    fontWeight: '700',
  },
  studioGrid: {
    gap: 12,
    marginBottom: 16,
  },
  studioSlotCard: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  studioSlotCardFilled: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: '#0a1320',
  },
  slotTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  slotLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slotTag: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  slotTagText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  slotTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
  },
  slotSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 10,
  },
  slotStatusBadgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  slotStatusTextSuccess: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10b981',
  },
  slotStatusBadgePending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(100, 116, 139, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  slotStatusTextPending: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
  },
  slotPreviewContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#020617',
  },
  slotPreviewImage: {
    width: '100%',
    height: 140,
    resizeMode: 'cover',
  },
  slotActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#0f172a',
    gap: 8,
  },
  slotActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  slotActionBtnText: {
    fontSize: 11,
    color: '#f1f5f9',
    fontWeight: '600',
  },
  slotDeleteBtn: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  slotEmptyActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  slotEmptyPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 12,
  },
  slotEmptyPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#38bdf8',
  },
  slotEmptySecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  slotEmptySecondaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  extraPhotosContainer: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  extraPhotosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  extraPhotosTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  addExtraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  addExtraBtnText: {
    fontSize: 11,
    color: '#38bdf8',
    fontWeight: '700',
  },
  noExtraPhotosText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
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
