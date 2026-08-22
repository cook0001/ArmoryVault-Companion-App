import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, FlatList, RefreshControl, Image, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SafeIcon } from '../components/CustomMobileIcons';

type CategoryFilter = 'all' | 'handgun' | 'rifle' | 'shotgun' | 'rimfire' | 'nfa';
type SortOption = 'az' | 'rounds_high' | 'rounds_low';

export default function FirearmsScreen() {
  const router = useRouter();
  const [firearms, setFirearms] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('az');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadCachedFirearms();
    }, [])
  );

  const loadCachedFirearms = async () => {
    try {
      const cacheStr = await AsyncStorage.getItem('inventory_cache');
      if (cacheStr) {
        const cache = JSON.parse(cacheStr);
        setFirearms(cache.firearms || []);
      }
    } catch (e) {
      console.error('Error loading firearms cache', e);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const ip = await AsyncStorage.getItem('server_ip');
      if (ip) {
        const res = await fetch(`${ip}/api/inventory/cache`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.success) {
            await AsyncStorage.setItem('inventory_cache', JSON.stringify(data));
            setFirearms(data.firearms || []);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    setRefreshing(false);
  };

  // Helper to categorize firearms
  const matchesCategory = (f: any, category: CategoryFilter): boolean => {
    if (category === 'all') return true;
    const combined = `${f.type || ''} ${f.action || ''} ${f.make || ''} ${f.model || ''} ${f.caliber || ''}`.toLowerCase();
    
    if (category === 'handgun') {
      return combined.includes('pistol') || combined.includes('handgun') || combined.includes('revolver') || combined.includes('9mm') || combined.includes('.45') || combined.includes('.380') || combined.includes('10mm');
    }
    if (category === 'rifle') {
      return combined.includes('rifle') || combined.includes('carbine') || combined.includes('5.56') || combined.includes('.223') || combined.includes('.308') || combined.includes('7.62') || combined.includes('6.5');
    }
    if (category === 'shotgun') {
      return combined.includes('shotgun') || combined.includes('12 ga') || combined.includes('20 ga') || combined.includes('gauge') || combined.includes('.410');
    }
    if (category === 'rimfire') {
      return combined.includes('.22 lr') || combined.includes('.22lr') || combined.includes('.17 hmr') || combined.includes('.22 wmr') || combined.includes('rimfire');
    }
    if (category === 'nfa') {
      return combined.includes('nfa') || combined.includes('sbr') || combined.includes('suppressor') || combined.includes('silencer') || combined.includes('sbs') || combined.includes('aow');
    }
    return true;
  };

  const filteredFirearms = useMemo(() => {
    let result = firearms.filter(f => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const make = (f.make || '').toLowerCase();
        const model = (f.model || '').toLowerCase();
        const caliber = (f.caliber || '').toLowerCase();
        const serial = (f.serial_number || '').toLowerCase();
        if (!make.includes(q) && !model.includes(q) && !caliber.includes(q) && !serial.includes(q)) {
          return false;
        }
      }
      // 2. Category Filter
      return matchesCategory(f, categoryFilter);
    });

    // 3. Sorting
    if (sortOption === 'az') {
      result.sort((a, b) => `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`));
    } else if (sortOption === 'rounds_high') {
      result.sort((a, b) => (b.total_rounds || 0) - (a.total_rounds || 0));
    } else if (sortOption === 'rounds_low') {
      result.sort((a, b) => (a.total_rounds || 0) - (b.total_rounds || 0));
    }

    return result;
  }, [firearms, searchQuery, categoryFilter, sortOption]);

  const CATEGORIES: { id: CategoryFilter; label: string; icon: string }[] = [
    { id: 'all', label: 'All Vault', icon: 'shield-outline' },
    { id: 'handgun', label: 'Handguns', icon: 'locate-outline' },
    { id: 'rifle', label: 'Rifles', icon: 'flash-outline' },
    { id: 'shotgun', label: 'Shotguns', icon: 'disc-outline' },
    { id: 'rimfire', label: 'Rimfire', icon: 'happy-outline' },
    { id: 'nfa', label: 'NFA / Suppressed', icon: 'moon-outline' },
  ];

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#94a3b8" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by make, model, caliber, or serial..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </Pressable>
        )}
      </View>

      {/* Category Filter Chips */}
      <View style={{ marginBottom: 10 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIES}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isSelected = categoryFilter === item.id;
            return (
              <Pressable
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setCategoryFilter(item.id);
                }}
              >
                <Ionicons 
                  name={item.icon as any} 
                  size={14} 
                  color={isSelected ? '#38bdf8' : '#94a3b8'} 
                  style={{ marginRight: 6 }} 
                />
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {/* Counter & Sort Controls Banner */}
      <View style={styles.counterRow}>
        <Text style={styles.counterText}>
          {filteredFirearms.length} {filteredFirearms.length === 1 ? 'Firearm' : 'Firearms'}
        </Text>

        <View style={styles.sortRow}>
          <Pressable 
            style={[styles.sortBtn, sortOption === 'az' && styles.sortBtnActive]}
            onPress={() => setSortOption('az')}
          >
            <Text style={[styles.sortBtnText, sortOption === 'az' && styles.sortBtnTextActive]}>A-Z</Text>
          </Pressable>
          <Pressable 
            style={[styles.sortBtn, sortOption === 'rounds_high' && styles.sortBtnActive]}
            onPress={() => setSortOption('rounds_high')}
          >
            <Text style={[styles.sortBtnText, sortOption === 'rounds_high' && styles.sortBtnTextActive]}>🔥 High Rds</Text>
          </Pressable>
        </View>
      </View>

      {/* Firearms List */}
      <FlatList
        data={filteredFirearms}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#38bdf8" />}
        contentContainerStyle={{ paddingBottom: 110 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            {/* Main Header */}
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.makeLabel}>{item.make}</Text>
                <Text style={styles.modelTitle}>{item.model}</Text>
              </View>
              <View style={[styles.roundsBadge, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                <Ionicons name="disc-outline" size={12} color="#38bdf8" />
                <Text style={styles.roundsBadgeText}>{item.total_rounds || 0} rds</Text>
              </View>
            </View>

            {/* Badges Row */}
            <View style={styles.badgeRow}>
              {item.caliber && (
                <View style={styles.caliberBadge}>
                  <Text style={styles.caliberBadgeText}>{item.caliber}</Text>
                </View>
              )}
              {item.serial_number && (
                <View style={styles.serialBadge}>
                  <Text style={styles.serialBadgeText}>S/N: {item.serial_number}</Text>
                </View>
              )}
              {item.type && (
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>{item.type}</Text>
                </View>
              )}
            </View>

            {/* Quick Action Buttons */}
            <View style={styles.cardActions}>
              {/* Range Mode */}
              <Pressable
                style={[styles.actionBtn, { backgroundColor: '#065f46', borderColor: '#10b981' }]}
                onPress={() => router.push(`/range?firearmId=${item.id}`)}
              >
                <Ionicons name="flash-outline" size={15} color="#34d399" style={{ marginRight: 4 }} />
                <Text style={[styles.actionBtnText, { color: '#34d399' }]}>Range Trip</Text>
              </Pressable>

              {/* Scan Replacement Parts */}
              <Pressable
                style={[styles.actionBtn, { backgroundColor: '#1e293b', borderColor: '#eab308' }]}
                onPress={() => {
                  router.push({
                    pathname: '/scanner',
                    params: { type: 'part_maintenance', firearmId: String(item.id) }
                  });
                }}
              >
                <Ionicons name="construct-outline" size={15} color="#eab308" style={{ marginRight: 4 }} />
                <Text style={[styles.actionBtnText, { color: '#eab308' }]}>Scan Part</Text>
              </Pressable>

              {/* Bill of Sale */}
              <Pressable
                style={[styles.actionBtn, { backgroundColor: '#1e293b', borderColor: '#38bdf8' }]}
                onPress={() => router.push(`/firearms/bill-of-sale?firearmId=${item.id}`)}
              >
                <Ionicons name="document-text-outline" size={15} color="#38bdf8" style={{ marginRight: 4 }} />
                <Text style={[styles.actionBtnText, { color: '#38bdf8' }]}>Bill of Sale</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
            <SafeIcon size={44} color="#475569" style={{ marginBottom: 12 }} />
            <Text style={{ color: '#f8fafc', fontSize: 16, fontWeight: '700', marginBottom: 4 }}>No Firearms Found</Text>
            <Text style={{ color: '#64748b', fontSize: 13, textAlign: 'center' }}>Sync with desktop to load your registered armory.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 14,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38bdf8',
  },
  filterChipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  filterChipTextActive: {
    color: '#38bdf8',
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  counterText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  sortRow: {
    flexDirection: 'row',
    gap: 6,
  },
  sortBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sortBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38bdf8',
  },
  sortBtnText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  sortBtnTextActive: {
    color: '#38bdf8',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  makeLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modelTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  roundsBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  roundsBadgeText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  caliberBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  caliberBadgeText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  serialBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  serialBadgeText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  typeBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  typeBadgeText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});
