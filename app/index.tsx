import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl, Modal } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSync } from '../context/SyncContext';

export default function Home() {
  const router = useRouter();
  const {
    syncedIp,
    isOnline,
    isVaultLocked,
    desktopDevice,
    offlineQueueCount,
    dashboardStats,
    syncProgress,
    lastCacheTime,
    lastSyncTime,
    isSyncing,
    autoSyncEnabled,
    triggerSync,
    loadStatus,
    refreshCache,
    remoteLockVault,
  } = useSync();

  const [refreshing, setRefreshing] = useState(false);
  const [showLockConfirmModal, setShowLockConfirmModal] = useState(false);
  const [isLocking, setIsLocking] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadStatus();
    }, [loadStatus])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStatus();
    if (syncedIp && isOnline && !isVaultLocked) {
      await refreshCache(true);
    }
    setRefreshing(false);
  };

  const handleManualSync = async () => {
    await triggerSync({ manual: true });
  };

  const handleExecuteRemoteLock = async () => {
    setIsLocking(true);
    await remoteLockVault();
    setIsLocking(false);
    setShowLockConfirmModal(false);
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#3b82f6" />}
    >
      {/* 1. Connection Status Beacon & Remote Lock Trigger */}
      <View style={styles.connectionBanner}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View 
            style={[
              styles.beaconDot, 
              isVaultLocked ? styles.beaconLocked : isOnline ? styles.beaconOnline : styles.beaconOffline
            ]} 
          />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.beaconStatusText}>
                {isVaultLocked ? 'DESKTOP LOCKED (CACHE ACTIVE)' : isOnline ? 'VAULT SERVER ONLINE' : syncedIp ? 'OFFLINE CACHE MODE' : 'NOT PAIRED'}
              </Text>
              {isOnline && !isVaultLocked && autoSyncEnabled && (
                <View style={styles.autoSyncBadge}>
                  <Text style={styles.autoSyncBadgeText}>AUTO-SYNC</Text>
                </View>
              )}
            </View>
            <Text style={styles.beaconSubText} numberOfLines={1}>
              {desktopDevice ? `${desktopDevice} (${syncedIp})` : syncedIp ? syncedIp : 'Scan Desktop QR to pair'}
            </Text>
          </View>
        </View>

        {isOnline && !isVaultLocked && (
          <Pressable 
            style={styles.remoteLockBtn} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              setShowLockConfirmModal(true);
            }}
          >
            <Ionicons name="lock-closed" size={13} color="#f87171" style={{ marginRight: 4 }} />
            <Text style={styles.remoteLockBtnText}>Lock Desktop</Text>
          </Pressable>
        )}

        {!syncedIp && (
          <Pressable style={styles.pairButton} onPress={() => router.push('/scanner')}>
            <Ionicons name="qr-code-outline" size={14} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.pairButtonText}>Pair</Text>
          </Pressable>
        )}
      </View>

      {/* 2. Cached Vault Summary */}
      <View style={styles.overviewCard}>
        <View style={styles.overviewHeader}>
          <Text style={styles.overviewTitle}>Cached Vault Summary</Text>
          {lastCacheTime ? (
            <Text style={styles.cacheTimeBadge}>✓ Synced {lastCacheTime}</Text>
          ) : null}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{dashboardStats?.firearms || 0}</Text>
            <Text style={styles.statLabel}>Firearms</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{(dashboardStats?.ammo || 0).toLocaleString()}</Text>
            <Text style={styles.statLabel}>Rounds</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{dashboardStats?.components || 0}</Text>
            <Text style={styles.statLabel}>Components</Text>
          </View>
        </View>
      </View>

      {/* 3. Hero Pending Sync Card */}
      {offlineQueueCount > 0 && (
        <View style={styles.syncCard}>
          <View style={styles.syncCardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{offlineQueueCount}</Text>
              </View>
              <Text style={styles.syncCardTitle}>Pending Offline Changes</Text>
            </View>
          </View>
          <Text style={styles.syncCardDesc}>
            {isOnline && autoSyncEnabled && !isVaultLocked
              ? 'Transmitting changes to desktop automatically in the background...'
              : 'Range trips, stock adjustments, and scans saved locally on device.'}
          </Text>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Pressable style={[styles.syncActionBtn, { backgroundColor: '#334155' }]} onPress={() => router.push('/outbox')}>
              <Text style={styles.syncActionBtnText}>Review ({offlineQueueCount})</Text>
            </Pressable>

            <Pressable 
              style={[
                styles.syncActionBtn, 
                { backgroundColor: (isSyncing || syncProgress || isVaultLocked) ? '#64748b' : '#10b981', flex: 1.2 }
              ]}
              onPress={(isSyncing || syncProgress || isVaultLocked) ? undefined : handleManualSync}
            >
              <Ionicons 
                name={isSyncing ? "sync" : "cloud-upload-outline"} 
                size={16} 
                color="#fff" 
                style={{ marginRight: 6 }} 
              />
              <Text style={styles.syncActionBtnText}>
                {syncProgress ? syncProgress : isSyncing ? 'Syncing...' : isVaultLocked ? 'Desktop Locked' : 'Sync to Desktop'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* 4. Action Hub Grid */}
      <Text style={styles.sectionHeader}>Companion Tools</Text>
      <View style={styles.gridContainer}>
        {/* Range Prep Checklist */}
        <Pressable style={styles.gridCard} onPress={() => router.push('/range/checklist')}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(56, 189, 248, 0.2)' }]}>
            <Ionicons name="bag-check-outline" size={24} color="#38bdf8" />
          </View>
          <Text style={styles.gridCardTitle}>Range Prep</Text>
          <Text style={styles.gridCardSub}>Bag Packing Checklist</Text>
        </Pressable>

        {/* Universal Scan */}
        <Pressable style={styles.gridCard} onPress={() => router.push('/scanner')}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
            <Ionicons name="barcode-outline" size={24} color="#38bdf8" />
          </View>
          <Text style={styles.gridCardTitle}>Universal Scan</Text>
          <Text style={styles.gridCardSub}>Barcodes & QR Labels</Text>
        </Pressable>

        {/* Range Companion */}
        <Pressable style={styles.gridCard} onPress={() => router.push('/range')}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
            <Ionicons name="flash-outline" size={24} color="#10b981" />
          </View>
          <Text style={styles.gridCardTitle}>Range Mode</Text>
          <Text style={styles.gridCardSub}>Log Sessions & Targets</Text>
        </Pressable>

        {/* Firearms Vault */}
        <Pressable style={styles.gridCard} onPress={() => router.push('/firearms')}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(168, 85, 247, 0.2)' }]}>
            <Ionicons name="shield-checkmark-outline" size={24} color="#a855f7" />
          </View>
          <Text style={styles.gridCardTitle}>Firearms Vault</Text>
          <Text style={styles.gridCardSub}>
            {dashboardStats ? `${dashboardStats.firearms} Registered` : 'Browse Guns'}
          </Text>
        </Pressable>

        {/* Ammo & Supplies */}
        <Pressable style={styles.gridCard} onPress={() => router.push('/inventory')}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
            <Ionicons name="cube-outline" size={24} color="#f59e0b" />
          </View>
          <Text style={styles.gridCardTitle}>Ammo & Supplies</Text>
          <Text style={styles.gridCardSub}>
            {dashboardStats ? `${dashboardStats.ammo.toLocaleString()} rds cached` : 'Stock & Powders'}
          </Text>
        </Pressable>

        {/* Ballistics DOPE */}
        <Pressable style={styles.gridCard} onPress={() => router.push('/range/ballistics')}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
            <Ionicons name="calculator-outline" size={24} color="#ef4444" />
          </View>
          <Text style={styles.gridCardTitle}>Ballistics DOPE</Text>
          <Text style={styles.gridCardSub}>Trajectory & Holdovers</Text>
        </Pressable>

        {/* Bench Voice Memos */}
        <Pressable style={styles.gridCard} onPress={() => router.push('/voice-memos')}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(168, 85, 247, 0.2)' }]}>
            <Ionicons name="mic-outline" size={24} color="#c084fc" />
          </View>
          <Text style={styles.gridCardTitle}>Voice Memos</Text>
          <Text style={styles.gridCardSub}>Air-Gapped Audio Logs</Text>
        </Pressable>

        {/* Offline Sync Outbox */}
        <Pressable style={styles.gridCard} onPress={() => router.push('/outbox')}>
          <View style={[styles.iconCircle, { backgroundColor: offlineQueueCount > 0 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(148, 163, 184, 0.15)' }]}>
            <Ionicons 
              name="file-tray-full-outline" 
              size={24} 
              color={offlineQueueCount > 0 ? '#38bdf8' : '#94a3b8'} 
            />
          </View>
          <Text style={styles.gridCardTitle}>Sync Outbox</Text>
          <Text style={styles.gridCardSub}>
            {offlineQueueCount === 0 ? '0 Pending Items' : `${offlineQueueCount} Pending ${offlineQueueCount === 1 ? 'Item' : 'Items'}`}
          </Text>
        </Pressable>
      </View>

      {/* Remote Lock Confirmation Modal */}
      <Modal visible={showLockConfirmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconBox}>
              <Ionicons name="lock-closed" size={32} color="#f87171" />
            </View>
            
            <Text style={styles.modalTitle}>Remote Lock Desktop Vault?</Text>
            
            <Text style={styles.modalBody}>
              This will immediately lock the database on <Text style={{ color: '#fff', fontWeight: 'bold' }}>{desktopDevice || 'Desktop'}</Text> and purge master encryption keys from PC memory. Your mobile offline cache will remain available for range use.
            </Text>

            <View style={{ width: '100%', gap: 8, marginTop: 16 }}>
              <Pressable 
                style={[styles.confirmLockBtn, isLocking && { opacity: 0.6 }]} 
                onPress={handleExecuteRemoteLock}
                disabled={isLocking}
              >
                <Ionicons name="lock-closed-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.confirmLockBtnText}>
                  {isLocking ? 'Locking Desktop...' : 'Yes, Lock Desktop Vault'}
                </Text>
              </Pressable>

              <Pressable 
                style={styles.cancelLockBtn} 
                onPress={() => setShowLockConfirmModal(false)}
                disabled={isLocking}
              >
                <Text style={styles.cancelLockBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#0f172a',
  },
  connectionBanner: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  beaconDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  beaconOnline: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  beaconOffline: {
    backgroundColor: '#f59e0b',
  },
  beaconLocked: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  beaconStatusText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#cbd5e1',
    letterSpacing: 0.5,
  },
  autoSyncBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  autoSyncBadgeText: {
    color: '#34d399',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  beaconSubText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 1,
  },
  remoteLockBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  remoteLockBtnText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: 'bold',
  },
  pairButton: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  pairButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  syncCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  syncCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  pendingBadge: {
    backgroundColor: '#ef4444',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  pendingBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  syncCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  syncCardDesc: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
  },
  syncActionBtn: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  syncActionBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  gridCard: {
    width: '48%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  gridCardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  gridCardSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  overviewCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  overviewTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  cacheTimeBadge: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#334155',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalIconBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalBody: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  confirmLockBtn: {
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  confirmLockBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  cancelLockBtn: {
    backgroundColor: '#334155',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLockBtnText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  }
});
