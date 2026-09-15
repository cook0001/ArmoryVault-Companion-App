import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RangeTargetIcon } from './components/CustomMobileIcons';
import { useSync } from '../context/SyncContext';
import { useDialog } from '../context/DialogContext';
import type { ShootingRangeItem } from '../types';

export default function RangesScreen() {
  const router = useRouter();
  const { savedRanges, isModuleInstalled } = useSync();
  const { showSuccess } = useDialog();

  const [ranges, setRanges] = useState<ShootingRangeItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);

  // Fallback preset verified ranges if offline cache is empty
  const defaultPresets: ShootingRangeItem[] = [
    {
      id: 1,
      name: 'Eagle Gun Range & Tactical Center',
      street: '491 Valley Ridge Blvd',
      city: 'Lewisville',
      state: 'TX',
      zip: '75057',
      phone: '972-353-4867',
      lane_fee: 22,
      fee_type: 'hour',
      is_public: true,
      amenities: '100yd Indoor Rifle, Tactical Action Bays, Chronograph Lane, Gunsmith',
      is_bookmarked: true,
    },
    {
      id: 2,
      name: 'Blackwood Precision Sports',
      street: '11400 FM 2854 Rd',
      city: 'Conroe',
      state: 'TX',
      zip: '77304',
      phone: '936-441-4040',
      lane_fee: 25,
      fee_type: 'day',
      is_public: true,
      amenities: '300yd Outdoor High-Power, Sporting Clays, Steel Challenge',
      is_bookmarked: true,
    },
    {
      id: 3,
      name: 'Lone Star Handgun & Precision Park',
      street: '27940 Evans Rd',
      city: 'San Antonio',
      state: 'TX',
      zip: '78266',
      phone: '210-845-9851',
      lane_fee: 20,
      fee_type: 'day',
      is_public: true,
      amenities: 'Pistol Steel, 100yd Rifle, Night Vision Bays',
      is_bookmarked: false,
    },
  ];

  const loadData = async () => {
    try {
      const cacheStr = await AsyncStorage.getItem('saved_ranges_cache');
      if (cacheStr) {
        const parsed = JSON.parse(cacheStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRanges(parsed);
          return;
        }
      }
      if (Array.isArray(savedRanges) && savedRanges.length > 0) {
        setRanges(savedRanges);
      } else {
        setRanges(defaultPresets);
      }
    } catch {
      setRanges(defaultPresets);
    }
  };

  useEffect(() => {
    loadData();
  }, [savedRanges]);

  const filteredRanges = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return ranges.filter((item) => {
      if (bookmarkedOnly && !item.is_bookmarked) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.city && item.city.toLowerCase().includes(q)) ||
        (item.state && item.state.toLowerCase().includes(q)) ||
        (item.zip && item.zip.includes(q)) ||
        (item.amenities && item.amenities.toLowerCase().includes(q))
      );
    });
  }, [ranges, searchQuery, bookmarkedOnly]);

  const handleToggleBookmark = async (rangeId: number) => {
    const updated = ranges.map((r) =>
      r.id === rangeId ? { ...r, is_bookmarked: !r.is_bookmarked } : r
    );
    setRanges(updated);
    await AsyncStorage.setItem('saved_ranges_cache', JSON.stringify(updated));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const handleOpenDirections = (range: ShootingRangeItem) => {
    const address = `${range.street || ''}, ${range.city || ''}, ${range.state || ''} ${range.zip || ''}`.trim();
    const encoded = encodeURIComponent(address || range.name);
    const url =
      Platform.OS === 'ios'
        ? `maps:0,0?q=${encoded}`
        : `geo:0,0?q=${encoded}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`);
    });
  };

  const handleStartSessionAtRange = (range: ShootingRangeItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // Direct navigate to Range Mode with facility pre-filled
    router.push({
      pathname: '/range',
      params: { rangeFacility: range.name },
    });
  };

  const isModuleActive = isModuleInstalled('ranges');

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#64748b" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Range Name, City, ZIP..."
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

        {/* Filter Row */}
        <View style={styles.filterRow}>
          <Pressable
            style={[styles.chip, !bookmarkedOnly && styles.chipActive]}
            onPress={() => setBookmarkedOnly(false)}
          >
            <Text style={[styles.chipText, !bookmarkedOnly && styles.chipTextActive]}>
              All Facilities ({ranges.length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.chip, bookmarkedOnly && styles.chipActive]}
            onPress={() => setBookmarkedOnly(true)}
          >
            <Ionicons
              name={bookmarkedOnly ? 'bookmark' : 'bookmark-outline'}
              size={14}
              color={bookmarkedOnly ? '#10b981' : '#94a3b8'}
            />
            <Text style={[styles.chipText, bookmarkedOnly && styles.chipTextActive]}>
              Saved Home Ranges
            </Text>
          </Pressable>
        </View>
      </View>

      {!isModuleActive && (
        <View style={styles.disabledBanner}>
          <Ionicons name="information-circle-outline" size={18} color="#f59e0b" style={{ marginRight: 6 }} />
          <Text style={styles.disabledBannerText}>
            Range Facility Module not installed on paired Desktop. Operating in standalone mode.
          </Text>
        </View>
      )}

      {/* Facilities List */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {filteredRanges.length === 0 ? (
          <View style={styles.emptyContainer}>
            <RangeTargetIcon size={48} color="#64748b" />
            <Text style={styles.emptyTitle}>No Range Facilities Found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try a different search query or state.'
                : 'Search or bookmark shooting ranges to have them available here.'}
            </Text>
          </View>
        ) : (
          filteredRanges.map((item) => (
            <View key={item.id} style={styles.rangeCard}>
              {/* Header */}
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rangeTitle}>{item.name}</Text>
                  <Text style={styles.rangeAddress}>
                    {item.street ? `${item.street}, ` : ''}
                    {item.city}, {item.state} {item.zip}
                  </Text>
                </View>

                <Pressable
                  onPress={() => handleToggleBookmark(item.id)}
                  style={styles.bookmarkBtn}
                >
                  <Ionicons
                    name={item.is_bookmarked ? 'bookmark' : 'bookmark-outline'}
                    size={20}
                    color={item.is_bookmarked ? '#10b981' : '#64748b'}
                  />
                </Pressable>
              </View>

              {/* Badges Row */}
              <View style={styles.badgeRow}>
                <View style={styles.publicBadge}>
                  <Text style={styles.publicBadgeText}>
                    {item.is_public ? 'PUBLIC RANGE' : 'PRIVATE CLUB'}
                  </Text>
                </View>

                {item.lane_fee ? (
                  <View style={styles.feeBadge}>
                    <Text style={styles.feeBadgeText}>
                      ${item.lane_fee} / {item.fee_type || 'day'}
                    </Text>
                  </View>
                ) : null}

                {item.phone ? (
                  <Pressable
                    style={styles.phoneBadge}
                    onPress={() => Linking.openURL(`tel:${item.phone}`)}
                  >
                    <Ionicons name="call-outline" size={12} color="#38bdf8" />
                    <Text style={styles.phoneBadgeText}>{item.phone}</Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Amenities */}
              {item.amenities ? (
                <View style={styles.amenitiesBox}>
                  <Text style={styles.amenitiesText}>{item.amenities}</Text>
                </View>
              ) : null}

              {/* Actions */}
              <View style={styles.actionsRow}>
                <Pressable style={styles.directionsBtn} onPress={() => handleOpenDirections(item)}>
                  <Ionicons name="navigate-outline" size={14} color="#38bdf8" />
                  <Text style={styles.directionsText}>Get Directions</Text>
                </Pressable>

                <Pressable
                  style={styles.startSessionBtn}
                  onPress={() => handleStartSessionAtRange(item)}
                >
                  <RangeTargetIcon size={14} color="#fff" />
                  <Text style={styles.startSessionText}>Start Range Session</Text>
                </Pressable>
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
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.2)',
  },
  chipActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  chipTextActive: {
    color: '#34d399',
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
  rangeCard: {
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
  rangeTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
  },
  rangeAddress: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  bookmarkBtn: {
    padding: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  publicBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  publicBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#34d399',
    letterSpacing: 0.5,
  },
  feeBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  feeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#38bdf8',
  },
  phoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  phoneBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  amenitiesBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    borderRadius: 8,
    padding: 8,
  },
  amenitiesText: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingTop: 4,
  },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  directionsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38bdf8',
  },
  startSessionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10b981',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  startSessionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
});
