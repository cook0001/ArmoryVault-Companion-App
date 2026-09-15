import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ScopeIcon, BallisticsTrajectoryIcon } from './components/CustomMobileIcons';
import { useSync } from '../context/SyncContext';
import { useDialog } from '../context/DialogContext';
import type { OpticItem, OpticZeroUpdateSyncItem } from '../types';

export default function OpticsScreen() {
  const router = useRouter();
  const { addToQueue, isModuleInstalled } = useSync();
  const { showSuccess } = useDialog();

  const [optics, setOptics] = useState<OpticItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('All');

  // Zero Update Modal state
  const [selectedOptic, setSelectedOptic] = useState<OpticItem | null>(null);
  const [isZeroModalOpen, setIsZeroModalOpen] = useState(false);
  const [zeroDistance, setZeroDistance] = useState('');
  const [clickUnit, setClickUnit] = useState('0.1 MRAD');
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    try {
      const cacheStr = await AsyncStorage.getItem('optics_cache');
      if (cacheStr) {
        setOptics(JSON.parse(cacheStr));
      } else {
        const invStr = await AsyncStorage.getItem('inventory_cache');
        if (invStr) {
          const inv = JSON.parse(invStr);
          if (Array.isArray(inv.optics)) {
            setOptics(inv.optics);
          }
        }
      }
    } catch (e) {
      console.warn('Error loading optics cache:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredOptics = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return optics.filter((item) => {
      if (filterType !== 'All' && item.type !== filterType) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.manufacturer.toLowerCase().includes(q) ||
        item.model.toLowerCase().includes(q) ||
        item.reticle.toLowerCase().includes(q) ||
        (item.mountedOnFirearm && item.mountedOnFirearm.toLowerCase().includes(q))
      );
    });
  }, [optics, searchQuery, filterType]);

  const handleOpenZeroModal = (optic: OpticItem) => {
    setSelectedOptic(optic);
    setZeroDistance(String(optic.zeroDistance || 100));
    setClickUnit(optic.clickValue || '0.1 MRAD');
    setNotes('');
    setIsZeroModalOpen(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const handleSubmitZeroUpdate = async () => {
    if (!selectedOptic) return;
    const distanceNum = parseInt(zeroDistance, 10) || 100;
    const today = new Date().toISOString().split('T')[0];

    const payload: OpticZeroUpdateSyncItem = {
      type: 'optic_zero_update',
      optic_id: selectedOptic.id,
      zero_distance: distanceNum,
      click_unit: clickUnit,
      date: today,
      notes: notes.trim(),
      timestamp: new Date().toISOString(),
    };

    // 1. Queue to desktop outbox
    await addToQueue(payload, 'Optic zero adjustment queued for Desktop');

    // 2. Optimistically update local optics cache
    const updatedList = optics.map((o) => {
      if (o.id === selectedOptic.id) {
        return {
          ...o,
          zeroDistance: distanceNum,
          clickValue: clickUnit,
          updatedAt: today,
        };
      }
      return o;
    });
    setOptics(updatedList);
    await AsyncStorage.setItem('optics_cache', JSON.stringify(updatedList));

    setIsZeroModalOpen(false);
    setSelectedOptic(null);
    showSuccess('Zero Saved', `Updated ${selectedOptic.name} zero to ${distanceNum} yds.`);
  };

  const isModuleActive = isModuleInstalled('optics');

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      {/* Header Search Bar */}
      <View style={styles.headerBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#64748b" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Optic, Reticle, Firearm..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#64748b" />
            </Pressable>
          ) : null}
        </View>

        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {['All', 'Rifle Scope', 'Red Dot', 'LPVO', 'Prism'].map((t) => (
            <Pressable
              key={t}
              style={[styles.filterChip, filterType === t && styles.filterChipActive]}
              onPress={() => setFilterType(t)}
            >
              <Text style={[styles.filterChipText, filterType === t && styles.filterChipTextActive]}>
                {t}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {!isModuleActive && (
        <View style={styles.disabledBanner}>
          <Ionicons name="information-circle-outline" size={18} color="#f59e0b" style={{ marginRight: 6 }} />
          <Text style={styles.disabledBannerText}>
            Optics Module is not installed on paired Desktop. Operating in standalone mode.
          </Text>
        </View>
      )}

      {/* Optics Cards */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {filteredOptics.length === 0 ? (
          <View style={styles.emptyContainer}>
            <ScopeIcon size={48} color="#64748b" />
            <Text style={styles.emptyTitle}>No Optics in Vault</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try a different search term'
                : 'Optics, red dots, and scopes configured on Desktop appear here.'}
            </Text>
          </View>
        ) : (
          filteredOptics.map((item) => (
            <View key={item.id} style={styles.opticCard}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.opticName}>{item.name}</Text>
                  <Text style={styles.opticSub}>
                    {item.manufacturer} {item.model} • {item.type}
                  </Text>
                </View>

                {item.mountedOnFirearm ? (
                  <View style={styles.mountedBadge}>
                    <Text style={styles.mountedBadgeText}>MOUNTED</Text>
                  </View>
                ) : (
                  <View style={styles.unmountedBadge}>
                    <Text style={styles.unmountedBadgeText}>UNMOUNTED</Text>
                  </View>
                )}
              </View>

              {item.mountedOnFirearm ? (
                <View style={styles.mountedGunRow}>
                  <Ionicons name="link-outline" size={13} color="#38bdf8" />
                  <Text style={styles.mountedGunText}>Host: {item.mountedOnFirearm}</Text>
                </View>
              ) : null}

              {/* Zero & Reticle Specs */}
              <View style={styles.specsGrid}>
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>ZERO DISTANCE</Text>
                  <Text style={styles.specVal}>{item.zeroDistance || 100} yds</Text>
                </View>
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>TURRET CLICKS</Text>
                  <Text style={styles.specVal}>{item.clickValue || '0.1 MRAD'}</Text>
                </View>
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>RETICLE</Text>
                  <Text style={styles.specVal} numberOfLines={1}>
                    {item.reticle || 'Standard Crosshair'}
                  </Text>
                </View>
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>BATTERY</Text>
                  <Text style={styles.specVal}>{item.batteryType || 'None'}</Text>
                </View>
              </View>

              {/* Quick Actions */}
              <View style={styles.actionsRow}>
                <Pressable
                  style={styles.ballisticsLinkBtn}
                  onPress={() => router.push('/range/ballistics')}
                >
                  <BallisticsTrajectoryIcon size={14} color="#ef4444" />
                  <Text style={styles.ballisticsLinkText}>Trajectory DOPE</Text>
                </Pressable>

                <Pressable style={styles.updateZeroBtn} onPress={() => handleOpenZeroModal(item)}>
                  <Ionicons name="locate-outline" size={14} color="#fff" />
                  <Text style={styles.updateZeroText}>Confirm / Adjust Zero</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Adjust Zero Modal */}
      <Modal visible={isZeroModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Confirm / Adjust Optic Zero</Text>
                <Text style={styles.modalSub}>{selectedOptic?.name}</Text>
              </View>
              <Pressable onPress={() => setIsZeroModalOpen(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </Pressable>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ZERO DISTANCE (YARDS) *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="100"
                placeholderTextColor="#64748b"
                keyboardType="numeric"
                value={zeroDistance}
                onChangeText={setZeroDistance}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>TURRET CLICK VALUE</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {['0.1 MRAD', '1/4 MOA', '1/2 MOA', '1 MOA'].map((u) => (
                  <Pressable
                    key={u}
                    style={[styles.typeChip, clickUnit === u && styles.typeChipActive]}
                    onPress={() => setClickUnit(u)}
                  >
                    <Text style={[styles.typeChipText, clickUnit === u && styles.typeChipTextActive]}>
                      {u}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ZERO VERIFICATION NOTES</Text>
              <TextInput
                style={[styles.formInput, { height: 60, textAlignVertical: 'top' }]}
                placeholder="Ammunition used, ambient temp, zero stop set..."
                placeholderTextColor="#64748b"
                multiline
                value={notes}
                onChangeText={setNotes}
              />
            </View>

            <View style={styles.modalButtonsRow}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setIsZeroModalOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSubmitBtn} onPress={handleSubmitZeroUpdate}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.modalSubmitText}>Save & Queue Zero</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  headerBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(100, 116, 139, 0.2)',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.3)',
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 14,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.2)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38bdf8',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  filterChipTextActive: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  disabledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 158, 11, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  disabledBannerText: {
    fontSize: 11,
    color: '#fbbf24',
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  opticCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.25)',
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  opticName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
  },
  opticSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 1,
  },
  mountedBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderColor: 'rgba(52, 211, 153, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  mountedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#34d399',
    letterSpacing: 0.5,
  },
  unmountedBadge: {
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  unmountedBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
  },
  mountedGunRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  mountedGunText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#38bdf8',
  },
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderRadius: 8,
    padding: 8,
    gap: 8,
  },
  specItem: {
    width: '48%',
    gap: 2,
  },
  specLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.4,
  },
  specVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    gap: 10,
  },
  ballisticsLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  ballisticsLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444',
  },
  updateZeroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  updateZeroText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.3)',
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
  },
  modalSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  formInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#f8fafc',
    fontSize: 13,
  },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.25)',
  },
  typeChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38bdf8',
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  typeChipTextActive: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  modalSubmitBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
});
