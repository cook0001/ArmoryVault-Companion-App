import { File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';
import { Platform, Alert } from 'react-native';

const REPO_LATEST_URL = 'https://api.github.com/repos/cook0001/ArmoryVault-Companion-App/releases/latest';

export interface CheckUpdateOptions {
  silent?: boolean;
  onConfirm?: (options: {
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
  }) => void;
  onAlert?: (title: string, message: string) => void;
}

/**
 * Gets the current installed version string.
 */
export function getCurrentAppVersion(): string {
  return (Application.nativeApplicationVersion || '2.7.6').replace(/^v/, '');
}

/**
 * Checks for updates against official GitHub releases.
 */
export async function checkForUpdates(options: boolean | CheckUpdateOptions = true) {
  if (Platform.OS !== 'android') return;

  const silent = typeof options === 'boolean' ? options : (options.silent ?? true);
  const onConfirm = typeof options === 'object' ? options.onConfirm : undefined;
  const onAlert = typeof options === 'object' ? options.onAlert : undefined;

  try {
    const response = await fetch(REPO_LATEST_URL);
    if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
    const releaseData = await response.json();

    if (!releaseData) throw new Error('No release data found on GitHub');

    const latestTag = releaseData.tag_name || '';
    const latestVersion = latestTag.replace(/^v/, '');
    const currentVersion = getCurrentAppVersion();

    const apkAsset = releaseData.assets?.find((asset: any) => asset.name?.endsWith('.apk'));

    const isNewer = compareVersions(latestVersion, currentVersion) > 0;

    if (isNewer && apkAsset) {
      const title = 'New Update Available';
      const message = `A newer release (${latestTag}) is available.\n\nCurrent: v${currentVersion}\nLatest: ${latestTag}\n\nWould you like to download and install this update now?`;

      const doInstall = () => downloadAndInstallUpdate(apkAsset.browser_download_url, onAlert);

      if (onConfirm) {
        onConfirm({
          title,
          message,
          confirmText: 'Download & Install',
          cancelText: 'Later',
          onConfirm: doInstall,
        });
      } else {
        Alert.alert(title, message, [
          { text: 'Later', style: 'cancel' },
          { text: 'Update Now', onPress: doInstall },
        ]);
      }
      return;
    }

    // Up to date notification
    if (!silent) {
      const msg = `You are running the latest version (v${currentVersion}).`;
      if (onAlert) {
        onAlert('Up to Date', msg);
      } else {
        Alert.alert('Up to Date', msg);
      }
    }
  } catch (error: any) {
    console.error('Update check failed:', error);
    if (!silent) {
      const msg = error?.message ? `Could not check for updates: ${error.message}` : 'Could not check for updates at this time.';
      if (onAlert) {
        onAlert('Update Check Error', msg);
      } else {
        Alert.alert('Update Check Error', msg);
      }
    }
  }
}

/**
 * Compare semantic versions (1 if a > b, -1 if a < b, 0 if equal)
 */
export function compareVersions(a: string, b: string): number {
  if (a === b) return 0;

  const cleanA = a.replace(/^v/, '');
  const cleanB = b.replace(/^v/, '');

  const [mainA, preA] = cleanA.split('-');
  const [mainB, preB] = cleanB.split('-');

  const partsA = mainA.split('.').map(n => parseInt(n, 10) || 0);
  const partsB = mainB.split('.').map(n => parseInt(n, 10) || 0);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const valA = partsA[i] || 0;
    const valB = partsB[i] || 0;
    if (valA > valB) return 1;
    if (valA < valB) return -1;
  }

  // If base versions are equal, standard release is newer than pre-release
  if (preA && !preB) return -1;
  if (!preA && preB) return 1;
  if (preA && preB) {
    return preA.localeCompare(preB, undefined, { numeric: true });
  }

  return 0;
}

/**
 * Downloads and launches the native Android APK installer.
 */
export async function downloadAndInstallUpdate(
  downloadUrl: string,
  onAlert?: (title: string, message: string) => void
) {
  if (Platform.OS !== 'android') return;

  try {
    const updateFile = new File(Paths.cache, `update-${Date.now()}.apk`);
    
    // Download using modern FileSystem API
    const fileOutput = await File.downloadFileAsync(downloadUrl, updateFile);
    
    if (fileOutput.exists) {
      const contentUri = await getContentUriAsync(fileOutput.uri);
      
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1 | 268435456, // Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK
        type: 'application/vnd.android.package-archive',
      });
    } else {
      throw new Error('Failed to download APK. File does not exist.');
    }
  } catch (error: any) {
    console.error('Download/Install error:', error);
    const msg = `There was an error downloading or installing the update: ${error instanceof Error ? error.message : String(error)}`;
    if (onAlert) {
      onAlert('Installation Failed', msg);
    } else {
      Alert.alert('Installation Failed', msg);
    }
  }
}
