import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { MaintenanceWrenchIcon, SafeIcon } from './components/CustomMobileIcons';
import { useSync } from '../context/SyncContext';
import { useDialog } from '../context/DialogContext';
import type { Firearm, FirearmMaintenanceSyncItem } from '../types';

export default function MaintenanceScreen() {
  const { addToQueue, isModuleInstalled } = useSync();
  const { showSuccess, showError } = useDialog();

  const [firearms, setFirearms] = useState<Firearm[]>([]);
  const [selectedFirearm, setSelectedFirearm] = useState<Firearm | null>(null);
  const [activeTab, setActiveTab] = useState<'status' | 'history'>('status');

  // Service Log Modal state
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [serviceType, setServiceType] = useState<'Cleaning' | 'Inspection' | 'Parts Replacement' | 'Repair'>('Cleaning');
  const [taskName, setTaskName] = useState('Standard Field Strip & Clean');
  const [roundsAtService, setRoundsAtService] = useState('');
  const [partsReplaced, setPartsReplaced] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    try {
      const cacheStr = await AsyncStorage.getItem('inventory_cache');
      if (cacheStr) {
        const parsed = JSON.parse(cacheStr);
        if (Array.isArray(parsed.firearms)) {
          setFirearms(parsed.firearms);
        }
      }
    } catch (e) {
      console.warn('Error loading maintenance inventory:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute all maintenance logs across all firearms
  const allLogs = useMemo(() => {
    const list: Array<{
      firearmName: string;
      firearmId?: number;
      date: string;
      type: string;
      rounds?: number;
      notes?: string;
      cost?: number;
    }> = [];

    firearms.forEach((f) => {
      (f.logs || []).forEach((l) => {
        if (l.type === 'Cleaning' || l.type === 'Modification' || l.type === 'Repair' || l.type === 'Other') {
          list.push({
            firearmName: `${f.make} ${f.model}`,
            firearmId: f.id,
            date: l.date,
            type: l.type,
            rounds: l.rounds_fired,
            notes: l.notes,
            cost: l.cost,
          });
        }
      });
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [firearms]);

  const handleOpenLogModal = (firearm: Firearm) => {
    setSelectedFirearm(firearm);
    setServiceType('Cleaning');
    setTaskName('Standard Field Strip & Clean');
    setRoundsAtService(String(firearm.total_rounds || firearm.round_count || 0));
    setPartsReplaced('');
    setCost('');
    setNotes('');
    setIsLogModalOpen(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const handleSubmitService = async () => {
    if (!selectedFirearm) return;

    const rounds = parseInt(roundsAtService, 10) || 0;
    const costNum = parseFloat(cost) || 0;
    const today = new Date().toISOString().split('T')[0];

    const payload: FirearmMaintenanceSyncItem = {
      type: 'firearm_maintenance',
      firearm_id: selectedFirearm.id || 0,
      date: today,
      task_name: taskName,
      service_type: serviceType,
      rounds_at_service: rounds,
      parts_replaced: partsReplaced.trim(),
      cost: costNum,
      notes: notes.trim(),
      timestamp: new Date().toISOString(),
    };

    // 1. Add to offline sync outbox
    await addToQueue(payload, 'Maintenance service event queued for Desktop');

    // 2. Optimistically append log into local firearm cache
    const newLog = {
      id: Date.now(),
      date: today,
      type: serviceType === 'Cleaning' ? 'Cleaning' : serviceType === 'Repair' ? 'Repair' : 'Modification',
      rounds_fired: 0,
      cost: costNum,
      notes: `${taskName}${partsReplaced ? ` (Parts: ${partsReplaced})` : ''} - ${notes.trim()}`,
    };

    const updatedList = firearms.map((f) => {
      if (f.id === selectedFirearm.id) {
        return {
          ...f,
          logs: [newLog as any, ...(f.logs || [])],
        };
      }
      return f;
    });
    setFirearms(updatedList);

    try {
      const cacheStr = await AsyncStorage.getItem('inventory_cache');
      if (cacheStr) {
        const cache = JSON.parse(cacheStr);
        cache.firearms = updatedList;
        await AsyncStorage.setItem('inventory_cache', JSON.stringify(cache));
      }
    } catch {}

    setIsLogModalOpen(false);
    setSelectedFirearm(null);
    showSuccess('Service Logged', `Recorded ${serviceType.toLowerCase()} service for ${selectedFirearm.make} ${selectedFirearm.model}.`);
  };

  const isModuleActive = isModuleInstalled('maintenance');

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      {/* Sub-tabs */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabBtn, activeTab === 'status' && styles.tabBtnActive]}
          onPress={() => setActiveTab('status')}
        >
          <Ionicons name="speedometer-outline" size={16} color={activeTab === 'status' ? '#38bdf8' : '#64748b'} />
          <Text style={[styles.tabBtnText, activeTab === 'status' && styles.tabBtnTextActive]}>
            Armory Wear & Service
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}
          onPress={() => setActiveTab('history')}
        >
          <Ionicons name="receipt-outline" size={16} color={activeTab === 'history' ? '#38bdf8' : '#64748b'} />
          <Text style={[styles.tabBtnText, activeTab === 'history' && styles.tabBtnTextActive]}>
            Service Ledger ({allLogs.length})
          </Text>
        </Pressable>
      </View>

      {!isModuleActive && (
        <View style={styles.disabledBanner}>
          <Ionicons name="information-circle-outline" size={18} color="#f59e0b" style={{ marginRight: 6 }} />
          <Text style={styles.disabledBannerText}>
            Armorer Module not installed on paired Desktop. Operating in standalone mobile mode.
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeTab === 'status' ? (
          firearms.map((f) => {
            const totalRds = f.total_rounds || f.round_count || 0;
            // Preset cleaning threshold: 500 rounds
            const cleaningInterval = 500;
            const rdsSinceClean = totalRds % cleaningInterval;
            const cleanPct = Math.min(100, Math.round((rdsSinceClean / cleaningInterval) * 100));
            const isDueSoon = cleanPct >= 80;

            return (
              <View key={f.id || f.serial_number} style={styles.gunCard}>
                <View style={styles.gunCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.gunTitle}>
                      {f.make} {f.model}
                    </Text>
                    <Text style={styles.gunSub}>
                      {f.caliber} • SN: {f.serial_number || 'N/A'}
                    </Text>
                  </View>
                  <Pressable style={styles.logServiceBtn} onPress={() => handleOpenLogModal(f)}>
                    <MaintenanceWrenchIcon size={14} color="#fff" />
                    <Text style={styles.logServiceBtnText}>Log Service</Text>
                  </Pressable>
                </View>

                {/* Telemetry Metrics */}
                <View style={styles.telemetryRow}>
                  <View style={styles.telemetryItem}>
                    <Text style={styles.telemetryVal}>{totalRds.toLocaleString()}</Text>
                    <Text style={styles.telemetryLabel}>LIFETIME ROUNDS</Text>
                  </View>
                  <View style={styles.telemetryDivider} />
                  <View style={styles.telemetryItem}>
                    <Text style={[styles.telemetryVal, isDueSoon && { color: '#fbbf24' }]}>
                      {rdsSinceClean} / {cleaningInterval}
                    </Text>
                    <Text style={styles.telemetryLabel}>ROUNDS SINCE CLEAN</Text>
                  </View>
                  <View style={styles.telemetryDivider} />
                  <View style={styles.telemetryItem}>
                    <Text style={[styles.telemetryVal, { color: isDueSoon ? '#fbbf24' : '#34d399' }]}>
                      {isDueSoon ? 'DUE SOON' : 'NOMINAL'}
                    </Text>
                    <Text style={styles.telemetryLabel}>HEALTH STATUS</Text>
                  </View>
                </View>

                {/* Progress Wear Bar */}
                <View style={styles.wearBarWrapper}>
                  <View
                    style={[
                      styles.wearBarFill,
                      {
                        width: `${cleanPct}%`,
                        backgroundColor: isDueSoon ? '#f59e0b' : '#3b82f6',
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })
        ) : (
          allLogs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaintenanceWrenchIcon size={44} color="#64748b" />
              <Text style={styles.emptyTitle}>No Maintenance Logs</Text>
              <Text style={styles.emptySubtitle}>
                Service logs recorded on Desktop or via Field Companion will appear here.
              </Text>
            </View>
          ) : (
            allLogs.map((log, idx) => (
              <View key={idx} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <View style={styles.logTag}>
                    <Text style={styles.logTagText}>{log.type.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.logDate}>{log.date}</Text>
                </View>
                <Text style={styles.logGunTitle}>{log.firearmName}</Text>
                {log.notes ? <Text style={styles.logNotes}>{log.notes}</Text> : null}
                {log.cost ? (
                  <Text style={styles.logCost}>Cost: ${Number(log.cost).toFixed(2)}</Text>
                ) : null}
              </View>
            ))
          )
        )}
      </ScrollView>

      {/* Service Modal */}
      <Modal visible={isLogModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Log Armorer Service</Text>
                <Text style={styles.modalSub}>
                  {selectedFirearm?.make} {selectedFirearm?.model}
                </Text>
              </View>
              <Pressable onPress={() => setIsLogModalOpen(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>SERVICE TYPE</Text>
                <View style={styles.serviceTypeRow}>
                  {(['Cleaning', 'Inspection', 'Parts Replacement', 'Repair'] as const).map((t) => (
                    <Pressable
                      key={t}
                      style={[styles.typeChip, serviceType === t && styles.typeChipActive]}
                      onPress={() => setServiceType(t)}
                    >
                      <Text style={[styles.typeChipText, serviceType === t && styles.typeChipTextActive]}>
                        {t}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>TASK DESCRIPTION</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Field Strip & Ultrasonic Bolt Cleaning"
                  placeholderTextColor="#64748b"
                  value={taskName}
                  onChangeText={setTaskName}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>ROUNDS AT SERVICE</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="0"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                    value={roundsAtService}
                    onChangeText={setRoundsAtService}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>SERVICE COST ($)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="0.00"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                    value={cost}
                    onChangeText={setCost}
                  />
                </View>
              </View>

              {serviceType === 'Parts Replacement' || serviceType === 'Repair' ? (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>PARTS REPLACED / INSTALLED</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. Recoil Spring Assembly, Extractor, Gas Ring"
                    placeholderTextColor="#64748b"
                    value={partsReplaced}
                    onChangeText={setPartsReplaced}
                  />
                </View>
              ) : null}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>SERVICE NOTES & INSPECTION REMARKS</Text>
                <TextInput
                  style={[styles.formInput, { height: 60, textAlignVertical: 'top' }]}
                  placeholder="Bore condition, extractor tension, wear patterns..."
                  placeholderTextColor="#64748b"
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>
            </ScrollView>

            <View style={styles.modalButtonsRow}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setIsLogModalOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSubmitBtn} onPress={handleSubmitService}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.modalSubmitText}>Queue Service Entry</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(100, 116, 139, 0.2)',
    gap: 10,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.2)',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38bdf8',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tabBtnTextActive: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  disabledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 158, 11, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  disabledBannerText: {
    fontSize: 11,
    color: '#fbbf24',
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
    gap: 12,
  },
  gunCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.25)',
    padding: 14,
    gap: 10,
  },
  gunCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  gunTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#f8fafc',
  },
  gunSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 1,
  },
  logServiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  logServiceBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  telemetryRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  telemetryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  telemetryVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#f1f5f9',
    fontVariant: ['tabular-nums'],
  },
  telemetryLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.4,
  },
  telemetryDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
  },
  wearBarWrapper: {
    height: 4,
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  wearBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  logCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.25)',
    padding: 12,
    gap: 6,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logTag: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  logTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fbbf24',
    letterSpacing: 0.5,
  },
  logDate: {
    fontSize: 11,
    color: '#64748b',
  },
  logGunTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
  },
  logNotes: {
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 16,
  },
  logCost: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34d399',
  },
  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.3)',
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
  },
  modalSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  serviceTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.25)',
  },
  typeChipActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: '#f59e0b',
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  typeChipTextActive: {
    color: '#fbbf24',
    fontWeight: '700',
  },
  formInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#f8fafc',
    fontSize: 13,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  modalSubmitBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
});
