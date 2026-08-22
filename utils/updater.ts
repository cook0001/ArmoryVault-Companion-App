import { File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REPO_LATEST_URL = 'https://api.github.com/repos/cook0001/ArmoryVault-Companion-App/releases/latest';
const REPO_ALL_RELEASES_URL = 'https://api.github.com/repos/cook0001/ArmoryVault-Companion-App/releases';

export type UpdateChannel = 'stable' | 'nightly';

export interface CheckUpdateOptions {
  silent?: boolean;
  channel?: UpdateChannel;
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
 * Checks if a given version string is a pre-release / nightly / beta build.
 */
export function isPrereleaseVersion(version: string): boolean {
  const v = version.toLowerCase();
  return v.includes('nightly') || v.includes('beta') || v.includes('alpha') || v.includes('rc') || v.includes('-');
}

/**
 * Gets the current installed version string.
 */
export function getCurrentAppVersion(): string {
  return (Application.nativeApplicationVersion || '2.6.0-nightly.42').replace(/^v/, '');
}

/**
 * Checks for updates or rollbacks according to the selected release channel.
 */
export async function checkForUpdates(options: boolean | CheckUpdateOptions = true) {
  if (Platform.OS !== 'android') return;

  const silent = typeof options === 'boolean' ? options : (options.silent ?? true);
  const onConfirm = typeof options === 'object' ? options.onConfirm : undefined;
  const onAlert = typeof options === 'object' ? options.onAlert : undefined;

  try {
    const savedChannel = await AsyncStorage.getItem('update_channel');
    const channel: UpdateChannel = (typeof options === 'object' && options.channel) 
      ? options.channel 
      : (savedChannel === 'nightly' ? 'nightly' : 'stable');

    let releaseData: any = null;

    if (channel === 'nightly') {
      const response = await fetch(REPO_ALL_RELEASES_URL);
      if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
      const releases = await response.json();
      
      // Find the latest nightly / prerelease or first release in the list
      const nightly = releases.find((r: any) => r.prerelease || r.tag_name?.includes('nightly') || r.tag_name?.includes('beta'));
      releaseData = nightly || releases[0];
    } else {
      const response = await fetch(REPO_LATEST_URL);
      if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
      releaseData = await response.json();
    }

    if (!releaseData) throw new Error('No release data found on GitHub');

    const latestTag = releaseData.tag_name || '';
    const latestVersion = latestTag.replace(/^v/, '');
    const currentVersion = getCurrentAppVersion();
    const isCurrentNightly = isPrereleaseVersion(currentVersion);

    const apkAsset = releaseData.assets?.find((asset: any) => asset.name?.endsWith('.apk'));

    // CASE 1: USER IS ON A NIGHTLY BUILD AND SWITCHED TO STABLE -> OFFER ROLLBACK TO STABLE
    if (channel === 'stable' && isCurrentNightly) {
      if (apkAsset) {
        const title = 'Rollback to Official Stable Release';
        const message = `You are currently running Nightly build (v${currentVersion}).\n\nLatest Official Stable Release: ${latestTag}\n\nWould you like to rollback and install the stable release now?`;
        
        const doInstall = () => downloadAndInstallUpdate(apkAsset.browser_download_url, onAlert);

        if (onConfirm) {
          onConfirm({
            title,
            message,
            confirmText: 'Rollback to Stable',
            cancelText: 'Stay on Nightly',
            onConfirm: doInstall,
          });
        } else {
          Alert.alert(title, message, [
            { text: 'Stay on Nightly', style: 'cancel' },
            { text: 'Rollback to Stable', onPress: doInstall },
          ]);
        }
        return;
      }
    }

    // CASE 2: USER IS ON STABLE AND SWITCHED TO NIGHTLY -> OFFER INSTALLING NIGHTLY
    if (channel === 'nightly' && !isCurrentNightly) {
      if (apkAsset && latestVersion !== currentVersion) {
        const title = 'Switch to Nightly Test Channel';
        const message = `You are currently on Stable (v${currentVersion}).\n\nA newer Nightly Test Build (${latestTag}) is available.\n\nWould you like to download and install this build?`;
        
        const doInstall = () => downloadAndInstallUpdate(apkAsset.browser_download_url, onAlert);

        if (onConfirm) {
          onConfirm({
            title,
            message,
            confirmText: 'Install Nightly Build',
            cancelText: 'Stay on Stable',
            onConfirm: doInstall,
          });
        } else {
          Alert.alert(title, message, [
            { text: 'Stay on Stable', style: 'cancel' },
            { text: 'Install Nightly', onPress: doInstall },
          ]);
        }
        return;
      }
    }

    // CASE 3: STANDARD VERSION UPGRADE WITHIN THE SAME CHANNEL
    const isNewer = compareVersions(latestVersion, currentVersion) > 0;

    if (isNewer && apkAsset) {
      const channelLabel = channel === 'nightly' ? 'Nightly Test Build' : 'Stable Release';
      const title = channel === 'nightly' ? 'New Nightly Build Found' : 'New Update Available';
      const message = `A newer ${channelLabel} (${latestTag}) is available.\n\nCurrent: v${currentVersion}\nLatest: ${latestTag}\n\nWould you like to download and install this update now?`;

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

    // UP TO DATE NOTIFICATION
    if (!silent) {
      const channelLabel = channel === 'nightly' ? 'Nightly Test' : 'Stable';
      const msg = `You are running the latest ${channelLabel} version (v${currentVersion}).`;
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
 * Compare semantic / nightly versions (1 if a > b, -1 if a < b, 0 if equal)
 */
function compareVersions(a: string, b: string): number {
  if (a === b) return 0;

  const cleanA = a.replace(/^v/, '');
  const cleanB = b.replace(/^v/, '');

  // Split into main version and prerelease tag
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

  // If base versions are equal, compare prerelease tags
  if (preA && !preB) return -1; // standard version is newer than prerelease of same number
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
