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
  firearmName?: string;
  ammoId?: number;
  ammoName?: string;
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
  firearmName?: string,
  ammoId?: number,
  ammoName?: string,
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
      firearmName,
      ammoId,
      ammoName,
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
  firearmId?: number,
  firearmName?: string,
  ammoId?: number,
  ammoName?: string
): Promise<AudioMemo> {
  const id = `memo_${Date.now()}`;
  const memo: AudioMemo = {
    id,
    firearmId,
    firearmName,
    ammoId,
    ammoName,
    title: title.trim() || 'Bench Note',
    durationSec: 0,
    fileUri: '',
    fileSizeBytes: 0,
    transcript: transcript || 'Manual note entry',
    createdAt: new Date().toISOString()
  };

  const existing = await getAudioMemos();
  const updated = [memo, ...existing];
  await AsyncStorage.setItem(STORAGE_KEY_AUDIO_METADATA, JSON.stringify(updated));

  return memo;
}

/**
 * Loads all locally persisted audio memo metadata records.
 */
export async function getAudioMemos(): Promise<AudioMemo[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY_AUDIO_METADATA);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Error fetching audio memos:', e);
    return [];
  }
}

/**
 * Plays an audio recording from local storage.
 */
export async function playAudioMemo(fileUri: string): Promise<any | null> {
  if (!ExpoAudio || !fileUri) return null;
  try {
    const { sound } = await ExpoAudio.Sound.createAsync(
      { uri: fileUri },
      { shouldPlay: true }
    );
    return sound;
  } catch (e) {
    console.error('Error playing audio memo:', e);
    return null;
  }
}

/**
 * Deletes a single audio memo and its physical file.
 */
export async function deleteAudioMemo(memoId: string): Promise<boolean> {
  try {
    const existing = await getAudioMemos();
    const target = existing.find(m => m.id === memoId);

    if (target && target.fileUri) {
      await FileSystem.deleteAsync(target.fileUri, { idempotent: true }).catch(() => {});
    }

    const updated = existing.filter(m => m.id !== memoId);
    await AsyncStorage.setItem(STORAGE_KEY_AUDIO_METADATA, JSON.stringify(updated));
    return true;
  } catch (e) {
    console.error('Error deleting audio memo:', e);
    return false;
  }
}

/**
 * Wipes all audio memos and deletes all recording files for complete data privacy.
 */
export async function wipeAllAudioMemos(): Promise<boolean> {
  try {
    const existing = await getAudioMemos();
    for (const memo of existing) {
      if (memo.fileUri) {
        await FileSystem.deleteAsync(memo.fileUri, { idempotent: true }).catch(() => {});
      }
    }
    await AsyncStorage.removeItem(STORAGE_KEY_AUDIO_METADATA);
    return true;
  } catch (e) {
    console.error('Error wiping all audio memos:', e);
    return false;
  }
}
