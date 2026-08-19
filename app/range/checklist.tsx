import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
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

export interface BagPreset {
  id: string;
  name: string;
  icon: string;
  description: string;
  defaultItems: string[];
  isCustom?: boolean;
}

export const BUILTIN_PRESETS: BagPreset[] = [
  {
    id: 'ccw_pistol',
    name: 'Pistol CCW Drills',
    icon: 'locate-outline',
    description: 'Concealed carry drills, holster draws & target transitions',
    defaultItems: [
      'IWB/OWB Holster',
      'Magazine / Speedloader Pouches',
      'Electronic Ear Pro (Check Batteries)',
      'Safety Glasses (Clear / Smoke)',
      'Target Pasters / Masking Tape',
      'Shot Timer / App Timer',
      'First Aid / Tourniquet (IFAK)'
    ]
  },
  {
    id: 'practical_pistol',
    name: 'USPSA / IDPA Match',
    icon: 'trophy-outline',
    description: 'Practical shooting competition rig & high-cadence stages',
    defaultItems: [
      'Competition Belt Rig & Holster',
      '4-5x Mag Pouches',
      'Mag Brush & Cleaning Rag',
      'Speedloader / Mag UpLULA',
      'Target Pasters & Overlay Gauge',
      'Gun Lube (Lucas / Slip2000)',
      'Electronic Ear Pro & Spare AAA Batteries'
    ]
  },
  {
    id: 'precision_rifle',
    name: 'Precision Rifle (Long Range)',
    icon: 'telescope-outline',
    description: 'Long-range benchrest, PRS & prone precision shooting',
    defaultItems: [
      'Rear Squeeze Bag / Sandbag',
      'Bipod / Front Rest',
      'Spotting Scope & Tripod',
      'DOPE Card / Ballistics Solver',
      'Action Torque Wrench & Hex Bit Set',
      'Chamber Safety Flag',
      'Chronograph / Radar (Garmin/LabRadar)',
      'Optics Lens Pen & Microfiber Cloth'
    ]
  },
  {
    id: 'defensive_carbine',
    name: 'Defensive Carbine / 2-Gun',
    icon: 'shield-outline',
    description: 'Tactical carbine & multi-gun dynamic transition drills',
    defaultItems: [
      '2-Point Quick-Adjust Sling',
      'Chest Rig / Battle Belt',
      'Weaponlight Spare CR123/18650 Batteries',
      'Chamber Safety Flags',
      'Dump Pouch for Empties',
      'Sight Adjustment Tool / A2 Front Post Tool',
      'Trauma Kit (Chest Seals, TQ, Hemostatic Gauze)'
    ]
  },
  {
    id: 'steel_challenge',
    name: 'Steel Challenge / Speed',
    icon: 'flash-outline',
    description: 'High-cadence speed shooting on steel plates & racks',
    defaultItems: [
      'Speedloader / Mag UpLULA',
      '6+ Loaded Magazines per Gun',
      'White Spray Paint for Steel Targets',
      'Safety Glasses (Extra Clear Anti-Fog)',
      'Double Ear Pro (Plugs + Electronic Muffs)',
      'Cleaning Spray, Oil & Microfiber Rag'
    ]
  },
  {
    id: 'clay_trap',
    name: 'Clay & Trap / Skeet',
    icon: 'disc-outline',
    description: 'Shotgun clays, skeet fields, and sporting clays courses',
    defaultItems: [
      'Shotgun Shell Pouch / Shooting Vest',
      'Choke Tubes & Choke Wrench',
      'Barrel Rest Magnetic Pad',
      'Slip-On Recoil Pad',
      'Eye Protection (Amber/High-Contrast Tint)',
      'Shotgun Bore Snake & Gun Oil'
    ]
  },
  {
    id: 'suppressed_night',
    name: 'Suppressed & Low-Light',
    icon: 'moon-outline',
    description: 'Silencer shooting, heat mitigation, and low-light sessions',
    defaultItems: [
      'Suppressor Heat Wrap / Silicone Cover',
      'Anti-Seize / High-Temp Thread Compound',
      'Thread Protectors & Suppressor Spanner Wrench',
      'Thermal / IR Glow Sticks / Handheld White Light',
      'Spare Weaponlight & Optic Batteries (CR123A, CR2032)',
      'Clear Anti-Fog Eye Protection'
    ]
  },
  {
    id: 'outdoor_range',
    name: 'Outdoor / Public Lands',
    icon: 'trail-sign-outline',
    description: 'Public BLM/state lands or outdoor range with no facilities',
    defaultItems: [
      'Heavy-Duty Staple Gun + Extra Box of Staples',
      'Paper Target Stands / Cardboard Backers',
      'Squib Rod & Brass Mallet',
      'Trauma Kit / IFAK (Chest Seals, TQ, Combat Gauze)',
      'Heavy Contractor Trash Bags (Leave No Trace)',
      'Multi-tool / Allen & Torx Key Set'
    ]
  },
  {
    id: 'youth_novice',
    name: 'Youth & Novice Training',
    icon: 'school-outline',
    description: 'New shooter orientation, firearms safety, and fundamentals',
    defaultItems: [
      'Compact / Youth-Sized Hearing Protection',
      'Extra Clear Safety Glasses (Small Fit)',
      'Reactive Splatter & High-Visibility Targets',
      'Chamber Safety Flags (Neon Orange)',
      'D-Lead / Lead Removal Hand Wipes',
      'Basic First Aid Kit & Bandages'
    ]
  },
  {
    id: 'casual_plinking',
    name: 'Casual Plinking Day',
    icon: 'happy-outline',
    description: 'Fun weekend plinking with friends, rimfire, and family',
    defaultItems: [
      'Eye Protection (Extra sets for guests)',
      'Hearing Protection (Extra sets for guests)',
      'Reactive Splatter Targets & Pasters',
      'Wet Wipes / Lead Removal Wipes',
      'Range Bag Padlock & Key'
    ]
  }
];

