import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useDialog } from '../../context/DialogContext';

interface ChecklistItem {
  id: string;
  label: string;
  category: 'firearm' | 'ammo' | 'magazines' | 'safety' | 'tools' | 'custom';
  packed: boolean;
  subtext?: string;
}

interface BagPreset {
  id: string;
  name: string;
  icon: string;
  description: string;
  defaultItems: string[];
}

const BAG_PRESETS: BagPreset[] = [
  {
    id: 'ccw_pistol',
    name: 'Pistol CCW Drills',
    icon: 'locate-outline',
    description: 'Concealed carry drills, holster draws & target transitions',
    defaultItems: ['IWB/OWB Holster', 'Magazine Pouches', 'Electronic Ear Pro (Check Batteries)', 'Safety Glasses', 'Target Pasters / Tape', 'Shot Timer', 'First Aid / Tourniquet']
  },
  {
    id: 'precision_rifle',
    name: 'Precision Rifle (Long Range)',
    icon: 'telescope-outline',
    description: 'Long-range benchrest & prone precision shooting',
    defaultItems: ['Rear Squeeze Bag', 'Bipod / Front Rest', 'Spotting Scope & Tripod', 'DOPE Card / Ballistics Solver', 'Action Torque Wrench', 'Chamber Flag', 'Chrono / Garmin']
  },
  {
    id: 'steel_challenge',
    name: 'Steel Challenge / Speed',
    icon: 'flash-outline',
    description: 'High-cadence speed shooting on steel plates',
    defaultItems: ['Speedloader / Mag UpLULA', '6+ Magazines per Gun', 'White Spray Paint for Steel', 'Safety Glasses (Extra Clear)', 'Double Ear Pro (Plugs + Muffs)', 'Cleaning Spray & Rag']
  },
  {
    id: 'outdoor_range',
    name: 'Outdoor / Air-Gapped Range',
    icon: 'trail-sign-outline',
    description: 'Public lands or outdoor range with no on-site facilities',
    defaultItems: ['Heavy-Duty Staple Gun + Staples', 'Paper Target Stands / Cardboard', 'Squib Rod & Brass Mallet', 'Trauma Kit / IFAK (Chest Seals, TQ)', 'Trash Bags', 'Multi-tool / Hex Keys']
  },
  {
    id: 'casual_plinking',
    name: 'Casual Plinking Day',
    icon: 'happy-outline',
    description: 'Fun weekend shooting with friends and family',
    defaultItems: ['Eye Protection (Extra sets)', 'Hearing Protection (Extra sets)', 'Reactive Splatter Targets', 'Wet Wipes / Lead Removal Wipes', 'Range Bag Padlock']
  }
];

