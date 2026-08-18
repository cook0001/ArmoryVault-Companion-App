import { View, Text, StyleSheet, Pressable, ScrollView, Image, Modal, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSync } from '../context/SyncContext';
import { useDialog } from '../context/DialogContext';

export default function Outbox() {
  const router = useRouter();
  const { 
    offlineQueue, 
    removeFromQueue, 
    updateQueueItem, 
    isOnline, 
    autoSyncEnabled, 
    desktopDevice, 
    syncedIp 
  } = useSync();

  const { showConfirm, showToast } = useDialog();

  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editQuantity, setEditQuantity] = useState('1');

  const handleDelete = (index: number) => {
    showConfirm({
      title: 'Remove from Queue',
      message: 'Are you sure you want to delete this pending change from your sync outbox?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        await removeFromQueue(index);
      }
    });
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
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Pending Sync Outbox</Text>
      <Text style={styles.headerSubtitle}>Items below will be transmitted to the desktop app.</Text>

      {/* Auto-Sync Status Banner */}
      <View style={styles.statusBanner}>
        <Ionicons 
          name={isOnline && autoSyncEnabled ? 'sync-circle' : 'cloud-offline-outline'} 
          size={20} 
          color={isOnline && autoSyncEnabled ? '#34d399' : '#f59e0b'} 
          style={{ marginRight: 8 }} 
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.statusBannerTitle}>
            {isOnline && autoSyncEnabled 
              ? 'Auto-Sync Active' 
              : !syncedIp 
              ? 'Not Paired with Desktop' 
              : 'Offline Mode'}
          </Text>
          <Text style={styles.statusBannerSubtitle}>
            {isOnline && autoSyncEnabled
              ? `Syncing changes seamlessly with ${desktopDevice || 'Vault Server'}.`
              : syncedIp 
              ? 'Changes are preserved safely and will sync when reconnected.'
              : 'Pair with your desktop server in Settings to enable syncing.'}
          </Text>
        </View>
      </View>

      {offlineQueue.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-done-circle-outline" size={54} color="#334155" style={{ marginBottom: 12 }} />
          <Text style={styles.emptyStateTitle}>Outbox is Empty</Text>
          <Text style={styles.emptyStateText}>All range sessions and stock changes are fully synchronized.</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }}>
          {offlineQueue.map((item, index) => (
            <Pressable key={index} style={styles.card} onPress={() => openEditModal(index)}>
              <View style={{ flex: 1 }}>
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>
                    {item.type === 'ammo_adjustment' ? 'Ammo Adjustment' : 
                     item.type === 'component_adjustment' ? 'Component Adjustment' : 
                     item.type === 'range_session' ? '🎯 Range Session' :
                     item.type === 'firearm_log' ? 'Firearm Log' : 
                     item.type === 'firearm_photo' ? 'Firearm Photo' :
                     item.type === 'universal_scan' ? 'Universal Scan' : 'Unknown'}
                  </Text>
                </View>
                
                {(item.type === 'ammo_adjustment' || item.type === 'component_adjustment' || item.type === 'universal_scan') && (
                  <Text style={styles.itemTitle}>{item.action === 'remove' ? '-' : '+'}{item.count} Items ({item.measurement || 'rds'})</Text>
                )}

                {item.type === 'range_session' && (
                  <>
                    <Text style={styles.itemTitle}>Firearm #{item.firearm_id} • {item.rounds_fired} Rounds</Text>
                    {item.ammo_id && <Text style={styles.itemDesc}>Deducting Ammo ID: {item.ammo_id}</Text>}
                    {item.notes && <Text style={styles.itemDesc}>"{item.notes}"</Text>}
                  </>
                )}
                
                {item.type === 'firearm_log' && (
                  <>
                    <Text style={styles.itemTitle}>{item.logType === 'maintenance' ? 'Maintenance' : 'Range Log'}</Text>
                    {item.roundCount > 0 && <Text style={styles.itemDesc}>{item.roundCount} Rounds Fired</Text>}
                    {item.notes && <Text style={styles.itemDesc}>"{item.notes}"</Text>}
                  </>
                )}

                {item.type === 'firearm_photo' && (
                  <Text style={styles.itemTitle}>New Photo for Firearm #{item.firearmId}</Text>
                )}
                
                <Text style={styles.timestamp}>{new Date(item.timestamp).toLocaleString()}</Text>
              </View>

              {item.photoBase64 && (
                <Image source={{ uri: item.photoBase64 }} style={styles.previewImage} />
              )}

              <Pressable style={styles.deleteButton} onPress={() => handleDelete(index)}>
                <Text style={styles.deleteText}>✕</Text>
              </Pressable>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>Back to Dashboard</Text>
      </Pressable>

      <Modal visible={editIndex !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Quantity</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={editQuantity}
              onChangeText={setEditQuantity}
              selectTextOnFocus
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Pressable style={[styles.modalBtn, { backgroundColor: '#475569' }]} onPress={() => setEditIndex(null)}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: '#10b981' }]} onPress={saveEdit}>
                <Text style={styles.modalBtnText}>Save</Text>
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
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 14,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
  },
  statusBannerTitle: {
    color: '#f8fafc',
    fontWeight: 'bold',
    fontSize: 13,
  },
  statusBannerSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#cbd5e1',
    marginBottom: 6,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  badgeContainer: {
    alignSelf: 'flex-start',
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#cbd5e1',
    textTransform: 'uppercase',
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 4,
  },
  itemDesc: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 6,
  },
  previewImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 10,
  },
  deleteButton: {
    backgroundColor: '#7f1d1d',
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteText: {
    color: '#fca5a5',
    fontSize: 15,
    fontWeight: 'bold',
  },
  backButton: {
    backgroundColor: '#334155',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  backButtonText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: 'bold',
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
    padding: 22,
    borderRadius: 14,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#0f172a',
    color: '#fff',
    width: '100%',
    textAlign: 'center',
    fontSize: 26,
    fontWeight: 'bold',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
    marginBottom: 18,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  }
});
