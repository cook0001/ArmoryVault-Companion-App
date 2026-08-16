import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';

export default function Settings() {
  const router = useRouter();
  const [syncedIp, setSyncedIp] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadStatus();
    }, [])
  );

  const loadStatus = async () => {
    try {
      const ip = await AsyncStorage.getItem('server_ip');
      setSyncedIp(ip);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDisconnect = async () => {
    Alert.alert('Disconnect', 'Are you sure you want to unpair from this desktop server?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: async () => {
        try {
          await AsyncStorage.removeItem('server_ip');
          setSyncedIp(null);
        } catch (e) {
          console.error(e);
        }
      }}
    ]);
  };

  const handleClearQueue = async () => {
    Alert.alert('Clear Queue', 'Are you sure you want to clear all pending syncs? This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => {
        try {
          await AsyncStorage.removeItem('offline_queue');
          Alert.alert('Success', 'Offline queue cleared.');
        } catch (e) {
          console.error(e);
        }
      }}
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Connection</Text>
      <View style={styles.card}>
        <Text style={styles.settingLabel}>Desktop Server</Text>
        <Text style={styles.settingValue}>{syncedIp || 'Not paired'}</Text>
        {syncedIp && (
          <Pressable style={styles.dangerButton} onPress={handleDisconnect}>
            <Text style={styles.dangerButtonText}>Disconnect</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.sectionTitle}>Data Management</Text>
      <View style={styles.card}>
        <Text style={styles.settingLabel}>Pending Syncs</Text>
        <Text style={styles.settingDescription}>Clear all items waiting to be synced. This cannot be undone.</Text>
        <Pressable style={styles.dangerButton} onPress={handleClearQueue}>
          <Text style={styles.dangerButtonText}>Clear Offline Queue</Text>
        </Pressable>
      </View>

      <Text style={styles.versionText}>App Version 2.1.17</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#0f172a',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginBottom: 10,
    marginTop: 20,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 12,
    marginBottom: 10,
  },
  settingLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 5,
  },
  settingValue: {
    fontSize: 16,
    color: '#10b981',
    marginBottom: 15,
  },
  settingDescription: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 15,
    lineHeight: 20,
  },
  dangerButton: {
    backgroundColor: '#ef4444',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  versionText: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 30,
  }
});
