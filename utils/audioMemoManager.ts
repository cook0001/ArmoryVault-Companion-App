import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

// expo-audio (the maintained replacement for expo-av) provides the recording and playback APIs.
// We use imperative APIs here since this is a utility module, not a React component.
// Components that need recording should use the useAudioRecorder hook from expo-audio directly,
// or call these utility functions for persistence and metadata management.
let AudioModule: any = null;
let createAudioPlayer: any = null;
let setAudioModeAsync: any = null;
let RecordingPresets: any = null;

try {
  const expoAudio = require('expo-audio');
  AudioModule = expoAudio.AudioModule;
  createAudioPlayer = expoAudio.createAudioPlayer;
  setAudioModeAsync = expoAudio.setAudioModeAsync;
  RecordingPresets = expoAudio.RecordingPresets;
} catch (e) {
  // Graceful fallback if expo-audio native module is not available
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
  return !!AudioModule;
}

/**
 * Request microphone permissions for local on-device voice notes.
 */
export async function requestAudioPermissions(): Promise<boolean> {
  if (!AudioModule) return false;
  try {
    const status = await AudioModule.requestRecordingPermissionsAsync();
    return status.granted;
  } catch (e) {
    console.warn('Audio permission request error:', e);
    return false;
  }
}

/**
 * Configures the audio mode for recording.
 * Call this before starting a recording session.
 */
export async function configureAudioForRecording(): Promise<void> {
  if (!setAudioModeAsync) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: true,
    });
  } catch (e) {
    console.warn('Audio mode configuration error:', e);
  }
}

/**
 * Returns the RecordingPresets for use with useAudioRecorder hook.
 * Components should use: const recorder = useAudioRecorder(getRecordingPreset());
 */
export function getRecordingPreset(): any {
  return RecordingPresets?.HIGH_QUALITY || {};
}

/**
 * Saves the recording from an AudioRecorder instance and persists the audio memo locally.
 * The recorder should already be stopped (via recorder.stop()) before calling this.
 */
export async function saveRecording(
  recorderUri: string | null,
  durationSec: number,
  title: string = 'Bench Audio Memo',
  firearmId?: number,
  firearmName?: string,
  ammoId?: number,
  ammoName?: string,
  transcript?: string
): Promise<AudioMemo | null> {
  try {
    const uri = recorderUri || '';
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
      durationSec: Math.max(1, Math.round(durationSec)),
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
 * Plays an audio recording from local storage using the new expo-audio API.
 * Returns a player instance that the caller should release() when done.
 */
export async function playAudioMemo(fileUri: string): Promise<any | null> {
  if (!createAudioPlayer || !fileUri) return null;
  try {
    const player = createAudioPlayer({ uri: fileUri });
    player.play();
    return player;
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
