import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AmmoScreen() {
  const { upc } = useLocalSearchParams();
  const router = useRouter();
  
  const [action, setAction] = useState<'add' | 'remove'>('add');
  const [count, setCount] = useState('');

  const handleSaveOffline = async () => {
    try {
      const parsedCount = parseInt(count) || 0;
      if (parsedCount <= 0) {
        alert('Enter a valid count');
        return;
      }

      const newLog = {
        type: 'ammo_adjustment',
        upcOrId: upc,
        action,
        count: parsedCount,
        timestamp: new Date().toISOString()
      };

      const queueStr = await AsyncStorage.getItem('offline_queue');
      const queue = queueStr ? JSON.parse(queueStr) : [];
      queue.push(newLog);
      await AsyncStorage.setItem('offline_queue', JSON.stringify(queue));

      alert('Inventory adjustment queued!');
      router.back();
    } catch (e) {
      console.error(e);
      alert('Failed to save');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ammo UPC/ID: {upc}</Text>
      
      <View style={styles.tabContainer}>
        <Pressable 
          style={[styles.tab, action === 'add' && styles.activeAddTab]} 
          onPress={() => setAction('add')}
        >
          <Text style={[styles.tabText, action === 'add' && styles.activeTabText]}>Add to Inventory</Text>
        </Pressable>
        <Pressable 
          style={[styles.tab, action === 'remove' && styles.activeRemoveTab]} 
          onPress={() => setAction('remove')}
        >
          <Text style={[styles.tabText, action === 'remove' && styles.activeTabText]}>Remove (Audit)</Text>
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

      <Pressable style={styles.saveButton} onPress={handleSaveOffline}>
        <Text style={styles.saveButtonText}>Queue Adjustment</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#0f172a',
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
    padding: 10,
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
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
  },
  label: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#cbd5e1',
  },
  input: {
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  }
});
