import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { 
  FACTORY_BALLISTIC_PROFILES, 
  FactoryAmmoProfile, 
  STANDARD_ATMOSPHERE, 
  AtmosphericConditions, 
  calculateVelocityForBarrelLength,
  calculateDopeTable, 
  DopeEntry 
} from '../../utils/ballisticsEngine';
import { useDialog } from '../../context/DialogContext';

type CategoryFilter = 'all' | 'handgun' | 'rifle' | 'precision' | 'rimfire_shotgun';

export default function BallisticsScreen() {
  const router = useRouter();
  const { showToast, showSuccess } = useDialog();

  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedProfile, setSelectedProfile] = useState<FactoryAmmoProfile>(FACTORY_BALLISTIC_PROFILES[0]);
  
  // Handload Recipes from Storage
  const [recipesList, setRecipesList] = useState<any[]>([]);
  const [isRecipePickerOpen, setIsRecipePickerOpen] = useState(false);

  // Simple Mode Parameters
  const [actualBarrelLength, setActualBarrelLength] = useState<number>(
    FACTORY_BALLISTIC_PROFILES[0].testBarrelLengthInches
  );
  const [simpleZeroDist, setSimpleZeroDist] = useState<number>(100);
  const [simpleSightHeight, setSimpleSightHeight] = useState<number>(1.5);

  // Advanced Mode Inputs
  const [velocityInput, setVelocityInput] = useState('2650');
  const [weightInput, setWeightInput] = useState('168');
  const [bcInput, setBcInput] = useState('0.462');
  const [zeroInput, setZeroInput] = useState('100');
  const [sightHeightInput, setSightHeightInput] = useState('1.5');
  const [windSpeedInput, setWindSpeedInput] = useState('10');
  const [windAngleInput, setWindAngleInput] = useState('90');
  const [altitudeInput, setAltitudeInput] = useState('0');
  const [tempInput, setTempInput] = useState('59');
  const [inclineInput, setInclineInput] = useState('0');

  // Optic Turret Unit format ('moa' | 'mil')
  const [turretUnit, setTurretUnit] = useState<'moa' | 'mil'>('moa');

  useEffect(() => {
    loadSavedRecipes();
  }, []);

  const loadSavedRecipes = async () => {
    try {
      const savedStr = await AsyncStorage.getItem('reloading_recipes_cache');
      if (savedStr) {
        const parsed = JSON.parse(savedStr);
        if (Array.isArray(parsed)) setRecipesList(parsed);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filtered Profiles based on Category & Search
  const filteredProfiles = useMemo(() => {
    return FACTORY_BALLISTIC_PROFILES.filter(p => {
      const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
      if (!matchCat) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.caliber.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    });
  }, [categoryFilter, searchQuery]);

  // Real-time barrel adjusted velocity calculation
  const barrelVelocityMetrics = useMemo(() => {
    return calculateVelocityForBarrelLength(selectedProfile, actualBarrelLength);
  }, [selectedProfile, actualBarrelLength]);

  // Calculate DOPE Table based on active mode
  const dopeTable: DopeEntry[] = useMemo(() => {
    if (mode === 'simple') {
      return calculateDopeTable(
        barrelVelocityMetrics.adjustedVelocityFps,
        selectedProfile.bulletWeightGr,
        selectedProfile.ballisticCoefficientG1,
        simpleZeroDist,
        simpleSightHeight,
        STANDARD_ATMOSPHERE,
        600,
        50
      );
    } else {
      const vel = parseFloat(velocityInput) || 2600;
      const wt = parseFloat(weightInput) || 150;
      const bc = parseFloat(bcInput) || 0.400;
      const zero = parseFloat(zeroInput) || 100;
      const sh = parseFloat(sightHeightInput) || 1.5;

      const atm: AtmosphericConditions = {
        altitudeFt: parseFloat(altitudeInput) || 0,
        temperatureF: parseFloat(tempInput) || 59,
        barometricPressureInHg: 29.92,
        humidityPct: 50,
        windSpeedMph: parseFloat(windSpeedInput) || 0,
        windAngleDegrees: parseFloat(windAngleInput) || 90,
        inclineAngleDegrees: parseFloat(inclineInput) || 0
      };

      return calculateDopeTable(vel, wt, bc, zero, sh, atm, 800, 50);
    }
  }, [
    mode, 
    selectedProfile, 
    barrelVelocityMetrics,
    simpleZeroDist, 
    simpleSightHeight, 
    velocityInput, 
    weightInput, 
    bcInput, 
    zeroInput, 
    sightHeightInput, 
    windSpeedInput, 
    windAngleInput, 
    altitudeInput, 
    tempInput, 
    inclineInput
  ]);

  // Maximum Point Blank Range (MPBR) Calculation for 6" Vital Zone (+/- 3")
  const mpbrMetrics = useMemo(() => {
    const activeVel = mode === 'simple' ? barrelVelocityMetrics.adjustedVelocityFps : (parseFloat(velocityInput) || 2600);
    const activeBc = mode === 'simple' ? selectedProfile.ballisticCoefficientG1 : (parseFloat(bcInput) || 0.400);

    // Approximate MPBR for 6" target (3" maximum rise/fall)
    // Formula: MPBR ~ (Velocity / 10) * (BC ^ 0.35)
    const estNearZero = Math.round(25 + (activeVel / 200));
    const estFarZero = Math.round(180 + (activeVel / 35) * activeBc);
    const maxPbr = Math.round(estFarZero * 1.18);

    return {
      vitalZoneDiameterInches: 6,
      nearZeroYards: estNearZero,
      farZeroYards: estFarZero,
      maxPbrYards: maxPbr,
    };
  }, [mode, barrelVelocityMetrics, selectedProfile, velocityInput, bcInput]);

  const handleSelectFactoryProfile = (profile: FactoryAmmoProfile) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedProfile(profile);
    setActualBarrelLength(profile.testBarrelLengthInches);
    setSimpleZeroDist(profile.zeroDistanceYards);
    setSimpleSightHeight(profile.sightHeightInches);

    // Sync to advanced inputs
    setVelocityInput(String(profile.muzzleVelocityFps));
    setWeightInput(String(profile.bulletWeightGr));
    setBcInput(String(profile.ballisticCoefficientG1));
    setZeroInput(String(profile.zeroDistanceYards));
    setSightHeightInput(String(profile.sightHeightInches));
  };

  const handleSelectRecipe = (recipe: any) => {
    Haptics.selectionAsync().catch(() => {});
    if (recipe.avgVelocityFps) setVelocityInput(String(recipe.avgVelocityFps));
    if (recipe.bullet) {
      const matchGr = recipe.bullet.match(/(\d+)\s*gr/i);
      if (matchGr) setWeightInput(matchGr[1]);
    }
    setIsRecipePickerOpen(false);
    showToast({ message: `Imported recipe "${recipe.name}"`, type: 'info' });
  };

  const adjustBarrelLength = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const newVal = Math.max(1.0, Math.min(40.0, Number((actualBarrelLength + delta).toFixed(1))));
    setActualBarrelLength(newVal);
  };

  // Generate & Export Pocket DOPE Card PDF / Print
  const handleExportDopeCard = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const activeName = mode === 'simple' ? selectedProfile.name : 'Custom Ballistic Setup';
      const activeVel = mode === 'simple' ? barrelVelocityMetrics.adjustedVelocityFps : (velocityInput || '2650');
      const activeZero = mode === 'simple' ? simpleZeroDist : (zeroInput || '100');

      const rowsHtml = dopeTable.map(d => `
        <tr style="border-bottom: 1px solid #cbd5e1; text-align: center; font-size: 11px;">
          <td style="padding: 6px 8px; font-weight: bold; background: #f1f5f9;">${d.distanceYards} yd</td>
          <td style="padding: 6px 8px; color: ${d.dropInches < 0 ? '#b91c1c' : '#047857'}; font-weight: bold;">
            ${d.dropInches > 0 ? `+${d.dropInches.toFixed(1)}` : d.dropInches.toFixed(1)}"
          </td>
          <td style="padding: 6px 8px; font-weight: bold; color: #1e40af;">
            ${turretUnit === 'moa' ? `${d.elevationMoa.toFixed(1)} MOA` : `${d.elevationMil.toFixed(1)} MIL`}
          </td>
          <td style="padding: 6px 8px;">${d.velocityFps} fps</td>
          <td style="padding: 6px 8px;">${d.energyFtLbs} ft-lb</td>
          <td style="padding: 6px 8px; color: #64748b;">${d.windDriftInches.toFixed(1)}"</td>
        </tr>
      `).join('');

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>ArmoryVault DOPE Card - ${activeName}</title>
            <style>
              @page { size: letter portrait; margin: 15mm; }
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                color: #0f172a;
                margin: 0;
                padding: 0;
              }
              .card {
                border: 2px solid #0f172a;
                border-radius: 8px;
                padding: 12px;
                max-width: 600px;
                margin: 0 auto;
                background: #fff;
              }
              .header {
                text-align: center;
                border-bottom: 2px solid #0f172a;
                padding-bottom: 8px;
                margin-bottom: 10px;
              }
              .title {
                font-size: 15px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }
              .meta {
                font-size: 11px;
                color: #475569;
                margin-top: 4px;
                font-weight: 600;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 8px;
              }
              th {
                background: #0f172a;
                color: #fff;
                font-size: 10px;
                padding: 6px 8px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }
              .footer {
                text-align: center;
                font-size: 9px;
                color: #94a3b8;
                margin-top: 10px;
                border-top: 1px dashed #cbd5e1;
                padding-top: 6px;
              }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="header">
                <div class="title">${activeName}</div>
                <div class="meta">Muzzle Vel: ${activeVel} fps &bull; Zero: ${activeZero} yds &bull; MPBR: ${mpbrMetrics.maxPbrYards} yds (6" Vital Zone)</div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Range</th>
                    <th>Drop</th>
                    <th>Elev Dial</th>
                    <th>Velocity</th>
                    <th>Energy</th>
                    <th>10mph Drift</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
              <div class="footer">ArmoryVault Pocket DOPE Card &bull; Generated on ${new Date().toLocaleDateString()}</div>
            </div>
          </body>
        </html>
      `;

      await Print.printAsync({ html });
    } catch (e: any) {
      console.error('Error in handleExportDopeCard:', e);
      showToast({ message: 'Could not open print/export dialog', type: 'error' });
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Mode Switcher (Simple vs Advanced) */}
      <View style={styles.modeTabBar}>
        <Pressable 
          style={[styles.modeTab, mode === 'simple' && styles.modeTabActive]} 
          onPress={() => setMode('simple')}
        >
          <Ionicons name="flash-outline" size={15} color={mode === 'simple' ? '#38bdf8' : '#94a3b8'} style={{ marginRight: 6 }} />
          <Text style={[styles.modeTabText, mode === 'simple' && styles.modeTabTextActive]}>
            Factory Ammo Profiles
          </Text>
        </Pressable>

        <Pressable 
          style={[styles.modeTab, mode === 'advanced' && styles.modeTabActive]} 
          onPress={() => setMode('advanced')}
        >
          <Ionicons name="construct-outline" size={15} color={mode === 'advanced' ? '#38bdf8' : '#94a3b8'} style={{ marginRight: 6 }} />
          <Text style={[styles.modeTabText, mode === 'advanced' && styles.modeTabTextActive]}>
            Custom Solver
          </Text>
        </Pressable>
      </View>

      {/* Simple Mode: Factory Presets */}
      {mode === 'simple' && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>1. Select Commercial Load ({filteredProfiles.length})</Text>

          {/* Category Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {[
              { id: 'all', label: 'All Loads' },
              { id: 'handgun', label: 'Handgun & PCC' },
              { id: 'rifle', label: 'Carbine / 5.56' },
              { id: 'precision', label: 'Precision / PRS' },
              { id: 'rimfire_shotgun', label: 'Rimfire & Slugs' },
            ].map(cat => (
              <Pressable
                key={cat.id}
                style={[styles.catChip, categoryFilter === cat.id && styles.catChipActive]}
                onPress={() => setCategoryFilter(cat.id as CategoryFilter)}
              >
                <Text style={[styles.catChipText, categoryFilter === cat.id && styles.catChipTextActive]}>
                  {cat.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by caliber, bullet, or brand..."
              placeholderTextColor="#64748b"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Factory Loads Carousel */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.profileRow}>
            {filteredProfiles.map(p => {
              const isSelected = selectedProfile.id === p.id;
              return (
                <Pressable
                  key={p.id}
                  style={[styles.profileCard, isSelected && styles.profileCardActive]}
                  onPress={() => handleSelectFactoryProfile(p)}
                >
                  <Text style={styles.profileCaliber}>{p.caliber}</Text>
                  <Text style={styles.profileName} numberOfLines={2}>{p.name}</Text>
                  <View style={styles.profileMetaRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Ionicons name="flash-outline" size={11} color="#f59e0b" />
                      <Text style={styles.profileMetaText}>{p.muzzleVelocityFps} fps</Text>
                    </View>
                    <Text style={styles.profileMetaText}>G1: {p.ballisticCoefficientG1.toFixed(3)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Barrel Length Empirical Scaler */}
          <View style={styles.barrelScalerCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={styles.barrelScalerTitle}>Barrel Length Adjustment</Text>
                <Text style={styles.barrelScalerSub}>
                  Test Barrel: {selectedProfile.testBarrelLengthInches}" • Scaling: ±{selectedProfile.fpsPerInch} fps/in
                </Text>
              </View>
              <Text style={styles.barrelLengthValue}>{actualBarrelLength.toFixed(1)}"</Text>
            </View>

            {/* Stepper Buttons */}
            <View style={styles.barrelControlRow}>
              <Pressable style={styles.barrelStepBtn} onPress={() => adjustBarrelLength(-1)}>
                <Text style={styles.barrelStepText}>-1.0"</Text>
              </Pressable>
              <Pressable style={styles.barrelStepBtn} onPress={() => adjustBarrelLength(-0.5)}>
                <Text style={styles.barrelStepText}>-0.5"</Text>
              </Pressable>
              <Pressable 
                style={[styles.barrelStepBtn, { backgroundColor: 'rgba(56, 189, 248, 0.2)' }]} 
                onPress={() => setActualBarrelLength(selectedProfile.testBarrelLengthInches)}
              >
                <Text style={[styles.barrelStepText, { color: '#38bdf8' }]}>Reset</Text>
              </Pressable>
              <Pressable style={styles.barrelStepBtn} onPress={() => adjustBarrelLength(0.5)}>
                <Text style={styles.barrelStepText}>+0.5"</Text>
              </Pressable>
              <Pressable style={styles.barrelStepBtn} onPress={() => adjustBarrelLength(1)}>
                <Text style={styles.barrelStepText}>+1.0"</Text>
              </Pressable>
            </View>

            {/* Adjusted Velocity Banner */}
            <View style={styles.velocityBanner}>
              <Text style={styles.velocityBannerLabel}>Scaled Muzzle Velocity:</Text>
              <Text style={styles.velocityBannerVal}>
                {barrelVelocityMetrics.adjustedVelocityFps} fps ({barrelVelocityMetrics.velocityDeltaFps >= 0 ? `+${barrelVelocityMetrics.velocityDeltaFps}` : barrelVelocityMetrics.velocityDeltaFps} fps)
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Advanced Custom Mode */}
      {mode === 'advanced' && (
        <View style={styles.sectionCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={styles.sectionTitle}>Custom Ballistic Inputs</Text>
            {recipesList.length > 0 && (
              <Pressable style={styles.importRecipeBtn} onPress={() => setIsRecipePickerOpen(true)}>
                <Ionicons name="download-outline" size={14} color="#38bdf8" style={{ marginRight: 4 }} />
                <Text style={styles.importRecipeText}>Import Recipe</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.advInputGrid}>
            <View style={styles.advField}>
              <Text style={styles.advLabel}>Muzzle Velocity (fps)</Text>
              <TextInput
                style={styles.advInput}
                keyboardType="numeric"
                value={velocityInput}
                onChangeText={setVelocityInput}
              />
            </View>

            <View style={styles.advField}>
              <Text style={styles.advLabel}>Bullet Weight (gr)</Text>
              <TextInput
                style={styles.advInput}
                keyboardType="numeric"
                value={weightInput}
                onChangeText={setWeightInput}
              />
            </View>

            <View style={styles.advField}>
              <Text style={styles.advLabel}>Ballistic Coeff (G1)</Text>
              <TextInput
                style={styles.advInput}
                keyboardType="numeric"
                value={bcInput}
                onChangeText={setBcInput}
              />
            </View>

            <View style={styles.advField}>
              <Text style={styles.advLabel}>Zero Distance (Yds)</Text>
              <TextInput
                style={styles.advInput}
                keyboardType="numeric"
                value={zeroInput}
                onChangeText={setZeroInput}
              />
            </View>

            <View style={styles.advField}>
              <Text style={styles.advLabel}>Crosswind (mph)</Text>
              <TextInput
                style={styles.advInput}
                keyboardType="numeric"
                value={windSpeedInput}
                onChangeText={setWindSpeedInput}
              />
            </View>

            <View style={styles.advField}>
              <Text style={styles.advLabel}>Altitude (ft)</Text>
              <TextInput
                style={styles.advInput}
                keyboardType="numeric"
                value={altitudeInput}
                onChangeText={setAltitudeInput}
              />
            </View>
          </View>
        </View>
      )}

      {/* Point Blank Range (MPBR) Card */}
      <View style={styles.mpbrCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Ionicons name="locate-outline" size={18} color="#34d399" style={{ marginRight: 6 }} />
          <Text style={styles.mpbrTitle}>Maximum Point Blank Range (6" Vital Zone)</Text>
        </View>
        <Text style={styles.mpbrSubtext}>
          Hold center-mass from 0 to <Text style={{ color: '#34d399', fontWeight: 'bold' }}>{mpbrMetrics.maxPbrYards} yards</Text> without adjusting elevation!
        </Text>
        <View style={styles.mpbrStatsRow}>
          <Text style={styles.mpbrStat}>Near Zero: {mpbrMetrics.nearZeroYards} yd</Text>
          <Text style={styles.mpbrStat}>Far Zero: {mpbrMetrics.farZeroYards} yd</Text>
          <Text style={[styles.mpbrStat, { color: '#34d399', fontWeight: 'bold' }]}>Max: {mpbrMetrics.maxPbrYards} yd</Text>
        </View>
      </View>

      {/* DOPE Output Header & Controls */}
      <View style={styles.dopeHeaderRow}>
        <Text style={styles.sectionTitle}>Calculated DOPE Trajectory</Text>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          {/* Turret Format Toggle */}
          <View style={styles.turretToggle}>
            <Pressable 
              style={[styles.turretBtn, turretUnit === 'moa' && styles.turretBtnActive]} 
              onPress={() => setTurretUnit('moa')}
            >
              <Text style={[styles.turretText, turretUnit === 'moa' && styles.turretTextActive]}>MOA</Text>
            </Pressable>
            <Pressable 
              style={[styles.turretBtn, turretUnit === 'mil' && styles.turretBtnActive]} 
              onPress={() => setTurretUnit('mil')}
            >
              <Text style={[styles.turretText, turretUnit === 'mil' && styles.turretTextActive]}>MIL</Text>
            </Pressable>
          </View>

          {/* Export PDF DOPE Card */}
          <Pressable style={styles.exportBtn} onPress={handleExportDopeCard}>
            <Ionicons name="card-outline" size={14} color="#38bdf8" style={{ marginRight: 4 }} />
            <Text style={styles.exportBtnText}>DOPE Card</Text>
          </Pressable>
        </View>
      </View>

      {/* DOPE Table */}
      <View style={styles.tableCard}>
        {/* Table Header */}
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.th, { flex: 1.2 }]}>Range</Text>
          <Text style={[styles.th, { flex: 1.2 }]}>Drop</Text>
          <Text style={[styles.th, { flex: 1.4, color: '#38bdf8' }]}>Dial ({turretUnit.toUpperCase()})</Text>
          <Text style={[styles.th, { flex: 1.2 }]}>Vel (fps)</Text>
          <Text style={[styles.th, { flex: 1.2 }]}>Energy</Text>
          <Text style={[styles.th, { flex: 1.2 }]}>Wind Drift</Text>
        </View>

        {/* Table Rows */}
        {dopeTable.map((row, idx) => {
          const isTransonic = row.velocityFps <= 1125;
          return (
            <View key={idx} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}>
              <View style={{ flex: 1.2, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.rangeText}>{row.distanceYards} yd</Text>
              </View>

              <Text style={[styles.td, { flex: 1.2, color: row.dropInches < 0 ? '#ef4444' : '#10b981' }]}>
                {row.dropInches > 0 ? `+${row.dropInches.toFixed(1)}"` : `${row.dropInches.toFixed(1)}"`}
              </Text>

              <Text style={[styles.td, { flex: 1.4, color: '#38bdf8', fontWeight: 'bold' }]}>
                {turretUnit === 'moa' ? `${row.elevationMoa.toFixed(1)}` : `${row.elevationMil.toFixed(1)}`}
              </Text>

              <View style={{ flex: 1.2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={[styles.td, isTransonic && { color: '#f59e0b' }]}>
                  {row.velocityFps}
                </Text>
              </View>

              <Text style={[styles.td, { flex: 1.2 }]}>{row.energyFtLbs}</Text>

              <Text style={[styles.td, { flex: 1.2, color: '#94a3b8' }]}>
                {row.windDriftInches.toFixed(1)}"
              </Text>
            </View>
          );
        })}
      </View>

      {/* Recipe Import Modal */}
      <Modal visible={isRecipePickerOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 12 }}>
              <Text style={styles.modalTitle}>Import Handload Recipe</Text>
              <Pressable onPress={() => setIsRecipePickerOpen(false)}>
                <Ionicons name="close" size={22} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 300, width: '100%' }}>
              {recipesList.map(r => (
                <Pressable
                  key={r.id}
                  style={styles.recipeSelectItem}
                  onPress={() => handleSelectRecipe(r)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recipeSelectTitle}>{r.name}</Text>
                    <Text style={styles.recipeSelectSub}>
                      {r.caliber} • {r.bullet} • {r.avgVelocityFps ? `${r.avgVelocityFps} fps` : 'No velocity logged'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#38bdf8" />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
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
  modeTabBar: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
  },
  modeTabActive: {
    backgroundColor: '#0284c7',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 2,
  },
  modeTabText: {
    color: '#94a3b8',
    fontWeight: 'bold',
    fontSize: 12,
  },
  modeTabTextActive: {
    color: '#ffffff',
  },
  sectionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  catChip: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  catChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  catChipText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  catChipTextActive: {
    color: '#ffffff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 12,
  },
  profileRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  profileCard: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    width: 170,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  profileCardActive: {
    backgroundColor: '#1e3a5f',
    borderColor: '#38bdf8',
    borderWidth: 1.5,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  profileCaliber: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  profileName: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: 'bold',
    marginVertical: 4,
  },
  profileMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  profileMetaText: {
    color: '#94a3b8',
    fontSize: 10,
  },
  barrelScalerCard: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  barrelScalerTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: 'bold',
  },
  barrelScalerSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 1,
  },
  barrelLengthValue: {
    color: '#38bdf8',
    fontSize: 18,
    fontWeight: 'bold',
  },
  barrelControlRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 10,
  },
  barrelStepBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 7,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  barrelStepText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: 'bold',
  },
  velocityBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  velocityBannerLabel: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  velocityBannerVal: {
    color: '#34d399',
    fontSize: 13,
    fontWeight: 'bold',
  },
  mpbrCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 12,
  },
  mpbrTitle: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: 'bold',
  },
  mpbrSubtext: {
    color: '#cbd5e1',
    fontSize: 11,
    marginTop: 2,
  },
  mpbrStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(16, 185, 129, 0.2)',
  },
  mpbrStat: {
    color: '#94a3b8',
    fontSize: 11,
  },
  advInputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  advField: {
    width: '48%',
  },
  advLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  advInput: {
    backgroundColor: '#0f172a',
    color: '#fff',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
  },
  importRecipeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  importRecipeText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  dopeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  turretToggle: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 6,
    padding: 2,
    borderWidth: 1,
    borderColor: '#334155',
  },
  turretBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  turretBtnActive: {
    backgroundColor: '#0284c7',
  },
  turretText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  turretTextActive: {
    color: '#ffffff',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  exportBtnText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  tableCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  th: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#334155',
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  rangeText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  td: {
    color: '#f8fafc',
    fontSize: 11,
    textAlign: 'center',
  },
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
    borderRadius: 12,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: 'bold',
  },
  recipeSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  recipeSelectTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: 'bold',
  },
  recipeSelectSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
});
