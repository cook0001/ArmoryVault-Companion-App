import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  CartridgesIcon,
  GunpowderIcon,
  SafeIcon,
} from './components/CustomMobileIcons';
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }} edges={['top']}>
      <ScrollView 
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#3b82f6" />}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {/* ─── Hero Landing Section ─── */}
        <View style={styles.heroSection}>
          {/* Shield Brand */}
          <View style={styles.heroBrandRow}>
            <View style={styles.heroShield}>
              <Ionicons name="shield-checkmark" size={32} color="#34d399" />
            </View>
            <View>
              <Text style={styles.heroTitle}>ArmoryVault</Text>
              <Text style={styles.heroSubtitle}>Field Companion</Text>
            </View>
          </View>

          {/* Connection Status Pill */}
          <Pressable 
            style={[
              styles.heroStatusPill,
              isVaultLocked ? styles.statusPillLocked : isOnline ? styles.statusPillOnline : styles.statusPillOffline
            ]}
            onPress={!syncedIp ? () => router.push('/scanner') : undefined}
          >
            <View style={[
              styles.heroPillDot, 
              { backgroundColor: isVaultLocked ? '#ef4444' : isOnline ? '#34d399' : syncedIp ? '#fbbf24' : '#64748b' }
            ]} />
            <Text style={styles.heroPillText}>
              {isVaultLocked ? 'VAULT LOCKED' : isOnline ? 'CONNECTED' : syncedIp ? 'OFFLINE MODE' : 'TAP TO PAIR'}
            </Text>
            {isOnline && !isVaultLocked && autoSyncEnabled && (
              <View style={{ backgroundColor: 'rgba(52,211,153,0.3)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, marginLeft: 4 }}>
                <Text style={{ color: '#34d399', fontSize: 8, fontWeight: '800' }}>SYNC</Text>
              </View>
            )}
          </Pressable>

          {desktopDevice && (
            <Text style={styles.heroDeviceText}>
              {desktopDevice} • {syncedIp}
            </Text>
          )}
        </View>

        {/* ─── Vault Stats Bar ─── */}
        <View style={styles.statsBar}>
          <View style={styles.statBlock}>
            <SafeIcon size={16} color="#a78bfa" />
            <Text style={styles.statBlockNumber}>{dashboardStats?.firearms || 0}</Text>
            <Text style={styles.statBlockLabel}>Firearms</Text>
          </View>
          <View style={styles.statsBarDivider} />
          <View style={styles.statBlock}>
            <CartridgesIcon size={16} color="#f59e0b" />
            <Text style={styles.statBlockNumber}>{(dashboardStats?.ammo || 0).toLocaleString()}</Text>
            <Text style={styles.statBlockLabel}>Rounds</Text>
          </View>
          <View style={styles.statsBarDivider} />
          <View style={styles.statBlock}>
            <GunpowderIcon size={16} color="#60a5fa" />
            <Text style={styles.statBlockNumber}>{dashboardStats?.components || 0}</Text>
            <Text style={styles.statBlockLabel}>Components</Text>
          </View>
        </View>

        {/* ─── Remote Lock + Pair Actions ─── */}
        {isOnline && !isVaultLocked && (
          <Pressable 
            style={styles.remoteLockBannerBtn} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              setShowLockConfirmModal(true);
            }}
          >
            <Ionicons name="lock-closed" size={14} color="#f87171" style={{ marginRight: 6 }} />
            <Text style={{ color: '#f87171', fontSize: 12, fontWeight: '700' }}>Remote Lock Desktop</Text>
          </Pressable>
        )}

        {/* ─── Hero Pending Sync Card ─── */}
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

        {/* ─── Companion Action Grid ─── */}
        <Text style={styles.sectionHeader}>Companion Tools</Text>
        <View style={styles.gridContainer}>
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
              <Ionicons name="locate-outline" size={24} color="#10b981" />
            </View>
            <Text style={styles.gridCardTitle}>Range Mode</Text>
            <Text style={styles.gridCardSub}>Log Sessions & Targets</Text>
          </Pressable>

          {/* Firearms Vault */}
          <Pressable style={styles.gridCard} onPress={() => router.push('/firearms')}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(168, 85, 247, 0.2)' }]}>
              <SafeIcon size={24} color="#a855f7" />
            </View>
            <Text style={styles.gridCardTitle}>Firearms Vault</Text>
            <Text style={styles.gridCardSub}>
              {dashboardStats ? `${dashboardStats.firearms} Registered` : 'Browse Guns'}
            </Text>
          </Pressable>

          {/* Ammo & Supplies */}
          <Pressable style={styles.gridCard} onPress={() => router.push('/inventory')}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
              <CartridgesIcon size={24} color="#f59e0b" />
            </View>
            <Text style={styles.gridCardTitle}>Ammo & Supplies</Text>
            <Text style={styles.gridCardSub}>
              {dashboardStats ? `${dashboardStats.ammo.toLocaleString()} rds cached` : 'Stock & Powders'}
            </Text>
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
                name="cloud-upload-outline" 
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#0f172a',
  },
  /* ─── Hero Landing Section ─── */
  heroSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(100,116,139,0.15)',
  },
  heroBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  heroShield: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: 'rgba(52,211,153,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#f8fafc',
    letterSpacing: 0.5,
  },
  heroSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  heroStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 6,
  },
  statusPillOnline: {
    backgroundColor: 'rgba(52,211,153,0.1)',
    borderColor: 'rgba(52,211,153,0.3)',
  },
  statusPillLocked: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  statusPillOffline: {
    backgroundColor: 'rgba(100,116,139,0.1)',
    borderColor: 'rgba(100,116,139,0.2)',
  },
  heroPillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 8,
  },
  heroPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#e2e8f0',
    letterSpacing: 0.8,
  },
  heroDeviceText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },

  /* ─── Vault Stats Bar ─── */
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statBlock: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  statBlockNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
    marginTop: 2,
  },
  statBlockLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  statsBarDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(100,116,139,0.2)',
  },

  remoteLockBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.12)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    marginBottom: 14,
  },

  /* ─── Pending Sync Card ─── */
  syncCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },
  syncCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  pendingBadge: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8,
  },
  pendingBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  syncCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
  },
  syncCardDesc: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 16,
  },
  syncActionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  syncActionBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  /* ─── Action Grid ─── */
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridCard: {
    backgroundColor: '#1e293b',
    width: '48%',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  gridCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 2,
  },
  gridCardSub: {
    fontSize: 11,
    color: '#64748b',
  },

  /* ─── Remote Lock Modal ─── */
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
    padding: 22,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  modalIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 12,
  },
  confirmLockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 13,
    borderRadius: 10,
    width: '100%',
  },
  confirmLockBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  cancelLockBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 10,
    width: '100%',
  },
  cancelLockBtnText: {
    color: '#cbd5e1',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
