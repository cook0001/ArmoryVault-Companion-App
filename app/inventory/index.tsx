import { View, Text, StyleSheet, TextInput, Pressable, FlatList, RefreshControl, Modal } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CartridgesIcon, GunpowderIcon } from '../components/CustomMobileIcons';
import { useSync } from '../../context/SyncContext';
import { useDialog } from '../../context/DialogContext';

export default function InventoryScreen() {
  const router = useRouter();
  const { addToQueue, refreshCache } = useSync();
  const { showToast, showError } = useDialog();

  const [activeTab, setActiveTab] = useState<'ammo' | 'components'>('ammo');
  const [ammoList, setAmmoList] = useState<any[]>([]);
  const [componentsList, setComponentsList] = useState<any[]>([]);
  const [componentFilter, setComponentFilter] = useState<'All' | 'Powder' | 'Primer' | 'Case' | 'Bullet'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Quick Adjustment Modal
  const [adjustItem, setAdjustItem] = useState<{ item: any, isAmmo: boolean } | null>(null);
  const [adjustAction, setAdjustAction] = useState<'add' | 'remove'>('add');
  const [adjustCount, setAdjustCount] = useState('50');

  useFocusEffect(
    useCallback(() => {
      loadCachedInventory();
    }, [])
  );

  const loadCachedInventory = async () => {
    try {
      const cacheStr = await AsyncStorage.getItem('inventory_cache');
      if (cacheStr) {
        const cache = JSON.parse(cacheStr);
        setAmmoList(cache.ammo || []);
        setComponentsList(cache.components || []);
      }
    } catch (e) {
      console.error('Error loading inventory cache', e);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshCache(true);
    await loadCachedInventory();
    setRefreshing(false);
  };

  const openAdjustModal = (item: any, isAmmo: boolean) => {
    setAdjustItem({ item, isAmmo });
    setAdjustAction('add');
    setAdjustCount(isAmmo ? '50' : '100');
  };

  const handleSaveAdjustment = async () => {
    if (!adjustItem) return;
    const parsed = parseInt(adjustCount) || 0;
    if (parsed <= 0) {
      showError('Invalid Count', 'Please enter a valid quantity greater than 0.');
      return;
    }

    try {
      const newLog = {
        type: adjustItem.isAmmo ? 'ammo_adjustment' : 'component_adjustment',
        upcOrId: String(adjustItem.item.id || adjustItem.item.upc_code),
        action: adjustAction,
        count: parsed,
        timestamp: new Date().toISOString()
      };

      await addToQueue(
        newLog,
        `Queued ${adjustAction === 'remove' ? '-' : '+'}${parsed} for sync!`
      );

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAdjustItem(null);
    } catch (e) {
      console.error(e);
      showError('Error', 'Failed to save adjustment');
    }
  };

  const filteredAmmo = ammoList.filter(a => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const caliber = (a.caliber || '').toLowerCase();
    const mfg = (a.manufacturer || '').toLowerCase();
    const proj = (a.projectile || '').toLowerCase();
    const grain = String(a.grain || '');
    return caliber.includes(q) || mfg.includes(q) || proj.includes(q) || grain.includes(q);
  });

  const filteredComponents = componentsList.filter(c => {
    if (componentFilter !== 'All') {
      const type = (c.type || '').toLowerCase();
      if (!type.includes(componentFilter.toLowerCase())) return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = (c.name || '').toLowerCase();
    const mfg = (c.manufacturer || '').toLowerCase();
    const cal = (c.caliber || '').toLowerCase();
    return name.includes(q) || mfg.includes(q) || cal.includes(q);
  });

  return (
    <View style={styles.container}>
      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, activeTab === 'ammo' && styles.activeTab]}
          onPress={() => setActiveTab('ammo')}
        >
          <CartridgesIcon size={16} color={activeTab === 'ammo' ? '#fff' : '#94a3b8'} style={{ marginRight: 6 }} />
          <Text style={[styles.tabText, activeTab === 'ammo' && styles.activeTabText]}>
            Ammunition ({ammoList.length})
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === 'components' && styles.activeTab]}
          onPress={() => setActiveTab('components')}
        >
          <GunpowderIcon size={16} color={activeTab === 'components' ? '#fff' : '#94a3b8'} style={{ marginRight: 6 }} />
          <Text style={[styles.tabText, activeTab === 'components' && styles.activeTabText]}>
            Reloading ({componentsList.length})
          </Text>
        </Pressable>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#64748b" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder={activeTab === 'ammo' ? "Filter by caliber, brand, bullet..." : "Filter by name, manufacturer..."}
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

      {/* Component Filter Chips */}
      {activeTab === 'components' && (
        <View style={styles.chipRow}>
          {(['All', 'Powder', 'Primer', 'Case', 'Bullet'] as const).map(chip => (
            <Pressable
              key={chip}
              style={[styles.chip, componentFilter === chip && styles.activeChip]}
              onPress={() => setComponentFilter(chip)}
            >
              <Text style={[styles.chipText, componentFilter === chip && styles.activeChipText]}>{chip}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Ammunition List */}
      {activeTab === 'ammo' && (
        <FlatList
          data={filteredAmmo}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#3b82f6" />}
          contentContainerStyle={{ paddingBottom: 110 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemManufacturer}>{item.manufacturer || 'Generic'}</Text>
                  <Text style={styles.itemTitle}>{item.caliber}</Text>
                  <Text style={styles.itemSubtitle}>
                    {item.grain ? `${item.grain}gr ` : ''}{item.projectile || item.type || ''}
                  </Text>
                </View>

                <View style={[styles.stockBadge, item.count <= 100 && styles.lowStockBadge]}>
                  <Text style={[styles.stockBadgeText, item.count <= 100 && styles.lowStockBadgeText]}>
                    {item.count} rds
                  </Text>
                </View>
              </View>

              <View style={styles.cardActions}>
                <Pressable
                  style={[styles.quickAdjustBtn, { backgroundColor: '#065f46' }]}
                  onPress={() => openAdjustModal(item, true)}
                >
                  <Ionicons name="add-circle-outline" size={16} color="#34d399" style={{ marginRight: 4 }} />
                  <Text style={{ color: '#34d399', fontWeight: 'bold', fontSize: 13 }}>Adjust Stock</Text>
                </Pressable>

                <Pressable
                  style={[styles.quickAdjustBtn, { backgroundColor: '#1e293b', borderColor: '#475569', borderWidth: 1 }]}
                  onPress={() => router.push(`/ammo/${item.id}`)}
                >
                  <Text style={{ color: '#cbd5e1', fontWeight: 'bold', fontSize: 13 }}>Details</Text>
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={48} color="#475569" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>No Ammunition Found</Text>
              <Text style={styles.emptySubtitle}>Sync with desktop to cache your ammunition inventory.</Text>
            </View>
          }
        />
      )}

      {/* Components List */}
      {activeTab === 'components' && (
        <FlatList
          data={filteredComponents}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#3b82f6" />}
          contentContainerStyle={{ paddingBottom: 110 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>{item.type}</Text>
                  </View>
                  <Text style={styles.itemTitle}>{item.manufacturer} {item.name}</Text>
                  {item.caliber && (
                    <Text style={styles.itemSubtitle}>Caliber: {item.caliber}</Text>
                  )}
                </View>

                <View style={styles.stockBadge}>
                  <Text style={styles.stockBadgeText}>
                    {item.quantity} {item.type === 'Powder' ? 'lbs' : 'units'}
                  </Text>
                </View>
              </View>

              <View style={styles.cardActions}>
                <Pressable
                  style={[styles.quickAdjustBtn, { backgroundColor: '#065f46' }]}
                  onPress={() => openAdjustModal(item, false)}
                >
                  <Ionicons name="add-circle-outline" size={16} color="#34d399" style={{ marginRight: 4 }} />
                  <Text style={{ color: '#34d399', fontWeight: 'bold', fontSize: 13 }}>Adjust Quantity</Text>
                </Pressable>

                <Pressable
                  style={[styles.quickAdjustBtn, { backgroundColor: '#1e293b', borderColor: '#475569', borderWidth: 1 }]}
                  onPress={() => router.push(`/component/${item.id}`)}
                >
                  <Text style={{ color: '#cbd5e1', fontWeight: 'bold', fontSize: 13 }}>Details</Text>
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="flask-outline" size={48} color="#475569" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>No Reloading Supplies Found</Text>
              <Text style={styles.emptySubtitle}>Sync with desktop to cache your reloading components.</Text>
            </View>
          }
        />
      )}

      {/* Quick Adjustment Modal */}
      <Modal visible={adjustItem !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {adjustItem && (
              <>
                <Text style={styles.modalTitle} numberOfLines={2}>
                  {adjustItem.isAmmo 
                    ? `${adjustItem.item.manufacturer || ''} ${adjustItem.item.caliber}`
                    : `${adjustItem.item.manufacturer || ''} ${adjustItem.item.name}`}
                </Text>
                <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 13, marginBottom: 14 }}>
                  Current Stock: {adjustItem.isAmmo ? adjustItem.item.count : adjustItem.item.quantity} {adjustItem.isAmmo ? 'rds' : 'units'}
                </Text>

                {/* Action Toggle */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14, width: '100%' }}>
                  <Pressable
                    style={[styles.actionToggleBtn, adjustAction === 'add' && styles.actionToggleAddActive]}
                    onPress={() => setAdjustAction('add')}
                  >
                    <Text style={[styles.actionToggleText, adjustAction === 'add' && styles.actionToggleTextActive]}>+ Add Stock</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionToggleBtn, adjustAction === 'remove' && styles.actionToggleRemoveActive]}
                    onPress={() => setAdjustAction('remove')}
                  >
                    <Text style={[styles.actionToggleText, adjustAction === 'remove' && styles.actionToggleTextActive]}>- Deduct / Use</Text>
                  </Pressable>
                </View>

                {/* Stepper Input */}
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={adjustCount}
                  onChangeText={setAdjustCount}
                  selectTextOnFocus
                />

                {/* Preset Chips */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                  {(adjustItem.isAmmo ? ['20', '50', '100', '250', '500'] : ['50', '100', '500', '1000']).map(val => (
                    <Pressable
                      key={val}
                      style={styles.stepperChip}
                      onPress={() => setAdjustCount(val)}
                    >
                      <Text style={styles.stepperText}>{val}</Text>
                    </Pressable>
                  ))}
                </View>

                {/* Modal Buttons */}
                <View style={styles.modalButtons}>
                  <Pressable
                    style={[styles.modalBtn, { backgroundColor: '#334155' }]}
                    onPress={() => setAdjustItem(null)}
                  >
                    <Text style={styles.modalBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalBtn, { backgroundColor: adjustAction === 'remove' ? '#dc2626' : '#10b981' }]}
                    onPress={handleSaveAdjustment}
                  >
                    <Text style={styles.modalBtnText}>Save</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#3b82f6',
  },
  tabText: {
    color: '#94a3b8',
    fontWeight: 'bold',
    fontSize: 13,
  },
  activeTabText: {
    color: '#ffffff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
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
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeChip: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  chipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  activeChipText: {
    color: '#ffffff',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemManufacturer: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  itemTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  itemSubtitle: {
    color: '#cbd5e1',
    fontSize: 13,
    marginTop: 2,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  typeBadgeText: {
    color: '#60a5fa',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  stockBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  stockBadgeText: {
    color: '#34d399',
    fontWeight: 'bold',
    fontSize: 13,
  },
  lowStockBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444',
  },
  lowStockBadgeText: {
    color: '#ef4444',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  quickAdjustBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
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
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 14,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 4,
  },
  actionToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionToggleAddActive: {
    backgroundColor: '#065f46',
    borderColor: '#10b981',
  },
  actionToggleRemoveActive: {
    backgroundColor: '#991b1b',
    borderColor: '#ef4444',
  },
  actionToggleText: {
    color: '#94a3b8',
    fontWeight: 'bold',
    fontSize: 13,
  },
  actionToggleTextActive: {
    color: '#ffffff',
  },
  modalInput: {
    backgroundColor: '#0f172a',
    color: '#fff',
    width: '100%',
    textAlign: 'center',
    fontSize: 26,
    fontWeight: 'bold',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
    marginBottom: 14,
  },
  stepperChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#334155',
  },
  stepperText: {
    color: '#f8fafc',
    fontWeight: 'bold',
    fontSize: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    padding: 13,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  }
});
