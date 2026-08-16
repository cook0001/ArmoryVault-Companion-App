import { View, Text, StyleSheet, Pressable, ScrollView, Alert, Image, Modal, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useCallback } from 'react';

export default function Outbox() {
  const router = useRouter();
  const [queue, setQueue] = useState<any[]>([]);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editQuantity, setEditQuantity] = useState('1');

  useFocusEffect(
    useCallback(() => {
      loadQueue();
    }, [])
  );

  const loadQueue = async () => {
    try {
      const queueStr = await AsyncStorage.getItem('offline_queue');
      if (queueStr) {
        setQueue(JSON.parse(queueStr));
      } else {
        setQueue([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = (index: number) => {
    Alert.alert(
      "Delete Item",
      "Are you sure you want to remove this item from your sync queue?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              const newQueue = [...queue];
              newQueue.splice(index, 1);
              await AsyncStorage.setItem('offline_queue', JSON.stringify(newQueue));
              setQueue(newQueue);
            } catch (e) {
              console.error(e);
            }
          }
        }
      ]
    );
  };

  const openEditModal = (index: number) => {
    const item = queue[index];
    if (item.type === 'ammo_adjustment' || item.type === 'component_adjustment') {
      setEditIndex(index);
      setEditQuantity(String(item.count));
    } else {
      Alert.alert('Not Editable', 'Only quantity adjustments can be edited in the outbox.');
    }
  };

  const saveEdit = async () => {
    if (editIndex === null) return;
    const parsed = parseInt(editQuantity);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid', 'Please enter a valid quantity greater than 0.');
      return;
    }

    try {
      const newQueue = [...queue];
      newQueue[editIndex].count = parsed;
      await AsyncStorage.setItem('offline_queue', JSON.stringify(newQueue));
      setQueue(newQueue);
      setEditIndex(null);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to save changes.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Pending Syncs</Text>
      <Text style={styles.headerSubtitle}>Items below will be sent to the desktop app on your next sync.</Text>

      {queue.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Your outbox is empty.</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }}>
          {queue.map((item, index) => (
            <Pressable key={index} style={styles.card} onPress={() => openEditModal(index)}>
              <View style={{ flex: 1 }}>
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>
                    {item.type === 'ammo_adjustment' ? 'Ammo Adjustment' : 
                     item.type === 'component_adjustment' ? 'Component Adjustment' : 
                     item.type === 'firearm_log' ? 'Firearm Log' : 
                     item.type === 'firearm_photo' ? 'Firearm Photo' : 'Unknown'}
                  </Text>
                </View>
                
                {(item.type === 'ammo_adjustment' || item.type === 'component_adjustment') && (
                  <Text style={styles.itemTitle}>{item.action === 'add' ? '+' : '-'}{item.count} Items</Text>
                )}
                
                {item.type === 'firearm_log' && (
                  <>
                    <Text style={styles.itemTitle}>{item.logType === 'range' ? 'Range Log' : 'Maintenance'}</Text>
                    {item.roundCount > 0 && <Text style={styles.itemDesc}>{item.roundCount} Rounds Fired</Text>}
                    {item.notes && <Text style={styles.itemDesc}>"{item.notes}"</Text>}
                  </>
                )}

                {item.type === 'firearm_photo' && (
                  <Text style={styles.itemTitle}>New Photo</Text>
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

      <Modal visible={editIndex !== null} transparent={true} animationType="slide">
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
              <Pressable style={[styles.modalBtn, { backgroundColor: '#64748b' }]} onPress={() => setEditIndex(null)}>
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
    padding: 20,
    backgroundColor: '#0f172a',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#64748b',
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
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
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
  },
  previewImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 10,
  },
  deleteButton: {
    backgroundColor: '#7f1d1d',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteText: {
    color: '#fca5a5',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    backgroundColor: '#334155',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  backButtonText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 12,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: '#0f172a',
    color: '#fff',
    width: '100%',
    textAlign: 'center',
    fontSize: 24,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
