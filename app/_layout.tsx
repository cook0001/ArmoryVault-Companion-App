import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function Layout() {
  return (
    <>
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
      <Stack.Screen name="ammo/[upc]" options={{ title: 'Ammo Inventory' }} />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