const PRESET_ICONS = [
  'trophy-outline',
  'locate-outline',
  'flash-outline',
  'telescope-outline',
  'shield-outline',
  'disc-outline',
  'moon-outline',
  'trail-sign-outline',
  'happy-outline',
  'flame-outline',
  'construct-outline',
  'bag-check-outline'
];

/**
 * Intelligent Feeding Classification Engine
 * Analyzes firearm make, model, type, action, and caliber to suggest the exact correct
 * loading accessory (e.g. speedloaders, en bloc clips, stripper clips, shell pouches,
 * possibles bags, stock cuffs) rather than blindly suggesting detachable magazines.
 */
function getFirearmFeedingSuggestion(f: any): { label: string; subtext: string; category: 'magazines' | 'tools' } {
  const combined = `${f.type || ''} ${f.action || ''} ${f.actionType || ''} ${f.make || ''} ${f.model || ''} ${f.caliber || ''}`.toLowerCase();
  const make = (f.make || '').toLowerCase();
  const model = (f.model || '').toLowerCase();
  const cal = (f.caliber || '').toLowerCase();

  // 1. Revolvers
  const isRevolver = combined.includes('revolver') || 
    combined.includes('wheelgun') || 
    combined.includes('single action army') || 
    combined.includes(' saa') || 
    model.includes('python') || 
    model.includes('anaconda') || 
    model.includes('king cobra') || 
    model.includes('gp100') || 
    model.includes('sp101') || 
    model.includes('blackhawk') || 
    model.includes('redhawk') || 
    model.includes('vaquero') || 
    model.includes('wrangler') || 
    model.includes('rough rider') || 
    model.includes('686') || 
    model.includes('586') || 
    model.includes('629') || 
    model.includes('642') || 
    model.includes('442') || 
    model.includes('judge') || 
    model.includes('governor') || 
    model.includes('j-frame') || 
    model.includes('k-frame') || 
    model.includes('l-frame') || 
    model.includes('n-frame');

  if (isRevolver) {
    return {
      label: `Speedloaders / Moon Clips for ${f.make} ${f.model}`,
      subtext: 'Recommend 2-3 loaded speedloaders, moon clips, or speed strips',
      category: 'tools'
    };
  }

  // 2. Muzzleloaders & Black Powder
  const isMuzzleloader = combined.includes('muzzleloader') || 
    combined.includes('black powder') || 
    combined.includes('percussion') || 
    combined.includes('flintlock') || 
    make.includes('cva') || 
    make.includes('traditions') || 
    make.includes('knight') || 
    model.includes('optima') || 
    model.includes('wolf') || 
    model.includes('accura');

  if (isMuzzleloader) {
    return {
      label: `Possibles Bag & Muzzleloader Kit for ${f.make} ${f.model}`,
      subtext: 'Powder charges, 209 primers/caps, sabots/balls, short starter & nipple wrench',
      category: 'tools'
    };
  }

  // 3. Single-Shot & Break-Action Rifles/Pistols
  const isSingleShot = combined.includes('single shot') || 
    combined.includes('single-shot') || 
    combined.includes('break action') || 
    combined.includes('break-action') || 
    combined.includes('falling block') || 
    combined.includes('rolling block') || 
    model.includes('contender') || 
    model.includes('encore') || 
    model.includes('handi-rifle') || 
    model.includes('sharps') || 
    model.includes('scout v2') || 
    model.includes('outfitter');

  if (isSingleShot) {
    return {
      label: `Cartridge Belt / Stock Ammo Cuff for ${f.make} ${f.model}`,
      subtext: 'Elastic buttstock ammo carrier or bench cartridge block (single-shot)',
      category: 'tools'
    };
  }

  // 4. Break-Action Shotguns (Over/Under, Side-by-Side, Single Barrel)
  const isBreakActionShotgun = combined.includes('over/under') || 
    combined.includes('over under') || 
    combined.includes('side by side') || 
    combined.includes('side-by-side') || 
    combined.includes('sxs') || 
    combined.includes('o/u') || 
    model.includes('citori') || 
    model.includes('silver pigeon') || 
    model.includes('red label') || 
    model.includes('condor') || 
    model.includes('silver reserve');

  if (isBreakActionShotgun) {
    return {
      label: `Shotgun Shell Pouch / Vest for ${f.make} ${f.model}`,
      subtext: 'Waist shell pouch for 25-50 hulls (break-action shotgun)',
      category: 'tools'
    };
  }

  // 5. Tube-Fed Shotguns (Mossberg 500/590, Rem 870, Benelli M4/M2, Beretta 1301/A300, etc.)
  const isShotgun = combined.includes('shotgun') || 
    f.type?.toLowerCase() === 'shotgun' || 
    cal.includes('12 ga') || 
    cal.includes('12 gauge') || 
    cal.includes('20 ga') || 
    cal.includes('20 gauge') || 
    cal.includes('.410') || 
    cal.includes('16 ga') || 
    cal.includes('28 ga');

  const isMagFedShotgun = combined.includes('saiga') || 
    combined.includes('vr80') || 
    combined.includes('origin 12') || 
    combined.includes('ks-12') || 
    combined.includes('lynx') || 
    combined.includes('typhoon') || 
    combined.includes('mag-fed') || 
    combined.includes('box mag');

  if (isShotgun && !isMagFedShotgun) {
    return {
      label: `Shell Carrier / Side Saddle for ${f.make} ${f.model}`,
      subtext: 'Elastic shell card, match saver, or dump pouch (tube-fed shotgun)',
      category: 'tools'
    };
  }

  // 6. Lever-Action Rifles (Tube-Fed)
  const isLeverAction = combined.includes('lever action') || 
    combined.includes('lever-action') || 
    combined.includes('lever') || 
    model.includes('336') || 
    model.includes('1895') || 
    model.includes('1894') || 
    model.includes('big boy') || 
    model.includes('golden boy') || 
    model.includes('all-weather') || 
    model.includes('model 94') || 
    model.includes('1894') || 
    model.includes('r92');

  if (isLeverAction) {
    return {
      label: `Stock Ammo Sleeve / Ammo Wallet for ${f.make} ${f.model}`,
      subtext: 'Leather stock cuff or cartridge carrier (tube-fed lever action)',
      category: 'tools'
    };
  }

  // 7. En Bloc Clip Rifles (M1 Garand)
  if (model.includes('garand') || model.includes('m1 ')) {
    return {
      label: `En Bloc Clips for ${f.make} ${f.model}`,
      subtext: 'Recommend 4-8 loaded 8-round en bloc clips',
      category: 'tools'
    };
  }

  // 8. Stripper Clip Surplus Rifles (SKS, Mosin, Mauser, Enfield)
  const isStripperClip = model.includes('sks') || 
    model.includes('mosin') || 
    model.includes('nagant') || 
    model.includes('mauser') || 
    model.includes('k98') || 
    model.includes('kar98') || 
    model.includes('enfield') || 
    model.includes('1903') || 
    model.includes('k31');

  if (isStripperClip) {
    return {
      label: `Stripper Clips for ${f.make} ${f.model}`,
      subtext: 'Recommend 4-6 loaded 5/10-round stripper clips',
      category: 'tools'
    };
  }

  // 9. Default Detachable Magazine Firearms (Semi-Auto, AR, AK, Glock, Sig, AICS Bolt Action, etc.)
  return {
    label: `Magazines for ${f.make} ${f.model}`,
    subtext: 'Recommend 3-5 loaded magazines',
    category: 'magazines'
  };
}

