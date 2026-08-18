import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Safe dynamic resolution of expo-av to prevent top-level crashes if native binary hasn't been rebuilt
let ExpoAudio: any = null;
try {
  const av = require('expo-av');
  if (av && av.Audio) {
    ExpoAudio = av.Audio;
  }
} catch (e) {
  // Graceful fallback for environments where ExponentAV native binary is not yet compiled
}

export interface AudioMemo {
  id: string;
  firearmId?: number;
  ammoId?: number;
  title: string;
  durationSec: number;
  fileUri: string;
  fileSizeBytes: number;
  transcript?: string;
  createdAt: string;
}

const STORAGE_KEY_AUDIO_METADATA = 'armoryvault_audio_memos_meta';

/**
 * Checks if native audio recording is available in the current runtime.
 */
export function isAudioAvailable(): boolean {
  return !!ExpoAudio;
}

/**
 * Request microphone permissions for local on-device voice notes.
 */
export async function requestAudioPermissions(): Promise<boolean> {
  if (!ExpoAudio) return false;
  try {
    const { granted } = await ExpoAudio.requestPermissionsAsync();
    return granted;
  } catch (e) {
    console.warn('Audio permission request error:', e);
    return false;
  }
}

/**
 * Starts a new on-device audio recording.
 */
export async function startAudioRecording(): Promise<any | null> {
  if (!ExpoAudio) return null;
  try {
    const hasPermission = await requestAudioPermissions();
    if (!hasPermission) return null;

    await ExpoAudio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const recording = new ExpoAudio.Recording();
    await recording.prepareToRecordAsync(ExpoAudio.RecordingOptionsPresets.HIGH_QUALITY);
    await recording.startAsync();
    return recording;
  } catch (e) {
    console.warn('startAudioRecording error:', e);
    return null;
  }
}

/**
 * Stops recording and persists the audio memo locally.
 */
export async function stopAndSaveAudioRecording(
  recording: any,
  title: string = 'Bench Audio Memo',
  firearmId?: number,
  transcript?: string
): Promise<AudioMemo | null> {
  try {
    let uri = '';
    let durationSec = 1;

    if (recording && typeof recording.stopAndUnloadAsync === 'function') {
      await recording.stopAndUnloadAsync();
      uri = recording.getURI() || '';
      const status = await recording.getStatusAsync();
      durationSec = Math.max(1, Math.round((status?.durationMillis || 0) / 1000));
    }

    const id = `memo_${Date.now()}`;
    let fileSizeBytes = 0;

    if (uri) {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      fileSizeBytes = fileInfo.exists ? (fileInfo.size || 0) : 0;
    }

    const memo: AudioMemo = {
      id,
      firearmId,
      title: title.trim() || 'Bench Voice Memo',
      durationSec,
      fileUri: uri,
      fileSizeBytes,
      transcript: transcript || 'Recorded bench note',
      createdAt: new Date().toISOString()
    };

    // Save to metadata index
    const existing = await getAudioMemos();
    const updated = [memo, ...existing];
    await AsyncStorage.setItem(STORAGE_KEY_AUDIO_METADATA, JSON.stringify(updated));

    return memo;
  } catch (e) {
    console.error('Error saving audio memo:', e);
    return null;
  }
}

/**
 * Creates a text-based bench note entry if audio recording hardware is unavailable.
 */
export async function saveTextBenchMemo(
  title: string,
  transcript: string,
  firearmId?: number
): Promise<AudioMemo> {
  const id = `memo_${Date.now()}`;
  const memo: AudioMemo = {
    id,
    firearmId,
    title: title.trim() || 'Bench Note',
    durationSec: 0,
    fileUri: '',
    fileSizeBytes: 0,
    transcript: transcript.trim() || 'Bench inspection note',
    createdAt: new Date().toISOString()
  };

  const existing = await getAudioMemos();
  const updated = [memo, ...existing];
  await AsyncStorage.setItem(STORAGE_KEY_AUDIO_METADATA, JSON.stringify(updated));
  return memo;
}

/**
 * Loads all saved audio memos.
 */
export async function getAudioMemos(): Promise<AudioMemo[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY_AUDIO_METADATA);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Deletes a single audio memo file from local filesystem and metadata.
 */
export async function deleteAudioMemo(id: string): Promise<boolean> {
  try {
    const memos = await getAudioMemos();
    const target = memos.find(m => m.id === id);

    if (target && target.fileUri) {
      const info = await FileSystem.getInfoAsync(target.fileUri);
      if (info.exists) {
        await FileSystem.deleteAsync(target.fileUri, { idempotent: true });
      }
    }

    const updated = memos.filter(m => m.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY_AUDIO_METADATA, JSON.stringify(updated));
    return true;
  } catch (e) {
    console.error('Error deleting audio memo:', e);
    return false;
  }
}

/**
 * Permanently purges and deletes ALL recorded voice logs from the device.
 */
export async function wipeAllAudioMemos(): Promise<boolean> {
  try {
    const memos = await getAudioMemos();
    for (const memo of memos) {
      if (memo.fileUri) {
        const info = await FileSystem.getInfoAsync(memo.fileUri);
        if (info.exists) {
          await FileSystem.deleteAsync(memo.fileUri, { idempotent: true });
        }
      }
    }
    await AsyncStorage.removeItem(STORAGE_KEY_AUDIO_METADATA);
    return true;
  } catch (e) {
    console.error('Error purging audio memos:', e);
    return false;
  }
}

/**
 * Plays an audio memo.
 */
export async function playAudioMemo(fileUri: string): Promise<any | null> {
  if (!ExpoAudio || !fileUri) return null;
  try {
    await ExpoAudio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });
    const { sound } = await ExpoAudio.Sound.createAsync({ uri: fileUri });
    await sound.playAsync();
    return sound;
  } catch (e) {
    console.error('Error playing audio memo:', e);
    return null;
  }
}
