import { Stack, Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import LockedScreen from './locked';
import { checkForUpdates } from '../utils/updater';
import { DialogProvider } from '../context/DialogContext';
import { SyncProvider } from '../context/SyncContext';
import BottomTabBar from './components/BottomTabBar';

function RootLayoutContent() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasAuthHardware, setHasAuthHardware] = useState(false);

  useEffect(() => {
    checkDeviceAuth();
    // Silently check for updates on startup without blocking
    try {
      checkForUpdates(true).catch(() => {});
    } catch {}
  }, []);

  const checkDeviceAuth = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync().catch(() => false);
      const enrolled = await LocalAuthentication.isEnrolledAsync().catch(() => false);
      if (compatible && enrolled) {
        setHasAuthHardware(true);
        handleAuthenticate();
      } else {
        setIsUnlocked(true); // No biometrics setup, proceed
      }
    } catch (e) {
      console.warn('Biometrics check error:', e);
      setIsUnlocked(true);
    }
  };

  const handleAuthenticate = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock ArmoryVault',
        fallbackLabel: 'Use PIN',
      }).catch(() => ({ success: false }));
      if (result && result.success) {
        setIsUnlocked(true);
      }
    } catch (e) {
      console.warn('Authentication error:', e);
      setIsUnlocked(true);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#0f172a',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          contentStyle: {
            backgroundColor: '#0f172a',
          },
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ 
            headerShown: false,
          }} 
        />
        <Stack.Screen 
          name="settings" 
          options={{ 
            title: 'Settings',
            headerStyle: { backgroundColor: '#0f172a' },
            headerTintColor: '#fff',
          }} 
        />
        <Stack.Screen 
          name="scanner" 
          options={{ 
            title: 'Scan Item',
            headerStyle: { backgroundColor: '#0f172a' },
            headerTintColor: '#fff',
          }} 
        />
        <Stack.Screen 
          name="firearm/[id]" 
          options={{ 
            title: 'Firearm Log',
            headerStyle: { backgroundColor: '#0f172a' },
            headerTintColor: '#fff',
          }} 
        />
        <Stack.Screen 
          name="outbox" 
          options={{ 
            title: 'Pending Syncs',
            headerStyle: { backgroundColor: '#0f172a' },
            headerTintColor: '#fff',
          }} 
        />  
        <Stack.Screen 
          name="firearms/index" 
          options={{ 
            title: 'Firearms Vault',
            headerStyle: { backgroundColor: '#0f172a' },
            headerTintColor: '#fff',
          }} 
        />
        <Stack.Screen 
          name="inventory/index" 
          options={{ 
            title: 'Ammo & Supplies',
            headerStyle: { backgroundColor: '#0f172a' },
            headerTintColor: '#fff',
          }} 
        />
        <Stack.Screen 
          name="range/index" 
          options={{ 
            title: 'Range Companion',
            headerStyle: { backgroundColor: '#0f172a' },
            headerTintColor: '#fff',
          }} 
        />
        <Stack.Screen 
          name="voice-memos" 
          options={{ 
            title: 'Voice Memos',
            headerStyle: { backgroundColor: '#0f172a' },
            headerTintColor: '#fff',
          }} 
        />
        <Stack.Screen name="ammo/[upc]" options={{ title: 'Ammo Stock', headerStyle: { backgroundColor: '#0f172a' }, headerTintColor: '#fff' }} />
        <Stack.Screen name="component/[id]" options={{ title: 'Component Stock', headerStyle: { backgroundColor: '#0f172a' }, headerTintColor: '#fff' }} />
      </Stack>
      <BottomTabBar />
      {(!isUnlocked && hasAuthHardware) && (
        <View style={StyleSheet.absoluteFill}>
          <LockedScreen onUnlock={handleAuthenticate} />
        </View>
      )}
      <StatusBar style="light" />
    </View>
  );
}

export default function Layout() {
  return (
    <DialogProvider>
      <SyncProvider>
        <RootLayoutContent />
      </SyncProvider>
    </DialogProvider>
  );
}
