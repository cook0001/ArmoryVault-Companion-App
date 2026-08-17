import { View, Text, StyleSheet, TextInput, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ComponentScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [action, setAction] = useState<'add' | 'remove'>('add');
  const [count, setCount] = useState('100');
  const [componentData, setComponentData] = useState<any | null>(null);

  useEffect(() => {
    loadCachedComponent();
  }, [id]);

  const loadCachedComponent = async () => {
    try {
      const cacheStr = await AsyncStorage.getItem('inventory_cache');
      if (cacheStr) {
        const cache = JSON.parse(cacheStr);
        const idStr = String(id);

        if (cache.components) {
          const found = cache.components.find((c: any) => String(c.id) === idStr || c.upc_code === idStr);
          if (found) {
            setComponentData(found);
            if (found.type === 'Powder') setCount('1');
            else if (found.type === 'Primer') setCount('1000');
            else setCount('100');
            return;
          }
        }

        if (cache.skus && cache.skus[idStr]) {
          const sku = cache.skus[idStr];
          setComponentData({
            manufacturer: sku.manufacturer,
            name: sku.name,
            caliber: sku.caliber,
            type: sku.type,
            quantity: sku.quantity
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
        alert('Enter a valid count');
        return;
      }

      const newLog = {
        type: 'component_adjustment',
        upcOrId: componentData?.id ? String(componentData.id) : id,
        action,
        count: parsedCount,
        timestamp: new Date().toISOString()
      };

      const queueStr = await AsyncStorage.getItem('offline_queue');
      const queue = queueStr ? JSON.parse(queueStr) : [];
      queue.push(newLog);
      await AsyncStorage.setItem('offline_queue', JSON.stringify(queue));

      alert(`Queued ${action === 'remove' ? '-' : '+'}${parsedCount} for sync!`);
      router.back();
    } catch (e) {
      console.error(e);
      alert('Failed to save');
    }
  };

  // Tailored steppers based on component type
  const isPowder = componentData?.type === 'Powder';
  const isPrimer = componentData?.type === 'Primer';
  const stepperValues = isPowder 
    ? [1, 2, 4, 8] 
    : isPrimer 
    ? [100, 500, 1000, 5000] 
    : [50, 100, 250, 500, 1000];

  return (
    <ScrollView style={styles.container}>
      {componentData ? (
        <View style={styles.card}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{componentData.type || 'Component'}</Text>
          </View>
          <Text style={styles.componentName}>{componentData.manufacturer} {componentData.name}</Text>
          {componentData.caliber && (
            <Text style={styles.componentCaliber}>Caliber: {componentData.caliber}</Text>
          )}
          {componentData.quantity !== undefined && (
            <View style={styles.stockBadge}>
              <Text style={styles.stockBadgeText}>
                In Stock: {componentData.quantity} {isPowder ? 'lbs' : 'units'}
              </Text>
            </View>
          )}
        </View>
      ) : (
        <Text style={styles.title}>Component ID: {id}</Text>
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
          <Text style={[styles.tabText, action === 'remove' && styles.activeTabText]}>- Use / Deduct</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Quantity ({isPowder ? 'lbs' : 'units'})</Text>
      <TextInput 
        style={styles.input} 
        keyboardType="numeric" 
        value={count}
        onChangeText={setCount}
        placeholder={isPowder ? 'e.g. 1' : 'e.g. 100'}
      />

      {/* Quick Steppers */}
      <View style={styles.stepperContainer}>
        {stepperValues.map(amt => (
          <Pressable
            key={amt}
            style={styles.stepperChip}
            onPress={() => setCount(String(amt))}
          >
            <Text style={styles.stepperText}>{amt} {isPowder ? 'lbs' : ''}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable 
        style={[styles.saveButton, { backgroundColor: action === 'remove' ? '#ef4444' : '#10b981' }]} 
        onPress={handleSaveOffline}
      >
        <Text style={styles.saveButtonText}>
          {action === 'remove' ? `Deduct ${count || 0}` : `Add ${count || 0}`} {isPowder ? 'lbs' : 'units'}
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
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 6,
  },
  typeBadgeText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  componentName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  componentCaliber: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  stockBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
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
  }
});
