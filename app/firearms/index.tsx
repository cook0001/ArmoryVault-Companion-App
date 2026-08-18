import { View, Text, StyleSheet, TextInput, Pressable, FlatList, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

export default function FirearmsScreen() {
  const router = useRouter();
  const [firearms, setFirearms] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
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

  const filteredFirearms = firearms.filter(f => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const make = (f.make || '').toLowerCase();
    const model = (f.model || '').toLowerCase();
    const caliber = (f.caliber || '').toLowerCase();
    const serial = (f.serial_number || '').toLowerCase();
    return make.includes(q) || model.includes(q) || caliber.includes(q) || serial.includes(q);
  });

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
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </Pressable>
        )}
      </View>

      {/* Counter Banner */}
      <View style={styles.counterRow}>
        <Text style={styles.counterText}>
          {filteredFirearms.length} {filteredFirearms.length === 1 ? 'Firearm' : 'Firearms'} in Vault
        </Text>
      </View>

      {/* Firearms List */}
      <FlatList
        data={filteredFirearms}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#3b82f6" />}
        contentContainerStyle={{ paddingBottom: 30 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.makeLabel}>{item.make}</Text>
                <Text style={styles.modelTitle}>{item.model}</Text>
              </View>
              <View style={styles.roundsBadge}>
                <Text style={styles.roundsBadgeText}>🎯 {item.total_rounds || 0} rds</Text>
              </View>
            </View>

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
            </View>

            <View style={styles.cardActions}>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: '#065f46', borderColor: '#10b981' }]}
                onPress={() => router.push(`/range?firearmId=${item.id}`)}
              >
                <Ionicons name="flash-outline" size={16} color="#34d399" style={{ marginRight: 6 }} />
                <Text style={[styles.actionBtnText, { color: '#34d399' }]}>Range Session</Text>
              </Pressable>

              <Pressable
                style={[styles.actionBtn, { backgroundColor: '#1e293b', borderColor: '#475569' }]}
                onPress={() => router.push(`/firearm/${item.id}`)}
              >
                <Ionicons name="camera-outline" size={16} color="#94a3b8" style={{ marginRight: 6 }} />
                <Text style={styles.actionBtnText}>Logs & Photo</Text>
              </Pressable>

              <Pressable
                style={[styles.actionBtn, { backgroundColor: '#1e293b', borderColor: '#38bdf8' }]}
                onPress={() => router.push(`/firearms/bill-of-sale?firearmId=${item.id}`)}
              >
                <Ionicons name="document-text-outline" size={16} color="#38bdf8" style={{ marginRight: 6 }} />
                <Text style={[styles.actionBtnText, { color: '#38bdf8' }]}>Bill of Sale</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="shield-outline" size={48} color="#475569" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>
              {firearms.length === 0 ? 'No Firearms in Offline Cache' : 'No Firearms Found'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {firearms.length === 0 
                ? 'Connect to the desktop app on Wi-Fi to sync your firearm vault.'
                : 'Try adjusting your search criteria.'}
            </Text>
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
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 15,
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  counterText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  makeLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginTop: 2,
  },
  roundsBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roundsBadgeText: {
    color: '#10b981',
    fontWeight: 'bold',
    fontSize: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  caliberBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: '#3b82f6',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  caliberBadgeText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: 'bold',
  },
  serialBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  serialBadgeText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnText: {
    color: '#cbd5e1',
    fontWeight: 'bold',
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  }
});
