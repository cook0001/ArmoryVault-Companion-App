import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';
import { Platform, Alert } from 'react-native';

const REPO_URL = 'https://api.github.com/repos/cook0001/ArmoryVault-Companion-App/releases/latest';

export async function checkForUpdates(silent = true) {
  if (Platform.OS !== 'android') return;

  try {
    const response = await fetch(REPO_URL);
    if (!response.ok) throw new Error('Failed to fetch latest release');
    
    const data = await response.json();
    const latestVersion = data.tag_name.replace('v', '');
    const currentVersion = Application.nativeApplicationVersion || '0.0.0';

    // Simple string comparison for versions (assuming format x.y.z)
    if (latestVersion > currentVersion) {
      const apkAsset = data.assets.find((asset: any) => asset.name.endsWith('.apk'));
      if (apkAsset) {
        if (!silent) {
          Alert.alert(
            'Update Available',
            `Version ${latestVersion} is available! Would you like to download and install it now?`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Update', onPress: () => downloadAndInstallUpdate(apkAsset.browser_download_url) }
            ]
          );
        } else {
          Alert.alert(
            'New Update Discovered',
            `A new version (${latestVersion}) was found. Would you like to update?`,
            [
              { text: 'Later', style: 'cancel' },
              { text: 'Update Now', onPress: () => downloadAndInstallUpdate(apkAsset.browser_download_url) }
            ]
          );
        }
      }
    } else if (!silent) {
      Alert.alert('Up to Date', `You are running the latest version (${currentVersion}).`);
    }
  } catch (error) {
    console.error('Update check failed:', error);
    if (!silent) {
      Alert.alert('Update Error', 'Could not check for updates at this time.');
    }
  }
}

async function downloadAndInstallUpdate(downloadUrl: string) {
  try {
    const apkFileUri = FileSystem.cacheDirectory + 'update.apk';
    
    const downloadRes = await FileSystem.downloadAsync(downloadUrl, apkFileUri);
    
    if (downloadRes.status === 200) {
      const contentUri = await FileSystem.getContentUriAsync(downloadRes.uri);
      
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1 | 268435456, // Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK
        type: 'application/vnd.android.package-archive',
      });
    } else {
      throw new Error(`Failed to download APK. Status: ${downloadRes.status}`);
    }
  } catch (error) {
    console.error('Download/Install error:', error);
    Alert.alert('Installation Failed', `There was an error downloading or installing the update: ${error instanceof Error ? error.message : String(error)}`);
  }
}
