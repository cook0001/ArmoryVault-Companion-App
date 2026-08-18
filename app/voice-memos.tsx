import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
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
  const [recordingInstance, setRecordingInstance] = useState<any | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [currentPlayingSound, setCurrentPlayingSound] = useState<any | null>(null);
  const [playingMemoId, setPlayingMemoId] = useState<string | null>(null);

  const [memoTitle, setMemoTitle] = useState('Bench Inspection Note');
  const [transcriptNotes, setTranscriptNotes] = useState('');
  const hasNativeAudio = isAudioAvailable();

  useEffect(() => {
    loadMemos();
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

  const handleStartRecord = async () => {
    if (!hasNativeAudio) {
      // Fallback to text bench note
      if (!transcriptNotes.trim()) {
        showToast({ message: 'Enter your inspection note text below', type: 'info' });
        return;
      }
      const saved = await saveTextBenchMemo(memoTitle, transcriptNotes);
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
        undefined,
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
          if (status.isLoaded && status.didJustFinish) {
            setPlayingMemoId(null);
            setCurrentPlayingSound(null);
          }
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteOne = (memo: AudioMemo) => {
    showConfirm({
      title: 'Delete Voice Memo?',
      message: `Permanently delete "${memo.title}"? This cannot be undone.`,
      confirmText: 'Delete Memo',
      type: 'danger',
      onConfirm: async () => {
        await deleteAudioMemo(memo.id);
        showToast({ message: 'Voice memo deleted', type: 'info' });
        loadMemos();
      }
    });
  };

  const handleWipeAll = () => {
    showConfirm({
      title: 'Wipe All Voice Logs?',
      message: `Are you sure you want to permanently delete all ${memos.length} voice memos from this device? Zero copies will remain.`,
      confirmText: 'Wipe All Audio',
      type: 'danger',
      onConfirm: async () => {
        await wipeAllAudioMemos();
        showToast({ message: 'All voice logs permanently wiped', type: 'info' });
        loadMemos();
      }
    });
  };

  return (
    <View style={styles.container}>
      {/* 1. Record Panel */}
      <View style={styles.recordCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <View style={[styles.pulseDot, isRecording && styles.pulseDotActive]} />
          <Text style={styles.recordCardTitle}>
            {isRecording ? `Recording... (${recordingSeconds}s)` : 'Secure Bench Voice Recorder'}
          </Text>
        </View>

        <TextInput
          style={styles.titleInput}
          placeholder="Voice note title (e.g. Barrel fouling check, trigger feel)..."
          placeholderTextColor="#64748b"
          value={memoTitle}
          onChangeText={setMemoTitle}
        />

        <TextInput
          style={styles.transcriptInput}
          placeholder="Optional transcript / summary notes..."
          placeholderTextColor="#64748b"
          value={transcriptNotes}
          onChangeText={setTranscriptNotes}
        />

        {/* Record / Stop Button */}
        <Pressable
          style={[styles.recordBtn, isRecording ? styles.recordBtnActive : styles.recordBtnIdle]}
          onPress={isRecording ? handleStopRecord : handleStartRecord}
        >
          <Ionicons 
            name={isRecording ? "stop-circle" : hasNativeAudio ? "mic" : "save-outline"} 
            size={24} 
            color="#fff" 
            style={{ marginRight: 8 }} 
          />
          <Text style={styles.recordBtnText}>
            {isRecording 
              ? 'Stop & Save Memo' 
              : hasNativeAudio 
                ? 'Start Recording Voice Memo' 
                : 'Save Bench Note'}
          </Text>
        </Pressable>

        <Text style={styles.privacyNotice}>
          🔒 100% On-Device & Air-Gapped. No audio data ever leaves your device.
        </Text>
      </View>

      {/* 2. Memos List Header & Wipe Button */}
      <View style={styles.listHeaderRow}>
        <Text style={styles.sectionHeader}>Saved Voice Logs ({memos.length})</Text>
        {memos.length > 0 && (
          <Pressable style={styles.wipeBtn} onPress={handleWipeAll}>
            <Ionicons name="trash" size={14} color="#ef4444" style={{ marginRight: 4 }} />
            <Text style={styles.wipeBtnText}>Wipe All Logs</Text>
          </Pressable>
        )}
      </View>

      {/* 3. Memos List */}
      <FlatList
        data={memos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => {
          const isPlaying = playingMemoId === item.id;
          const sizeKb = Math.round(item.fileSizeBytes / 1024);

          return (
            <View style={styles.memoCard}>
              <Pressable style={styles.playBtn} onPress={() => handlePlay(item)}>
                <Ionicons 
                  name={isPlaying ? "pause" : item.fileUri ? "play" : "document-text-outline"} 
                  size={20} 
                  color="#fff" 
                />
              </Pressable>

              <View style={{ flex: 1, marginHorizontal: 12 }}>
                <Text style={styles.memoTitle}>{item.title}</Text>
                <Text style={styles.memoMeta}>
                  {item.durationSec > 0 ? `${item.durationSec}s • ` : ''}{sizeKb > 0 ? `${sizeKb} KB • ` : ''}{new Date(item.createdAt).toLocaleDateString()}
                </Text>
                {item.transcript && (
                  <Text style={styles.memoTranscript} numberOfLines={2}>
                    "{item.transcript}"
                  </Text>
                )}
              </View>

              <Pressable style={styles.deleteBtn} onPress={() => handleDeleteOne(item)}>
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="mic-outline" size={48} color="#475569" style={{ marginBottom: 10 }} />
            <Text style={styles.emptyTitle}>No Voice Logs</Text>
            <Text style={styles.emptySubtitle}>
              Tap the record button above to record voice notes during maintenance or range trips.
            </Text>
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
  recordCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#64748b',
    marginRight: 8,
  },
  pulseDotActive: {
    backgroundColor: '#ef4444',
  },
  recordCardTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: 'bold',
  },
  titleInput: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 8,
  },
  transcriptInput: {
    backgroundColor: '#0f172a',
    color: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
  },
  recordBtnIdle: {
    backgroundColor: '#ef4444',
  },
  recordBtnActive: {
    backgroundColor: '#991b1b',
  },
  recordBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  privacyNotice: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeader: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  wipeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#ef4444',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  wipeBtnText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: 'bold',
  },
  memoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: 'bold',
  },
  memoMeta: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  memoTranscript: {
    color: '#cbd5e1',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  deleteBtn: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 10,
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptySubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  }
});