export default function RangeChecklistScreen() {
  const router = useRouter();
  const { showToast, showConfirm } = useDialog();

  const [firearms, setFirearms] = useState<any[]>([]);
  const [ammoList, setAmmoList] = useState<any[]>([]);

  // Selected guns & allocated ammo
  const [selectedFirearmIds, setSelectedFirearmIds] = useState<number[]>([]);
  const [allocatedAmmo, setAllocatedAmmo] = useState<Record<number, number>>({}); // ammoId -> rounds to bring
  const [activePreset, setActivePreset] = useState<string>('ccw_pistol');
  const [customPresets, setCustomPresets] = useState<BagPreset[]>([]);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newCustomItem, setNewCustomItem] = useState('');

  // Custom Preset Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [presetModalName, setPresetModalName] = useState('');
  const [presetModalDesc, setPresetModalDesc] = useState('');
  const [presetModalIcon, setPresetModalIcon] = useState('trophy-outline');
  const [presetModalItems, setPresetModalItems] = useState<string[]>([]);
  const [newPresetItemInput, setNewPresetItemInput] = useState('');

  useEffect(() => {
    loadCachedInventory();
    loadCustomPresets();
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

  const loadCustomPresets = async () => {
    try {
      const saved = await AsyncStorage.getItem('custom_range_bag_presets');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCustomPresets(parsed);
        }
      }
    } catch (e) {
      console.error('Error loading custom presets', e);
    }
  };

  const saveCustomPresets = async (updated: BagPreset[]) => {
    try {
      setCustomPresets(updated);
      await AsyncStorage.setItem('custom_range_bag_presets', JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving custom presets', e);
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

  // Combined presets list (Built-in + Custom)
  const allPresets = useMemo(() => {
    return [...BUILTIN_PRESETS, ...customPresets];
  }, [customPresets]);

  // Toggle Gun Selection
  const toggleFirearm = (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const newSelected = selectedFirearmIds.includes(id)
      ? selectedFirearmIds.filter(fId => fId !== id)
      : [...selectedFirearmIds, id];
    
    setSelectedFirearmIds(newSelected);
    rebuildChecklist(newSelected, allocatedAmmo, activePreset);
  };

  // Reset / Clear all selected firearms in 1 tap
  const handleClearFirearms = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedFirearmIds([]);
    setAllocatedAmmo({});
    rebuildChecklist([], {}, activePreset);
    showToast({ message: 'Deselected all firearms', type: 'info' });
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

    // 1. Firearms & Caliber-Accurate Feeding Gear (No Blind Magazine Suggestions)
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

        // Smart feeding suggestion (Speedloaders for revolvers, clips for surplus, shell carrier for shotguns, etc.)
        const feeding = getFirearmFeedingSuggestion(f);
        const feedingId = `feed_${f.id}`;
        newItems.push({
          id: feedingId,
          label: feeding.label,
          category: feeding.category,
          packed: existingPackedMap.get(feedingId) || false,
          subtext: feeding.subtext
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
    const preset = allPresets.find(p => p.id === presetId) || allPresets[0];
    if (preset) {
      preset.defaultItems.forEach((gear, idx) => {
        const itemId = `gear_${presetId}_${idx}`;
        newItems.push({
          id: itemId,
          label: gear,
          category: 'safety',
          packed: existingPackedMap.get(itemId) || false
        });
      });
    }

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
      message: 'Do you want to reset all packed item checkboxes, or clear all firearms and reset everything?',
      confirmText: 'Reset Everything',
      cancelText: 'Uncheck Items Only',
      type: 'danger',
      onConfirm: async () => {
        setSelectedFirearmIds([]);
        setAllocatedAmmo({});
        rebuildChecklist([], {}, activePreset);
        showToast({ message: 'Range bag completely reset', type: 'info' });
      },
      onCancel: async () => {
        const resetItems = items.map(i => ({ ...i, packed: false }));
        setItems(resetItems);
        saveChecklistState(resetItems);
        showToast({ message: 'Unchecked all items', type: 'info' });
      }
    });
  };

  const handleApplyPreset = (presetId: string) => {
    setActivePreset(presetId);
    rebuildChecklist(selectedFirearmIds, allocatedAmmo, presetId);
    const p = allPresets.find(pr => pr.id === presetId);
    showToast({ message: `Applied "${p?.name || 'Preset'}"`, type: 'info' });
  };

  // Open Custom Preset Creator Modal
  const openNewPresetModal = () => {
    setPresetModalName('');
    setPresetModalDesc('');
    setPresetModalIcon('trophy-outline');
    setPresetModalItems(['Eye Protection', 'Hearing Protection', 'Target Pasters', 'Gun Oil & Rag']);
    setNewPresetItemInput('');
    setIsModalVisible(true);
  };

  // Add Item to Preset Modal
  const handleAddModalItem = () => {
    if (!newPresetItemInput.trim()) return;
    setPresetModalItems([...presetModalItems, newPresetItemInput.trim()]);
    setNewPresetItemInput('');
  };

  // Remove Item from Preset Modal
  const handleRemoveModalItem = (index: number) => {
    setPresetModalItems(presetModalItems.filter((_, idx) => idx !== index));
  };

  // Save Custom Preset
  const handleSaveCustomPreset = () => {
    if (!presetModalName.trim()) {
      showToast({ message: 'Please enter a preset name', type: 'error' });
      return;
    }
    if (presetModalItems.length === 0) {
      showToast({ message: 'Add at least one gear item to this preset', type: 'error' });
      return;
    }

    const newPreset: BagPreset = {
      id: `custom_${Date.now()}`,
      name: presetModalName.trim(),
      description: presetModalDesc.trim() || 'Custom user range gear configuration',
      icon: presetModalIcon,
      defaultItems: presetModalItems,
      isCustom: true
    };

    const updated = [...customPresets, newPreset];
    saveCustomPresets(updated);
    setIsModalVisible(false);
    setActivePreset(newPreset.id);
    rebuildChecklist(selectedFirearmIds, allocatedAmmo, newPreset.id);
    showToast({ message: `Saved custom preset "${newPreset.name}"`, type: 'success' });
  };

  // Delete Custom Preset
  const handleDeleteCustomPreset = (presetId: string) => {
    const target = customPresets.find(p => p.id === presetId);
    if (!target) return;

    showConfirm({
      title: 'Delete Custom Preset?',
      message: `Are you sure you want to delete "${target.name}"? This cannot be undone.`,
      confirmText: 'Delete Preset',
      type: 'danger',
      onConfirm: async () => {
        const updated = customPresets.filter(p => p.id !== presetId);
        await saveCustomPresets(updated);
        if (activePreset === presetId) {
          setActivePreset(BUILTIN_PRESETS[0].id);
          rebuildChecklist(selectedFirearmIds, allocatedAmmo, BUILTIN_PRESETS[0].id);
        }
        showToast({ message: `Deleted "${target.name}"`, type: 'info' });
      }
    });
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
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeader}>1. Select Firearms to Bring ({selectedFirearmIds.length})</Text>
        {selectedFirearmIds.length > 0 && (
          <Pressable style={styles.clearGunsBtn} onPress={handleClearFirearms}>
            <Ionicons name="close-circle-outline" size={14} color="#f87171" style={{ marginRight: 4 }} />
            <Text style={styles.clearGunsBtnText}>Reset Guns</Text>
          </Pressable>
        )}
      </View>

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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Text style={[styles.sectionHeader, { marginBottom: 0 }]}>3. Range Discipline Preset</Text>
        <Pressable style={styles.newPresetBtn} onPress={openNewPresetModal}>
          <Ionicons name="add" size={14} color="#38bdf8" style={{ marginRight: 4 }} />
          <Text style={styles.newPresetBtnText}>New Custom</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalRow}>
        {allPresets.map(preset => {
          const isActive = activePreset === preset.id;
          return (
            <Pressable
              key={preset.id}
              style={[styles.presetCard, isActive && styles.presetCardActive]}
              onPress={() => handleApplyPreset(preset.id)}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Ionicons 
                  name={preset.icon as any} 
                  size={22} 
                  color={isActive ? "#38bdf8" : "#94a3b8"} 
                />
                {preset.isCustom && (
                  <Pressable 
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDeleteCustomPreset(preset.id);
                    }}
                    style={styles.deletePresetBtn}
                  >
                    <Ionicons name="trash-outline" size={14} color="#ef4444" />
                  </Pressable>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={[styles.presetName, isActive && styles.presetNameActive]}>{preset.name}</Text>
              </View>
              {preset.isCustom && (
                <View style={styles.customBadge}>
                  <Text style={styles.customBadgeText}>CUSTOM</Text>
                </View>
              )}
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

      {/* Create Custom Preset Modal */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="bag-add-outline" size={22} color="#38bdf8" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>New Custom Bag Preset</Text>
              </View>
              <Pressable onPress={() => setIsModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* Preset Name */}
              <Text style={styles.inputLabel}>Preset Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., 3-Gun Match, Benchrest Varmint..."
                placeholderTextColor="#64748b"
                value={presetModalName}
                onChangeText={setPresetModalName}
              />

              {/* Description */}
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Tactical shotgun, carbine, and match pistol gear"
                placeholderTextColor="#64748b"
                value={presetModalDesc}
                onChangeText={setPresetModalDesc}
              />

              {/* Icon Selector */}
              <Text style={styles.inputLabel}>Choose Icon</Text>
              <View style={styles.iconSelectorRow}>
                {PRESET_ICONS.map(ic => {
                  const isSelected = presetModalIcon === ic;
                  return (
                    <Pressable
                      key={ic}
                      style={[styles.iconChoice, isSelected && styles.iconChoiceSelected]}
                      onPress={() => setPresetModalIcon(ic)}
                    >
                      <Ionicons name={ic as any} size={20} color={isSelected ? '#38bdf8' : '#94a3b8'} />
                    </Pressable>
                  );
                })}
              </View>

              {/* Preset Items List */}
              <Text style={styles.inputLabel}>Default Gear Items ({presetModalItems.length})</Text>
              <View style={styles.modalItemsList}>
                {presetModalItems.map((gear, idx) => (
                  <View key={idx} style={styles.modalItemChip}>
                    <Text style={styles.modalItemChipText}>{gear}</Text>
                    <Pressable onPress={() => handleRemoveModalItem(idx)} style={{ padding: 2 }}>
                      <Ionicons name="close-circle" size={16} color="#ef4444" />
                    </Pressable>
                  </View>
                ))}
              </View>

              {/* Add Item Input */}
              <View style={styles.modalAddRow}>
                <TextInput
                  style={styles.modalAddInput}
                  placeholder="Add gear item (e.g. staple gun, shot timer)..."
                  placeholderTextColor="#64748b"
                  value={newPresetItemInput}
                  onChangeText={setNewPresetItemInput}
                  onSubmitEditing={handleAddModalItem}
                />
                <Pressable style={styles.modalAddBtn} onPress={handleAddModalItem}>
                  <Text style={styles.modalAddBtnText}>+ Add</Text>
                </Pressable>
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setIsModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSaveBtn} onPress={handleSaveCustomPreset}>
                <Text style={styles.modalSaveText}>Save Preset</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeader: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearGunsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  clearGunsBtnText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: 'bold',
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
  newPresetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  newPresetBtnText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  presetCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    width: 165,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetCardActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: '#38bdf8',
  },
  deletePresetBtn: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  presetName: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: 'bold',
    flex: 1,
  },
  presetNameActive: {
    color: '#38bdf8',
  },
  customBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    marginTop: 3,
    marginBottom: 2,
    borderWidth: 0.5,
    borderColor: '#a855f7',
  },
  customBadgeText: {
    color: '#c084fc',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
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
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: 'bold',
  },
  inputLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 14,
  },
  iconSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  iconChoice: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChoiceSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38bdf8',
  },
  modalItemsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  modalItemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 6,
  },
  modalItemChipText: {
    color: '#e2e8f0',
    fontSize: 12,
  },
  modalAddRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 10,
  },
  modalAddInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 13,
  },
  modalAddBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 8,
  },
  modalAddBtnText: {
    color: '#38bdf8',
    fontWeight: 'bold',
    fontSize: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  modalCancelText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: 'bold',
  },
  modalSaveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#10b981',
  },
  modalSaveText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  }
});
