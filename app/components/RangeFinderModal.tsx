import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import { useDialog } from '../../context/DialogContext';

export interface ShootingRangeItem {
  id: number;
  name: string;
  trade_name?: string;
  range_type?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  lane_fee?: number | null;
  fee_type?: string;
  amenities?: string;
  is_public?: number | boolean;
  distance_miles?: number;
}

export interface RangeFinderModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectRange?: (range: ShootingRangeItem) => void;
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

export const RangeFinderModal: React.FC<RangeFinderModalProps> = ({
  visible,
  onClose,
  onSelectRange,
}) => {
  const { showToast } = useDialog();
  const [zipCode, setZipCode] = useState('');
  const [selectedState, setSelectedState] = useState('TX');
  const [typeFilter, setTypeFilter] = useState('all');
  const [publicOnly, setPublicOnly] = useState(false);
  const [ranges, setRanges] = useState<ShootingRangeItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      handleSearch('TX');
    }
  }, [visible]);

  const handleSearch = async (overrideState?: string) => {
    setLoading(true);
    const cleanZip = zipCode.trim();
    const cleanState = (overrideState !== undefined ? overrideState : selectedState).toUpperCase().trim();

    try {
      const q = cleanZip ? `zip=${cleanZip}` : cleanState ? `state=${cleanState}` : 'state=TX';
      const res = await fetch(`https://armstrader.store/api/ranges/search?${q}&limit=50`, {
        headers: { 'Accept': 'application/json' },
      });

      if (res.ok) {
        const json = await res.json();
        setRanges(json.ranges || json.data || []);
      } else {
        showToast({ message: 'Could not reach Range Directory server', type: 'error' });
      }
    } catch (e) {
      console.warn('Network lookup failed, using offline fallback', e);
      showToast({ message: 'Range search offline. Check connection.', type: 'info' });
    } finally {
      setLoading(false);
    }
  };

  const handleCall = (phone: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      showToast({ message: 'Unable to open phone dialer', type: 'error' });
    });
  };

  const handleDirections = (range: ShootingRangeItem) => {
    const address = `${range.name} ${range.street || ''} ${range.city || ''} ${range.state || ''} ${range.zip || ''}`.replace(/\s+/g, ' ').trim();
    const url = Platform.select({
      ios: `https://maps.apple.com/?q=${encodeURIComponent(address)}`,
      android: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
      default: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
    });
    Linking.openURL(url!).catch(() => {
      showToast({ message: 'Unable to open maps', type: 'error' });
    });
  };

  const filteredRanges = useMemo(() => {
    return ranges.filter((r) => {
      if (publicOnly && !r.is_public) return false;
      if (typeFilter !== 'all') {
        const rType = (r.range_type || '').toLowerCase();
        if (typeFilter === 'indoor' && !rType.includes('indoor')) return false;
        if (typeFilter === 'outdoor' && !rType.includes('outdoor')) return false;
        if (typeFilter === 'club' && !rType.includes('club')) return false;
        if (typeFilter === 'clays' && !rType.includes('clay') && !rType.includes('trap')) return false;
      }
      return true;
    });
  }, [ranges, publicOnly, typeFilter]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="location-outline" size={20} color="#38bdf8" />
              <Text style={styles.title}>Shooting Range Locator</Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#94a3b8" />
            </Pressable>
          </View>

          {/* Search Controls Bar */}
          <View style={styles.searchBar}>
            {/* ZIP Input */}
            <View style={styles.zipInputWrap}>
              <Ionicons name="search" size={15} color="#64748b" style={{ marginRight: 6 }} />
              <TextInput
                style={styles.zipInput}
                placeholder="5-digit ZIP..."
                placeholderTextColor="#64748b"
                keyboardType="numeric"
                value={zipCode}
                onChangeText={setZipCode}
                onSubmitEditing={() => handleSearch()}
              />
            </View>

            {/* Search Button */}
            <Pressable
              style={styles.searchBtn}
              onPress={() => handleSearch()}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#0f172a" />
              ) : (
                <Text style={styles.searchBtnText}>Search</Text>
              )}
            </Pressable>
          </View>

          {/* State Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.stateScrollView}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
          >
            {US_STATES.map((st) => (
              <Pressable
                key={st}
                style={[
                  styles.stateChip,
                  selectedState === st && styles.stateChipActive,
                ]}
                onPress={() => {
                  setSelectedState(st);
                  handleSearch(st);
                }}
              >
                <Text
                  style={[
                    styles.stateChipText,
                    selectedState === st && styles.stateChipTextActive,
                  ]}
                >
                  {st}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Type Filter Chips */}
          <View style={styles.typeFilterRow}>
            {['all', 'indoor', 'outdoor', 'club', 'clays'].map((t) => (
              <Pressable
                key={t}
                style={[
                  styles.typeChip,
                  typeFilter === t && styles.typeChipActive,
                ]}
                onPress={() => setTypeFilter(t)}
              >
                <Text
                  style={[
                    styles.typeChipText,
                    typeFilter === t && styles.typeChipTextActive,
                  ]}
                >
                  {t}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Range List */}
          <ScrollView style={styles.rangeList} contentContainerStyle={{ paddingBottom: 24 }}>
            {filteredRanges.map((item) => (
              <View key={item.id} style={styles.rangeCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.rangeName}>{item.name}</Text>
                    {item.trade_name && item.trade_name !== item.name && (
                      <Text style={styles.tradeName}>{item.trade_name}</Text>
                    )}
                  </View>

                  {/* Badges */}
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View
                      style={[
                        styles.accessBadge,
                        {
                          backgroundColor: item.is_public
                            ? 'rgba(52, 211, 153, 0.15)'
                            : 'rgba(245, 158, 11, 0.15)',
                          borderColor: item.is_public ? '#34d399' : '#fbbf24',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.accessBadgeText,
                          { color: item.is_public ? '#34d399' : '#fbbf24' },
                        ]}
                      >
                        {item.is_public ? 'Public' : 'Private Club'}
                      </Text>
                    </View>
                    {item.distance_miles !== undefined && (
                      <Text style={styles.distanceText}>{item.distance_miles} mi away</Text>
                    )}
                  </View>
                </View>

                {/* Meta details */}
                <View style={styles.metaRow}>
                  <Ionicons name="navigate-outline" size={13} color="#64748b" />
                  <Text style={styles.addressText} numberOfLines={1}>
                    {item.street ? `${item.street}, ` : ''}{item.city}, {item.state} {item.zip}
                  </Text>
                </View>

                {item.lane_fee !== null && item.lane_fee !== undefined && (
                  <View style={styles.feeRow}>
                    <Ionicons name="cash-outline" size={13} color="#34d399" />
                    <Text style={styles.feeText}>
                      Lane Fee: ${item.lane_fee} {item.fee_type || ''}
                    </Text>
                  </View>
                )}

                {item.amenities && (
                  <Text style={styles.amenitiesText} numberOfLines={2}>
                    {item.amenities}
                  </Text>
                )}

                {/* Actions */}
                <View style={styles.actionsRow}>
                  {item.phone && (
                    <Pressable style={styles.iconBtn} onPress={() => handleCall(item.phone!)}>
                      <Ionicons name="call-outline" size={15} color="#38bdf8" />
                      <Text style={styles.iconBtnText}>Call</Text>
                    </Pressable>
                  )}

                  <Pressable style={styles.iconBtn} onPress={() => handleDirections(item)}>
                    <Ionicons name="map-outline" size={15} color="#38bdf8" />
                    <Text style={styles.iconBtnText}>Map</Text>
                  </Pressable>

                  {onSelectRange && (
                    <Pressable
                      style={styles.selectBtn}
                      onPress={async () => {
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        onSelectRange(item);
                        onClose();
                      }}
                    >
                      <Ionicons name="checkmark-circle-outline" size={16} color="#0f172a" />
                      <Text style={styles.selectBtnText}>Select Facility</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}

            {filteredRanges.length === 0 && !loading && (
              <View style={styles.emptyBox}>
                <Ionicons name="location-outline" size={38} color="#64748b" />
                <Text style={styles.emptyTitle}>No Shooting Ranges Found</Text>
                <Text style={styles.emptySub}>
                  Try entering a different ZIP code or switching states above.
                </Text>
              </View>
            )}
          </ScrollView>
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
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  title: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  zipInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  zipInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 13,
    padding: 0,
  },
  searchBtn: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 13,
  },
  stateScrollView: {
    maxHeight: 36,
    marginVertical: 6,
  },
  stateChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  stateChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38bdf8',
  },
  stateChipText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  stateChipTextActive: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  typeFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 8,
  },
  typeChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  typeChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38bdf8',
  },
  typeChipText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  typeChipTextActive: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  rangeList: {
    paddingHorizontal: 16,
  },
  rangeCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  rangeName: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
  tradeName: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 1,
  },
  accessBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  accessBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  distanceText: {
    color: '#94a3b8',
    fontSize: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  addressText: {
    color: '#cbd5e1',
    fontSize: 12,
    flex: 1,
  },
  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  feeText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '600',
  },
  amenitiesText: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 6,
    backgroundColor: '#0f172a',
    padding: 6,
    borderRadius: 6,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  iconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  iconBtnText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600',
  },
  selectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#38bdf8',
    paddingVertical: 6,
    borderRadius: 6,
  },
  selectBtnText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySub: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 24,
  },
});
