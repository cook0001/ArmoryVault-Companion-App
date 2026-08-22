import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { checkForUpdates, UpdateChannel, isPrereleaseVersion, getCurrentAppVersion } from '../utils/updater';
import * as Application from 'expo-application';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSync } from '../context/SyncContext';
import { useDialog } from '../context/DialogContext';

export default function Settings() {
  const {
    syncedIp,
    autoSyncEnabled,
    setAutoSyncEnabled,
    setServerIp,
    refreshCache,
    clearQueue,
    offlineQueueCount,
  } = useSync();

  const { showConfirm, showSuccess, showError, showToast, showAlert } = useDialog();

  const [manualIp, setManualIp] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cacheStats, setCacheStats] = useState<{ firearms: number, ammo: number, components: number } | null>(null);
  const [updateChannel, setUpdateChannel] = useState<UpdateChannel>('stable');

  useFocusEffect(
    useCallback(() => {
      loadSettingsData();
    }, [syncedIp])
  );

  const loadSettingsData = async () => {
    try {
      if (syncedIp) setManualIp(syncedIp);

      const channel = await AsyncStorage.getItem('update_channel');
      if (channel === 'nightly') {
        setUpdateChannel('nightly');
      } else {
        setUpdateChannel('stable');
      }

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

  const currentVersionStr = getCurrentAppVersion();
  const isCurrentBuildNightly = isPrereleaseVersion(currentVersionStr);

  const triggerUpdateOrRollbackCheck = (targetChannel: UpdateChannel) => {
    checkForUpdates({
      silent: false,
      channel: targetChannel,
      onConfirm: (opts) => {
        showConfirm({
          title: opts.title,
          message: opts.message,
          confirmText: opts.confirmText,
          cancelText: opts.cancelText,
          type: opts.title.includes('Rollback') ? 'danger' : 'confirm',
          onConfirm: opts.onConfirm,
        });
      },
      onAlert: (title, message) => {
        showAlert({ title, message, type: 'info' });
      }
    });
  };

  const handleChannelChange = async (newChannel: UpdateChannel) => {
    setUpdateChannel(newChannel);
    await AsyncStorage.setItem('update_channel', newChannel);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    showToast({
      title: 'Update Channel Changed',
      message: `Now tracking ${newChannel === 'nightly' ? 'Nightly Pre-release' : 'Stable'} builds.`,
      type: 'info'
    });

    // Automatically check for rollback or nightly upgrade upon switching
    setTimeout(() => {
      triggerUpdateOrRollbackCheck(newChannel);
    }, 400);
  };

  const handleTestConnection = async () => {
    const target = manualIp.trim();
    if (!target) {
      showError('Error', 'Please enter a server IP address (e.g. http://192.168.1.189:3456)');
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
      const res = await fetch(`${url}/api/ping`, { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        await setServerIp(url);
        setManualIp(url);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showSuccess('Connected to Vault', `Successfully paired with ${data.device || 'Vault Server'} at ${url}`);
      } else {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
    } catch (e: any) {
      showError('Connection Failed', `Could not reach ${url}. Make sure your PC is running ArmoryVault and connected to the same Wi-Fi network.`);
    }
    setIsTesting(false);
  };

  const handleForceRefreshCache = async () => {
    if (!syncedIp) {
      showError('Not Connected', 'Please pair with your desktop server first.');
      return;
    }

    setIsRefreshing(true);
    await refreshCache(false);
    const cacheStr = await AsyncStorage.getItem('inventory_cache');
    if (cacheStr) {
      const cache = JSON.parse(cacheStr);
      setCacheStats({
        firearms: cache.firearms?.length || 0,
        ammo: cache.ammo?.length || 0,
        components: cache.components?.length || 0
      });
    }
    setIsRefreshing(false);
  };

  const handleDisconnect = () => {
    showConfirm({
      title: 'Unpair Desktop Server',
      message: 'Are you sure you want to unpair from this desktop server? Your offline cache will remain available.',
      confirmText: 'Unpair Server',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        await setServerIp(null);
        setManualIp('');
        showToast({ message: 'Disconnected from desktop server', type: 'info' });
      }
    });
  };

  const handleClearQueue = () => {
    showConfirm({
      title: 'Clear Offline Sync Queue',
      message: `Are you sure you want to delete all ${offlineQueueCount} pending items in your outbox? This action cannot be undone.`,
      confirmText: 'Clear Queue',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        await clearQueue();
      }
    });
  };

  const handleCheckForUpdates = () => {
    triggerUpdateOrRollbackCheck(updateChannel);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 110 }}>
      {/* 1. Connection Section */}
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
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="link-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.primaryButtonText}>Test Connection</Text>
              </View>
            )}
          </Pressable>

          {syncedIp && (
            <Pressable 
              style={[styles.secondaryButton, { flex: 0.8 }]} 
              onPress={handleDisconnect}
            >
              <Text style={styles.secondaryButtonText}>Unpair</Text>
            </Pressable>
          )}
        </View>

        {syncedIp && (
          <View style={styles.statusBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#10b981" style={{ marginRight: 6 }} />
            <Text style={styles.statusText}>Paired with {syncedIp}</Text>
          </View>
        )}
      </View>

      {/* 2. Automated Sync Settings */}
      <Text style={styles.sectionTitle}>Sync Behavior</Text>
      <View style={styles.card}>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.settingLabel}>Auto-Sync on Launch</Text>
            <Text style={styles.settingDescription}>
              Automatically sync pending queue when connected to your desktop network.
            </Text>
          </View>
          <Switch
            value={autoSyncEnabled}
            onValueChange={setAutoSyncEnabled}
            trackColor={{ false: '#334155', true: '#059669' }}
            thumbColor={autoSyncEnabled ? '#10b981' : '#94a3b8'}
          />
        </View>
      </View>

      {/* 3. Offline Cache Inspection */}
      <Text style={styles.sectionTitle}>Offline Vault Cache</Text>
      <View style={styles.card}>
        <Text style={styles.settingLabel}>Cached Inventory</Text>
        <Text style={styles.settingDescription}>
          Local copy of firearms, ammo stock, and reloading components stored for offline field use.
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{cacheStats?.firearms ?? '-'}</Text>
            <Text style={styles.statLabel}>Firearms</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{cacheStats?.ammo ?? '-'}</Text>
            <Text style={styles.statLabel}>Ammo Lots</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{cacheStats?.components ?? '-'}</Text>
            <Text style={styles.statLabel}>Components</Text>
          </View>
        </View>

        <Pressable 
          style={[styles.primaryButton, { backgroundColor: '#1e293b', borderColor: '#34d399', borderWidth: 1, marginTop: 12 }]} 
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

      {/* 4. Data Management */}
      <Text style={styles.sectionTitle}>Data Management</Text>
      <View style={styles.card}>
        <Text style={styles.settingLabel}>Pending Sync Queue ({offlineQueueCount} items)</Text>
        <Text style={styles.settingDescription}>
          Clear all range sessions, logs, and stock adjustments waiting in the outbox.
        </Text>
        <Pressable 
          style={[styles.dangerButton, offlineQueueCount === 0 && { opacity: 0.5 }]} 
          onPress={handleClearQueue}
          disabled={offlineQueueCount === 0}
        >
          <Text style={styles.dangerButtonText}>Clear Offline Queue</Text>
        </Pressable>
      </View>

      {/* 5. Update Channel & App Updates */}
      <Text style={styles.sectionTitle}>Update Channel & Releases</Text>
      <View style={styles.card}>
        <Text style={styles.settingLabel}>Release Channel</Text>
        <Text style={styles.settingDescription}>
          Select which release stream to receive APK updates from:
        </Text>

        <View style={styles.channelRow}>
          <Pressable
            style={[styles.channelTab, updateChannel === 'stable' && styles.channelTabActive]}
            onPress={() => handleChannelChange('stable')}
          >
            <Ionicons 
              name="checkmark-circle" 
              size={16} 
              color={updateChannel === 'stable' ? '#10b981' : '#64748b'} 
              style={{ marginRight: 6 }} 
            />
            <Text style={[styles.channelTabText, updateChannel === 'stable' && styles.channelTabTextActive]}>
              Stable (Standard)
            </Text>
          </Pressable>

          <Pressable
            style={[styles.channelTab, updateChannel === 'nightly' && styles.channelTabNightlyActive]}
            onPress={() => handleChannelChange('nightly')}
          >
            <Ionicons 
              name="flash" 
              size={16} 
              color={updateChannel === 'nightly' ? '#f59e0b' : '#64748b'} 
              style={{ marginRight: 6 }} 
            />
            <Text style={[styles.channelTabText, updateChannel === 'nightly' && styles.channelTabTextNightlyActive]}>
              Nightly (Testing)
            </Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 8 }}>
          <Ionicons 
            name={updateChannel === 'nightly' ? "flash-outline" : "shield-checkmark-outline"} 
            size={14} 
            color={updateChannel === 'nightly' ? "#f59e0b" : "#38bdf8"} 
          />
          <Text style={[styles.channelDescriptionText, { flex: 1, marginVertical: 0 }]}>
            {updateChannel === 'nightly'
              ? 'Tracking bleeding-edge test builds for new features, ballistics tools, and debugging.'
              : 'Tracking thoroughly tested, official production releases.'}
          </Text>
        </View>

        {/* Current Build Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: isCurrentBuildNightly ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)', borderColor: isCurrentBuildNightly ? '#f59e0b' : '#10b981', borderWidth: 1, marginBottom: 12 }]}>
          <Ionicons 
            name={isCurrentBuildNightly ? "flask-outline" : "shield-checkmark-outline"} 
            size={16} 
            color={isCurrentBuildNightly ? "#f59e0b" : "#10b981"} 
            style={{ marginRight: 6 }} 
          />
          <Text style={[styles.statusText, { color: isCurrentBuildNightly ? "#f59e0b" : "#10b981", fontWeight: 'bold' }]}>
            Current Installed Build: v{currentVersionStr} ({isCurrentBuildNightly ? 'Nightly Pre-release' : 'Official Stable'})
          </Text>
        </View>

        {/* Dedicated Rollback Button if currently on Nightly */}
        {isCurrentBuildNightly && (
          <Pressable 
            style={[styles.dangerButton, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#ef4444', borderWidth: 1, marginBottom: 10 }]} 
            onPress={() => triggerUpdateOrRollbackCheck('stable')}
          >
            <Ionicons name="arrow-undo-outline" size={18} color="#ef4444" style={{ marginRight: 6 }} />
            <Text style={[styles.dangerButtonText, { color: '#ef4444' }]}>
              Rollback to Latest Stable Release
            </Text>
          </Pressable>
        )}

        <Pressable style={styles.primaryButton} onPress={handleCheckForUpdates}>
          <Ionicons name="cloud-download-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.primaryButtonText}>
            Check for {updateChannel === 'nightly' ? 'Nightly Updates' : 'Stable Updates'}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.versionText}>
        ArmoryVault Companion v{currentVersionStr} ({updateChannel.toUpperCase()})
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
    marginTop: 14,
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  channelDescriptionText: {
    fontSize: 12,
    color: '#cbd5e1',
    marginBottom: 14,
    fontStyle: 'italic',
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
  channelRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  channelTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  channelTabActive: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  channelTabNightlyActive: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  channelTabText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  channelTabTextActive: {
    color: '#10b981',
    fontWeight: 'bold',
  },
  channelTabTextNightlyActive: {
    color: '#f59e0b',
    fontWeight: 'bold',
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
    flexDirection: 'row',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  secondaryButton: {
    backgroundColor: '#334155',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#cbd5e1',
    fontWeight: 'bold',
    fontSize: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#34d399',
  },
  statLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  versionText: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 16,
    marginBottom: 34,
    fontSize: 12,
  }
});
