import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, FlatList, RefreshControl, Modal, ScrollView, Platform } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  CartridgesIcon,
  GunpowderIcon,
  SafeIcon,
  AmmoCanIcon,
  CabinetIcon,
  GunCaseIcon,
  VehicleVaultIcon,
} from '../components/CustomMobileIcons';
import {
  getStorageCapacityUtilization,
  StorageLocation,
} from '../../utils/storageCapacity';
import { formatAmmoSubtitle, formatShotgunSpecs, getPlusPBadgeText, isShotgunAmmo } from '../../utils/caliberHelpers';
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

const SHOTGUN_PRESETS = [
  { label: '00 Buck (9 Pellets)', shotType: 'Buckshot', shot_size: '00 Buck', pellet_count: 9, shell_length: '2 3/4"', oz_payload: undefined },
  { label: '#8 Target (1 1/8 oz)', shotType: 'Target / Clay', shot_size: '8', oz_payload: '1 1/8 oz', shell_length: '2 3/4"', pellet_count: undefined },
  { label: '#7 1/2 Clay (1 1/8 oz)', shotType: 'Target / Clay', shot_size: '7 1/2', oz_payload: '1 1/8 oz', shell_length: '2 3/4"', pellet_count: undefined },
  { label: '1 oz Rifled Slug', shotType: 'Slug', shot_size: 'Slug', oz_payload: '1 oz', shell_length: '2 3/4"', pellet_count: undefined },
  { label: '#4 Birdshot (1 1/4 oz)', shotType: 'Birdshot / Field', shot_size: '4', oz_payload: '1 1/4 oz', shell_length: '2 3/4"', pellet_count: undefined },
  { label: '#6 Game Load (1 oz)', shotType: 'Birdshot / Field', shot_size: '6', oz_payload: '1 oz', shell_length: '2 3/4"', pellet_count: undefined },
  { label: 'BB Waterfowl (3")', shotType: 'Waterfowl', shot_size: 'BB', oz_payload: '1 1/4 oz', shell_length: '3"', pellet_count: undefined },
];

