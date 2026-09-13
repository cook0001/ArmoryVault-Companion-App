import { View, Text, StyleSheet, TextInput, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSync } from '../../context/SyncContext';
import { useDialog } from '../../context/DialogContext';
import { formatAmmoSubtitle, formatShotgunSpecs, getPlusPBadgeText, isShotgunAmmo } from '../../utils/caliberHelpers';

export default function AmmoScreen() {
  const { upc } = useLocalSearchParams();
  const router = useRouter();
  const { addToQueue } = useSync();
  const { showToast, showError } = useDialog();
  
  const [action, setAction] = useState<'add' | 'remove'>('add');
  const [count, setCount] = useState('50');
  const [matchedAmmo, setMatchedAmmo] = useState<any | null>(null);

  useEffect(() => {
    loadCachedAmmo();
  }, [upc]);

  const loadCachedAmmo = async () => {
    try {
      const cacheStr = await AsyncStorage.getItem('inventory_cache');
      if (cacheStr) {
        const cache = JSON.parse(cacheStr);
        const upcStr = String(upc);

        if (cache.ammo) {
          const found = cache.ammo.find((a: any) => String(a.id) === upcStr || a.upc_code === upcStr);
          if (found) {
            setMatchedAmmo(found);
            return;
          }
        }

        if (cache.skus && cache.skus[upcStr]) {
          const skuInfo = cache.skus[upcStr];
          setMatchedAmmo({
            manufacturer: skuInfo.manufacturer,
            name: skuInfo.name,
            caliber: skuInfo.caliber,
            type: skuInfo.type,
            count: skuInfo.quantity,
            isPlusP: skuInfo.isPlusP,
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveOffline = async () => {
    try {
      const parsedCount = parseInt(count) || 0;
      if (parsedCount <= 0) {
        showToast({ message: 'Please enter a valid round count', type: 'warning' });
        return;
      }

      const newLog = {
        type: 'ammo_adjustment',
        upcOrId: matchedAmmo?.id ? String(matchedAmmo.id) : String(upc),
        action,
        count: parsedCount,
        timestamp: new Date().toISOString()
      };

      const msg = `Queued ${action === 'remove' ? '-' : '+'}${parsedCount} rds (${matchedAmmo?.caliber || upc})`;
      await addToQueue(newLog, msg);
      router.back();
    } catch (e) {
      console.error(e);
      showError('Save Failed', 'Could not queue ammo adjustment');
    }
  };

  return (
    <ScrollView style={styles.container}>
      {matchedAmmo ? (() => {
        const isShotgun = isShotgunAmmo(matchedAmmo);
        const shotgunSpecs = isShotgun ? formatShotgunSpecs(matchedAmmo) : null;
        const plusPText = getPlusPBadgeText(matchedAmmo);
        return (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <Text style={styles.ammoTitle}>
                {matchedAmmo.manufacturer || ''} {matchedAmmo.caliber || ''}
              </Text>
              {plusPText ? (
                <View style={styles.plusPBadge}>
                  <Text style={styles.plusPBadgeText}>{plusPText}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.ammoSubtitle}>
              {formatAmmoSubtitle(matchedAmmo)}
            </Text>

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
              {!isShotgun && matchedAmmo.grain ? (
                <View style={styles.specChip}>
                  <Text style={styles.specChipText}>{matchedAmmo.grain}gr</Text>
                </View>
              ) : null}
              {!isShotgun && matchedAmmo.projectile ? (
                <View style={styles.specChip}>
                  <Text style={styles.specChipText}>{matchedAmmo.projectile}</Text>
                </View>
              ) : null}
            </View>

            {matchedAmmo.count !== undefined && (
              <View style={styles.stockBadge}>
                <Text style={styles.stockBadgeText}>Current Stock: {matchedAmmo.count} rds</Text>
              </View>
            )}
          </View>
        );
      })() : (
        <Text style={styles.title}>Ammo UPC/ID: {upc}</Text>
      )}
      
      <View style={styles.tabContainer}>
        <Pressable 
          style={[styles.tab, action === 'add' && styles.activeAddTab]} 
          onPress={() => setAction('add')}
        >
          <Text style={[styles.tabText, action === 'add' && styles.activeTabText]}>+ Add to Stock</Text>
        </Pressable>
        <Pressable 
          style={[styles.tab, action === 'remove' && styles.activeRemoveTab]} 
          onPress={() => setAction('remove')}
        >
          <Text style={[styles.tabText, action === 'remove' && styles.activeTabText]}>- Remove / Shoot</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Round Count</Text>
      <TextInput 
        style={styles.input} 
        keyboardType="numeric" 
        value={count}
        onChangeText={setCount}
        placeholder="e.g. 50"
      />

      {/* Quick Steppers */}
      <View style={styles.stepperContainer}>
        {[20, 50, 100, 250, 500, 1400].map(amt => (
          <Pressable
            key={amt}
            style={styles.stepperChip}
            onPress={() => setCount(String(amt))}
          >
            <Text style={styles.stepperText}>{amt} rds</Text>
          </Pressable>
        ))}
      </View>

      <Pressable 
        style={[styles.saveButton, { backgroundColor: action === 'remove' ? '#ef4444' : '#10b981' }]} 
        onPress={handleSaveOffline}
      >
        <Text style={styles.saveButtonText}>
          {action === 'remove' ? `Deduct ${count || 0} Rounds` : `Add ${count || 0} Rounds`}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#0f172a',
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  ammoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  ammoSubtitle: {
    fontSize: 15,
    color: '#94a3b8',
    marginTop: 4,
  },
  stockBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 10,
  },
  stockBadgeText: {
    color: '#10b981',
    fontWeight: 'bold',
    fontSize: 13,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#f8fafc',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    padding: 4,
  },
  tab: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeAddTab: {
    backgroundColor: '#10b981',
  },
  activeRemoveTab: {
    backgroundColor: '#ef4444',
  },
  tabText: {
    color: '#94a3b8',
    fontWeight: 'bold',
    fontSize: 14,
  },
  activeTabText: {
    color: '#fff',
  },
  label: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#cbd5e1',
    fontSize: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    fontSize: 20,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  stepperContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 24,
  },
  stepperChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#334155',
  },
  stepperText: {
    color: '#f8fafc',
    fontWeight: 'bold',
    fontSize: 13,
  },
  saveButton: {
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 40,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  specChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  specTypeBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#f59e0b',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  specTypeBadgeText: {
    color: '#f59e0b',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  specChip: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  specChipText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
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
});