export default function RangeChecklistScreen() {
  const router = useRouter();
  const { showToast, showConfirm } = useDialog();

  const [firearms, setFirearms] = useState<any[]>([]);
  const [ammoList, setAmmoList] = useState<any[]>([]);

  // Selected guns & allocated ammo
  const [selectedFirearmIds, setSelectedFirearmIds] = useState<number[]>([]);
  const [allocatedAmmo, setAllocatedAmmo] = useState<Record<number, number>>({}); // ammoId -> rounds to bring
  const [activePreset, setActivePreset] = useState<string>('ccw_pistol');
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newCustomItem, setNewCustomItem] = useState('');

  useEffect(() => {
    loadCachedInventory();
    loadSavedChecklist();
  }, []);

  const loadCachedInventory = async () => {
    try {
      const cacheStr = await AsyncStorage.getItem('inventory_cache');
      if (cacheStr) {
        const cache = JSON.parse(cacheStr);
        setFirearms(cache.firearms || []);
        setAmmoList(cache.ammo || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadSavedChecklist = async () => {
    try {
      const savedStr = await AsyncStorage.getItem('range_prep_checklist');
      if (savedStr) {
        const data = JSON.parse(savedStr);
        if (data.items) setItems(data.items);
        if (data.selectedFirearmIds) setSelectedFirearmIds(data.selectedFirearmIds);
        if (data.allocatedAmmo) setAllocatedAmmo(data.allocatedAmmo);
        if (data.activePreset) setActivePreset(data.activePreset);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveChecklistState = async (newItems: ChecklistItem[], fIds = selectedFirearmIds, ammo = allocatedAmmo, preset = activePreset) => {
    try {
      const payload = {
        items: newItems,
        selectedFirearmIds: fIds,
        allocatedAmmo: ammo,
        activePreset: preset,
        updatedAt: new Date().toISOString()
      };
      await AsyncStorage.setItem('range_prep_checklist', JSON.stringify(payload));
    } catch (e) {
      console.error(e);
    }
  };

  // Toggle Gun Selection
  const toggleFirearm = (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const newSelected = selectedFirearmIds.includes(id)
      ? selectedFirearmIds.filter(fId => fId !== id)
      : [...selectedFirearmIds, id];
    
    setSelectedFirearmIds(newSelected);
    rebuildChecklist(newSelected, allocatedAmmo, activePreset);
  };

  // Update Ammo Allocation
  const setAmmoRounds = (ammoId: number, rounds: number) => {
    const updated = { ...allocatedAmmo, [ammoId]: Math.max(0, rounds) };
    setAllocatedAmmo(updated);
    rebuildChecklist(selectedFirearmIds, updated, activePreset);
  };

  // Rebuild Checklist based on selected guns, ammo, and active preset
  const rebuildChecklist = (fIds: number[], ammoMap: Record<number, number>, presetId: string) => {
    const existingPackedMap = new Map(items.map(i => [i.id, i.packed]));
    const newItems: ChecklistItem[] = [];

    // 1. Firearms
    fIds.forEach(id => {
      const f = firearms.find(g => g.id === id);
      if (f) {
        const itemId = `gun_${f.id}`;
        newItems.push({
          id: itemId,
          label: `${f.make} ${f.model}`,
          category: 'firearm',
          packed: existingPackedMap.get(itemId) || false,
          subtext: `Caliber: ${f.caliber} • S/N: ${f.serial_number || 'N/A'}`
        });

        // Add matching magazine suggestion
        const magId = `mag_${f.id}`;
        newItems.push({
          id: magId,
          label: `Magazines for ${f.make} ${f.model}`,
          category: 'magazines',
          packed: existingPackedMap.get(magId) || false,
          subtext: `Recommend 3-5 loaded magazines`
        });
      }
    });

    // 2. Allocated Ammunition
    Object.entries(ammoMap).forEach(([ammoIdStr, count]) => {
      if (count > 0) {
        const a = ammoList.find(lot => String(lot.id) === ammoIdStr);
        if (a) {
          const itemId = `ammo_${a.id}`;
          newItems.push({
            id: itemId,
            label: `${count} rds • ${a.manufacturer || ''} ${a.caliber}`,
            category: 'ammo',
            packed: existingPackedMap.get(itemId) || false,
            subtext: `${a.grain ? `${a.grain}gr ` : ''}${a.projectile || ''} (In Vault: ${a.count} rds)`
          });
        }
      }
    });

    // 3. Preset Gear Items
    const preset = BAG_PRESETS.find(p => p.id === presetId) || BAG_PRESETS[0];
    preset.defaultItems.forEach((gear, idx) => {
      const itemId = `gear_${presetId}_${idx}`;
      newItems.push({
        id: itemId,
        label: gear,
        category: 'safety',
        packed: existingPackedMap.get(itemId) || false
      });
    });

    // 4. Preserve existing custom items
    items.filter(i => i.category === 'custom').forEach(c => {
      newItems.push(c);
    });

    setItems(newItems);
    saveChecklistState(newItems, fIds, ammoMap, presetId);
  };

  const toggleItemPacked = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const updated = items.map(i => i.id === id ? { ...i, packed: !i.packed } : i);
    setItems(updated);
    saveChecklistState(updated);
  };

  const addCustomItem = () => {
    if (!newCustomItem.trim()) return;
    const newItem: ChecklistItem = {
      id: `custom_${Date.now()}`,
      label: newCustomItem.trim(),
      category: 'custom',
      packed: false
    };
    const updated = [...items, newItem];
    setItems(updated);
    setNewCustomItem('');
    saveChecklistState(updated);
    showToast({ message: `Added "${newItem.label}"`, type: 'success', durationMs: 1500 });
  };

  const removeCustomItem = (id: string) => {
    const updated = items.filter(i => i.id !== id);
    setItems(updated);
    saveChecklistState(updated);
  };

  const handleResetChecklist = () => {
    showConfirm({
      title: 'Reset Range Bag?',
      message: 'This will uncheck all packed items and reset your gear list.',
      confirmText: 'Reset Bag',
      type: 'danger',
      onConfirm: async () => {
        const resetItems = items.map(i => ({ ...i, packed: false }));
        setItems(resetItems);
        saveChecklistState(resetItems);
        showToast({ message: 'Range bag checklist reset', type: 'info' });
      }
    });
  };

  const handleApplyPreset = (presetId: string) => {
    setActivePreset(presetId);
    rebuildChecklist(selectedFirearmIds, allocatedAmmo, presetId);
    showToast({ message: `Applied "${BAG_PRESETS.find(p => p.id === presetId)?.name}"`, type: 'info' });
  };

  // Compute matching ammo for selected guns
  const relevantAmmoList = useMemo(() => {
    if (selectedFirearmIds.length === 0) return [];
    const selectedGuns = firearms.filter(f => selectedFirearmIds.includes(f.id));
    const selectedCalibers = selectedGuns.map(g => (g.caliber || '').toLowerCase().replace(/[^a-z0-9]/g, ''));
    
    return ammoList.filter(a => {
      if (!a.caliber) return false;
      const cleanCal = a.caliber.toLowerCase().replace(/[^a-z0-9]/g, '');
      return selectedCalibers.some(sc => cleanCal.includes(sc) || sc.includes(cleanCal));
    });
  }, [selectedFirearmIds, firearms, ammoList]);

  // Packing Progress
  const totalItems = items.length;
  const packedCount = items.filter(i => i.packed).length;
  const progressPct = totalItems > 0 ? Math.round((packedCount / totalItems) * 100) : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Packing Progress Header Card */}
      <View style={styles.progressCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <View>
            <Text style={styles.progressTitle}>Range Bag Packing Status</Text>
            <Text style={styles.progressSubtitle}>{packedCount} of {totalItems} items packed ({progressPct}%)</Text>
          </View>
          {totalItems > 0 && (
            <Pressable style={styles.resetBtn} onPress={handleResetChecklist}>
              <Ionicons name="refresh" size={16} color="#94a3b8" />
            </Pressable>
          )}
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progressPct}%`, backgroundColor: progressPct === 100 ? '#10b981' : '#38bdf8' }]} />
        </View>
      </View>

      {/* 1. Firearm Selection */}
      <Text style={styles.sectionHeader}>1. Select Firearms to Bring ({selectedFirearmIds.length})</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalRow}>
        {firearms.map(f => {
          const isSelected = selectedFirearmIds.includes(f.id);
          return (
            <Pressable
              key={f.id}
              style={[styles.gunCard, isSelected && styles.gunCardActive]}
              onPress={() => toggleFirearm(f.id)}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.gunMake}>{f.make}</Text>
                <Ionicons 
                  name={isSelected ? "checkbox" : "square-outline"} 
                  size={20} 
                  color={isSelected ? "#10b981" : "#64748b"} 
                />
              </View>
              <Text style={styles.gunModel}>{f.model}</Text>
              <View style={styles.caliberBadge}>
                <Text style={styles.caliberBadgeText}>{f.caliber}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* 2. Ammo Allocation */}
      {relevantAmmoList.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.sectionHeader}>2. Allocate Ammunition Boxes</Text>
          {relevantAmmoList.map(ammo => {
            const count = allocatedAmmo[ammo.id] || 0;
            return (
              <View key={ammo.id} style={styles.ammoRowCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ammoLotName}>
                    {ammo.manufacturer} {ammo.caliber}
                  </Text>
                  <Text style={styles.ammoLotDesc}>
                    {ammo.grain ? `${ammo.grain}gr ` : ''}{ammo.projectile || ''} • In Vault: {ammo.count} rds
                  </Text>
                </View>

                {/* Round Steppers */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Pressable 
                    style={styles.stepperBtn} 
                    onPress={() => setAmmoRounds(ammo.id, count - 50)}
                  >
                    <Text style={styles.stepperBtnText}>-50</Text>
                  </Pressable>

                  <TextInput
                    style={styles.roundsInput}
                    keyboardType="numeric"
                    value={String(count)}
                    onChangeText={(val) => setAmmoRounds(ammo.id, parseInt(val) || 0)}
                  />

                  <Pressable 
                    style={styles.stepperBtn} 
                    onPress={() => setAmmoRounds(ammo.id, count + 50)}
                  >
                    <Text style={styles.stepperBtnText}>+50</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* 3. Range Bag Preset Selector */}
      <Text style={styles.sectionHeader}>3. Range Discipline Preset</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalRow}>
        {BAG_PRESETS.map(preset => {
          const isActive = activePreset === preset.id;
          return (
            <Pressable
              key={preset.id}
              style={[styles.presetCard, isActive && styles.presetCardActive]}
              onPress={() => handleApplyPreset(preset.id)}
            >
              <Ionicons 
                name={preset.icon as any} 
                size={22} 
                color={isActive ? "#38bdf8" : "#94a3b8"} 
                style={{ marginBottom: 6 }} 
              />
              <Text style={[styles.presetName, isActive && styles.presetNameActive]}>{preset.name}</Text>
              <Text style={styles.presetDesc} numberOfLines={2}>{preset.description}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* 4. Complete Packing Checklist */}
      <Text style={styles.sectionHeader}>4. Interactive Packing Checklist ({packedCount}/{totalItems})</Text>
      
      {items.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="bag-check-outline" size={48} color="#475569" style={{ marginBottom: 8 }} />
          <Text style={{ color: '#94a3b8', textAlign: 'center' }}>
            Select firearms above to automatically generate your packing checklist!
          </Text>
        </View>
      ) : (
        items.map(item => (
          <Pressable
            key={item.id}
            style={[styles.checklistItem, item.packed && styles.checklistItemPacked]}
            onPress={() => toggleItemPacked(item.id)}
          >
            <Ionicons 
              name={item.packed ? "checkbox" : "square-outline"} 
              size={22} 
              color={item.packed ? "#10b981" : "#64748b"} 
              style={{ marginRight: 12 }} 
            />

            <View style={{ flex: 1 }}>
              <Text style={[styles.itemLabel, item.packed && styles.itemLabelPacked]}>
                {item.label}
              </Text>
              {item.subtext && (
                <Text style={styles.itemSubtext}>{item.subtext}</Text>
              )}
            </View>

            {item.category === 'custom' && (
              <Pressable onPress={() => removeCustomItem(item.id)} style={{ padding: 4 }}>
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
              </Pressable>
            )}
          </Pressable>
        ))
      )}

      {/* Add Custom Item Input */}
      <View style={styles.customItemRow}>
        <TextInput
          style={styles.customInput}
          placeholder="Add custom item (e.g. staple gun, tool kit)..."
          placeholderTextColor="#64748b"
          value={newCustomItem}
          onChangeText={setNewCustomItem}
        />
        <Pressable style={styles.addBtn} onPress={addCustomItem}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </Pressable>
      </View>

      {/* 1-Tap Launch Range Session */}
      <Pressable 
        style={styles.launchRangeBtn} 
        onPress={() => {
          if (selectedFirearmIds.length > 0) {
            router.push({
              pathname: '/range',
              params: { firearmId: String(selectedFirearmIds[0]) }
            });
          } else {
            router.push('/range');
          }
        }}
      >
        <Ionicons name="flame" size={20} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.launchRangeBtnText}>Start Range Trip Now →</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  progressCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  progressTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 2,
  },
  resetBtn: {
    backgroundColor: '#0f172a',
    padding: 8,
    borderRadius: 6,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#0f172a',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  sectionHeader: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  horizontalRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  gunCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    width: 170,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  gunCardActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10b981',
  },
  gunMake: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  gunModel: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: 'bold',
    marginVertical: 4,
  },
  caliberBadge: {
    backgroundColor: '#0f172a',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  caliberBadgeText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600',
  },
  ammoRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  ammoLotName: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: 'bold',
  },
  ammoLotDesc: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  stepperBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  stepperBtnText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: 'bold',
  },
  roundsInput: {
    backgroundColor: '#0f172a',
    color: '#fff',
    width: 50,
    textAlign: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    width: 160,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetCardActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: '#38bdf8',
  },
  presetName: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: 'bold',
  },
  presetNameActive: {
    color: '#38bdf8',
  },
  presetDesc: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 14,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  checklistItemPacked: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: '#10b981',
  },
  itemLabel: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  itemLabelPacked: {
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  itemSubtext: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
  },
  customItemRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 20,
  },
  customInput: {
    flex: 1,
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 13,
  },
  addBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 8,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  launchRangeBtn: {
    flexDirection: 'row',
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  launchRangeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
