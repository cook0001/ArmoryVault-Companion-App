import { Stack, Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import LockedScreen from './locked';
import { checkForUpdates } from '../utils/updater';

export default function Layout() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasAuthHardware, setHasAuthHardware] = useState(false);

  useEffect(() => {
    checkDeviceAuth();
    // Silently check for updates on startup
    checkForUpdates(true);
  }, []);

  const checkDeviceAuth = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (compatible && enrolled) {
      setHasAuthHardware(true);
      handleAuthenticate();
    } else {
      setIsUnlocked(true); // No biometrics setup, proceed
    }
  };

  const handleAuthenticate = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock ArmoryVault',
      fallbackLabel: 'Use PIN',
    });
    if (result.success) {
      setIsUnlocked(true);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#0f172a',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen 
        name="index" 
        options={{ 
          title: 'ArmoryVault Sync',
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#fff',
          headerRight: () => (
            <Link href="/settings" asChild>
              <Pressable style={{ marginRight: 15 }}>
                <Ionicons name="settings-outline" size={24} color="#fff" />
              </Pressable>
            </Link>
          ),
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
      <Stack.Screen name="ammo/[upc]" options={{ title: 'Ammo Inventory', headerStyle: { backgroundColor: '#0f172a' }, headerTintColor: '#fff' }} />
      <Stack.Screen name="component/[id]" options={{ title: 'Component Inventory', headerStyle: { backgroundColor: '#0f172a' }, headerTintColor: '#fff' }} />
      </Stack>
      {(!isUnlocked && hasAuthHardware) && (
        <View style={StyleSheet.absoluteFill}>
          <LockedScreen onUnlock={handleAuthenticate} />
        </View>
      )}
      <StatusBar style="light" />
    </View>
  );
}
