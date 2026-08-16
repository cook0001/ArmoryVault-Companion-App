import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

export default function FirearmScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [logType, setLogType] = useState('range');
  const [notes, setNotes] = useState('');
  const [roundCount, setRoundCount] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleSaveOffline = async () => {
    try {
      let newLog;
      
      if (logType === 'photo') {
        if (!photo) {
          alert('Please take a photo first');
          return;
        }
        newLog = {
          type: 'firearm_photo',
          firearmId: id,
          photoBase64: photo,
          timestamp: new Date().toISOString()
        };
      } else {
        newLog = {
          type: 'firearm_log',
          firearmId: id,
          logType,
          notes,
          roundCount: parseInt(roundCount) || 0,
          photoBase64: photo,
          timestamp: new Date().toISOString()
        };
      }

      const queueStr = await AsyncStorage.getItem('offline_queue');
      const queue = queueStr ? JSON.parse(queueStr) : [];
      queue.push(newLog);
      await AsyncStorage.setItem('offline_queue', JSON.stringify(queue));

      alert('Saved offline!');
      router.back();
    } catch (e) {
      console.error(e);
      alert('Failed to save');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Firearm #{id}</Text>
      
      <View style={styles.tabContainer}>
        <Pressable 
          style={[styles.tab, logType === 'range' && styles.activeTab]} 
          onPress={() => setLogType('range')}
        >
          <Text style={[styles.tabText, logType === 'range' && styles.activeTabText]}>Range Log</Text>
        </Pressable>
        <Pressable 
          style={[styles.tab, logType === 'maintenance' && styles.activeTab]} 
          onPress={() => setLogType('maintenance')}
        >
          <Text style={[styles.tabText, logType === 'maintenance' && styles.activeTabText]}>Maintenance</Text>
        </Pressable>
        <Pressable 
          style={[styles.tab, logType === 'photo' && styles.activeTab]} 
          onPress={() => setLogType('photo')}
        >
          <Text style={[styles.tabText, logType === 'photo' && styles.activeTabText]}>Add Photo</Text>
        </Pressable>
      </View>

      {logType !== 'photo' && (
        <>
          <Text style={styles.label}>Notes / Description</Text>
          <TextInput 
            style={styles.textArea} 
            multiline 
            numberOfLines={4} 
            value={notes}
            onChangeText={setNotes}
            placeholder="Enter details..."
          />
        </>
      )}

      {logType === 'range' && (
        <>
          <Text style={styles.label}>Rounds Fired</Text>
          <TextInput 
            style={styles.input} 
            keyboardType="numeric" 
            value={roundCount}
            onChangeText={setRoundCount}
            placeholder="e.g. 150"
          />
        </>
      )}

      {logType === 'photo' && (
        <Text style={{ marginBottom: 16, color: '#64748b' }}>
          Take a new photo of this firearm to add to its inspection card gallery.
        </Text>
      )}

      <Pressable style={styles.photoButton} onPress={takePhoto}>
        <Text style={styles.buttonText}>{photo ? 'Retake Photo' : 'Capture Photo'}</Text>
      </Pressable>

      {photo && (
        <Image source={{ uri: photo }} style={styles.previewImage} />
      )}

      <Pressable style={styles.saveButton} onPress={handleSaveOffline}>
        <Text style={styles.saveButtonText}>Save Offline</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#0f172a',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#f8fafc',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    padding: 4,
  },
  tab: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#f8fafc',
  },
  label: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#cbd5e1',
  },
  input: {
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    height: 100,
    textAlignVertical: 'top',
  },
  photoButton: {
    backgroundColor: '#334155',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#f8fafc',
    fontWeight: 'bold',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 40,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  }
});
