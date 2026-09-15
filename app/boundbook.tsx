import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BoundBookIcon, SafeIcon } from './components/CustomMobileIcons';
import { useSync } from '../context/SyncContext';
import { useDialog } from '../context/DialogContext';
import type { Firearm, BillOfSaleSyncItem } from '../types';

export default function BoundBookScreen() {
  const router = useRouter();
  const { addToQueue, isModuleInstalled } = useSync();
  const { showSuccess, showError } = useDialog();

  const [firearms, setFirearms] = useState<Firearm[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'acquired' | 'disposed'>('all');
  const [loading, setLoading] = useState(true);

  // Transfer modal state
  const [selectedFirearm, setSelectedFirearm] = useState<Firearm | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [buyerFflOrDl, setBuyerFflOrDl] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    try {
      const cacheStr = await AsyncStorage.getItem('inventory_cache');
      if (cacheStr) {
        const parsed = JSON.parse(cacheStr);
        if (Array.isArray(parsed.firearms)) {
          setFirearms(parsed.firearms);
        }
      }
    } catch (e) {
      console.warn('Error loading bound book inventory:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return firearms.filter((f) => {
      // Tab filter
      if (filterTab === 'acquired' && f.is_sold) return false;
      if (filterTab === 'disposed' && !f.is_sold) return false;

      // Text search
      if (!q) return true;
      const make = (f.make || '').toLowerCase();
      const model = (f.model || '').toLowerCase();
      const serial = (f.serial_number || '').toLowerCase();
      const caliber = (f.caliber || '').toLowerCase();
      const acquiredFrom = (f.acquired_from_name || '').toLowerCase();
      const soldTo = (f.sold_to_name || '').toLowerCase();

      return (
        make.includes(q) ||
        model.includes(q) ||
        serial.includes(q) ||
        caliber.includes(q) ||
        acquiredFrom.includes(q) ||
        soldTo.includes(q)
      );
    });
  }, [firearms, searchQuery, filterTab]);

  const handleOpenTransfer = (firearm: Firearm) => {
    setSelectedFirearm(firearm);
    setBuyerName('');
    setBuyerAddress('');
    setBuyerFflOrDl('');
    setSalePrice('');
    setPaymentMethod('Cash');
    setNotes('');
    setIsTransferModalOpen(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const handleSubmitTransfer = async () => {
    if (!selectedFirearm) return;
    if (!buyerName.trim()) {
      showError('Required Field', 'Please enter the Buyer or Transferee name.');
      return;
    }

    const priceNum = parseFloat(salePrice) || 0;
    const today = new Date().toISOString().split('T')[0];
    const transferId = `TR-${Date.now().toString(36).toUpperCase()}`;

    const payload: BillOfSaleSyncItem = {
      type: 'bill_of_sale_transfer',
      firearm_id: selectedFirearm.id,
      serial_number: selectedFirearm.serial_number,
      transfer_id: transferId,
      date: today,
      buyer_name: buyerName.trim(),
      buyer_dl: buyerFflOrDl.trim(),
      buyer_address: buyerAddress.trim(),
      seller_name: 'ArmoryVault User',
      sale_price: priceNum,
      payment_method: paymentMethod,
      notes: notes.trim(),
      timestamp: new Date().toISOString(),
    };

    // 1. Add to offline sync outbox
    await addToQueue(payload, 'Firearm disposition queued for Desktop synchronization');

    // 2. Optimistically update local cache so bound book updates immediately
    const updatedList = firearms.map((f) => {
      if (f.id === selectedFirearm.id || f.serial_number === selectedFirearm.serial_number) {
        return {
          ...f,
          is_sold: true,
          sold_date: today,
          sold_to_name: buyerName.trim(),
          sold_to_address: buyerAddress.trim(),
          sold_to_ffl: buyerFflOrDl.trim(),
          sold_price: priceNum,
        };
      }
      return f;
    });
    setFirearms(updatedList);

    try {
      const cacheStr = await AsyncStorage.getItem('inventory_cache');
      if (cacheStr) {
        const cache = JSON.parse(cacheStr);
        cache.firearms = updatedList;
        await AsyncStorage.setItem('inventory_cache', JSON.stringify(cache));
      }
    } catch {}

    setIsTransferModalOpen(false);
    setSelectedFirearm(null);
    showSuccess('Disposition Recorded', `Transfer ${transferId} queued for desktop Bound Book.`);
  };

  const isModuleActive = isModuleInstalled('boundbook');

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      {/* Search & Filter Bar */}
      <View style={styles.headerBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#64748b" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Serial, Model, Make..."
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

        {/* Tab Filters */}
        <View style={styles.tabFilterRow}>
          <Pressable
            style={[styles.filterChip, filterTab === 'all' && styles.filterChipActive]}
            onPress={() => setFilterTab('all')}
          >
            <Text style={[styles.filterChipText, filterTab === 'all' && styles.filterChipTextActive]}>
              All ({firearms.length})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, filterTab === 'acquired' && styles.filterChipActive]}
            onPress={() => setFilterTab('acquired')}
          >
            <Text style={[styles.filterChipText, filterTab === 'acquired' && styles.filterChipTextActive]}>
              In Inventory ({firearms.filter((f) => !f.is_sold).length})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, filterTab === 'disposed' && styles.filterChipActive]}
            onPress={() => setFilterTab('disposed')}
          >
            <Text style={[styles.filterChipText, filterTab === 'disposed' && styles.filterChipTextActive]}>
              Disposed ({firearms.filter((f) => f.is_sold).length})
            </Text>
          </Pressable>
        </View>
      </View>

      {!isModuleActive && (
        <View style={styles.disabledBanner}>
          <Ionicons name="information-circle-outline" size={18} color="#f59e0b" style={{ marginRight: 6 }} />
          <Text style={styles.disabledBannerText}>
            Module is not currently installed on paired Desktop. Operating in standalone mode.
          </Text>
        </View>
      )}

      {/* Records List */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {filteredRecords.length === 0 ? (
          <View style={styles.emptyContainer}>
            <BoundBookIcon size={48} color="#475569" />
            <Text style={styles.emptyTitle}>No Bound Book Entries Found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Firearms registered on Desktop or Field Companion appear here automatically.'}
            </Text>
          </View>
        ) : (
          filteredRecords.map((item, idx) => (
            <View key={item.id || item.serial_number || idx} style={styles.recordCard}>
              {/* Card Header */}
              <View style={styles.recordHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recordTitle}>
                    {item.make} {item.model}
                  </Text>
                  <Text style={styles.recordSub}>
                    {item.caliber} • {item.type || 'Firearm'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    item.is_sold ? styles.statusBadgeDisposed : styles.statusBadgeAcquired,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      item.is_sold ? styles.statusTextDisposed : styles.statusTextAcquired,
                    ]}
                  >
                    {item.is_sold ? 'DISPOSED' : 'IN INVENTORY'}
                  </Text>
                </View>
              </View>

              {/* Serial & Specs Banner */}
              <View style={styles.serialBox}>
                <Text style={styles.serialLabel}>SERIAL NUMBER</Text>
                <Text style={styles.serialVal}>{item.serial_number || 'N/A'}</Text>
              </View>

              {/* Acquisition Section */}
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="arrow-down-circle-outline" size={14} color="#34d399" />
                  <Text style={styles.sectionHeading}>1. Acquisition Record</Text>
                </View>
                <View style={styles.detailGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailKey}>Date Acquired</Text>
                    <Text style={styles.detailVal}>{item.acquire_date || item.purchase_date || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailKey}>Acquired From</Text>
                    <Text style={styles.detailVal} numberOfLines={1}>
                      {item.acquired_from_name || item.purchase_location || 'Private Party'}
                    </Text>
                  </View>
                  {item.acquired_from_ffl ? (
                    <View style={styles.detailItem}>
                      <Text style={styles.detailKey}>FFL / License</Text>
                      <Text style={styles.detailVal}>{item.acquired_from_ffl}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Disposition Section */}
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="arrow-up-circle-outline" size={14} color={item.is_sold ? '#ef4444' : '#64748b'} />
                  <Text style={styles.sectionHeading}>2. Disposition Record</Text>
                </View>

                {item.is_sold ? (
                  <View style={styles.detailGrid}>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailKey}>Date Disposed</Text>
                      <Text style={styles.detailVal}>{item.sold_date || 'N/A'}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailKey}>Disposed To</Text>
                      <Text style={styles.detailVal}>{item.sold_to_name || 'N/A'}</Text>
                    </View>
                    {item.sold_to_address ? (
                      <View style={styles.detailItem}>
                        <Text style={styles.detailKey}>Address / FFL</Text>
                        <Text style={styles.detailVal} numberOfLines={1}>
                          {item.sold_to_address} {item.sold_to_ffl ? `(${item.sold_to_ffl})` : ''}
                        </Text>
                      </View>
                    ) : null}
                    {item.sold_price ? (
                      <View style={styles.detailItem}>
                        <Text style={styles.detailKey}>Sale Amount</Text>
                        <Text style={styles.detailVal}>${Number(item.sold_price).toFixed(2)}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.undisposedRow}>
                    <Text style={styles.undisposedText}>Currently held in active collection / vault.</Text>
                    <Pressable style={styles.transferActionBtn} onPress={() => handleOpenTransfer(item)}>
                      <Ionicons name="swap-horizontal" size={14} color="#fff" style={{ marginRight: 4 }} />
                      <Text style={styles.transferActionText}>Transfer / Dispose</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Transfer / Dispose Modal */}
      <Modal visible={isTransferModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Record Firearm Disposition</Text>
                <Text style={styles.modalSub}>
                  {selectedFirearm?.make} {selectedFirearm?.model} • SN: {selectedFirearm?.serial_number}
                </Text>
              </View>
              <Pressable onPress={() => setIsTransferModalOpen(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>BUYER / TRANSFEREE FULL NAME *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Johnathan Doe"
                  placeholderTextColor="#64748b"
                  value={buyerName}
                  onChangeText={setBuyerName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>BUYER DRIVER'S LICENSE OR FFL #</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="DL / Concealed Carry / FFL License #"
                  placeholderTextColor="#64748b"
                  value={buyerFflOrDl}
                  onChangeText={setBuyerFflOrDl}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>BUYER ADDRESS / CITY, STATE</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Street, City, State, ZIP"
                  placeholderTextColor="#64748b"
                  value={buyerAddress}
                  onChangeText={setBuyerAddress}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>SALE PRICE ($)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="0.00"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                    value={salePrice}
                    onChangeText={setSalePrice}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>PAYMENT METHOD</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Cash, Check, Zelle"
                    placeholderTextColor="#64748b"
                    value={paymentMethod}
                    onChangeText={setPaymentMethod}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>SALE & TRANSFER NOTES</Text>
                <TextInput
                  style={[styles.formInput, { height: 60, textAlignVertical: 'top' }]}
                  placeholder="Private bill of sale notes, accessories included, etc."
                  placeholderTextColor="#64748b"
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>
            </ScrollView>

            <View style={styles.modalButtonsRow}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setIsTransferModalOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSubmitBtn} onPress={handleSubmitTransfer}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.modalSubmitText}>Queue Disposition</Text>
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
  tabFilterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
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
    gap: 14,
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
  recordCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.25)',
    padding: 14,
    gap: 10,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
  },
  recordSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeAcquired: {
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  statusBadgeDisposed: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusTextAcquired: {
    color: '#34d399',
  },
  statusTextDisposed: {
    color: '#ef4444',
  },
  serialBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.15)',
  },
  serialLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  serialVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38bdf8',
    fontVariant: ['tabular-nums'],
  },
  sectionBlock: {
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#cbd5e1',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailGrid: {
    gap: 4,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailKey: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  detailVal: {
    fontSize: 11,
    color: '#e2e8f0',
    fontWeight: '600',
  },
  undisposedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  undisposedText: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
    flex: 1,
  },
  transferActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  transferActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  /* Modal Styles */
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
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 4,
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
