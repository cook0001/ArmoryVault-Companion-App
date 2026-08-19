import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useDialog } from '../context/DialogContext';
import { useSync } from '../context/SyncContext';
import { 
  AudioMemo, 
  getAudioMemos, 
  startAudioRecording, 
  stopAndSaveAudioRecording, 
  saveTextBenchMemo,
  deleteAudioMemo, 
  wipeAllAudioMemos, 
  playAudioMemo,
  isAudioAvailable
} from '../utils/audioMemoManager';

export default function VoiceMemosScreen() {
  const router = useRouter();
  const { showToast, showConfirm, showSuccess, showError } = useDialog();
  const { addToQueue } = useSync();

  const [memos, setMemos] = useState<AudioMemo[]>([]);
  const [firearms, setFirearms] = useState<any[]>([]);
  const [ammoList, setAmmoList] = useState<any[]>([]);

  // Selected Tags
  const [selectedFirearmId, setSelectedFirearmId] = useState<number | null>(null);
  const [selectedAmmoId, setSelectedAmmoId] = useState<number | null>(null);

  // Recording State
  const [recordingInstance, setRecordingInstance] = useState<any | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [currentPlayingSound, setCurrentPlayingSound] = useState<any | null>(null);
  const [playingMemoId, setPlayingMemoId] = useState<string | null>(null);

  const [memoTitle, setMemoTitle] = useState('Bench Inspection Note');
  const [transcriptNotes, setTranscriptNotes] = useState('');
  const hasNativeAudio = isAudioAvailable();

  // Filter state
  const [filterQuery, setFilterQuery] = useState('');

  useEffect(() => {
    loadMemos();
    loadCachedInventory();
    return () => {
      if (currentPlayingSound && typeof currentPlayingSound.unloadAsync === 'function') {
        currentPlayingSound.unloadAsync().catch(() => {});
      }
    };
  }, []);

  // Timer while recording
  useEffect(() => {
    let interval: any = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const loadMemos = async () => {
    const data = await getAudioMemos();
    setMemos(data);
  };

  const loadCachedInventory = async () => {
    try {
      const cacheStr = await AsyncStorage.getItem('inventory_cache');
      if (cacheStr) {
        const cache = JSON.parse(cacheStr);
        setFirearms(cache.firearms || []);
        setAmmoList(cache.ammo || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const selectedFirearm = firearms.find(f => f.id === selectedFirearmId);
  const selectedAmmo = ammoList.find(a => a.id === selectedAmmoId);

  const handleStartRecord = async () => {
    if (!hasNativeAudio) {
      if (!transcriptNotes.trim()) {
        showToast({ message: 'Enter your inspection note text below', type: 'info' });
        return;
      }
      const saved = await saveTextBenchMemo(
        memoTitle, 
        transcriptNotes, 
        selectedFirearmId || undefined,
        selectedFirearm ? `${selectedFirearm.make} ${selectedFirearm.model}` : undefined,
        selectedAmmoId || undefined,
        selectedAmmo ? `${selectedAmmo.manufacturer || ''} ${selectedAmmo.caliber}` : undefined
      );
      showSuccess('Bench Note Saved', `Stored locally: "${saved.title}"`);
      setTranscriptNotes('');
      loadMemos();
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      const rec = await startAudioRecording();
      if (!rec) {
        showError('Permission Error', 'Microphone access is required for voice memos');
        return;
      }
      setRecordingInstance(rec);
      setIsRecording(true);
      showToast({ message: '🎙️ Recording voice note...', type: 'info' });
    } catch (e) {
      console.error(e);
      showError('Record Error', 'Could not initialize recording');
    }
  };

  const handleStopRecord = async () => {
    if (!recordingInstance) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setIsRecording(false);
      const savedMemo = await stopAndSaveAudioRecording(
        recordingInstance,
        memoTitle.trim() || 'Bench Voice Memo',
        selectedFirearmId || undefined,
        selectedFirearm ? `${selectedFirearm.make} ${selectedFirearm.model}` : undefined,
        selectedAmmoId || undefined,
        selectedAmmo ? `${selectedAmmo.manufacturer || ''} ${selectedAmmo.caliber}` : undefined,
        transcriptNotes.trim() || undefined
      );

      setRecordingInstance(null);
      setTranscriptNotes('');
      if (savedMemo) {
        showSuccess('Voice Memo Saved', `Stored securely on-device (${savedMemo.durationSec}s)`);
        loadMemos();
      }
    } catch (e) {
      console.error(e);
      showError('Save Error', 'Failed to save recording');
    }
  };

  const handlePlay = async (memo: AudioMemo) => {
    try {
      if (currentPlayingSound && typeof currentPlayingSound.stopAsync === 'function') {
        await currentPlayingSound.stopAsync();
        await currentPlayingSound.unloadAsync();
      }

      if (playingMemoId === memo.id) {
        setPlayingMemoId(null);
        setCurrentPlayingSound(null);
        return;
      }

      if (!memo.fileUri) {
        showToast({ message: 'Text-only memo (No audio stream)', type: 'info' });
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const sound = await playAudioMemo(memo.fileUri);
      if (sound) {
        setCurrentPlayingSound(sound);
        setPlayingMemoId(memo.id);
        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.didJustFinish) {
            setPlayingMemoId(null);
            setCurrentPlayingSound(null);
          }
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = (memoId: string, title: string) => {
    showConfirm({
      title: 'Delete Voice Memo?',
      message: `Are you sure you want to permanently delete "${title}"?`,
      confirmText: 'Delete',
      type: 'danger',
      onConfirm: async () => {
        await deleteAudioMemo(memoId);
        showToast({ message: 'Voice memo deleted', type: 'info' });
        loadMemos();
      }
    });
  };

  const handleWipeAll = () => {
    showConfirm({
      title: 'Purge All Voice Logs?',
      message: 'This will irreversibly delete all audio recordings and local bench memos from your device for total data privacy.',
      confirmText: 'Purge All Logs',
      type: 'danger',
      onConfirm: async () => {
        await wipeAllAudioMemos();
        showToast({ message: 'All voice memos purged', type: 'info' });
        loadMemos();
      }
    });
  };

  const filteredMemos = useMemo(() => {
    if (!filterQuery.trim()) return memos;
    const q = filterQuery.toLowerCase();
    return memos.filter(m => 
      m.title.toLowerCase().includes(q) ||
      (m.firearmName && m.firearmName.toLowerCase().includes(q)) ||
      (m.ammoName && m.ammoName.toLowerCase().includes(q)) ||
      (m.transcript && m.transcript.toLowerCase().includes(q))
    );
  }, [memos, filterQuery]);

  return (
    <View style={styles.container}>
      {/* Privacy Notice Banner */}
      <View style={styles.privacyBanner}>
        <Ionicons name="lock-closed" size={16} color="#10b981" style={{ marginRight: 6 }} />
        <Text style={styles.privacyText}>
          Air-Gapped & Private: Voice recordings never leave this device.
        </Text>
      </View>

      {/* Recording Studio Card */}
      <View style={styles.studioCard}>
        <Text style={styles.studioTitle}>1. Record Voice Memo / Bench Note</Text>
        
        <TextInput
          style={styles.titleInput}
          placeholder="Memo Subject (e.g. S&W 686 Timing Check, Bad Ammo Batch)..."
          placeholderTextColor="#64748b"
          value={memoTitle}
          onChangeText={setMemoTitle}
        />

        {/* Tag Firearm Selector */}
        <Text style={styles.tagSectionLabel}>Tag Firearm (Optional):</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagScrollRow}>
          <Pressable
            style={[styles.tagChip, selectedFirearmId === null && styles.tagChipActive]}
            onPress={() => setSelectedFirearmId(null)}
          >
            <Text style={[styles.tagChipText, selectedFirearmId === null && styles.tagChipTextActive]}>
              None
            </Text>
          </Pressable>
          {firearms.map(f => (
            <Pressable
              key={f.id}
              style={[styles.tagChip, selectedFirearmId === f.id && styles.tagChipActive]}
              onPress={() => setSelectedFirearmId(selectedFirearmId === f.id ? null : f.id)}
            >
              <Text style={[styles.tagChipText, selectedFirearmId === f.id && styles.tagChipTextActive]}>
                🔫 {f.make} {f.model}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Tag Ammo Lot Selector (for reporting bad ammo) */}
        <Text style={styles.tagSectionLabel}>Tag Ammo Lot (e.g. Suspected Bad Ammo):</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagScrollRow}>
          <Pressable
            style={[styles.tagChip, selectedAmmoId === null && styles.tagChipActive]}
            onPress={() => setSelectedAmmoId(null)}
          >
            <Text style={[styles.tagChipText, selectedAmmoId === null && styles.tagChipTextActive]}>
              None
            </Text>
          </Pressable>
          {ammoList.map(a => (
            <Pressable
              key={a.id}
              style={[styles.tagChip, selectedAmmoId === a.id && styles.tagChipAmmoActive]}
              onPress={() => setSelectedAmmoId(selectedAmmoId === a.id ? null : a.id)}
            >
              <Text style={[styles.tagChipText, selectedAmmoId === a.id && { color: '#f87171' }]}>
                📦 {a.manufacturer || ''} {a.caliber}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Notes input */}
        <TextInput
          style={styles.transcriptInput}
          placeholder="Type notes or transcription summary..."
          placeholderTextColor="#64748b"
          value={transcriptNotes}
          onChangeText={setTranscriptNotes}
          multiline
        />

        {/* Record Button & Timer */}
        <View style={styles.recordActionRow}>
          {isRecording ? (
            <Pressable style={styles.stopBtn} onPress={handleStopRecord}>
              <Ionicons name="stop" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.stopBtnText}>Stop & Save ({recordingSeconds}s)</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.recordBtn} onPress={handleStartRecord}>
              <Ionicons name="mic" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.recordBtnText}>
                {hasNativeAudio ? 'Start Voice Recording' : 'Save Text Bench Note'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Saved Memos Header & Filter */}
      <View style={styles.listHeaderRow}>
        <Text style={styles.listHeaderTitle}>Saved Voice Memos ({filteredMemos.length})</Text>
        {memos.length > 0 && (
          <Pressable style={styles.purgeBtn} onPress={handleWipeAll}>
            <Ionicons name="trash" size={13} color="#ef4444" style={{ marginRight: 4 }} />
            <Text style={styles.purgeBtnText}>Purge All</Text>
          </Pressable>
        )}
      </View>

      {/* Memos List */}
      <FlatList
        data={filteredMemos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => {
          const isPlaying = playingMemoId === item.id;
          return (
            <View style={styles.memoCard}>
              <View style={styles.memoHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memoTitle}>{item.title}</Text>
                  <Text style={styles.memoDate}>
                    {new Date(item.createdAt).toLocaleDateString()} • {item.durationSec > 0 ? `${item.durationSec}s audio` : 'Text Note'}
                  </Text>
                </View>

                {/* Play Button */}
                {item.fileUri ? (
                  <Pressable 
                    style={[styles.playBtn, isPlaying && styles.playBtnActive]} 
                    onPress={() => handlePlay(item)}
                  >
                    <Ionicons name={isPlaying ? "pause" : "play"} size={16} color="#fff" />
                  </Pressable>
                ) : null}

                <Pressable onPress={() => handleDelete(item.id, item.title)} style={{ padding: 4, marginLeft: 8 }}>
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </Pressable>
              </View>

              {/* Tag Badges */}
              {(item.firearmName || item.ammoName) && (
                <View style={styles.memoBadgeRow}>
                  {item.firearmName && (
                    <View style={styles.gunTagBadge}>
                      <Text style={styles.gunTagText}>🔫 {item.firearmName}</Text>
                    </View>
                  )}
                  {item.ammoName && (
                    <View style={styles.ammoTagBadge}>
                      <Text style={styles.ammoTagText}>📦 {item.ammoName}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Transcript */}
              {item.transcript ? (
                <Text style={styles.memoTranscript}>{item.transcript}</Text>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="mic-outline" size={40} color="#475569" style={{ marginBottom: 8 }} />
            <Text style={styles.emptyTitle}>No Voice Memos Recorded</Text>
            <Text style={styles.emptySub}>Record local gunsmithing and range voice notes above.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 12,
  },
  privacyText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  studioCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
  },
  studioTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  titleInput: {
    backgroundColor: '#0f172a',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 8,
  },
  tagSectionLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 4,
    marginTop: 4,
  },
  tagScrollRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  tagChip: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tagChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38bdf8',
  },
  tagChipAmmoActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#ef4444',
  },
  tagChipText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  tagChipTextActive: {
    color: '#38bdf8',
    fontWeight: 'bold',
  },
  transcriptInput: {
    backgroundColor: '#0f172a',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
    height: 55,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  recordActionRow: {
    marginTop: 4,
  },
  recordBtn: {
    flexDirection: 'row',
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  stopBtn: {
    flexDirection: 'row',
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  listHeaderTitle: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  purgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  purgeBtnText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: 'bold',
  },
  memoCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  memoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memoTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: 'bold',
  },
  memoDate: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  playBtn: {
    backgroundColor: '#10b981',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnActive: {
    backgroundColor: '#f59e0b',
  },
  memoBadgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  gunTagBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  gunTagText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  ammoTagBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  ammoTagText: {
    color: '#f87171',
    fontSize: 10,
    fontWeight: 'bold',
  },
  memoTranscript: {
    color: '#cbd5e1',
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptySub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  }
});
