import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, FlatList, RefreshControl, Modal, ScrollView, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useSync } from '../../context/SyncContext';
import { useDialog } from '../../context/DialogContext';

export interface ReloadingRecipe {
  id: string;
  lotNumber: string;
  name: string;
  caliber: string;
  bullet: string;
  powder: string;
  chargeGrains: string;
  primer: string;
  brass: string;
  coalInches: string;
  batchSize: number;
  avgVelocityFps?: number;
  extremeSpread?: number;
  standardDeviation?: number;
  groupMoa?: number;
  notes?: string;
  costPerRound?: number;
  createdAt: string;
}

export default function InventoryScreen() {
  const router = useRouter();
  const { addToQueue, refreshCache } = useSync();
  const { showToast, showError, showConfirm, showSuccess } = useDialog();

  const [activeTab, setActiveTab] = useState<'ammo' | 'components' | 'recipes'>('ammo');
  const [ammoList, setAmmoList] = useState<any[]>([]);
  const [componentsList, setComponentsList] = useState<any[]>([]);
  const [recipesList, setRecipesList] = useState<ReloadingRecipe[]>([]);
  const [componentFilter, setComponentFilter] = useState<'All' | 'Powder' | 'Primer' | 'Case' | 'Bullet'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Financial Value Toggle
  const [showValuation, setShowValuation] = useState(false);

  // Quick Adjustment Modal
  const [adjustItem, setAdjustItem] = useState<{ item: any, isAmmo: boolean } | null>(null);
  const [adjustAction, setAdjustAction] = useState<'add' | 'remove'>('add');
  const [adjustCount, setAdjustCount] = useState('50');

  // New Recipe Modal State
  const [isRecipeModalVisible, setIsRecipeModalVisible] = useState(false);
  const [recipeLotNumber, setRecipeLotNumber] = useState('');
  const [recipeName, setRecipeName] = useState('');
  const [recipeCaliber, setRecipeCaliber] = useState('');
  const [recipeBullet, setRecipeBullet] = useState('');
  const [recipePowder, setRecipePowder] = useState('');
  const [recipeCharge, setRecipeCharge] = useState('');
  const [recipePrimer, setRecipePrimer] = useState('');
  const [recipeBrass, setRecipeBrass] = useState('');
  const [recipeCoal, setRecipeCoal] = useState('');
  const [recipeBatchSize, setRecipeBatchSize] = useState('50');
  const [recipeVelocity, setRecipeVelocity] = useState('');
  const [recipeMoa, setRecipeMoa] = useState('');
  const [recipeNotes, setRecipeNotes] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadCachedInventory();
      loadRecipes();
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

  const loadRecipes = async () => {
    try {
      const savedStr = await AsyncStorage.getItem('reloading_recipes_cache');
      if (savedStr) {
        const parsed = JSON.parse(savedStr);
        if (Array.isArray(parsed)) {
          setRecipesList(parsed);
        }
      }
    } catch (e) {
      console.error('Error loading recipes cache', e);
    }
  };

  const saveRecipes = async (updated: ReloadingRecipe[]) => {
    try {
      setRecipesList(updated);
      await AsyncStorage.setItem('reloading_recipes_cache', JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving recipes', e);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshCache(true);
    await loadCachedInventory();
    setRefreshing(false);
  };

  const openNewRecipeModal = () => {
    const defaultLot = `LOT-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Date.now().toString().slice(-3)}`;
    setRecipeLotNumber(defaultLot);
    setRecipeName('');
    setRecipeCaliber('');
    setRecipeBullet('');
    setRecipePowder('');
    setRecipeCharge('');
    setRecipePrimer('');
    setRecipeBrass('');
    setRecipeCoal('');
    setRecipeBatchSize('50');
    setRecipeVelocity('');
    setRecipeMoa('');
    setRecipeNotes('');
    setIsRecipeModalVisible(true);
  };

  const handleSaveRecipe = async () => {
    if (!recipeName.trim() || !recipeCaliber.trim()) {
      showToast({ message: 'Recipe Name and Caliber are required', type: 'warning' });
      return;
    }

    const newRecipe: ReloadingRecipe = {
      id: `recipe_${Date.now()}`,
      lotNumber: recipeLotNumber.trim() || `LOT-${Date.now().toString().slice(-6)}`,
      name: recipeName.trim(),
      caliber: recipeCaliber.trim(),
      bullet: recipeBullet.trim() || 'Standard Projectile',
      powder: recipePowder.trim() || 'Standard Powder',
      chargeGrains: recipeCharge.trim() || '0',
      primer: recipePrimer.trim() || 'Standard',
      brass: recipeBrass.trim() || 'Mixed',
      coalInches: recipeCoal.trim() || 'Standard',
      batchSize: parseInt(recipeBatchSize) || 50,
      avgVelocityFps: parseFloat(recipeVelocity) || undefined,
      groupMoa: parseFloat(recipeMoa) || undefined,
      notes: recipeNotes.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    const updated = [newRecipe, ...recipesList];
    await saveRecipes(updated);
    setIsRecipeModalVisible(false);
    showSuccess('Recipe Saved', `Lot #${newRecipe.lotNumber} added to catalog`);
  };

  const handleDeleteRecipe = (id: string, name: string) => {
    showConfirm({
      title: 'Delete Recipe?',
      message: `Are you sure you want to delete "${name}"?`,
      confirmText: 'Delete',
      type: 'danger',
      onConfirm: async () => {
        const updated = recipesList.filter(r => r.id !== id);
        await saveRecipes(updated);
        showToast({ message: 'Recipe deleted', type: 'info' });
      }
    });
  };

  // Print Batch Ammo Box Label with QR Code
  const handlePrintRecipeLabel = async (recipe: ReloadingRecipe) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const qrData = encodeURIComponent(`AV-RECIPE-${recipe.id}`);
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${qrData}`;

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Ammo Box Label - ${recipe.lotNumber}</title>
            <style>
              @page { size: auto; margin: 10mm; }
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                color: #0f172a;
                margin: 0;
                padding: 0;
              }
              .label-card {
                width: 3.5in;
                border: 2px solid #0f172a;
                border-radius: 8px;
                padding: 10px;
                box-sizing: border-box;
                background: #fff;
              }
              .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 2px solid #0f172a;
                padding-bottom: 6px;
                margin-bottom: 8px;
              }
              .caliber {
                font-size: 16px;
                font-weight: 900;
                text-transform: uppercase;
              }
              .lot-badge {
                background: #0f172a;
                color: #fff;
                font-size: 10px;
                font-weight: bold;
                padding: 2px 6px;
                border-radius: 4px;
              }
              .title {
                font-size: 12px;
                font-weight: bold;
                margin-bottom: 6px;
                color: #1e293b;
              }
              .content {
                display: flex;
                gap: 10px;
              }
              .specs {
                flex: 1;
                font-size: 9.5px;
                line-height: 1.4;
              }
              .specs strong {
                color: #334155;
              }
              .qr-side {
                text-align: center;
                width: 80px;
              }
              .qr-img {
                width: 75px;
                height: 75px;
                border: 1px solid #cbd5e1;
                border-radius: 4px;
              }
              .qr-caption {
                font-size: 7.5px;
                color: #64748b;
                margin-top: 2px;
              }
              .footer {
                margin-top: 6px;
                padding-top: 4px;
                border-top: 1px dashed #cbd5e1;
                font-size: 8px;
                color: #64748b;
                display: flex;
                justify-content: space-between;
              }
            </style>
          </head>
          <body>
            <div class="label-card">
              <div class="header">
                <div class="caliber">${recipe.caliber}</div>
                <div class="lot-badge">LOT #${recipe.lotNumber}</div>
              </div>
              <div class="title">${recipe.name}</div>
              <div class="content">
                <div class="specs">
                  <div><strong>Bullet:</strong> ${recipe.bullet}</div>
                  <div><strong>Powder:</strong> ${recipe.powder} (${recipe.chargeGrains} gr)</div>
                  <div><strong>Primer:</strong> ${recipe.primer}</div>
                  <div><strong>Brass/COAL:</strong> ${recipe.brass} • ${recipe.coalInches}"</div>
                  ${recipe.avgVelocityFps ? `<div><strong>Velocity:</strong> ${recipe.avgVelocityFps} fps</div>` : ''}
                  ${recipe.groupMoa ? `<div><strong>Accuracy:</strong> ${recipe.groupMoa} MOA</div>` : ''}
                </div>
                <div class="qr-side">
                  <img class="qr-img" src="${qrUrl}" alt="QR" />
                  <div class="qr-caption">Scan in App</div>
                </div>
              </div>
              <div class="footer">
                <div>ArmoryVault Handload Batch</div>
                <div>Count: ${recipe.batchSize} rds &bull; ${new Date(recipe.createdAt).toLocaleDateString()}</div>
              </div>
            </div>
          </body>
        </html>
      `;

      await Print.printAsync({ html });
    } catch (e: any) {
      console.error('Error printing label', e);
      showToast({ message: 'Failed to open print dialog', type: 'error' });
    }
  };

  // Open Quick Adjustment Modal
  const openAdjustModal = (item: any, isAmmo: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAdjustItem({ item, isAmmo });
    setAdjustAction('add');
    setAdjustCount(isAmmo ? '50' : '100');
  };

  const handleSaveAdjustment = async () => {
    if (!adjustItem) return;
    const parsed = parseInt(adjustCount) || 0;
    if (parsed <= 0) {
      showToast({ message: 'Please enter a valid count', type: 'warning' });
      return;
    }

    try {
      const isAmmo = adjustItem.isAmmo;
      const unit = isAmmo ? 'rds' : (adjustItem.item.type === 'Powder' ? 'lbs' : 'units');
      const itemName = isAmmo 
        ? `${adjustItem.item.caliber || 'Ammo'}`
        : `${adjustItem.item.name || 'Component'}`;

      const newLog = {
        type: isAmmo ? 'ammo_adjustment' : 'component_adjustment',
        itemId: adjustItem.item.id,
        action: adjustAction,
        count: parsed,
        measurement: unit,
        timestamp: new Date().toISOString()
      };

      await addToQueue(newLog, `${adjustAction === 'add' ? 'Added' : 'Deducted'} ${parsed} ${unit} of ${itemName}`);
      
      // Update local state preview
      if (isAmmo) {
        setAmmoList(prev => prev.map(a => {
          if (a.id === adjustItem.item.id) {
            const current = a.count || 0;
            const updated = adjustAction === 'add' ? current + parsed : Math.max(0, current - parsed);
            return { ...a, count: updated };
          }
          return a;
        }));
      } else {
        setComponentsList(prev => prev.map(c => {
          if (c.id === adjustItem.item.id) {
            const current = c.quantity || 0;
            const updated = adjustAction === 'add' ? current + parsed : Math.max(0, current - parsed);
            return { ...c, quantity: updated };
          }
          return c;
        }));
      }

      setAdjustItem(null);
    } catch (e) {
      console.error(e);
      showError('Error', 'Failed to save inventory change');
    }
  };

  // Computations for Vault Totals & Valuation
  const totalRounds = useMemo(() => {
    return ammoList.reduce((acc, a) => acc + (a.count || 0), 0);
  }, [ammoList]);

  const totalVaultValue = useMemo(() => {
    let total = 0;
    ammoList.forEach(a => {
      const pricePerRound = a.cost_per_round || 0.40;
      total += (a.count || 0) * pricePerRound;
    });
    componentsList.forEach(c => {
      const unitCost = c.unit_cost || (c.type === 'Powder' ? 42 : 0.08);
      total += (c.quantity || 0) * unitCost;
    });
    return total;
  }, [ammoList, componentsList]);

  const filteredAmmo = useMemo(() => {
    return ammoList.filter(a => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const caliber = (a.caliber || '').toLowerCase();
      const mfg = (a.manufacturer || '').toLowerCase();
      const proj = (a.projectile || '').toLowerCase();
      const grain = String(a.grain || '');
      return caliber.includes(q) || mfg.includes(q) || proj.includes(q) || grain.includes(q);
    });
  }, [ammoList, searchQuery]);

  const filteredComponents = useMemo(() => {
    return componentsList.filter(c => {
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
  }, [componentsList, componentFilter, searchQuery]);

  const filteredRecipes = useMemo(() => {
    return recipesList.filter(r => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.caliber.toLowerCase().includes(q) ||
        r.lotNumber.toLowerCase().includes(q) ||
        r.bullet.toLowerCase().includes(q) ||
        r.powder.toLowerCase().includes(q)
      );
    });
  }, [recipesList, searchQuery]);

  return (
    <View style={styles.container}>
      {/* Header Summary Banner with Vault Financial Valuation Toggle */}
      <View style={styles.summaryBanner}>
        <View>
          <Text style={styles.summaryTitle}>Total Stock: {totalRounds.toLocaleString()} Rounds</Text>
          <Text style={styles.summarySubtitle}>
            {ammoList.length} Caliber Lots • {componentsList.length} Reloading SKUs
          </Text>
        </View>

        <Pressable 
          style={styles.valuationToggleBtn} 
          onPress={() => setShowValuation(!showValuation)}
        >
          <Ionicons 
            name={showValuation ? "eye-outline" : "eye-off-outline"} 
            size={16} 
            color="#38bdf8" 
            style={{ marginRight: 4 }} 
          />
          <Text style={styles.valuationToggleText}>
            {showValuation ? `$${totalVaultValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Show Value'}
          </Text>
        </Pressable>
      </View>

      {/* Tab Switcher (Ammo / Components / Recipes) */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, activeTab === 'ammo' && styles.activeTab]}
          onPress={() => setActiveTab('ammo')}
        >
          <Ionicons name="cube-outline" size={15} color={activeTab === 'ammo' ? '#fff' : '#94a3b8'} style={{ marginRight: 5 }} />
          <Text style={[styles.tabText, activeTab === 'ammo' && styles.activeTabText]}>
            Ammo ({ammoList.length})
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === 'components' && styles.activeTab]}
          onPress={() => setActiveTab('components')}
        >
          <Ionicons name="flask-outline" size={15} color={activeTab === 'components' ? '#fff' : '#94a3b8'} style={{ marginRight: 5 }} />
          <Text style={[styles.tabText, activeTab === 'components' && styles.activeTabText]}>
            Supplies ({componentsList.length})
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === 'recipes' && styles.activeTab]}
          onPress={() => setActiveTab('recipes')}
        >
          <Ionicons name="receipt-outline" size={15} color={activeTab === 'recipes' ? '#fff' : '#94a3b8'} style={{ marginRight: 5 }} />
          <Text style={[styles.tabText, activeTab === 'recipes' && styles.activeTabText]}>
            Recipes ({recipesList.length})
          </Text>
        </Pressable>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder={
            activeTab === 'ammo'
              ? 'Search caliber, brand, bullet type...'
              : activeTab === 'components'
              ? 'Search powders, primers, brass, bullets...'
              : 'Search recipes, calibers, lot #...'
          }
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

      {/* Tab Content: Ammunition */}
      {activeTab === 'ammo' && (
        <FlatList
          data={filteredAmmo}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#38bdf8" />}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => {
            const isLowStock = (item.count || 0) < 100;
            const cpr = item.cost_per_round || 0.45;
            return (
              <View style={[styles.card, isLowStock && styles.lowStockCard]}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>
                      {item.manufacturer ? `${item.manufacturer} ` : ''}{item.caliber}
                    </Text>
                    <Text style={styles.itemSubtitle}>
                      {item.grain ? `${item.grain}gr ` : ''}{item.projectile || 'FMJ / Target'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.itemCount}>{item.count || 0} rds</Text>
                    <Text style={styles.cprText}>${cpr.toFixed(2)}/rd</Text>
                  </View>
                </View>

                {isLowStock && (
                  <View style={styles.lowStockBadge}>
                    <Ionicons name="warning-outline" size={12} color="#ef4444" style={{ marginRight: 4 }} />
                    <Text style={styles.lowStockText}>LOW STOCK (Below 100 rds)</Text>
                  </View>
                )}

                <View style={styles.cardActions}>
                  <Pressable 
                    style={styles.adjustBtn} 
                    onPress={() => openAdjustModal(item, true)}
                  >
                    <Ionicons name="swap-vertical" size={14} color="#38bdf8" style={{ marginRight: 4 }} />
                    <Text style={styles.adjustBtnText}>Quick Adjust Stock</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={44} color="#475569" style={{ marginBottom: 8 }} />
              <Text style={styles.emptyTitle}>No Ammunition Found</Text>
              <Text style={styles.emptySubtitle}>Sync with desktop or add ammunition lots to view your supply.</Text>
            </View>
          }
        />
      )}

      {/* Tab Content: Reloading Supplies / Components */}
      {activeTab === 'components' && (
        <View style={{ flex: 1 }}>
          {/* Component Filter Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChipRow}>
            {['All', 'Powder', 'Primer', 'Case', 'Bullet'].map(filter => (
              <Pressable
                key={filter}
                style={[styles.filterChip, componentFilter === filter && styles.filterChipActive]}
                onPress={() => setComponentFilter(filter as any)}
              >
                <Text style={[styles.filterChipText, componentFilter === filter && styles.filterChipTextActive]}>
                  {filter}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <FlatList
            data={filteredComponents}
            keyExtractor={(item) => String(item.id)}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#38bdf8" />}
            contentContainerStyle={{ paddingBottom: 40 }}
            renderItem={({ item }) => {
              const unit = item.type === 'Powder' ? 'lbs' : 'units';
              return (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{item.name}</Text>
                      <Text style={styles.itemSubtitle}>
                        {item.type} {item.caliber ? `• ${item.caliber}` : ''} {item.manufacturer ? `• ${item.manufacturer}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.itemCount}>{item.quantity || 0} {unit}</Text>
                  </View>

                  <View style={styles.cardActions}>
                    <Pressable 
                      style={styles.adjustBtn} 
                      onPress={() => openAdjustModal(item, false)}
                    >
                      <Ionicons name="swap-vertical" size={14} color="#38bdf8" style={{ marginRight: 4 }} />
                      <Text style={styles.adjustBtnText}>Quick Adjust Stock</Text>
                    </Pressable>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="flask-outline" size={44} color="#475569" style={{ marginBottom: 8 }} />
                <Text style={styles.emptyTitle}>No Components Found</Text>
                <Text style={styles.emptySubtitle}>Sync with desktop or select a different filter.</Text>
              </View>
            }
          />
        </View>
      )}

      {/* Tab Content: Handload Recipes & Batches */}
      {activeTab === 'recipes' && (
        <View style={{ flex: 1 }}>
          {/* Create New Recipe Action Button */}
          <Pressable style={styles.newRecipeBtn} onPress={openNewRecipeModal}>
            <Ionicons name="add-circle" size={18} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.newRecipeBtnText}>Create Handload Recipe / Batch</Text>
          </Pressable>

          <FlatList
            data={filteredRecipes}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 40 }}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{item.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                      <View style={styles.caliberBadge}>
                        <Text style={styles.caliberBadgeText}>{item.caliber}</Text>
                      </View>
                      <View style={styles.lotBadge}>
                        <Text style={styles.lotBadgeText}>LOT #{item.lotNumber}</Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Pressable 
                      onPress={() => handlePrintRecipeLabel(item)}
                      style={styles.printLabelBtn}
                    >
                      <Ionicons name="print-outline" size={15} color="#38bdf8" style={{ marginRight: 3 }} />
                      <Text style={styles.printLabelBtnText}>Box Label</Text>
                    </Pressable>

                    <Pressable 
                      onPress={() => handleDeleteRecipe(item.id, item.name)}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </Pressable>
                  </View>
                </View>

                {/* Recipe Formulation Grid */}
                <View style={styles.recipeSpecsGrid}>
                  <View style={styles.recipeSpec}>
                    <Text style={styles.recipeSpecLabel}>Bullet</Text>
                    <Text style={styles.recipeSpecValue}>{item.bullet}</Text>
                  </View>
                  <View style={styles.recipeSpec}>
                    <Text style={styles.recipeSpecLabel}>Powder & Charge</Text>
                    <Text style={styles.recipeSpecValue}>{item.powder} ({item.chargeGrains} gr)</Text>
                  </View>
                  <View style={styles.recipeSpec}>
                    <Text style={styles.recipeSpecLabel}>Primer</Text>
                    <Text style={styles.recipeSpecValue}>{item.primer}</Text>
                  </View>
                  <View style={styles.recipeSpec}>
                    <Text style={styles.recipeSpecLabel}>COAL</Text>
                    <Text style={styles.recipeSpecValue}>{item.coalInches}</Text>
                  </View>
                </View>

                {/* Metrics / Performance */}
                {(item.avgVelocityFps || item.groupMoa) && (
                  <View style={styles.metricsRow}>
                    {item.avgVelocityFps && (
                      <Text style={styles.metricPill}>⚡ {item.avgVelocityFps} fps</Text>
                    )}
                    {item.groupMoa && (
                      <Text style={styles.metricPill}>🎯 {item.groupMoa} MOA</Text>
                    )}
                    <Text style={styles.metricPill}>📦 Batch: {item.batchSize} rds</Text>
                  </View>
                )}

                {item.notes ? (
                  <Text style={styles.recipeNotesText} numberOfLines={2}>
                    📝 {item.notes}
                  </Text>
                ) : null}
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="receipt-outline" size={44} color="#475569" style={{ marginBottom: 8 }} />
                <Text style={styles.emptyTitle}>No Handload Recipes Yet</Text>
                <Text style={styles.emptySubtitle}>Tap above to log custom powder charges, bullet seatings, and generate printable batch box labels.</Text>
              </View>
            }
          />
        </View>
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
                  Current Stock: {adjustItem.isAmmo ? adjustItem.item.count : adjustItem.item.quantity} {adjustItem.isAmmo ? 'rds' : (adjustItem.item.type === 'Powder' ? 'lbs' : 'units')}
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
                    <Text style={[styles.actionToggleText, adjustAction === 'remove' && styles.actionToggleTextActive]}>- Deduct Stock</Text>
                  </Pressable>
                </View>

                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={adjustCount}
                  onChangeText={setAdjustCount}
                  autoFocus
                />

                {/* Quick Steppers */}
                <View style={styles.stepperChipRow}>
                  {[20, 50, 100, 250, 500].map(amt => (
                    <Pressable
                      key={amt}
                      style={styles.stepperChip}
                      onPress={() => setAdjustCount(String(amt))}
                    >
                      <Text style={styles.stepperChipText}>{amt}</Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.modalButtons}>
                  <Pressable style={styles.cancelBtn} onPress={() => setAdjustItem(null)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable 
                    style={[styles.confirmBtn, { backgroundColor: adjustAction === 'remove' ? '#ef4444' : '#10b981' }]} 
                    onPress={handleSaveAdjustment}
                  >
                    <Text style={styles.confirmBtnText}>
                      {adjustAction === 'remove' ? 'Deduct' : 'Add'}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* New Recipe Modal */}
      <Modal visible={isRecipeModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 12 }}>
              <Text style={styles.modalTitle}>New Handload Recipe</Text>
              <Pressable onPress={() => setIsRecipeModalVisible(false)}>
                <Ionicons name="close" size={22} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }}>
              <View style={styles.fieldRow2}>
                <View style={{ flex: 1.2 }}>
                  <Text style={styles.inputLabel}>Recipe / Batch Name *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. 6.5 CM Match Precision"
                    placeholderTextColor="#64748b"
                    value={recipeName}
                    onChangeText={setRecipeName}
                  />
                </View>
                <View style={{ flex: 0.8 }}>
                  <Text style={styles.inputLabel}>Lot Number *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="LOT-12345"
                    placeholderTextColor="#64748b"
                    value={recipeLotNumber}
                    onChangeText={setRecipeLotNumber}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Caliber *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 6.5 Creedmoor, 9mm, .308 Win"
                placeholderTextColor="#64748b"
                value={recipeCaliber}
                onChangeText={setRecipeCaliber}
              />

              <View style={styles.fieldRow2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Bullet & Weight</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="140gr ELD-M"
                    placeholderTextColor="#64748b"
                    value={recipeBullet}
                    onChangeText={setRecipeBullet}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Powder & Grains</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="H4350 (41.5 gr)"
                    placeholderTextColor="#64748b"
                    value={recipePowder}
                    onChangeText={setRecipePowder}
                  />
                </View>
              </View>

              <View style={styles.fieldRow2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Primer</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Fed 210M / CCI 450"
                    placeholderTextColor="#64748b"
                    value={recipePrimer}
                    onChangeText={setRecipePrimer}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Brass / Headstamp</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Lapua / Alpha"
                    placeholderTextColor="#64748b"
                    value={recipeBrass}
                    onChangeText={setRecipeBrass}
                  />
                </View>
              </View>

              <View style={styles.fieldRow2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>C.O.A.L. (Inches)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder='2.800"'
                    placeholderTextColor="#64748b"
                    value={recipeCoal}
                    onChangeText={setRecipeCoal}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Batch Size (Rds)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="50"
                    placeholderTextColor="#64748b"
                    value={recipeBatchSize}
                    onChangeText={setRecipeBatchSize}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.fieldRow2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Avg Chrono Velocity (fps)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="2685"
                    placeholderTextColor="#64748b"
                    value={recipeVelocity}
                    onChangeText={setRecipeVelocity}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Accuracy / Group (MOA)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0.45"
                    placeholderTextColor="#64748b"
                    value={recipeMoa}
                    onChangeText={setRecipeMoa}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Notes & Seating Depth Details</Text>
              <TextInput
                style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
                placeholder="Jump to lands, powder lot #, crimp specifications..."
                placeholderTextColor="#64748b"
                value={recipeNotes}
                onChangeText={setRecipeNotes}
                multiline
              />

              <Pressable style={styles.saveRecipeBtn} onPress={handleSaveRecipe}>
                <Text style={styles.saveRecipeBtnText}>Save Recipe to Vault</Text>
              </Pressable>
            </ScrollView>
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
  summaryBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  summarySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  valuationToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  valuationToggleText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  tabText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 12,
  },
  activeTabText: {
    color: '#38bdf8',
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 13,
  },
  filterChipRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  filterChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterChipActive: {
    backgroundColor: '#38bdf8',
    borderColor: '#38bdf8',
  },
  filterChipText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#0f172a',
    fontWeight: 'bold',
  },
  newRecipeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  newRecipeBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  lowStockCard: {
    borderColor: 'rgba(239, 68, 68, 0.5)',
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  itemCount: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#34d399',
  },
  cprText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  lowStockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 8,
    borderWidth: 0.5,
    borderColor: '#ef4444',
  },
  lowStockText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardActions: {
    flexDirection: 'row',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  adjustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  adjustBtnText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  caliberBadge: {
    backgroundColor: '#0f172a',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  caliberBadgeText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600',
  },
  lotBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#38bdf8',
  },
  lotBadgeText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  printLabelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#38bdf8',
  },
  printLabelBtnText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  recipeSpecsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  recipeSpec: {
    width: '50%',
    paddingVertical: 3,
  },
  recipeSpecLabel: {
    fontSize: 9.5,
    color: '#64748b',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  recipeSpecValue: {
    fontSize: 11.5,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  metricPill: {
    backgroundColor: '#0f172a',
    color: '#34d399',
    fontSize: 10.5,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  recipeNotesText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 6,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: 'bold',
  },
  emptySubtitle: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 16,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 14,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  actionToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionToggleAddActive: {
    backgroundColor: '#065f46',
    borderColor: '#10b981',
  },
  actionToggleRemoveActive: {
    backgroundColor: '#7f1d1d',
    borderColor: '#ef4444',
  },
  actionToggleText: {
    color: '#94a3b8',
    fontWeight: 'bold',
    fontSize: 12,
  },
  actionToggleTextActive: {
    color: '#fff',
  },
  modalInput: {
    backgroundColor: '#0f172a',
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#38bdf8',
    marginBottom: 10,
  },
  stepperChipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  stepperChip: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  stepperChipText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#475569',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  // New Recipe Form Fields
  inputLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 4,
    marginTop: 6,
  },
  textInput: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  fieldRow2: {
    flexDirection: 'row',
    gap: 8,
  },
  saveRecipeBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 10,
  },
  saveRecipeBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
