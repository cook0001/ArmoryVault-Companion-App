import { View, Text, StyleSheet, Pressable, Alert, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { checkForUpdates } from '../utils/updater';
import * as Application from 'expo-application';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export default function Settings() {
  const router = useRouter();
  const [syncedIp, setSyncedIp] = useState<string | null>(null);
  const [manualIp, setManualIp] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cacheStats, setCacheStats] = useState<{ firearms: number, ammo: number, components: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadStatus();
    }, [])
  );

  const loadStatus = async () => {
    try {
      const ip = await AsyncStorage.getItem('server_ip');
      setSyncedIp(ip);
      if (ip) setManualIp(ip);

      const cacheStr = await AsyncStorage.getItem('inventory_cache');
      if (cacheStr) {
        const cache = JSON.parse(cacheStr);
        setCacheStats({
          firearms: cache.firearms?.length || 0,
          ammo: cache.ammo?.length || 0,
          components: cache.components?.length || 0
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTestConnection = async () => {
    const target = manualIp.trim();
    if (!target) {
      Alert.alert('Error', 'Please enter a server IP address (e.g. http://192.168.1.189:3456)');
      return;
    }

    let url = target;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `http://${url}`;
    }
    if (!url.includes(':', 7)) {
      url = `${url}:3456`;
    }

    setIsTesting(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${url}/api/ping`, { method: 'GET', signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        await AsyncStorage.setItem('server_ip', url);
        setSyncedIp(url);
        setManualIp(url);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Connected!', `Successfully connected to ${data.device || 'Vault Server'} at ${url}`);
      } else {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
    } catch (e: any) {
      Alert.alert('Connection Failed', `Could not reach ${url}. Make sure your PC is running ArmoryVault and on the same Wi-Fi network.`);
    }
    setIsTesting(false);
  };

  const handleForceRefreshCache = async () => {
    if (!syncedIp) {
      Alert.alert('Error', 'Please connect to desktop server first.');
      return;
    }

    setIsRefreshing(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${syncedIp}/api/inventory/cache`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          await AsyncStorage.setItem('inventory_cache', JSON.stringify(data));
          const now = new Date().toLocaleTimeString();
          await AsyncStorage.setItem('inventory_cache_time', now);
          
          setCacheStats({
            firearms: data.firearms?.length || 0,
            ammo: data.ammo?.length || 0,
            components: data.components?.length || 0
          });

          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Cache Updated', `Successfully cached ${data.firearms?.length || 0} firearms, ${data.ammo?.length || 0} ammo lots, and ${data.components?.length || 0} reloading components.`);
        }
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (e: any) {
      Alert.alert('Cache Fetch Failed', `Could not refresh cache from ${syncedIp}. Ensure your PC server is running.`);
    }
    setIsRefreshing(false);
  };

  const handleDisconnect = async () => {
    Alert.alert('Disconnect', 'Are you sure you want to unpair from this desktop server?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: async () => {
        try {
          await AsyncStorage.removeItem('server_ip');
          setSyncedIp(null);
          setManualIp('');
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
    <ScrollView style={styles.container}>
      {/* Connection Section */}
      <Text style={styles.sectionTitle}>Vault Server Connection</Text>
      <View style={styles.card}>
        <Text style={styles.settingLabel}>Server IP Address</Text>
        <Text style={styles.settingDescription}>
          Enter your desktop PC's local network address or scan the pairing QR code in the desktop app.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="http://192.168.1.189:3456"
          placeholderTextColor="#64748b"
          value={manualIp}
          onChangeText={setManualIp}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable 
            style={[styles.primaryButton, { flex: 1 }]} 
            onPress={handleTestConnection}
            disabled={isTesting}
          >
            {isTesting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Test & Connect</Text>
            )}
          </Pressable>

          {syncedIp && (
            <Pressable style={styles.dangerButton} onPress={handleDisconnect}>
              <Text style={styles.dangerButtonText}>Unpair</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Offline Cache Management */}
      <Text style={styles.sectionTitle}>Offline Inventory Cache</Text>
      <View style={styles.card}>
        <Text style={styles.settingLabel}>Local Vault Storage</Text>
        {cacheStats ? (
          <Text style={styles.settingDescription}>
            Cached: {cacheStats.firearms} Firearms • {cacheStats.ammo} Ammo Types • {cacheStats.components} Components
          </Text>
        ) : (
          <Text style={styles.settingDescription}>No inventory cached locally yet.</Text>
        )}

        <Pressable 
          style={[styles.primaryButton, { backgroundColor: '#065f46', borderColor: '#10b981', borderWidth: 1 }]} 
          onPress={handleForceRefreshCache}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="refresh-outline" size={18} color="#34d399" style={{ marginRight: 6 }} />
              <Text style={[styles.primaryButtonText, { color: '#34d399' }]}>Force Refresh Cache</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Data Management */}
      <Text style={styles.sectionTitle}>Data Management</Text>
      <View style={styles.card}>
        <Text style={styles.settingLabel}>Pending Sync Queue</Text>
        <Text style={styles.settingDescription}>
          Clear all range sessions, logs, and stock adjustments waiting in the outbox.
        </Text>
        <Pressable style={styles.dangerButton} onPress={handleClearQueue}>
          <Text style={styles.dangerButtonText}>Clear Offline Queue</Text>
        </Pressable>
      </View>

      {/* App Updates */}
      <Text style={styles.sectionTitle}>App Updates</Text>
      <View style={styles.card}>
        <Text style={styles.settingLabel}>Check for Updates</Text>
        <Text style={styles.settingDescription}>Query GitHub to see if a newer version of the companion app is available.</Text>
        <Pressable style={styles.primaryButton} onPress={() => checkForUpdates(false)}>
          <Text style={styles.primaryButtonText}>Check Now</Text>
        </Pressable>
      </View>

      <Text style={styles.versionText}>
        ArmoryVault Companion v{Application.nativeApplicationVersion || '2.5.0'}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#0f172a',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginBottom: 8,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 12,
    lineHeight: 18,
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    color: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  dangerButton: {
    backgroundColor: '#7f1d1d',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  dangerButtonText: {
    color: '#fca5a5',
    fontWeight: 'bold',
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  versionText: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 20,
    marginBottom: 30,
    fontSize: 12,
  }
});
