import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

export default function Home() {
  const router = useRouter();
  const [syncedIp, setSyncedIp] = useState<string | null>(null);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [dashboardStats, setDashboardStats] = useState<{firearms: number, ammo: number, components: number} | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadStatus();
    }, [])
  );

  const loadStatus = async () => {
    try {
      const ip = await AsyncStorage.getItem('server_ip');
      setSyncedIp(ip);
      const queue = await AsyncStorage.getItem('offline_queue');
      if (queue) {
        const parsed = JSON.parse(queue);
        setOfflineQueueCount(parsed.length || 0);
      }
      
      if (ip) {
        fetch(`${ip}/api/inventory/summary`)
          .then(res => res.json())
          .then(data => {
            if (data && data.success) {
              setDashboardStats({ firearms: data.firearms, ammo: data.ammo, components: data.components });
            }
          })
          .catch(err => console.error("Summary fetch error", err));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSyncNow = async () => {
    if (!syncedIp) {
      alert('Please pair with the desktop app first');
      return;
    }
    
    try {
      const queueStr = await AsyncStorage.getItem('offline_queue');
      const queue = queueStr ? JSON.parse(queueStr) : [];
      
      if (queue.length === 0) return;

      const response = await fetch(`${syncedIp}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: queue }),
      });

      if (!response.ok) throw new Error('Sync failed');

      const data = await response.json();
      if (data.success) {
        await AsyncStorage.removeItem('offline_queue');
        setOfflineQueueCount(0);
        alert(`Successfully synced ${data.processed} items!`);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to sync. Ensure you are on the same Wi-Fi and the desktop app is running.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Desktop Connection</Text>
          {syncedIp && (
            <Pressable onPress={async () => {
              await AsyncStorage.removeItem('server_ip');
              setSyncedIp(null);
            }}>
              <Text style={styles.disconnectText}>Disconnect</Text>
            </Pressable>
          )}
        </View>
        {syncedIp ? (
          <Text style={styles.statusSuccess}>Paired to {syncedIp}</Text>
        ) : (
          <Text style={styles.statusWarning}>Not paired</Text>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Offline Queue</Text>
        </View>
        <Text style={styles.queueCount}>{offlineQueueCount} items pending</Text>
        {offlineQueueCount > 0 && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable style={[styles.syncButton, { flex: 1 }]} onPress={() => router.push('/outbox')}>
              <Text style={styles.buttonText}>View Outbox</Text>
            </Pressable>
            <Pressable style={[styles.syncButton, { flex: 1, backgroundColor: '#10b981' }]} onPress={handleSyncNow}>
              <Text style={styles.buttonText}>Sync Now</Text>
            </Pressable>
          </View>
        )}
      </View>

      {dashboardStats && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Inventory Overview</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#94a3b8', fontSize: 14 }}>Firearms</Text>
              <Text style={{ color: '#f8fafc', fontSize: 20, fontWeight: 'bold' }}>{dashboardStats.firearms}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#94a3b8', fontSize: 14 }}>Ammo</Text>
              <Text style={{ color: '#f8fafc', fontSize: 20, fontWeight: 'bold' }}>{dashboardStats.ammo}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#94a3b8', fontSize: 14 }}>Components</Text>
              <Text style={{ color: '#f8fafc', fontSize: 20, fontWeight: 'bold' }}>{dashboardStats.components}</Text>
            </View>
          </View>
        </View>
      )}

      <Pressable style={styles.scanButton} onPress={() => router.push('/scanner')}>
        <Text style={styles.scanButtonText}>Open Scanner</Text>
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
  card: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  disconnectText: {
    color: '#ef4444',
    fontWeight: 'bold',
    fontSize: 14,
    padding: 4,
  },
  statusSuccess: {
    color: '#10b981',
    fontWeight: '600',
  },
  statusWarning: {
    color: '#f59e0b',
    fontWeight: '600',
  },
  queueCount: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 15,
  },
  syncButton: {
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  scanButton: {
    backgroundColor: '#3b82f6',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 'auto',
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  }
});
