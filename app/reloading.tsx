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
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  ReloadingScaleIcon,
  GunpowderIcon,
  PrimerIcon,
  BulletProjectileIcon,
  BrassCaseIcon,
  CartridgesIcon,
} from './components/CustomMobileIcons';
import { useSync } from '../context/SyncContext';
import { useDialog } from '../context/DialogContext';
import type {
  ReloadingComponent,
  ReloadingRecipe,
  ComponentAdjustmentSyncItem,
  AmmoAdjustmentSyncItem,
} from '../types';

export default function ReloadingScreen() {
  const { isModuleInstalled, reloadingRecipes, addToQueue, syncedIp } = useSync();
  const { showSuccess, showError } = useDialog();

  const [components, setComponents] = useState<ReloadingComponent[]>([]);
  const [recipes, setRecipes] = useState<ReloadingRecipe[]>(reloadingRecipes || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | 'Powder' | 'Primer' | 'Bullet' | 'Brass' | 'Recipes'>('All');

  // Adjust stock modal state
  const [adjustTarget, setAdjustTarget] = useState<ReloadingComponent | null>(null);
  const [adjustQty, setAdjustQty] = useState('50');
  const [adjustAction, setAdjustAction] = useState<'add' | 'remove'>('remove');
  const [adjustNotes, setAdjustNotes] = useState('');

  // Manufacture batch modal state
  const [batchRecipe, setBatchRecipe] = useState<ReloadingRecipe | null>(null);
  const [batchRoundCount, setBatchRoundCount] = useState('50');

  const loadData = async () => {
    try {
      const cacheStr = await AsyncStorage.getItem('inventory_cache');
      if (cacheStr) {
        const parsed = JSON.parse(cacheStr);
        if (Array.isArray(parsed.components)) {
          setComponents(parsed.components);
        }
        if (Array.isArray(parsed.reloadingRecipes) && parsed.reloadingRecipes.length > 0) {
          setRecipes(parsed.reloadingRecipes);
        }
      }
    } catch (e) {
      console.warn('Failed to load reloading cache:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (reloadingRecipes && reloadingRecipes.length > 0) {
      setRecipes(reloadingRecipes);
    }
  }, [reloadingRecipes]);

  // Component Balances
  const balanceSummary = useMemo(() => {
    let powderGrains = 0;
    let powderLbs = 0;
    let primerCount = 0;
    let bulletCount = 0;
    let brassCount = 0;

    components.forEach((c) => {
      const qty = Number(c.quantity) || 0;
      if (c.type === 'Powder') {
        if (c.weightUnit === 'lbs') {
          powderLbs += qty;
          powderGrains += qty * 7000;
        } else if (c.weightUnit === 'oz') {
          powderLbs += qty / 16;
          powderGrains += (qty / 16) * 7000;
        } else {
          powderGrains += qty;
          powderLbs += qty / 7000;
        }
      } else if (c.type === 'Primer') {
        primerCount += qty;
      } else if (c.type === 'Bullet') {
        bulletCount += qty;
      } else if (c.type === 'Brass') {
        brassCount += qty;
      }
    });

    return {
      powderLbs: powderLbs.toFixed(1),
      powderGrains: Math.round(powderGrains).toLocaleString(),
      primerCount: primerCount.toLocaleString(),
      bulletCount: bulletCount.toLocaleString(),
      brassCount: brassCount.toLocaleString(),
    };
  }, [components]);

  // Filtered list
  const filteredComponents = useMemo(() => {
    return components.filter((c) => {
      const matchesTab = activeTab === 'All' || c.type === activeTab;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        c.manufacturer.toLowerCase().includes(q) ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.caliber && c.caliber.toLowerCase().includes(q)) ||
        (c.bulletType && c.bulletType.toLowerCase().includes(q));
      return matchesTab && matchesSearch;
    });
  }, [components, activeTab, searchQuery]);

  const filteredRecipes = useMemo(() => {
    return recipes.filter((r) => {
      const q = searchQuery.trim().toLowerCase();
      return (
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.caliber.toLowerCase().includes(q) ||
        (r.bullet_name && r.bullet_name.toLowerCase().includes(q)) ||
        (r.powder_name && r.powder_name.toLowerCase().includes(q))
      );
    });
  }, [recipes, searchQuery]);

  // Handle Quick Adjust Quantity
  const handleConfirmAdjust = async () => {
    if (!adjustTarget) return;
    const qty = parseInt(adjustQty, 10);
    if (isNaN(qty) || qty <= 0) {
      showError('Please enter a valid count.');
      return;
    }

    const payload: ComponentAdjustmentSyncItem = {
      type: 'component_adjustment',
      timestamp: new Date().toISOString(),
      upcOrId: adjustTarget.upc_code || (adjustTarget.id ? String(adjustTarget.id) : undefined),
      component_id: adjustTarget.id,
      count: qty,
      action: adjustAction,
      measurement: adjustTarget.weightUnit || (adjustTarget.type === 'Primer' ? 'brick' : 'rds'),
      notes: adjustNotes.trim() || `Mobile reloading adjust (${adjustAction})`,
    };

    const ok = await addToQueue(payload, `Adjusted ${adjustTarget.manufacturer} ${adjustTarget.name || adjustTarget.type}`);
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Optimistically update local component list
      setComponents((prev) =>
        prev.map((c) => {
          if (c.id === adjustTarget.id) {
            const current = Number(c.quantity) || 0;
            const updated = adjustAction === 'add' ? current + qty : Math.max(0, current - qty);
            return { ...c, quantity: updated };
          }
          return c;
        })
      );
      setAdjustTarget(null);
      setAdjustNotes('');
    }
  };

  // Handle Batch Manufacturing
  const handleConfirmBatch = async () => {
    if (!batchRecipe) return;
    const rounds = parseInt(batchRoundCount, 10);
    if (isNaN(rounds) || rounds <= 0) {
      showError('Please enter a valid round count.');
      return;
    }

    const powderChargeGrains = Number(batchRecipe.powder_charge) || 0;
    const totalPowderGrains = powderChargeGrains * rounds;
    const totalPowderLbs = totalPowderGrains / 7000;

    const payloads: (ComponentAdjustmentSyncItem | AmmoAdjustmentSyncItem)[] = [];

    // 1. Deplete Bullets
    if (batchRecipe.bullet_id || batchRecipe.bullet_name) {
      payloads.push({
        type: 'component_adjustment',
        timestamp: new Date().toISOString(),
        upcOrId: batchRecipe.bullet_id ? String(batchRecipe.bullet_id) : undefined,
        component_id: typeof batchRecipe.bullet_id === 'number' ? batchRecipe.bullet_id : undefined,
        count: rounds,
        action: 'remove',
        measurement: 'rds',
        notes: `Loaded ${rounds} rds: ${batchRecipe.name}`,
      });
    }

    // 2. Deplete Primers
    if (batchRecipe.primer_id || batchRecipe.primer_name) {
      payloads.push({
        type: 'component_adjustment',
        timestamp: new Date().toISOString(),
        upcOrId: batchRecipe.primer_id ? String(batchRecipe.primer_id) : undefined,
        component_id: typeof batchRecipe.primer_id === 'number' ? batchRecipe.primer_id : undefined,
        count: rounds,
        action: 'remove',
        measurement: 'rds',
        notes: `Loaded ${rounds} rds: ${batchRecipe.name}`,
      });
    }

    // 3. Deplete Powder (in grains or lbs)
    if (batchRecipe.powder_id || batchRecipe.powder_name) {
      payloads.push({
        type: 'component_adjustment',
        timestamp: new Date().toISOString(),
        upcOrId: batchRecipe.powder_id ? String(batchRecipe.powder_id) : undefined,
        component_id: typeof batchRecipe.powder_id === 'number' ? batchRecipe.powder_id : undefined,
        count: Math.round(totalPowderGrains * 10) / 10,
        action: 'remove',
        measurement: 'grains',
        notes: `Used ${totalPowderGrains.toFixed(1)} gr (${totalPowderLbs.toFixed(2)} lbs) for ${batchRecipe.name}`,
      });
    }

    // 4. Deplete Brass
    if (batchRecipe.brass_id || batchRecipe.brass_name) {
      payloads.push({
        type: 'component_adjustment',
        timestamp: new Date().toISOString(),
        upcOrId: batchRecipe.brass_id ? String(batchRecipe.brass_id) : undefined,
        component_id: typeof batchRecipe.brass_id === 'number' ? batchRecipe.brass_id : undefined,
        count: rounds,
        action: 'remove',
        measurement: 'rds',
        notes: `Loaded ${rounds} casings for ${batchRecipe.name}`,
      });
    }

    // 5. Add Finished Ammo
    payloads.push({
      type: 'ammo_adjustment',
      timestamp: new Date().toISOString(),
      count: rounds,
      action: 'add',
      measurement: 'rds',
      notes: `Manufactured ${rounds} rds handloaded ${batchRecipe.caliber} (${batchRecipe.name})`,
    });

    const ok = await addToQueue(
      payloads,
      `Successfully queued batch load: ${rounds} rds of ${batchRecipe.name}`
    );

    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSuccess(`Batch Queued! ${rounds} rds of ${batchRecipe.name} will sync to Desktop.`);
      setBatchRecipe(null);
    }
  };

  const isReloadingInstalled = isModuleInstalled('reloading');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIconContainer}>
          <ReloadingScaleIcon size={24} color="#ec4899" />
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Reloading Bench</Text>
          <Text style={styles.headerSubtitle}>
            Component Balances, Recipes & Batch Loading
          </Text>
        </View>
      </View>

      {/* Module Status Warning if Disabled on Desktop */}
      {syncedIp && !isReloadingInstalled && (
        <View style={styles.warningBanner}>
          <Ionicons name="information-circle" size={20} color="#f59e0b" />
          <Text style={styles.warningText}>
            Reloading module is disabled on your Desktop. You can view cached components and queue loads; Desktop will store them once enabled.
          </Text>
        </View>
      )}

      {/* Balances Dashboard */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderLeftColor: '#60a5fa' }]}>
          <View style={styles.statHeader}>
            <GunpowderIcon size={16} color="#60a5fa" />
            <Text style={styles.statLabel}>Powder</Text>
          </View>
          <Text style={styles.statValue}>{balanceSummary.powderLbs} lbs</Text>
          <Text style={styles.statSub}>{balanceSummary.powderGrains} gr</Text>
        </View>

        <View style={[styles.statCard, { borderLeftColor: '#fbbf24' }]}>
          <View style={styles.statHeader}>
            <PrimerIcon size={16} color="#fbbf24" />
            <Text style={styles.statLabel}>Primers</Text>
          </View>
          <Text style={styles.statValue}>{balanceSummary.primerCount}</Text>
          <Text style={styles.statSub}>units in stock</Text>
        </View>

        <View style={[styles.statCard, { borderLeftColor: '#ef4444' }]}>
          <View style={styles.statHeader}>
            <BulletProjectileIcon size={16} color="#ef4444" />
            <Text style={styles.statLabel}>Bullets</Text>
          </View>
          <Text style={styles.statValue}>{balanceSummary.bulletCount}</Text>
          <Text style={styles.statSub}>projectiles</Text>
        </View>

        <View style={[styles.statCard, { borderLeftColor: '#eab308' }]}>
          <View style={styles.statHeader}>
            <BrassCaseIcon size={16} color="#eab308" />
            <Text style={styles.statLabel}>Brass</Text>
          </View>
          <Text style={styles.statValue}>{balanceSummary.brassCount}</Text>
          <Text style={styles.statSub}>casings</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {(['All', 'Powder', 'Primer', 'Bullet', 'Brass', 'Recipes'] as const).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tabButton, activeTab === tab && styles.activeTabButton]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab(tab);
            }}
          >
            <Text style={[styles.tabButtonText, activeTab === tab && styles.activeTabButtonText]}>
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#94a3b8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={activeTab === 'Recipes' ? 'Search handload recipes...' : 'Search components, powder, bullets...'}
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Content List */}
      <ScrollView contentContainerStyle={styles.listContent}>
        {activeTab === 'Recipes' ? (
          filteredRecipes.length === 0 ? (
            <View style={styles.emptyState}>
              <CartridgesIcon size={44} color="#64748b" />
              <Text style={styles.emptyTitle}>No Handload Recipes Found</Text>
              <Text style={styles.emptySubtitle}>
                Create load development recipes in ArmoryVault Desktop to calculate and manufacture batches here.
              </Text>
            </View>
          ) : (
            filteredRecipes.map((recipe) => (
              <View key={recipe.id} style={styles.recipeCard}>
                <View style={styles.recipeHeader}>
                  <View style={styles.recipeTitleCol}>
                    <Text style={styles.recipeName}>{recipe.name}</Text>
                    <Text style={styles.recipeCaliber}>{recipe.caliber}</Text>
                  </View>
                  <Pressable
                    style={styles.batchButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setBatchRecipe(recipe);
                      setBatchRoundCount('50');
                    }}
                  >
                    <Ionicons name="calculator-outline" size={16} color="#ec4899" />
                    <Text style={styles.batchButtonText}>Load Batch</Text>
                  </Pressable>
                </View>

                {/* Recipe Breakdown Specs */}
                <View style={styles.recipeSpecsGrid}>
                  {recipe.bullet_name && (
                    <View style={styles.recipeSpecCol}>
                      <Text style={styles.specLabel}>Bullet</Text>
                      <Text style={styles.specVal}>
                        {recipe.grain ? `${recipe.grain}gr ` : ''}
                        {recipe.bullet_name}
                      </Text>
                    </View>
                  )}
                  {recipe.powder_name && (
                    <View style={styles.recipeSpecCol}>
                      <Text style={styles.specLabel}>Powder</Text>
                      <Text style={styles.specVal}>
                        {recipe.powder_charge ? `${recipe.powder_charge}gr ` : ''}
                        {recipe.powder_name}
                      </Text>
                    </View>
                  )}
                  {recipe.primer_name && (
                    <View style={styles.recipeSpecCol}>
                      <Text style={styles.specLabel}>Primer</Text>
                      <Text style={styles.specVal}>{recipe.primer_name}</Text>
                    </View>
                  )}
                  {recipe.target_fps && (
                    <View style={styles.recipeSpecCol}>
                      <Text style={styles.specLabel}>Target Velocity</Text>
                      <Text style={styles.specVal}>{recipe.target_fps} fps</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )
        ) : filteredComponents.length === 0 ? (
          <View style={styles.emptyState}>
            <ReloadingScaleIcon size={44} color="#64748b" />
            <Text style={styles.emptyTitle}>No Components Found</Text>
            <Text style={styles.emptySubtitle}>
              Connect and sync with ArmoryVault Desktop to download your powder, primer, bullet, and brass inventories.
            </Text>
          </View>
        ) : (
          filteredComponents.map((comp) => {
            const isLow = comp.min_threshold && comp.quantity <= comp.min_threshold;
            return (
              <View key={comp.id || `${comp.type}-${comp.manufacturer}-${comp.name}`} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemTypeBadge}>
                    {comp.type === 'Powder' && <GunpowderIcon size={14} color="#60a5fa" />}
                    {comp.type === 'Primer' && <PrimerIcon size={14} color="#fbbf24" />}
                    {comp.type === 'Bullet' && <BulletProjectileIcon size={14} color="#ef4444" />}
                    {comp.type === 'Brass' && <BrassCaseIcon size={14} color="#eab308" />}
                    <Text style={styles.itemTypeText}>{comp.type}</Text>
                  </View>

                  {isLow && (
                    <View style={styles.lowStockBadge}>
                      <Ionicons name="warning" size={12} color="#ef4444" />
                      <Text style={styles.lowStockText}>Low Stock</Text>
                    </View>
                  )}
                </View>

                <View style={styles.itemMain}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemManufacturer}>{comp.manufacturer}</Text>
                    <Text style={styles.itemName}>{comp.name || comp.type}</Text>
                    {comp.caliber && <Text style={styles.itemSub}>{comp.caliber} {comp.grain ? `• ${comp.grain} gr` : ''}</Text>}
                  </View>

                  <View style={styles.itemQtyCol}>
                    <Text style={styles.itemQtyNum}>
                      {Number(comp.quantity).toLocaleString()}
                    </Text>
                    <Text style={styles.itemQtyUnit}>
                      {comp.weightUnit || (comp.type === 'Powder' ? 'grains' : 'units')}
                    </Text>
                  </View>
                </View>

                <View style={styles.itemFooter}>
                  <Pressable
                    style={styles.adjustBtn}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setAdjustTarget(comp);
                      setAdjustAction('remove');
                      setAdjustQty('50');
                    }}
                  >
                    <Ionicons name="remove-circle-outline" size={16} color="#ef4444" />
                    <Text style={styles.adjustBtnText}>Deplete</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.adjustBtn, styles.adjustAddBtn]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setAdjustTarget(comp);
                      setAdjustAction('add');
                      setAdjustQty('100');
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={16} color="#10b981" />
                    <Text style={[styles.adjustBtnText, styles.adjustAddBtnText]}>Add Stock</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Adjust Component Quantity Modal */}
      <Modal visible={!!adjustTarget} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {adjustAction === 'add' ? 'Add Component Stock' : 'Deplete Component Stock'}
              </Text>
              <Pressable onPress={() => setAdjustTarget(null)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </Pressable>
            </View>

            {adjustTarget && (
              <Text style={styles.modalSubtitle}>
                {adjustTarget.manufacturer} {adjustTarget.name || adjustTarget.type}
              </Text>
            )}

            <View style={styles.toggleRow}>
              <Pressable
                style={[styles.toggleBtn, adjustAction === 'remove' && styles.toggleBtnActiveDanger]}
                onPress={() => setAdjustAction('remove')}
              >
                <Text style={[styles.toggleBtnText, adjustAction === 'remove' && styles.toggleBtnTextActive]}>
                  Deplete / Use
                </Text>
              </Pressable>
              <Pressable
                style={[styles.toggleBtn, adjustAction === 'add' && styles.toggleBtnActiveSuccess]}
                onPress={() => setAdjustAction('add')}
              >
                <Text style={[styles.toggleBtnText, adjustAction === 'add' && styles.toggleBtnTextActive]}>
                  Add Stock
                </Text>
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>Quantity</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="number-pad"
              value={adjustQty}
              onChangeText={setAdjustQty}
              placeholder="e.g. 50"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.inputLabel}>Notes / Reason (Optional)</Text>
            <TextInput
              style={styles.modalInput}
              value={adjustNotes}
              onChangeText={setAdjustNotes}
              placeholder="e.g. Used for test loads, range session"
              placeholderTextColor="#64748b"
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setAdjustTarget(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmBtn} onPress={handleConfirmAdjust}>
                <Text style={styles.confirmBtnText}>Queue Adjustment</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Manufacture / Batch Calculator Modal */}
      <Modal visible={!!batchRecipe} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Batch Manufacture Calculator</Text>
              <Pressable onPress={() => setBatchRecipe(null)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </Pressable>
            </View>

            {batchRecipe && (
              <ScrollView style={{ maxHeight: 380 }}>
                <Text style={styles.modalSubtitle}>
                  {batchRecipe.name} ({batchRecipe.caliber})
                </Text>

                <Text style={styles.inputLabel}>Batch Size (Rounds)</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="number-pad"
                  value={batchRoundCount}
                  onChangeText={setBatchRoundCount}
                  placeholder="e.g. 50"
                  placeholderTextColor="#64748b"
                />

                {/* Calculation breakdown */}
                {(() => {
                  const rounds = parseInt(batchRoundCount, 10) || 0;
                  const charge = Number(batchRecipe.powder_charge) || 0;
                  const totalGrains = charge * rounds;
                  const totalLbs = (totalGrains / 7000).toFixed(2);

                  return (
                    <View style={styles.batchCalcBox}>
                      <Text style={styles.batchCalcTitle}>Estimated Material Depletion:</Text>
                      <View style={styles.calcRow}>
                        <BulletProjectileIcon size={14} color="#ef4444" />
                        <Text style={styles.calcLabel}>Bullets:</Text>
                        <Text style={styles.calcVal}>{rounds} units ({batchRecipe.bullet_name || 'Standard'})</Text>
                      </View>
                      <View style={styles.calcRow}>
                        <PrimerIcon size={14} color="#fbbf24" />
                        <Text style={styles.calcLabel}>Primers:</Text>
                        <Text style={styles.calcVal}>{rounds} units ({batchRecipe.primer_name || 'Standard'})</Text>
                      </View>
                      <View style={styles.calcRow}>
                        <GunpowderIcon size={14} color="#60a5fa" />
                        <Text style={styles.calcLabel}>Powder:</Text>
                        <Text style={styles.calcVal}>
                          {totalGrains.toFixed(1)} gr ({totalLbs} lbs) of {batchRecipe.powder_name || 'Powder'}
                        </Text>
                      </View>
                      <View style={styles.calcRow}>
                        <BrassCaseIcon size={14} color="#eab308" />
                        <Text style={styles.calcLabel}>Brass:</Text>
                        <Text style={styles.calcVal}>{rounds} casings ({batchRecipe.brass_name || 'Fired / Prepped'})</Text>
                      </View>
                    </View>
                  );
                })()}

                <View style={styles.modalActions}>
                  <Pressable style={styles.cancelBtn} onPress={() => setBatchRecipe(null)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={styles.confirmBtn} onPress={handleConfirmBatch}>
                    <Text style={styles.confirmBtnText}>Finalize & Queue</Text>
                  </Pressable>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 16,
    marginTop: 8,
    gap: 8,
  },
  warningText: {
    flex: 1,
    color: '#f59e0b',
    fontSize: 12,
    lineHeight: 16,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
  },
  statSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 10,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: '#1e293b',
  },
  activeTabButton: {
    backgroundColor: '#ec4899',
  },
  tabButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  activeTabButtonText: {
    color: '#ffffff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  itemCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 5,
  },
  itemTypeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  lowStockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  lowStockText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ef4444',
  },
  itemMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemManufacturer: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
    marginTop: 1,
  },
  itemSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  itemQtyCol: {
    alignItems: 'flex-end',
  },
  itemQtyNum: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
  },
  itemQtyUnit: {
    fontSize: 11,
    color: '#94a3b8',
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  adjustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  adjustBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ef4444',
  },
  adjustAddBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  adjustAddBtnText: {
    color: '#10b981',
  },
  recipeCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  recipeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recipeTitleCol: {
    flex: 1,
  },
  recipeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  recipeCaliber: {
    fontSize: 12,
    color: '#ec4899',
    fontWeight: '600',
    marginTop: 2,
  },
  batchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  batchButtonText: {
    color: '#ec4899',
    fontSize: 12,
    fontWeight: '700',
  },
  recipeSpecsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    gap: 12,
  },
  recipeSpecCol: {
    minWidth: '45%',
  },
  specLabel: {
    fontSize: 10,
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  specVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#e2e8f0',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  toggleBtnActiveDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#ef4444',
  },
  toggleBtnActiveSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  toggleBtnTextActive: {
    color: '#f8fafc',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 14,
    marginBottom: 12,
  },
  batchCalcBox: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 6,
  },
  batchCalcTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 4,
  },
  calcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  calcLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    width: 60,
  },
  calcVal: {
    fontSize: 11,
    color: '#e2e8f0',
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: '#334155',
  },
  cancelBtnText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
  confirmBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#ec4899',
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
