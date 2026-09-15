import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { NfaTaxStampIcon, SuppressorIcon } from './components/CustomMobileIcons';
import { useSync } from '../context/SyncContext';
import { useDialog } from '../context/DialogContext';
import type { NfaRecord } from '../types';

export default function NfaScreen() {
  const { isModuleInstalled } = useSync();
  const { showSuccess } = useDialog();

  const [nfaItems, setNfaItems] = useState<NfaRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Suppressor' | 'SBR' | 'Other'>('All');

  const loadData = async () => {
    try {
      const cacheStr = await AsyncStorage.getItem('inventory_cache');
      if (cacheStr) {
        const parsed = JSON.parse(cacheStr);
        const compiled: NfaRecord[] = [];

        // 1. Extract from Firearms (SBR, SBS, Machine Gun, etc.)
        (parsed.firearms || []).forEach((f: any) => {
          if (f.is_nfa || f.nfa_type || f.nfa_tax_stamp_number) {
            compiled.push({
              id: `gun-${f.id}`,
              firearm_id: f.id,
              type: f.nfa_type || 'SBR',
              make: f.make,
              model: f.model,
              serial_number: f.serial_number,
              caliber: f.caliber,
              form_type: f.nfa_form_type || 'Form 4',
              tax_stamp_number: f.nfa_tax_stamp_number,
              trust_name: f.nfa_trust_name,
              approval_date: f.nfa_approval_date,
              status: f.nfa_tax_stamp_number ? 'Approved' : 'Pending',
              notes: f.notes,
            });
          }
        });

        // 2. Extract from Accessories (Suppressors / Silencers)
        (parsed.accessories || []).forEach((acc: any) => {
          if (acc.type === 'Suppressor' || acc.is_nfa) {
            compiled.push({
              id: `acc-${acc.id}`,
              type: 'Suppressor',
              make: acc.manufacturer,
              model: acc.model || acc.name,
              serial_number: acc.serialNumber || 'N/A',
              form_type: 'Form 4',
              tax_stamp_number: acc.taxStampNumber || undefined,
              trust_name: acc.trustName || undefined,
              status: 'Approved',
              notes: acc.notes,
            });
          }
        });

        setNfaItems(compiled);
      }
    } catch (e) {
      console.warn('Error loading NFA vault items:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return nfaItems.filter((item) => {
      // Type filter
      if (filterType === 'Suppressor' && item.type !== 'Suppressor') return false;
      if (filterType === 'SBR' && item.type !== 'SBR' && item.type !== 'Short Barrel Rifle') return false;
      if (filterType === 'Other' && (item.type === 'Suppressor' || item.type === 'SBR')) return false;

      // Text query
      if (!q) return true;
      return (
        item.make.toLowerCase().includes(q) ||
        item.model.toLowerCase().includes(q) ||
        item.serial_number.toLowerCase().includes(q) ||
        (item.tax_stamp_number && item.tax_stamp_number.toLowerCase().includes(q)) ||
        (item.trust_name && item.trust_name.toLowerCase().includes(q))
      );
    });
  }, [nfaItems, searchQuery, filterType]);

  const handleCopyStamp = async (stampNumber: string) => {
    await Clipboard.setStringAsync(stampNumber);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    showSuccess('Tax Stamp Copied', `Tax Stamp #${stampNumber} copied to clipboard for RSO inspection.`);
  };

  const isModuleActive = isModuleInstalled('nfa');

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      {/* Search & Filter Header */}
      <View style={styles.headerBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#64748b" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Stamp #, Serial, Make..."
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
        <View style={styles.chipRow}>
          {(['All', 'Suppressor', 'SBR', 'Other'] as const).map((t) => (
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
        </View>
      </View>

      {!isModuleActive && (
        <View style={styles.disabledBanner}>
          <Ionicons name="information-circle-outline" size={18} color="#f59e0b" style={{ marginRight: 6 }} />
          <Text style={styles.disabledBannerText}>
            NFA Module is not installed on paired Desktop. Operating in standalone mode.
          </Text>
        </View>
      )}

      {/* Items Scroll */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {filteredItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <NfaTaxStampIcon size={48} color="#64748b" />
            <Text style={styles.emptyTitle}>No NFA Regulated Items Found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try a different search query'
                : 'Suppressors, SBRs, SBS, and AOWs registered in ArmoryVault appear here with tax stamps.'}
            </Text>
          </View>
        ) : (
          filteredItems.map((item) => (
            <View key={item.id} style={styles.nfaCard}>
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>
                    {item.make} {item.model}
                  </Text>
                  <Text style={styles.itemSub}>
                    {item.type} {item.caliber ? `• ${item.caliber}` : ''}
                  </Text>
                </View>

                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>
                    {item.status ? item.status.toUpperCase() : 'APPROVED'}
                  </Text>
                </View>
              </View>

              {/* Serial & Form Row */}
              <View style={styles.infoRow}>
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>SERIAL NUMBER</Text>
                  <Text style={styles.infoVal}>{item.serial_number}</Text>
                </View>
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>ATF FORM</Text>
                  <Text style={styles.infoVal}>{item.form_type || 'Form 4'}</Text>
                </View>
              </View>

              {/* Tax Stamp Box */}
              <View style={styles.stampBox}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stampLabel}>ATF TAX STAMP NUMBER</Text>
                  <Text style={styles.stampVal}>
                    {item.tax_stamp_number || 'STAMP-RECORD-PENDING'}
                  </Text>
                  {item.trust_name ? (
                    <Text style={styles.trustText}>Registered to: {item.trust_name}</Text>
                  ) : null}
                  {item.approval_date ? (
                    <Text style={styles.dateText}>Approved: {item.approval_date}</Text>
                  ) : null}
                </View>

                {item.tax_stamp_number ? (
                  <Pressable
                    style={styles.copyStampBtn}
                    onPress={() => handleCopyStamp(item.tax_stamp_number!)}
                  >
                    <Ionicons name="copy-outline" size={14} color="#fff" />
                    <Text style={styles.copyStampText}>Copy</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>
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
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderColor: '#a855f7',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  filterChipTextActive: {
    color: '#c084fc',
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
  nfaCard: {
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
  itemTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
  },
  itemSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 1,
  },
  statusBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderColor: 'rgba(168, 85, 247, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#c084fc',
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderRadius: 8,
    padding: 10,
  },
  infoCol: {
    flex: 1,
    gap: 2,
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  infoVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f1f5f9',
    fontVariant: ['tabular-nums'],
  },
  stampBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    borderRadius: 10,
    padding: 10,
  },
  stampLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#a855f7',
    letterSpacing: 0.5,
  },
  stampVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#f8fafc',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  trustText: {
    fontSize: 11,
    color: '#cbd5e1',
    marginTop: 2,
  },
  dateText: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
  },
  copyStampBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#9333ea',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  copyStampText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
});
