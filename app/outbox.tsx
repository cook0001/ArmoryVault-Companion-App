import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSync } from '../context/SyncContext';
import { useDialog } from '../context/DialogContext';

export default function Outbox() {
  const router = useRouter();
  const { 
    offlineQueue, 
    removeFromQueue, 
    updateQueueItem, 
    clearQueue,
    triggerSync,
    isSyncing,
    syncProgress,
    isOnline, 
    autoSyncEnabled, 
    desktopDevice, 
    syncedIp 
  } = useSync();

  const { showConfirm, showToast } = useDialog();

  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editQuantity, setEditQuantity] = useState('1');

  const getItemBadge = (type: string) => {
    switch (type) {
      case 'ammo_adjustment':
        return { icon: 'cube-outline' as const, label: 'Ammo Adjustment' };
      case 'component_adjustment':
        return { icon: 'flask-outline' as const, label: 'Component Adjustment' };
      case 'range_session':
        return { icon: 'disc-outline' as const, label: 'Range Session' };
      case 'part_maintenance':
        return { icon: 'construct-outline' as const, label: 'Replacement Part' };
      case 'firearm_log':
        return { icon: 'document-text-outline' as const, label: 'Firearm Log' };
      case 'firearm_photo':
        return { icon: 'camera-outline' as const, label: 'Firearm Photo' };
      case 'universal_scan':
        return { icon: 'scan-outline' as const, label: 'Universal Scan' };
      default:
        return { icon: 'layers-outline' as const, label: 'Log Item' };
    }
  };

  const handleDelete = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    showConfirm({
      title: 'Remove from Outbox?',
      message: 'Are you sure you want to discard this pending item?',
      confirmText: 'Discard Item',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        await removeFromQueue(index);
        showToast({ message: 'Item removed from outbox', type: 'info' });
      }
    });
  };

  const handleClearAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    showConfirm({
      title: 'Clear Outbox?',
      message: 'Are you sure you want to clear all pending changes from your outbox? This cannot be undone.',
      confirmText: 'Clear Everything',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        await clearQueue();
        showToast({ message: 'Sync outbox cleared', type: 'info' });
      }
    });
  };

  const handleManualSync = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const success = await triggerSync({ manual: true });
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  };

  const openEditModal = (index: number) => {
    const item = offlineQueue[index];
    if (item.type === 'ammo_adjustment' || item.type === 'component_adjustment' || item.type === 'universal_scan') {
      setEditIndex(index);
      setEditQuantity(String(item.count || 1));
    } else if (item.type === 'range_session') {
      setEditIndex(index);
      setEditQuantity(String(item.rounds_fired || 0));
    } else {
      showToast({ message: 'Only quantity and round adjustments can be edited in outbox.', type: 'info' });
    }
  };

  const saveEdit = async () => {
    if (editIndex === null) return;
    const parsed = parseInt(editQuantity);
    if (isNaN(parsed) || parsed <= 0) {
      showToast({ message: 'Please enter a valid quantity greater than 0.', type: 'error' });
      return;
    }

    const item = { ...offlineQueue[editIndex] };
    if (item.type === 'range_session') {
      item.rounds_fired = parsed;
    } else {
      item.count = parsed;
    }
    
    await updateQueueItem(editIndex, item);
    setEditIndex(null);
    showToast({ message: 'Item updated in outbox', type: 'success' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Sync Outbox ({offlineQueue.length})</Text>
          <Text style={styles.headerSubtitle}>Items queued to transmit to ArmoryVault Desktop.</Text>
        </View>
        {offlineQueue.length > 0 && (
          <Pressable style={styles.clearAllBtn} onPress={handleClearAll}>
            <Ionicons name="trash-outline" size={14} color="#ef4444" style={{ marginRight: 4 }} />
            <Text style={styles.clearAllBtnText}>Clear</Text>
          </Pressable>
        )}
      </View>

      {/* Auto-Sync Status Banner */}
      <View style={styles.statusBanner}>
        <Ionicons 
          name={isOnline && autoSyncEnabled ? 'sync-circle' : 'cloud-offline-outline'} 
          size={22} 
          color={isOnline && autoSyncEnabled ? '#34d399' : '#f59e0b'} 
          style={{ marginRight: 8 }} 
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.statusBannerTitle}>
            {isOnline && autoSyncEnabled 
              ? 'Auto-Sync Active' 
              : !syncedIp 
              ? 'Not Paired with Desktop' 
              : 'Offline Cache Mode'}
          </Text>
          <Text style={styles.statusBannerSubtitle}>
            {isOnline && autoSyncEnabled
              ? `Connected to ${desktopDevice || 'Vault Server'}. Changes transmit automatically.`
              : syncedIp 
              ? 'Changes preserved safely on-device. Will sync upon reconnection.'
              : 'Scan pairing QR code in Settings to link desktop app.'}
          </Text>
        </View>
      </View>

      {/* 1-Tap Manual Sync Button */}
      {offlineQueue.length > 0 && (
        <Pressable 
          style={[styles.syncNowBtn, isSyncing && { opacity: 0.8 }]} 
          onPress={handleManualSync}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <>
              <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.syncNowBtnText}>{syncProgress || 'Transmitting to Desktop...'}</Text>
            </>
          ) : (
            <>
              <Ionicons name="cloud-upload" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.syncNowBtnText}>Transmit {offlineQueue.length} Pending Changes Now →</Text>
            </>
          )}
        </Pressable>
      )}

      {offlineQueue.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-done-circle-outline" size={54} color="#334155" style={{ marginBottom: 12 }} />
          <Text style={styles.emptyStateTitle}>Outbox is Clear</Text>
          <Text style={styles.emptyStateText}>All range sessions, stock audits, and maintenance logs are synced.</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 110 }}>
          {offlineQueue.map((item, index) => {
            const badge = getItemBadge(item.type);
            return (
              <Pressable key={index} style={styles.card} onPress={() => openEditModal(index)}>
                <View style={{ flex: 1 }}>
                  <View style={[styles.badgeContainer, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                    <Ionicons name={badge.icon} size={12} color="#38bdf8" />
                    <Text style={styles.badgeText}>{badge.label}</Text>
                  </View>
                  
                  {(item.type === 'ammo_adjustment' || item.type === 'component_adjustment' || item.type === 'universal_scan') && (
                    <Text style={styles.itemTitle}>{item.action === 'remove' ? '-' : '+'}{String(item.count)} Units ({String(item.measurement || 'rds')})</Text>
                  )}

                  {item.type === 'range_session' && (
                    <>
                      <Text style={styles.itemTitle}>Firearm #{String(item.firearm_id)} • {String(item.rounds_fired)} Rounds</Text>
                      {item.ammo_id && <Text style={styles.itemDesc}>Deducting Ammo ID: {String(item.ammo_id)}</Text>}
                      {item.notes && <Text style={styles.itemDesc}>"{String(item.notes)}"</Text>}
                      {item.malfunctions && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <Ionicons name="warning-outline" size={12} color="#ef4444" />
                          <Text style={[styles.itemDesc, { color: '#ef4444' }]}>{Array.isArray(item.malfunctions) ? item.malfunctions.length : 0} Malfunctions Logged</Text>
                        </View>
                      )}
                    </>
                  )}

                  {item.type === 'part_maintenance' && (
                    <Text style={styles.itemTitle}>Part SKU: {item.upcOrId} for Firearm #{String(item.firearmId || 'General')}</Text>
                  )}
                  
                  {item.type === 'firearm_log' && (
                    <>
                      <Text style={styles.itemTitle}>{item.logType === 'maintenance' ? 'Maintenance' : 'Range Log'}</Text>
                      {Number(item.roundCount) > 0 && <Text style={styles.itemDesc}>{String(item.roundCount)} Rounds Fired</Text>}
                      {item.notes && <Text style={styles.itemDesc}>"{String(item.notes)}"</Text>}
                    </>
                  )}

                  {item.type === 'firearm_photo' && (
                    <Text style={styles.itemTitle}>New Photo for Firearm #{String(item.firearmId)}</Text>
                  )}
                  
                  <Text style={styles.timestamp}>{new Date(item.timestamp).toLocaleString()}</Text>
                </View>

                {typeof item.photoBase64 === 'string' && item.photoBase64 && (
                  <Image source={{ uri: item.photoBase64 as string }} style={styles.previewImage} />
                )}

                <Pressable style={styles.deleteButton} onPress={() => handleDelete(index)}>
                  <Ionicons name="close-circle" size={20} color="#ef4444" />
                </Pressable>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Edit Quantity Modal */}
      <Modal visible={editIndex !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Quantity / Rounds</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={editQuantity}
              onChangeText={setEditQuantity}
              selectTextOnFocus
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Pressable style={[styles.modalBtn, styles.modalCancelBtn]} onPress={() => setEditIndex(null)}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalSaveBtn]} onPress={saveEdit}>
                <Text style={styles.modalSaveBtnText}>Save Changes</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#0f172a',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  clearAllBtnText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: 'bold',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  statusBannerTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: 'bold',
  },
  statusBannerSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 1,
  },
  syncNowBtn: {
    flexDirection: 'row',
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  syncNowBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  emptyStateText: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  badgeContainer: {
    backgroundColor: '#0f172a',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 4,
  },
  badgeText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  itemTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: 'bold',
  },
  itemDesc: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  timestamp: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 4,
  },
  previewImage: {
    width: 48,
    height: 48,
    borderRadius: 6,
    marginRight: 10,
  },
  deleteButton: {
    padding: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 14,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: '#0f172a',
    color: '#fff',
    width: '100%',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#0284c7',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtn: {
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#475569',
  },
  modalCancelBtnText: {
    color: '#f1f5f9',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalSaveBtn: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  modalSaveBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
