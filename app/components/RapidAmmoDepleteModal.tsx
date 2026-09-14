import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  Switch,
  KeyboardAvoidingView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSync } from '../../context/SyncContext';
import { useDialog } from '../../context/DialogContext';
import { CartridgesIcon } from './CustomMobileIcons';
import { parseStorageUri } from '../../utils/storageCapacity';
import { formatAmmoSubtitle, formatShotgunSpecs, getPlusPBadgeText, isShotgunAmmo } from '../../utils/caliberHelpers';
import { calculateFirearmWear } from '../../utils/maintenanceManager';

export interface RapidAmmoDepleteModalProps {
  visible: boolean;
  onClose: () => void;
  onDepleted?: (updatedAmmo: any, firearmId?: number, roundsDepleted?: number) => void;
}

const PRESET_AMOUNTS = [20, 50, 100, 200];

export const RapidAmmoDepleteModal: React.FC<RapidAmmoDepleteModalProps> = ({
  visible,
  onClose,
  onDepleted,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const { addToQueue, offlineQueue, removeFromQueue } = useSync();
  const { showToast, showError, showSuccess } = useDialog();

  const [torchOn, setTorchOn] = useState(false);
  const [continuousMode, setContinuousMode] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showManualList, setShowManualList] = useState(false);

  // Cached data
  const [ammoList, setAmmoList] = useState<any[]>([]);
  const [firearmsList, setFirearmsList] = useState<any[]>([]);
  const [skus, setSkus] = useState<Record<string, any>>({});

  // Active matched ammo & selection
  const [matchedAmmo, setMatchedAmmo] = useState<any | null>(null);
  const [selectedFirearmId, setSelectedFirearmId] = useState<number | null>(null);
  const [roundsToDeplete, setRoundsToDeplete] = useState<number>(50);
  const [customAmountText, setCustomAmountText] = useState<string>('');
  const [isCustomAmount, setIsCustomAmount] = useState(false);
  const [showFirearmPicker, setShowFirearmPicker] = useState(false);

  // Load latest inventory when opened
  useEffect(() => {
    if (visible) {
      loadInventoryCache();
      setScanned(false);
      setMatchedAmmo(null);
      setSelectedFirearmId(null);
      setIsCustomAmount(false);
      setCustomAmountText('');
      setShowManualList(false);
      setSearchQuery('');
    }
  }, [visible]);

  const loadInventoryCache = async () => {
    try {
      const cacheStr = await AsyncStorage.getItem('inventory_cache');
      if (cacheStr) {
        const cache = JSON.parse(cacheStr);
        setAmmoList(cache.ammo || []);
        setFirearmsList(cache.firearms || []);
        setSkus(cache.skus || {});
      }
    } catch (e) {
      console.error('Error loading inventory cache in rapid depletion modal', e);
    }
  };

  const handleBarcodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned || matchedAmmo) return;
    setScanned(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const cleanData = (data || '').trim();

    // 1. Direct Ammo ID format (AV-AMMO-<id> or armoryvault://ammo/<id>)
    let ammoId: string | null = null;
    if (cleanData.startsWith('AV-AMMO-')) {
      ammoId = cleanData.replace('AV-AMMO-', '').trim();
    } else if (cleanData.startsWith('armoryvault://ammo/')) {
      ammoId = cleanData.replace('armoryvault://ammo/', '').trim();
    }

    let found = null;
    if (ammoId) {
      found = ammoList.find((a) => String(a.id) === ammoId);
    }

    // 2. Barcode UPC lookup
    if (!found) {
      found = ammoList.find((a) => a.upc_code === cleanData || String(a.id) === cleanData);
    }

    // 3. Custom SKU lookup
    if (!found && skus[cleanData]) {
      const skuData = skus[cleanData];
      found = ammoList.find(
        (a) =>
          a.caliber === skuData.caliber &&
          (a.manufacturer === skuData.manufacturer || a.name === skuData.name)
      );
    }

    if (found) {
      selectAmmoItem(found);
    } else {
      showToast('No matching ammunition found in vault catalog for this barcode.');
      setTimeout(() => setScanned(false), 1500);
    }
  };

  const selectAmmoItem = (item: any) => {
    setMatchedAmmo(item);
    setShowManualList(false);

    // Default depletion count based on caliber category
    const cal = (item.caliber || '').toLowerCase();
    const isRifle = cal.includes('5.56') || cal.includes('.223') || cal.includes('.308') || cal.includes('6.5') || cal.includes('7.62') || cal.includes('30-06');
    const isShot = isShotgunAmmo(item);
    const defaultRounds = isRifle || isShot ? 20 : 50;
    setRoundsToDeplete(defaultRounds);
    setIsCustomAmount(false);
    setCustomAmountText('');

    // Pre-select matching firearm if only 1 matches caliber
    const matchingGuns = firearmsList.filter(
      (f) => !f.is_sold && (f.caliber || '').toLowerCase().trim() === (item.caliber || '').toLowerCase().trim()
    );
    if (matchingGuns.length === 1) {
      setSelectedFirearmId(matchingGuns[0].id);
    } else {
      setSelectedFirearmId(null);
    }
  };

  // Filtered manual list for fallback selection
  const filteredAmmoList = useMemo(() => {
    if (!searchQuery.trim()) return ammoList;
    const q = searchQuery.toLowerCase();
    return ammoList.filter(
      (a) =>
        (a.caliber && a.caliber.toLowerCase().includes(q)) ||
        (a.manufacturer && a.manufacturer.toLowerCase().includes(q)) ||
        (a.projectile && a.projectile.toLowerCase().includes(q)) ||
        (a.upc_code && a.upc_code.includes(q))
    );
  }, [ammoList, searchQuery]);

  // Prioritized firearms list: matching calibers first
  const sortedFirearms = useMemo(() => {
    if (!matchedAmmo) return firearmsList.filter((f) => !f.is_sold);
    const targetCal = (matchedAmmo.caliber || '').toLowerCase().trim();
    return [...firearmsList.filter((f) => !f.is_sold)].sort((a, b) => {
      const aMatch = (a.caliber || '').toLowerCase().trim() === targetCal ? 1 : 0;
      const bMatch = (b.caliber || '').toLowerCase().trim() === targetCal ? 1 : 0;
      return bMatch - aMatch;
    });
  }, [firearmsList, matchedAmmo]);

  const selectedFirearm = useMemo(() => {
    if (!selectedFirearmId) return null;
    return firearmsList.find((f) => f.id === selectedFirearmId) || null;
  }, [firearmsList, selectedFirearmId]);

  const activeAmount = isCustomAmount
    ? parseInt(customAmountText, 10) || 0
    : roundsToDeplete;

  const currentStock = matchedAmmo ? parseInt(matchedAmmo.count, 10) || 0 : 0;
  const remainingStock = Math.max(0, currentStock - activeAmount);

  const handleConfirmDeplete = async () => {
    if (!matchedAmmo || activeAmount <= 0) return;

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const updatedCount = Math.max(0, currentStock - activeAmount);
    const updatedAmmo = { ...matchedAmmo, count: updatedCount };

    // 1. Update local ammo state in modal
    setAmmoList((prev) => prev.map((a) => (a.id === matchedAmmo.id ? updatedAmmo : a)));

    // 2. Persist to AsyncStorage inventory_cache
    try {
      const cacheStr = await AsyncStorage.getItem('inventory_cache');
      if (cacheStr) {
        const cache = JSON.parse(cacheStr);
        if (cache.ammo) {
          cache.ammo = cache.ammo.map((a: any) => (a.id === matchedAmmo.id ? updatedAmmo : a));
        }
        if (selectedFirearmId && cache.firearms) {
          cache.firearms = cache.firearms.map((f: any) => {
            if (f.id === selectedFirearmId) {
              const currentRounds = Number(f.round_count) || 0;
              return { ...f, round_count: currentRounds + activeAmount };
            }
            return f;
          });
        }
        await AsyncStorage.setItem('inventory_cache', JSON.stringify(cache));
      }
    } catch (e) {
      console.error('Failed to update inventory cache on ammo depletion', e);
    }

    // 3. Queue sync item for desktop synchronization
    const syncItem = {
      type: 'ammo_adjustment',
      upcOrId: String(matchedAmmo.id),
      action: 'remove',
      count: activeAmount,
      measurement: 'rds',
      firearmId: selectedFirearmId || undefined,
      firearm_id: selectedFirearmId || undefined,
      timestamp: new Date().toISOString(),
      data: {
        caliber: matchedAmmo.caliber,
        manufacturer: matchedAmmo.manufacturer,
        firearmId: selectedFirearmId || undefined,
        rounds_fired: activeAmount,
      },
      notes: selectedFirearm
        ? `Fired ${activeAmount} rds through ${selectedFirearm.make} ${selectedFirearm.model}`
        : `Rapid bench depletion: -${activeAmount} rds`,
    };

    await addToQueue(
      syncItem,
      `Depleted ${activeAmount} rds ${matchedAmmo.caliber}${
        selectedFirearm ? ` (${selectedFirearm.make} ${selectedFirearm.model})` : ''
      }`
    );

    showToast({
      message: `Depleted ${activeAmount} rds (${remainingStock} remaining)`,
      type: 'success',
      action: {
        label: 'UNDO',
        onPress: () => {
          if (offlineQueue.length > 0) {
            removeFromQueue(offlineQueue.length - 1);
          }
        },
      },
    });

    if (onDepleted) {
      onDepleted(updatedAmmo, selectedFirearmId || undefined, activeAmount);
    }

    // If continuous mode is enabled, keep scanner open for next box
    if (continuousMode) {
      setMatchedAmmo(null);
      setSelectedFirearmId(null);
      setIsCustomAmount(false);
      setCustomAmountText('');
      setTimeout(() => setScanned(false), 600);
    } else {
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <CartridgesIcon size={20} color="#38bdf8" />
              <Text style={styles.modalTitle}>Rapid Ammo Depletion</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable
                style={styles.headerIconBtn}
                onPress={() => setTorchOn(!torchOn)}
                accessibilityLabel="Toggle Flashlight"
              >
                <Ionicons
                  name={torchOn ? 'flash' : 'flash-off'}
                  size={18}
                  color={torchOn ? '#fbbf24' : '#94a3b8'}
                />
              </Pressable>

              <Pressable
                style={styles.headerIconBtn}
                onPress={onClose}
                accessibilityLabel="Close Scanner"
              >
                <Ionicons name="close" size={20} color="#94a3b8" />
              </Pressable>
            </View>
          </View>

          {/* Continuous Mode Toggle Bar */}
          <View style={styles.continuousBar}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="repeat-outline" size={16} color="#38bdf8" />
              <Text style={styles.continuousText}>Continuous Scan Mode</Text>
            </View>
            <Switch
              value={continuousMode}
              onValueChange={setContinuousMode}
              trackColor={{ false: '#334155', true: 'rgba(56, 189, 248, 0.4)' }}
              thumbColor={continuousMode ? '#38bdf8' : '#94a3b8'}
            />
          </View>

          {/* Main Area: Camera or Matched Item Card */}
          {!matchedAmmo ? (
            <View style={styles.cameraSection}>
              {permission?.granted ? (
                <View style={styles.cameraWrapper}>
                  <CameraView
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    enableTorch={torchOn}
                    barcodeScannerSettings={{
                      barcodeTypes: [
                        'qr',
                        'upc_a',
                        'upc_e',
                        'ean13',
                        'ean8',
                        'code39',
                        'code128',
                      ],
                    }}
                    onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                  />

                  {/* Viewfinder Target */}
                  <View style={styles.viewfinderBox} pointerEvents="none">
                    <View style={[styles.corner, styles.cornerTL]} />
                    <View style={[styles.corner, styles.cornerTR]} />
                    <View style={[styles.corner, styles.cornerBL]} />
                    <View style={[styles.corner, styles.cornerBR]} />
                  </View>

                  <Text style={styles.cameraHint}>
                    Align commercial ammo UPC or QR code inside frame
                  </Text>
                </View>
              ) : (
                <View style={styles.permissionBox}>
                  <Ionicons name="camera-outline" size={42} color="#64748b" />
                  <Text style={styles.permissionTitle}>Camera Access Required</Text>
                  <Text style={styles.permissionDesc}>
                    ArmoryVault requires camera permission to rapidly scan ammo box barcodes.
                  </Text>
                  <Pressable style={styles.permissionBtn} onPress={requestPermission}>
                    <Text style={styles.permissionBtnText}>Grant Camera Access</Text>
                  </Pressable>
                </View>
              )}

              {/* Manual Selection Fallback Drawer */}
              <View style={styles.manualSearchSection}>
                <Pressable
                  style={styles.manualToggleBtn}
                  onPress={() => setShowManualList(!showManualList)}
                >
                  <Ionicons
                    name={showManualList ? 'chevron-down' : 'search-outline'}
                    size={16}
                    color="#38bdf8"
                  />
                  <Text style={styles.manualToggleText}>
                    {showManualList ? 'Hide Catalog Search' : 'Select from Vault Catalog Manually'}
                  </Text>
                </Pressable>

                {showManualList && (
                  <View style={styles.manualListContainer}>
                    <View style={styles.searchBar}>
                      <Ionicons name="search" size={16} color="#64748b" />
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Search caliber, brand, or UPC..."
                        placeholderTextColor="#64748b"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                      />
                      {searchQuery.length > 0 && (
                        <Pressable onPress={() => setSearchQuery('')}>
                          <Ionicons name="close-circle" size={16} color="#64748b" />
                        </Pressable>
                      )}
                    </View>

                    <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
                      {filteredAmmoList.map((item) => (
                        <Pressable
                          key={item.id}
                          style={styles.manualItemRow}
                          onPress={() => selectAmmoItem(item)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.manualItemTitle}>
                              {item.caliber} - {item.manufacturer || 'Factory'}
                            </Text>
                            <Text style={styles.manualItemSub}>
                              {item.grain ? `${item.grain}gr ` : ''}
                              {item.projectile || ''} • {item.count} rds in stock
                            </Text>
                          </View>
                          <Ionicons name="arrow-forward" size={16} color="#38bdf8" />
                        </Pressable>
                      ))}
                      {filteredAmmoList.length === 0 && (
                        <Text style={styles.emptySearchText}>No matching ammunition found.</Text>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>
          ) : (
            /* Matched Ammo Depletion Form */
            <ScrollView style={styles.matchedForm} keyboardShouldPersistTaps="handled">
              {/* Ammunition Card Header */}
              <View style={styles.ammoInfoCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ammoCaliber}>{matchedAmmo.caliber}</Text>
                    <Text style={styles.ammoMfg}>
                      {matchedAmmo.manufacturer || 'Standard'} • {matchedAmmo.projectile || 'FMJ'}{' '}
                      {matchedAmmo.grain ? `(${matchedAmmo.grain}gr)` : ''}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.rescanBtn}
                    onPress={() => {
                      setMatchedAmmo(null);
                      setScanned(false);
                    }}
                  >
                    <Ionicons name="refresh-outline" size={14} color="#38bdf8" />
                    <Text style={styles.rescanBtnText}>Scan Next</Text>
                  </Pressable>
                </View>

                {/* Stock Stats Row */}
                <View style={styles.stockPreviewRow}>
                  <View style={styles.stockStatCol}>
                    <Text style={styles.stockStatLabel}>Current Vault Stock</Text>
                    <Text style={styles.stockStatValue}>{currentStock} rds</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={18} color="#64748b" />
                  <View style={styles.stockStatCol}>
                    <Text style={styles.stockStatLabel}>Stock After Depletion</Text>
                    <Text
                      style={[
                        styles.stockStatValue,
                        { color: remainingStock === 0 ? '#ef4444' : '#38bdf8' },
                      ]}
                    >
                      {remainingStock} rds
                    </Text>
                  </View>
                </View>

                {activeAmount > currentStock && (
                  <View style={styles.warningBox}>
                    <Ionicons name="warning-outline" size={16} color="#fbbf24" />
                    <Text style={styles.warningText}>
                      Depletion count exceeds recorded vault stock ({currentStock} rds).
                    </Text>
                  </View>
                )}
              </View>

              {/* Rounds To Deplete Selector */}
              <Text style={styles.sectionHeader}>Rounds to Deplete</Text>
              <View style={styles.presetRow}>
                {PRESET_AMOUNTS.map((amt) => {
                  const isSelected = !isCustomAmount && roundsToDeplete === amt;
                  return (
                    <Pressable
                      key={amt}
                      style={[styles.presetChip, isSelected && styles.presetChipActive]}
                      onPress={() => {
                        setIsCustomAmount(false);
                        setRoundsToDeplete(amt);
                      }}
                    >
                      <Text
                        style={[
                          styles.presetChipText,
                          isSelected && styles.presetChipTextActive,
                        ]}
                      >
                        -{amt}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  style={[styles.presetChip, isCustomAmount && styles.presetChipActive]}
                  onPress={() => setIsCustomAmount(true)}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      isCustomAmount && styles.presetChipTextActive,
                    ]}
                  >
                    Custom
                  </Text>
                </Pressable>
              </View>

              {isCustomAmount && (
                <View style={styles.customAmountRow}>
                  <Text style={styles.customAmountLabel}>Enter Exact Rounds:</Text>
                  <TextInput
                    style={styles.customAmountInput}
                    placeholder="e.g. 35"
                    placeholderTextColor="#64748b"
                    keyboardType="number-pad"
                    value={customAmountText}
                    onChangeText={setCustomAmountText}
                    autoFocus
                  />
                </View>
              )}

              {/* Firearm Dispatch Selector */}
              <Text style={styles.sectionHeader}>Firearm Dispatched / Logged To (Optional)</Text>
              <Pressable
                style={styles.firearmSelectBtn}
                onPress={() => setShowFirearmPicker(!showFirearmPicker)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <Ionicons
                    name={selectedFirearm ? 'shield-checkmark' : 'cube-outline'}
                    size={18}
                    color={selectedFirearm ? '#38bdf8' : '#94a3b8'}
                  />
                  <Text style={styles.firearmSelectText}>
                    {selectedFirearm
                      ? `${selectedFirearm.make} ${selectedFirearm.model} (${selectedFirearm.caliber})`
                      : 'Unassigned (General Range / Off-Record)'}
                  </Text>
                </View>
                <Ionicons
                  name={showFirearmPicker ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#94a3b8"
                />
              </Pressable>

              {/* Selected Firearm Round Count Impact & Proactive Wear Alert */}
              {selectedFirearm && (() => {
                const currentCount = Number(selectedFirearm.round_count) || 0;
                const projectedCount = currentCount + activeAmount;
                const wear = calculateFirearmWear(projectedCount);
                const isOverdue = wear.deepClean.status === 'overdue' || wear.recoilSpring.status === 'overdue';
                const isWarning = wear.deepClean.status === 'warning' || wear.recoilSpring.status === 'warning';

                return (
                  <View style={{ gap: 6, marginBottom: 8 }}>
                    <View style={styles.firearmImpactBox}>
                      <Ionicons name="speedometer-outline" size={16} color="#34d399" />
                      <Text style={styles.firearmImpactText}>
                        Round count: {currentCount} rds ➔ {projectedCount} rds (+{activeAmount})
                      </Text>
                    </View>

                    {(isOverdue || isWarning) && (
                      <View
                        style={[
                          styles.firearmWearAlertBox,
                          isOverdue ? styles.firearmWearAlertOverdue : styles.firearmWearAlertWarning,
                        ]}
                      >
                        <Ionicons
                          name={isOverdue ? 'warning' : 'construct-outline'}
                          size={15}
                          color={isOverdue ? '#f87171' : '#fbbf24'}
                        />
                        <Text
                          style={[
                            styles.firearmWearAlertText,
                            { color: isOverdue ? '#fca5a5' : '#fde68a' },
                          ]}
                        >
                          {isOverdue
                            ? `Maintenance Due: ${
                                wear.deepClean.status === 'overdue'
                                  ? 'Clean & Lube Required'
                                  : 'Recoil Spring Overdue'
                              } (${projectedCount} rds)`
                            : `Maintenance Approaching: ${wear.deepClean.currentRounds}/${wear.deepClean.thresholdRounds} rds until service`}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })()}

              {/* Firearm Picker Accordion */}
              {showFirearmPicker && (
                <View style={styles.firearmPickerList}>
                  <Pressable
                    style={[
                      styles.firearmPickerOption,
                      selectedFirearmId === null && styles.firearmPickerOptionActive,
                    ]}
                    onPress={() => {
                      setSelectedFirearmId(null);
                      setShowFirearmPicker(false);
                    }}
                  >
                    <Text style={styles.firearmPickerOptionText}>
                      None (General Range Depletion)
                    </Text>
                    {selectedFirearmId === null && (
                      <Ionicons name="checkmark" size={16} color="#38bdf8" />
                    )}
                  </Pressable>

                  {sortedFirearms.map((gun) => {
                    const isCalMatch =
                      (gun.caliber || '').toLowerCase().trim() ===
                      (matchedAmmo.caliber || '').toLowerCase().trim();
                    const isSelected = selectedFirearmId === gun.id;
                    const gunRounds = Number(gun.round_count) || 0;
                    const gunWear = calculateFirearmWear(gunRounds);
                    const isGunDue =
                      gunWear.deepClean.status === 'overdue' ||
                      gunWear.recoilSpring.status === 'overdue';

                    return (
                      <Pressable
                        key={gun.id}
                        style={[
                          styles.firearmPickerOption,
                          isSelected && styles.firearmPickerOptionActive,
                        ]}
                        onPress={() => {
                          setSelectedFirearmId(gun.id);
                          setShowFirearmPicker(false);
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.firearmPickerOptionText}>
                              {gun.make} {gun.model}
                            </Text>
                            {isCalMatch && (
                              <View style={styles.calMatchBadge}>
                                <Text style={styles.calMatchBadgeText}>Caliber Match</Text>
                              </View>
                            )}
                            {isGunDue && (
                              <View style={styles.serviceDueBadge}>
                                <Ionicons name="construct-outline" size={10} color="#f87171" />
                                <Text style={styles.serviceDueBadgeText}>Service Due</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.firearmPickerOptionSub}>
                            {gun.caliber} • SN: {gun.serial_number || 'N/A'} • Round count:{' '}
                            {gunRounds} rds
                          </Text>
                        </View>
                        {isSelected && <Ionicons name="checkmark" size={16} color="#38bdf8" />}
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.actionButtonsRow}>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => {
                    setMatchedAmmo(null);
                    setScanned(false);
                  }}
                >
                  <Text style={styles.cancelBtnText}>Back</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.confirmBtn,
                    activeAmount <= 0 && { opacity: 0.5 },
                  ]}
                  disabled={activeAmount <= 0}
                  onPress={handleConfirmDeplete}
                >
                  <Ionicons name="remove-circle-outline" size={18} color="#fff" />
                  <Text style={styles.confirmBtnText}>
                    Confirm Deplete (-{activeAmount} rds)
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerIconBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  continuousBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#131e32',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  continuousText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  cameraSection: {
    padding: 16,
  },
  cameraWrapper: {
    height: 250,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  viewfinderBox: {
    width: 200,
    height: 120,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#38bdf8',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  cameraHint: {
    position: 'absolute',
    bottom: 12,
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '500',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  permissionBox: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 20,
  },
  permissionTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 10,
  },
  permissionDesc: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  permissionBtn: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
  },
  permissionBtnText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 13,
  },
  manualSearchSection: {
    marginTop: 14,
  },
  manualToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  manualToggleText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
  manualListContainer: {
    marginTop: 10,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 12,
    padding: 0,
  },
  manualItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  manualItemTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
  },
  manualItemSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  emptySearchText: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 16,
  },
  matchedForm: {
    padding: 16,
  },
  ammoInfoCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    marginBottom: 16,
  },
  ammoCaliber: {
    color: '#38bdf8',
    fontSize: 17,
    fontWeight: '700',
  },
  ammoMfg: {
    color: '#cbd5e1',
    fontSize: 13,
    marginTop: 2,
  },
  rescanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  rescanBtnText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600',
  },
  stockPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  stockStatCol: {
    alignItems: 'center',
  },
  stockStatLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  stockStatValue: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    borderRadius: 6,
    padding: 8,
    marginTop: 10,
  },
  warningText: {
    color: '#fbbf24',
    fontSize: 11,
    flex: 1,
  },
  sectionHeader: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  presetChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38bdf8',
  },
  presetChipText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  presetChipTextActive: {
    color: '#38bdf8',
  },
  customAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  customAmountLabel: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  customAmountInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#38bdf8',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  firearmSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 8,
  },
  firearmSelectText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '500',
  },
  firearmImpactBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  firearmImpactText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '600',
  },
  firearmPickerList: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 6,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
    maxHeight: 180,
  },
  firearmPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  firearmPickerOptionActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  firearmPickerOptionText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
  },
  firearmPickerOptionSub: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 1,
  },
  calMatchBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.4)',
  },
  calMatchBadgeText: {
    color: '#34d399',
    fontSize: 9,
    fontWeight: '700',
  },
  serviceDueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  serviceDueBadgeText: {
    color: '#f87171',
    fontSize: 9,
    fontWeight: '700',
  },
  firearmWearAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  firearmWearAlertOverdue: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  firearmWearAlertWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  firearmWearAlertText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 20,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#ef4444',
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
