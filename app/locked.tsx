import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function LockedScreen({ onUnlock }: { onUnlock: () => void }) {
  return (
    <View style={styles.container}>
      <Ionicons name="lock-closed" size={64} color="#3b82f6" style={{ marginBottom: 20 }} />
      <Text style={styles.title}>App Locked</Text>
      <Text style={styles.subtitle}>Please authenticate to access your inventory.</Text>
      
      <Pressable style={styles.unlockButton} onPress={onUnlock}>
        <Text style={styles.unlockText}>Unlock</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 40,
  },
  unlockButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
  },
  unlockText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  }
});
