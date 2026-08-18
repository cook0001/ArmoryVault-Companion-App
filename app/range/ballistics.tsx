import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { 
  FACTORY_BALLISTIC_PROFILES, 
  FactoryAmmoProfile, 
  STANDARD_ATMOSPHERE, 
  AtmosphericConditions, 
  calculateVelocityForBarrelLength,
  calculateDopeTable, 
  DopeEntry 
} from '../../utils/ballisticsEngine';

type CategoryFilter = 'all' | 'handgun' | 'rifle' | 'precision' | 'rimfire_shotgun';

export default function BallisticsScreen() {
  const router = useRouter();

  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedProfile, setSelectedProfile] = useState<FactoryAmmoProfile>(FACTORY_BALLISTIC_PROFILES[0]);
  
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

  const adjustBarrelLength = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const newVal = Math.max(1.0, Math.min(40.0, Number((actualBarrelLength + delta).toFixed(1))));
    setActualBarrelLength(newVal);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Mode Switcher */}
      <View style={styles.modeTabBar}>
        <Pressable 
          style={[styles.modeTab, mode === 'simple' && styles.modeTabActive]} 
          onPress={() => setMode('simple')}
        >
          <Ionicons name="flash-outline" size={16} color={mode === 'simple' ? '#38bdf8' : '#94a3b8'} style={{ marginRight: 6 }} />
          <Text style={[styles.modeTabText, mode === 'simple' && styles.modeTabTextActive]}>
            Simple (Factory Commercial)
          </Text>
        </Pressable>

        <Pressable 
          style={[styles.modeTab, mode === 'advanced' && styles.modeTabActive]} 
          onPress={() => setMode('advanced')}
        >
          <Ionicons name="calculator-outline" size={16} color={mode === 'advanced' ? '#38bdf8' : '#94a3b8'} style={{ marginRight: 6 }} />
          <Text style={[styles.modeTabText, mode === 'advanced' && styles.modeTabTextActive]}>
            Advanced (Handloader / G1)
          </Text>
        </Pressable>
      </View>

      {/* Simple Mode Controls */}
      {mode === 'simple' && (
        <View style={styles.card}>
          <Text style={styles.cardHeader}>1. Select Factory Caliber ({filteredProfiles.length} Available)</Text>
          
          {/* Category Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
            {[
              { key: 'all', label: 'All Calibers' },
              { key: 'handgun', label: '🔫 Handguns & PCC' },
              { key: 'rifle', label: '🎯 Rifles & Carbines' },
              { key: 'precision', label: '🔭 Precision & Long Range' },
              { key: 'rimfire_shotgun', label: '🌲 Rimfire & Shotgun' }
            ].map(cat => (
              <Pressable
                key={cat.key}
                style={[styles.catPill, categoryFilter === cat.key && styles.catPillActive]}
                onPress={() => setCategoryFilter(cat.key as CategoryFilter)}
              >
                <Text style={[styles.catPillText, categoryFilter === cat.key && styles.catPillTextActive]}>
                  {cat.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Quick Search */}
          <TextInput
            style={styles.filterSearchInput}
            placeholder="Search calibers (e.g. 5.56, 9mm, .308, 10mm, 6.5)..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          {/* Caliber Horizontal Selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 12 }}>
            {filteredProfiles.map(p => (
              <Pressable
                key={p.id}
                style={[styles.profileChip, selectedProfile.id === p.id && styles.profileChipActive]}
                onPress={() => handleSelectFactoryProfile(p)}
              >
                <Text style={[styles.profileChipText, selectedProfile.id === p.id && styles.profileChipTextActive]}>
                  {p.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* 2. Barrel Length Scaling Controls */}
          <View style={styles.barrelCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={styles.barrelCardTitle}>2. Firearm Barrel Length Adjustment</Text>
              <Text style={styles.testBblLabel}>Factory Spec: {selectedProfile.testBarrelLengthInches}"</Text>
            </View>

            {/* Quick Barrel Presets */}
            {selectedProfile.barrelPresets.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 10 }}>
                {selectedProfile.barrelPresets.map(preset => (
                  <Pressable
                    key={preset.label}
                    style={[styles.bblPresetBtn, actualBarrelLength === preset.lengthInches && styles.bblPresetBtnActive]}
                    onPress={() => setActualBarrelLength(preset.lengthInches)}
                  >
                    <Text style={[styles.bblPresetText, actualBarrelLength === preset.lengthInches && styles.bblPresetTextActive]}>
                      {preset.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {/* Barrel Stepper & Numeric Input */}
            <View style={styles.stepperContainer}>
              <Pressable style={styles.bblStepBtn} onPress={() => adjustBarrelLength(-1.0)}>
                <Text style={styles.bblStepBtnText}>-1.0"</Text>
              </Pressable>
              <Pressable style={styles.bblStepBtn} onPress={() => adjustBarrelLength(-0.5)}>
                <Text style={styles.bblStepBtnText}>-0.5"</Text>
              </Pressable>

              <View style={styles.bblDisplayBox}>
                <TextInput
                  style={styles.bblInput}
                  keyboardType="numeric"
                  value={String(actualBarrelLength)}
                  onChangeText={(val) => setActualBarrelLength(parseFloat(val) || 1.0)}
                />
                <Text style={styles.bblInchUnit}>inches</Text>
              </View>

              <Pressable style={styles.bblStepBtn} onPress={() => adjustBarrelLength(0.5)}>
                <Text style={styles.bblStepBtnText}>+0.5"</Text>
              </Pressable>
              <Pressable style={styles.bblStepBtn} onPress={() => adjustBarrelLength(1.0)}>
                <Text style={styles.bblStepBtnText}>+1.0"</Text>
              </Pressable>
            </View>

            {/* Real-Time Velocity Comparison Readout */}
            <View style={styles.velocityReadoutCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={styles.readoutSmallText}>Muzzle Velocity ({actualBarrelLength}" Barrel)</Text>
                  <Text style={styles.readoutBigVelocity}>
                    {barrelVelocityMetrics.adjustedVelocityFps} <Text style={{ fontSize: 13, color: '#94a3b8' }}>fps</Text>
                  </Text>
                </View>

                <View style={styles.deltaBadge}>
                  <Text style={[styles.deltaBadgeText, barrelVelocityMetrics.velocityDeltaFps < 0 ? { color: '#ef4444' } : barrelVelocityMetrics.velocityDeltaFps > 0 ? { color: '#34d399' } : { color: '#94a3b8' }]}>
                    {barrelVelocityMetrics.velocityDeltaFps > 0 ? `+${barrelVelocityMetrics.velocityDeltaFps}` : barrelVelocityMetrics.velocityDeltaFps} fps
                  </Text>
                  <Text style={styles.deltaSubText}>({selectedProfile.fpsPerInch} fps/in)</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Zero Distance Buttons */}
          <Text style={[styles.label, { marginTop: 12 }]}>3. Zero Distance:</Text>
          <View style={styles.buttonRow}>
            {[25, 50, 100, 200].map(d => (
              <Pressable
                key={d}
                style={[styles.smallBtn, simpleZeroDist === d && styles.smallBtnActive]}
                onPress={() => setSimpleZeroDist(d)}
              >
                <Text style={[styles.smallBtnText, simpleZeroDist === d && styles.smallBtnTextActive]}>{d} Yards</Text>
              </Pressable>
            ))}
          </View>

          {/* Sight Height Buttons */}
          <Text style={[styles.label, { marginTop: 10 }]}>4. Sight Height Over Bore:</Text>
          <View style={styles.buttonRow}>
            {[
              { val: 0.8, label: 'Pistol (0.8")' },
              { val: 1.5, label: 'Scoped (1.5")' },
              { val: 2.6, label: 'AR-15 (2.6")' }
            ].map(sh => (
              <Pressable
                key={sh.val}
                style={[styles.smallBtn, simpleSightHeight === sh.val && styles.smallBtnActive]}
                onPress={() => setSimpleSightHeight(sh.val)}
              >
                <Text style={[styles.smallBtnText, simpleSightHeight === sh.val && styles.smallBtnTextActive]}>{sh.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Advanced Mode Controls */}
      {mode === 'advanced' && (
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Precision Handload & Environmental Inputs</Text>
          
          <View style={styles.inputGrid}>
            <View style={styles.gridItem}>
              <Text style={styles.inputLabel}>Muzzle Velocity (fps)</Text>
              <TextInput
                style={styles.gridInput}
                keyboardType="numeric"
                value={velocityInput}
                onChangeText={setVelocityInput}
              />
            </View>

            <View style={styles.gridItem}>
              <Text style={styles.inputLabel}>Bullet Weight (gr)</Text>
              <TextInput
                style={styles.gridInput}
                keyboardType="numeric"
                value={weightInput}
                onChangeText={setWeightInput}
              />
            </View>

            <View style={styles.gridItem}>
              <Text style={styles.inputLabel}>G1 Ballistic Coeff</Text>
              <TextInput
                style={styles.gridInput}
                keyboardType="numeric"
                value={bcInput}
                onChangeText={setBcInput}
              />
            </View>

            <View style={styles.gridItem}>
              <Text style={styles.inputLabel}>Zero Distance (yds)</Text>
              <TextInput
                style={styles.gridInput}
                keyboardType="numeric"
                value={zeroInput}
                onChangeText={setZeroInput}
              />
            </View>

            <View style={styles.gridItem}>
              <Text style={styles.inputLabel}>Sight Height (in)</Text>
              <TextInput
                style={styles.gridInput}
                keyboardType="numeric"
                value={sightHeightInput}
                onChangeText={setSightHeightInput}
              />
            </View>

            <View style={styles.gridItem}>
              <Text style={styles.inputLabel}>Crosswind (mph)</Text>
              <TextInput
                style={styles.gridInput}
                keyboardType="numeric"
                value={windSpeedInput}
                onChangeText={setWindSpeedInput}
              />
            </View>

            <View style={styles.gridItem}>
              <Text style={styles.inputLabel}>Temperature (°F)</Text>
              <TextInput
                style={styles.gridInput}
                keyboardType="numeric"
                value={tempInput}
                onChangeText={setTempInput}
              />
            </View>

            <View style={styles.gridItem}>
              <Text style={styles.inputLabel}>Altitude (ft)</Text>
              <TextInput
                style={styles.gridInput}
                keyboardType="numeric"
                value={altitudeInput}
                onChangeText={setAltitudeInput}
              />
            </View>
          </View>
        </View>
      )}

      {/* Unit Selector */}
      <View style={styles.unitBar}>
        <Text style={{ color: '#94a3b8', fontWeight: 'bold', fontSize: 13 }}>Optic Elevation Units:</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Pressable 
            style={[styles.unitBtn, turretUnit === 'moa' && styles.unitBtnActive]} 
            onPress={() => setTurretUnit('moa')}
          >
            <Text style={[styles.unitBtnText, turretUnit === 'moa' && styles.unitBtnTextActive]}>1/4 MOA</Text>
          </Pressable>
          <Pressable 
            style={[styles.unitBtn, turretUnit === 'mil' && styles.unitBtnActive]} 
            onPress={() => setTurretUnit('mil')}
          >
            <Text style={[styles.unitBtnText, turretUnit === 'mil' && styles.unitBtnTextActive]}>0.1 MIL / MRAD</Text>
          </Pressable>
        </View>
      </View>

      {/* DOPE Trajectory Table */}
      <Text style={styles.sectionHeader}>🎯 Trajectory Drop Table (DOPE Card)</Text>
      <View style={styles.tableCard}>
        {/* Table Header */}
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeadCol, { width: 45 }]}>DIST</Text>
          <Text style={[styles.tableHeadCol, { flex: 1 }]}>DROP</Text>
          <Text style={[styles.tableHeadCol, { flex: 1.2 }]}>DIAL / CLICKS</Text>
          <Text style={[styles.tableHeadCol, { flex: 1 }]}>10mph WIND</Text>
          <Text style={[styles.tableHeadCol, { flex: 1 }]}>VELOCITY</Text>
        </View>

        {/* Table Body */}
        {dopeTable.map(entry => (
          <View key={entry.distanceYards} style={styles.tableRow}>
            <Text style={[styles.tableColDist, { width: 45 }]}>{entry.distanceYards}y</Text>
            
            <Text style={[styles.tableCol, { flex: 1, color: entry.holdoverInches < 0 ? '#ef4444' : '#34d399' }]}>
              {entry.holdoverInches > 0 ? `+${entry.holdoverInches}"` : `${entry.holdoverInches}"`}
            </Text>

            <Text style={[styles.tableCol, { flex: 1.2, color: '#38bdf8', fontWeight: 'bold' }]}>
              {turretUnit === 'moa' ? `${entry.elevationMoa} MOA (${entry.elevationClicks14Moa}c)` : `${entry.elevationMil} MIL (${entry.elevationClicks01Mil}c)`}
            </Text>

            <Text style={[styles.tableCol, { flex: 1, color: '#f59e0b' }]}>
              {turretUnit === 'moa' ? `${entry.windDriftMoa} MOA` : `${entry.windDriftMil} MIL`}
            </Text>

            <Text style={[styles.tableCol, { flex: 1, color: '#94a3b8' }]}>
              {entry.velocityFps} fps
            </Text>
          </View>
        ))}
      </View>
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
    marginBottom: 14,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  modeTabActive: {
    backgroundColor: '#334155',
  },
  modeTabText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modeTabTextActive: {
    color: '#38bdf8',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
  },
  cardHeader: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  catScroll: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  catPill: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  catPillActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38bdf8',
  },
  catPillText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  catPillTextActive: {
    color: '#38bdf8',
    fontWeight: 'bold',
  },
  filterSearchInput: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  profileChip: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  profileChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38bdf8',
  },
  profileChipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  profileChipTextActive: {
    color: '#38bdf8',
    fontWeight: 'bold',
  },
  barrelCard: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  barrelCardTitle: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: 'bold',
  },
  testBblLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  bblPresetBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  bblPresetBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
  },
  bblPresetText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  bblPresetTextActive: {
    color: '#34d399',
    fontWeight: 'bold',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginVertical: 8,
  },
  bblStepBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  bblStepBtnText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bblDisplayBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  bblInput: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    minWidth: 40,
  },
  bblInchUnit: {
    color: '#94a3b8',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: 'bold',
  },
  velocityReadoutCard: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  readoutSmallText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  readoutBigVelocity: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: 'bold',
  },
  deltaBadge: {
    alignItems: 'flex-end',
  },
  deltaBadgeText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  deltaSubText: {
    color: '#64748b',
    fontSize: 10,
  },
  label: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  smallBtn: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  smallBtnActive: {
    backgroundColor: '#065f46',
    borderColor: '#10b981',
  },
  smallBtnText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  smallBtnTextActive: {
    color: '#34d399',
  },
  inputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridItem: {
    width: '48%',
  },
  inputLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  gridInput: {
    backgroundColor: '#0f172a',
    color: '#fff',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: '#334155',
  },
  unitBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  unitBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  unitBtnActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  unitBtnText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  unitBtnTextActive: {
    color: '#fff',
  },
  sectionHeader: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  tableHeadCol: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    alignItems: 'center',
  },
  tableColDist: {
    color: '#f8fafc',
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
  },
  tableCol: {
    fontSize: 11,
    textAlign: 'center',
  }
});