export default function InventoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ storageId?: string }>();
  const { addToQueue, refreshCache, storageLocations, lastCacheTime, isOnline } = useSync();
  const { showToast, showError, showConfirm, showSuccess } = useDialog();

  const [activeTab, setActiveTab] = useState<'ammo' | 'components' | 'recipes'>('ammo');
  const [ammoList, setAmmoList] = useState<any[]>([]);
  const [componentsList, setComponentsList] = useState<any[]>([]);
  const [recipesList, setRecipesList] = useState<ReloadingRecipe[]>([]);
  const [componentFilter, setComponentFilter] = useState<'All' | 'Powder' | 'Primer' | 'Case' | 'Bullet'>('All');
  const [selectedStorageId, setSelectedStorageId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Financial Value Toggle
  const [showValuation, setShowValuation] = useState(false);

  // Inspect Ammo Modal
  const [inspectingAmmo, setInspectingAmmo] = useState<any | null>(null);

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
      if (params.storageId) {
        setSelectedStorageId(parseInt(params.storageId, 10) || null);
      }
      loadCachedInventory();
      loadRecipes();
      if (isOnline) {
        refreshCache(true)
          .then(() => loadCachedInventory())
          .catch(() => {});
      }
    }, [params.storageId, isOnline, refreshCache])
  );

  useEffect(() => {
    loadCachedInventory();
  }, [lastCacheTime]);

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

  const handleApplyShotgunPreset = async (preset: (typeof SHOTGUN_PRESETS)[0]) => {
    if (!inspectingAmmo) return;
    const updatedAmmo = {
      ...inspectingAmmo,
      shot_size: preset.shot_size,
      shell_length: preset.shell_length,
      oz_payload: preset.oz_payload,
      pellet_count: preset.pellet_count,
    };
    setInspectingAmmo(updatedAmmo);

    // Update in local state
    setAmmoList(prev => prev.map(a => (a.id === inspectingAmmo.id ? updatedAmmo : a)));

    // Persist to AsyncStorage inventory_cache
    try {
      const cacheStr = await AsyncStorage.getItem('inventory_cache');
      if (cacheStr) {
        const cache = JSON.parse(cacheStr);
        if (cache.ammo) {
          cache.ammo = cache.ammo.map((a: any) => (a.id === inspectingAmmo.id ? updatedAmmo : a));
          await AsyncStorage.setItem('inventory_cache', JSON.stringify(cache));
        }
      }
    } catch (e) {
      console.error('Error saving preset to cache', e);
    }

    // Queue sync to desktop
    addToQueue({
      type: 'ammo_adjustment',
      itemId: inspectingAmmo.id,
      timestamp: new Date().toISOString(),
      data: {
        id: inspectingAmmo.id,
        caliber: inspectingAmmo.caliber,
        shot_size: preset.shot_size,
        shell_length: preset.shell_length,
        oz_payload: preset.oz_payload,
        pellet_count: preset.pellet_count,
      },
    }, `Updated to ${preset.label}`);

    showToast(`Updated to ${preset.label}`);
  };

  const handleTogglePlusP = async (ammo: any) => {
    if (!ammo) return;
    const currentPlusP = Boolean(ammo.isPlusP);
    const nextPlusP = !currentPlusP;
    const updatedAmmo = {
      ...ammo,
      isPlusP: nextPlusP,
    };
    setInspectingAmmo(updatedAmmo);

    // Update in local state
    setAmmoList(prev => prev.map(a => (a.id === ammo.id ? updatedAmmo : a)));

    // Persist to AsyncStorage inventory_cache
    try {
      const cacheStr = await AsyncStorage.getItem('inventory_cache');
      if (cacheStr) {
        const cache = JSON.parse(cacheStr);
        if (cache.ammo) {
          cache.ammo = cache.ammo.map((a: any) => (a.id === ammo.id ? updatedAmmo : a));
          await AsyncStorage.setItem('inventory_cache', JSON.stringify(cache));
        }
      }
    } catch (e) {
      console.error('Error saving +P toggle to cache', e);
    }

    // Queue sync to desktop
    addToQueue({
      type: 'ammo_adjustment',
      upcOrId: String(ammo.id),
      action: 'add',
      count: 0,
      timestamp: new Date().toISOString(),
      data: {
        id: ammo.id,
        isPlusP: nextPlusP,
      },
    } as any, `Updated ${ammo.caliber} rating to ${nextPlusP ? '+P' : 'Standard'}`);

    showToast({
      message: `Set ${ammo.caliber} to ${nextPlusP ? '+P High Pressure' : 'Standard Pressure'}`,
      type: 'success',
    });
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

  const selectedStorageLocation = useMemo(() => {
    if (!selectedStorageId) return null;
    return (storageLocations || []).find((l: any) => l.id === selectedStorageId) || null;
  }, [storageLocations, selectedStorageId]);

  const storageCapUtil = useMemo(() => {
    if (!selectedStorageLocation) return null;
    const fCount = (selectedStorageLocation.firearmIds || []).length;
    const accCount = (selectedStorageLocation.accessoryIds || []).length;
    const ammoCount = (selectedStorageLocation.ammoIds || []).length;
    const compCount = (selectedStorageLocation.componentIds || []).length;
    return getStorageCapacityUtilization(
      selectedStorageLocation,
      fCount,
      accCount,
      ammoCount,
      compCount
    );
  }, [selectedStorageLocation]);

  const filteredAmmo = useMemo(() => {
    return ammoList.filter(a => {
      if (selectedStorageId && selectedStorageLocation) {
        if (!(selectedStorageLocation.ammoIds || []).includes(a.id)) return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const caliber = (a.caliber || '').toLowerCase();
      const mfg = (a.manufacturer || '').toLowerCase();
      const proj = (a.projectile || '').toLowerCase();
      const grain = String(a.grain || '');
      const shotSize = (a.shot_size || '').toLowerCase();
      const shellLen = (a.shell_length || '').toLowerCase();
      const payload = (a.oz_payload || '').toLowerCase();
      return (
        caliber.includes(q) ||
        mfg.includes(q) ||
        proj.includes(q) ||
        grain.includes(q) ||
        shotSize.includes(q) ||
        shellLen.includes(q) ||
        payload.includes(q)
      );
    });
  }, [ammoList, searchQuery, selectedStorageId, selectedStorageLocation]);

  const filteredComponents = useMemo(() => {
    return componentsList.filter(c => {
      if (selectedStorageId && selectedStorageLocation) {
        if (!(selectedStorageLocation.componentIds || []).includes(c.id)) return false;
      }
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
  }, [componentsList, componentFilter, searchQuery, selectedStorageId, selectedStorageLocation]);

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
          <CartridgesIcon size={15} color={activeTab === 'ammo' ? '#fff' : '#94a3b8'} style={{ marginRight: 5 }} />
          <Text style={[styles.tabText, activeTab === 'ammo' && styles.activeTabText]}>
            Ammo ({ammoList.length})
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === 'components' && styles.activeTab]}
          onPress={() => setActiveTab('components')}
        >
          <GunpowderIcon size={15} color={activeTab === 'components' ? '#fff' : '#94a3b8'} style={{ marginRight: 5 }} />
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

      {/* Storage Location Filter Chips */}
      {storageLocations && storageLocations.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 38, marginBottom: 8, paddingHorizontal: 16 }}
          contentContainerStyle={{ gap: 6, alignItems: 'center' }}
        >
          <Pressable
            style={[
              {
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 16,
                backgroundColor: selectedStorageId === null ? '#38bdf8' : 'rgba(255,255,255,0.05)',
                borderWidth: 1,
                borderColor: selectedStorageId === null ? '#38bdf8' : 'rgba(255,255,255,0.1)',
              },
            ]}
            onPress={() => setSelectedStorageId(null)}
          >
            <Text
              style={{
                color: selectedStorageId === null ? '#0f172a' : '#94a3b8',
                fontSize: 11,
                fontWeight: '700',
              }}
            >
              All Storage
            </Text>
          </Pressable>

          {storageLocations.map((loc: any) => {
            const isSelected = selectedStorageId === loc.id;
            return (
              <Pressable
                key={loc.id}
                style={[
                  {
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 16,
                    backgroundColor: isSelected ? '#38bdf8' : 'rgba(255,255,255,0.05)',
                    borderWidth: 1,
                    borderColor: isSelected ? '#38bdf8' : 'rgba(255,255,255,0.1)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  },
                ]}
                onPress={() => setSelectedStorageId(isSelected ? null : loc.id)}
              >
                {loc.type === 'Safe' ? (
                  <SafeIcon size={12} color={isSelected ? '#0f172a' : '#34d399'} />
                ) : loc.type === 'AmmoCan' ? (
                  <AmmoCanIcon size={12} color={isSelected ? '#0f172a' : '#f59e0b'} />
                ) : loc.type === 'Cabinet' ? (
                  <CabinetIcon size={12} color={isSelected ? '#0f172a' : '#38bdf8'} />
                ) : loc.type === 'Case' ? (
                  <GunCaseIcon size={12} color={isSelected ? '#0f172a' : '#a78bfa'} />
                ) : (
                  <VehicleVaultIcon size={12} color={isSelected ? '#0f172a' : '#fb7185'} />
                )}
                <Text
                  style={{
                    color: isSelected ? '#0f172a' : '#f1f5f9',
                    fontSize: 11,
                    fontWeight: '600',
                  }}
                  numberOfLines={1}
                >
                  {loc.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Selected Storage Location Card Banner */}
      {selectedStorageLocation && storageCapUtil && (
        <View
          style={{
            marginHorizontal: 16,
            marginBottom: 10,
            backgroundColor: 'rgba(56, 189, 248, 0.08)',
            borderColor: 'rgba(56, 189, 248, 0.25)',
            borderWidth: 1,
            borderRadius: 10,
            padding: 10,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {selectedStorageLocation.type === 'Safe' ? (
                <SafeIcon size={16} color="#34d399" />
              ) : selectedStorageLocation.type === 'AmmoCan' ? (
                <AmmoCanIcon size={16} color="#f59e0b" />
              ) : selectedStorageLocation.type === 'Cabinet' ? (
                <CabinetIcon size={16} color="#38bdf8" />
              ) : selectedStorageLocation.type === 'Case' ? (
                <GunCaseIcon size={16} color="#a78bfa" />
              ) : (
                <VehicleVaultIcon size={16} color="#fb7185" />
              )}
              <Text style={{ color: '#f8fafc', fontSize: 13, fontWeight: '700' }}>
                {selectedStorageLocation.name}
              </Text>
            </View>

            <Pressable onPress={() => setSelectedStorageId(null)}>
              <Ionicons name="close-circle" size={16} color="#94a3b8" />
            </Pressable>
          </View>

          {storageCapUtil.max ? (
            <View style={{ marginTop: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                <Text style={{ color: '#94a3b8', fontSize: 10 }}>
                  {storageCapUtil.unitLabel} Capacity
                </Text>
                <Text style={{ color: storageCapUtil.isOverCapacity ? '#ef4444' : '#38bdf8', fontSize: 10, fontWeight: '700' }}>
                  {storageCapUtil.used} / {storageCapUtil.max} ({storageCapUtil.percent}%)
                </Text>
              </View>
              <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                <View
                  style={{
                    width: `${Math.min(100, storageCapUtil.percent || 0)}%`,
                    height: '100%',
                    backgroundColor: storageCapUtil.isOverCapacity ? '#ef4444' : '#38bdf8',
                  }}
                />
              </View>
            </View>
          ) : (
            <Text style={{ color: '#64748b', fontSize: 11 }}>
              {storageCapUtil.summaryText}
            </Text>
          )}
        </View>
      )}

      {/* Tab Content: Ammunition */}
      {activeTab === 'ammo' && (
        <FlatList
          data={filteredAmmo}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#38bdf8" />}
          contentContainerStyle={{ paddingBottom: 110 }}
          renderItem={({ item }) => {
            const isLowStock = (item.count || 0) < 100;
            const cpr = item.cost_per_round || 0.45;
            const isShotgun = isShotgunAmmo(item);
            const shotgunSpecs = isShotgun ? formatShotgunSpecs(item) : null;
            const plusPText = getPlusPBadgeText(item);
            const loc = (storageLocations || []).find((l: any) => l.id === item.storageLocationId);

            return (
              <Pressable 
                style={[styles.card, isLowStock && styles.lowStockCard]}
                onPress={() => setInspectingAmmo(item)}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <Text style={styles.itemTitle}>
                        {item.manufacturer ? `${item.manufacturer} ` : ''}{item.caliber}
                      </Text>
                      {plusPText ? (
                        <View style={styles.plusPBadge}>
                          <Text style={styles.plusPBadgeText}>{plusPText}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.itemSubtitle}>
                      {formatAmmoSubtitle(item)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.itemCount}>{item.count || 0} rds</Text>
                    <Text style={styles.cprText}>${cpr.toFixed(2)}/rd</Text>
                  </View>
                </View>

                {/* Shotgun & Specification Chips Row */}
                <View style={styles.specChipsRow}>
                  {isShotgun && shotgunSpecs && (
                    <>
                      <View style={styles.specTypeBadge}>
                        <Text style={styles.specTypeBadgeText}>{shotgunSpecs.badgeText}</Text>
                      </View>
                      {shotgunSpecs.shellLength ? (
                        <View style={styles.specChip}>
                          <Text style={styles.specChipText}>{shotgunSpecs.shellLength}</Text>
                        </View>
                      ) : null}
                      {shotgunSpecs.shotSize ? (
                        <View style={styles.specChip}>
                          <Text style={styles.specChipText}>{shotgunSpecs.shotSize}</Text>
                        </View>
                      ) : null}
                      {shotgunSpecs.shotType === 'Buckshot' && shotgunSpecs.pelletCount ? (
                        <View style={styles.specChip}>
                          <Text style={styles.specChipText}>{shotgunSpecs.pelletCount}</Text>
                        </View>
                      ) : shotgunSpecs.payload ? (
                        <View style={styles.specChip}>
                          <Text style={styles.specChipText}>{shotgunSpecs.payload}</Text>
                        </View>
                      ) : null}
                    </>
                  )}
                  {!isShotgun && item.grain ? (
                    <View style={styles.specChip}>
                      <Text style={styles.specChipText}>{item.grain}gr</Text>
                    </View>
                  ) : null}
                  {!isShotgun && item.projectile ? (
                    <View style={styles.specChip}>
                      <Text style={styles.specChipText}>{item.projectile}</Text>
                    </View>
                  ) : null}
                  {loc && (
                    <View style={styles.locationChip}>
                      <Text style={styles.locationChipText}>{loc.name}</Text>
                    </View>
                  )}
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
                    onPress={(e) => {
                      e.stopPropagation();
                      openAdjustModal(item, true);
                    }}
                  >
                    <Ionicons name="swap-vertical" size={14} color="#38bdf8" style={{ marginRight: 4 }} />
                    <Text style={styles.adjustBtnText}>Quick Adjust Stock</Text>
                  </Pressable>
                  <Pressable
                    style={styles.detailsBtn}
                    onPress={() => setInspectingAmmo(item)}
                  >
                    <Ionicons name="information-circle-outline" size={14} color="#94a3b8" style={{ marginRight: 4 }} />
                    <Text style={styles.detailsBtnText}>Specs & Details</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <CartridgesIcon size={44} color="#475569" style={{ marginBottom: 8 }} />
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
            contentContainerStyle={{ paddingBottom: 110 }}
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
                <GunpowderIcon size={44} color="#475569" style={{ marginBottom: 8 }} />
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
            contentContainerStyle={{ paddingBottom: 110 }}
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
                <View style={styles.metricsRow}>
                  {item.avgVelocityFps && (
                    <View style={[styles.metricPill, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                      <Ionicons name="flash-outline" size={11} color="#f59e0b" />
                      <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '500' }}>{item.avgVelocityFps} fps</Text>
                    </View>
                  )}
                  {item.groupMoa && (
                    <View style={[styles.metricPill, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                      <Ionicons name="disc-outline" size={11} color="#34d399" />
                      <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '500' }}>{item.groupMoa} MOA</Text>
                    </View>
                  )}
                  <View style={[styles.metricPill, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                    <Ionicons name="cube-outline" size={11} color="#60a5fa" />
                    <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '500' }}>Batch: {item.batchSize} rds</Text>
                  </View>
                </View>

                {item.notes ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                    <Ionicons name="document-text-outline" size={12} color="#64748b" />
                    <Text style={styles.recipeNotesText} numberOfLines={2}>
                      {item.notes}
                    </Text>
                  </View>
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

      {/* Ammo Inspect / Detailed Specifications Modal */}
      <Modal visible={inspectingAmmo !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 400 }]}>
            {inspectingAmmo && (() => {
              const isShotgun = isShotgunAmmo(inspectingAmmo);
              const shotgunSpecs = isShotgun ? formatShotgunSpecs(inspectingAmmo) : null;
              const plusPText = getPlusPBadgeText(inspectingAmmo);
              const loc = (storageLocations || []).find((l: any) => l.id === inspectingAmmo.storageLocationId);
              const cpr = inspectingAmmo.cost_per_round || 0.45;
              const totalVal = ((inspectingAmmo.count || 0) * cpr).toFixed(2);

              return (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <Text style={styles.modalTitle} numberOfLines={2}>
                          {inspectingAmmo.manufacturer ? `${inspectingAmmo.manufacturer} ` : ''}{inspectingAmmo.caliber}
                        </Text>
                        {plusPText ? (
                          <View style={styles.plusPBadge}>
                            <Text style={styles.plusPBadgeText}>{plusPText}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[styles.itemSubtitle, { marginTop: 3 }]}>
                        {formatAmmoSubtitle(inspectingAmmo)}
                      </Text>
                    </View>
                    <Pressable onPress={() => setInspectingAmmo(null)} hitSlop={12} style={{ padding: 4 }}>
                      <Ionicons name="close" size={22} color="#94a3b8" />
                    </Pressable>
                  </View>

                  {/* Badges Row */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {plusPText ? (
                      <View style={[styles.plusPBadge, { paddingHorizontal: 7, paddingVertical: 2.5 }]}>
                        <Text style={[styles.plusPBadgeText, { fontSize: 10.5 }]}>{plusPText} HIGH PRESSURE</Text>
                      </View>
                    ) : null}
                    <View style={[styles.specTypeBadge, { backgroundColor: isShotgun ? 'rgba(245, 158, 11, 0.15)' : 'rgba(56, 189, 248, 0.15)', borderColor: isShotgun ? '#f59e0b' : '#38bdf8' }]}>
                      <Text style={[styles.specTypeBadgeText, { color: isShotgun ? '#f59e0b' : '#38bdf8' }]}>
                        {isShotgun ? (shotgunSpecs?.badgeText || 'TARGET LOAD') : (inspectingAmmo.type === 'handload' ? 'HANDLOAD' : 'FACTORY AMMO')}
                      </Text>
                    </View>
                    {isShotgun && shotgunSpecs?.shellLength ? (
                      <View style={styles.specChip}>
                        <Text style={styles.specChipText}>{shotgunSpecs.shellLength}</Text>
                      </View>
                    ) : null}
                    {loc && (
                      <View style={styles.locationChip}>
                        <Text style={styles.locationChipText}>{loc.name}</Text>
                      </View>
                    )}
                  </View>

                  {/* Stock & Value Summary Box */}
                  <View style={styles.modalStatBox}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalStatLabel}>CURRENT STOCK</Text>
                      <Text style={styles.modalStatVal}>{inspectingAmmo.count || 0} rds</Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={styles.modalStatLabel}>COST / RND</Text>
                      <Text style={[styles.modalStatVal, { color: '#38bdf8' }]}>${cpr.toFixed(2)}</Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={styles.modalStatLabel}>TOTAL VALUE</Text>
                      <Text style={[styles.modalStatVal, { color: '#10b981' }]}>${totalVal}</Text>
                    </View>
                  </View>

                  {/* Detailed Specifications Grid */}
                  <Text style={styles.modalSectionHeading}>SPECIFICATIONS</Text>
                  <View style={styles.specsGrid}>
                    <View style={styles.specRow}>
                      <Text style={styles.specRowLabel}>Caliber / Gauge:</Text>
                      <Text style={styles.specRowVal}>{inspectingAmmo.caliber}</Text>
                    </View>
                    {plusPText ? (
                      <View style={styles.specRow}>
                        <Text style={styles.specRowLabel}>Pressure Rating:</Text>
                        <Text style={[styles.specRowVal, { color: '#ef4444', fontWeight: 'bold' }]}>
                          {plusPText} High Pressure
                        </Text>
                      </View>
                    ) : null}
                    {isShotgun && shotgunSpecs && (
                      <>
                        <View style={styles.specRow}>
                          <Text style={styles.specRowLabel}>Shell Type:</Text>
                          <Text style={[styles.specRowVal, { color: '#38bdf8', fontWeight: 'bold' }]}>
                            {shotgunSpecs.shotType}
                          </Text>
                        </View>
                        <View style={styles.specRow}>
                          <Text style={styles.specRowLabel}>Shell Length:</Text>
                          <Text style={styles.specRowVal}>{shotgunSpecs.shellLength || '2 3/4"'}</Text>
                        </View>
                        <View style={styles.specRow}>
                          <Text style={styles.specRowLabel}>Shot Size:</Text>
                          <Text style={styles.specRowVal}>
                            {shotgunSpecs.shotSize || (shotgunSpecs.shotType === 'Buckshot' ? '00 Buckshot' : '#8 Target / Clay')}
                          </Text>
                        </View>
                        {shotgunSpecs.shotType === 'Buckshot' && shotgunSpecs.pelletCount ? (
                          <View style={styles.specRow}>
                            <Text style={styles.specRowLabel}>Pellet Count:</Text>
                            <Text style={styles.specRowVal}>{shotgunSpecs.pelletCount}</Text>
                          </View>
                        ) : null}
                        {shotgunSpecs.payload ? (
                          <View style={styles.specRow}>
                            <Text style={styles.specRowLabel}>Payload Weight:</Text>
                            <Text style={styles.specRowVal}>{shotgunSpecs.payload}</Text>
                          </View>
                        ) : null}
                      </>
                    )}
                    {!isShotgun && (
                      <>
                        {inspectingAmmo.grain ? (
                          <View style={styles.specRow}>
                            <Text style={styles.specRowLabel}>Bullet Weight:</Text>
                            <Text style={styles.specRowVal}>{inspectingAmmo.grain}gr</Text>
                          </View>
                        ) : null}
                        {inspectingAmmo.projectile ? (
                          <View style={styles.specRow}>
                            <Text style={styles.specRowLabel}>Projectile / Bullet:</Text>
                            <Text style={styles.specRowVal}>{inspectingAmmo.projectile}</Text>
                          </View>
                        ) : null}
                      </>
                    )}
                    {inspectingAmmo.type === 'handload' && (
                      <>
                        {inspectingAmmo.powder ? (
                          <View style={styles.specRow}>
                            <Text style={styles.specRowLabel}>Powder & Charge:</Text>
                            <Text style={styles.specRowVal}>
                              {inspectingAmmo.powder}{inspectingAmmo.powderCharge ? ` (${inspectingAmmo.powderCharge}gr)` : ''}
                            </Text>
                          </View>
                        ) : null}
                        {inspectingAmmo.primer || inspectingAmmo.primer_type ? (
                          <View style={styles.specRow}>
                            <Text style={styles.specRowLabel}>Primer:</Text>
                            <Text style={styles.specRowVal}>{inspectingAmmo.primer_type || inspectingAmmo.primer}</Text>
                          </View>
                        ) : null}
                      </>
                    )}
                    {loc && (
                      <View style={styles.specRow}>
                        <Text style={styles.specRowLabel}>Storage Location:</Text>
                        <Text style={styles.specRowVal}>{loc.name}</Text>
                      </View>
                    )}
                    {inspectingAmmo.upc_code ? (
                      <View style={styles.specRow}>
                        <Text style={styles.specRowLabel}>UPC / Barcode:</Text>
                        <Text style={[styles.specRowVal, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}>
                          {inspectingAmmo.upc_code}
                        </Text>
                      </View>
                    ) : null}
                    <Pressable
                      style={styles.specRow}
                      onPress={() => handleTogglePlusP(inspectingAmmo)}
                    >
                      <Text style={styles.specRowLabel}>Pressure Rating:</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {plusPText ? (
                          <View style={[styles.plusPBadge, { paddingHorizontal: 6, paddingVertical: 1 }]}>
                            <Text style={styles.plusPBadgeText}>{plusPText} High Pressure</Text>
                          </View>
                        ) : (
                          <Text style={[styles.specRowVal, { color: '#94a3b8' }]}>Standard Pressure</Text>
                        )}
                        <Ionicons
                          name={inspectingAmmo.isPlusP ? 'checkbox' : 'square-outline'}
                          size={18}
                          color={inspectingAmmo.isPlusP ? '#ef4444' : '#64748b'}
                        />
                      </View>
                    </Pressable>
                    {inspectingAmmo.notes ? (
                      <View style={[styles.specRow, { borderBottomWidth: 0, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }]}>
                        <Text style={styles.specRowLabel}>Notes:</Text>
                        <Text style={[styles.specRowVal, { color: '#cbd5e1' }]}>{inspectingAmmo.notes}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Quick Load Presets for Shotgun */}
                  {isShotgun && (
                    <View style={styles.presetSection}>
                      <Text style={styles.modalSectionHeading}>LOAD TYPE PRESETS (1-TAP SET)</Text>
                      <View style={styles.presetGrid}>
                        {SHOTGUN_PRESETS.map((preset) => {
                          const isActive =
                            (inspectingAmmo.shot_size === preset.shot_size ||
                              shotgunSpecs?.shotSize?.toLowerCase().includes(preset.shot_size.toLowerCase())) &&
                            (inspectingAmmo.shell_length === preset.shell_length ||
                              shotgunSpecs?.shellLength === preset.shell_length);
                          return (
                            <Pressable
                              key={preset.label}
                              style={[styles.presetChip, isActive && styles.presetChipActive]}
                              onPress={() => handleApplyShotgunPreset(preset)}
                            >
                              <Text style={[styles.presetChipText, isActive && styles.presetChipTextActive]}>
                                {preset.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* Actions */}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                    <Pressable
                      style={styles.cancelBtn}
                      onPress={() => setInspectingAmmo(null)}
                    >
                      <Text style={styles.cancelBtnText}>Close</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.confirmBtn, { backgroundColor: '#38bdf8' }]}
                      onPress={() => {
                        const ammoToAdjust = inspectingAmmo;
                        setInspectingAmmo(null);
                        openAdjustModal(ammoToAdjust, true);
                      }}
                    >
                      <Text style={[styles.confirmBtnText, { color: '#0f172a' }]}>Adjust Stock</Text>
                    </Pressable>
                  </View>
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Quick Adjustment Modal */}
      <Modal visible={adjustItem !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {adjustItem && (() => {
              const plusPText = adjustItem.isAmmo ? getPlusPBadgeText(adjustItem.item) : null;
              return (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                    <Text style={styles.modalTitle} numberOfLines={2}>
                      {adjustItem.isAmmo 
                        ? `${adjustItem.item.manufacturer || ''} ${adjustItem.item.caliber}`
                        : `${adjustItem.item.manufacturer || ''} ${adjustItem.item.name}`}
                    </Text>
                    {plusPText ? (
                      <View style={styles.plusPBadge}>
                        <Text style={styles.plusPBadgeText}>{plusPText}</Text>
                      </View>
                    ) : null}
                  </View>
                  {adjustItem.isAmmo && (
                    <Text style={[styles.itemSubtitle, { marginBottom: 6 }]}>
                      {formatAmmoSubtitle(adjustItem.item)}
                    </Text>
                  )}
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
                  selectTextOnFocus
                />

                {/* Quick Steppers */}
                <View style={styles.stepperChipRow}>
                  {[20, 50, 100, 250, 500].map(amt => (
                    <Pressable
                      key={val}
                      style={styles.stepperChip}
                      onPress={() => setAdjustCount(val)}
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
              );
            })()}
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
    paddingVertical: 10,
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
  searchBar: {
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
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionToggleAddActive: {
    backgroundColor: '#059669',
    borderColor: '#10b981',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  actionToggleRemoveActive: {
    backgroundColor: '#dc2626',
    borderColor: '#ef4444',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
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
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#0284c7',
    marginBottom: 12,
  },
  stepperChipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  stepperChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  stepperChipText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#f1f5f9',
    fontWeight: 'bold',
    fontSize: 14,
  },
  confirmBtn: {
    flex: 1.2,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
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
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    marginBottom: 10,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  saveRecipeBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Specification Chips & Details
  specChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 8,
  },
  plusPBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    alignSelf: 'center',
  },
  plusPBadgeText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  specTypeBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  specTypeBadgeText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  specChip: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  specChipText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  locationChip: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  locationChipText: {
    color: '#38bdf8',
    fontSize: 10.5,
    fontWeight: '600',
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    marginLeft: 8,
  },
  detailsBtnText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  modalStatBox: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  modalStatLabel: {
    color: '#64748b',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  modalStatVal: {
    color: '#f8fafc',
    fontSize: 13.5,
    fontWeight: 'bold',
  },
  modalSectionHeading: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  specsGrid: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 65, 85, 0.5)',
  },
  specRowLabel: {
    color: '#94a3b8',
    fontSize: 12,
  },
  specRowVal: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
  },
  presetSection: {
    marginTop: 12,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  presetChipActive: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  presetChipText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: '#38bdf8',
    fontWeight: '700',
  },
});
