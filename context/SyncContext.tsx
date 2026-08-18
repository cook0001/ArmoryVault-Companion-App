import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useDialog } from './DialogContext';

export interface DashboardStats {
  firearms: number;
  ammo: number;
  components: number;
  skus?: number;
}

interface SyncContextType {
  syncedIp: string | null;
  isOnline: boolean | null;
  desktopDevice: string | null;
  isSyncing: boolean;
  syncProgress: string | null;
  lastSyncTime: string | null;
  lastCacheTime: string | null;
  offlineQueue: any[];
  offlineQueueCount: number;
  autoSyncEnabled: boolean;
  dashboardStats: DashboardStats | null;
  
  // Actions
  loadStatus: () => Promise<void>;
  triggerSync: (options?: { manual?: boolean }) => Promise<boolean>;
  addToQueue: (item: any | any[], successMessage?: string) => Promise<boolean>;
  removeFromQueue: (index: number) => Promise<void>;
  updateQueueItem: (index: number, updatedItem: any) => Promise<void>;
  clearQueue: () => Promise<void>;
  refreshCache: (silent?: boolean) => Promise<boolean>;
  setAutoSyncEnabled: (enabled: boolean) => Promise<void>;
  setServerIp: (ip: string | null) => Promise<void>;
}

const SyncContext = createContext<SyncContextType | null>(null);

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast, showError, showSuccess } = useDialog();

  const [syncedIp, setSyncedIpState] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [desktopDevice, setDesktopDevice] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [lastCacheTime, setLastCacheTime] = useState<string | null>(null);
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);
  const [autoSyncEnabled, setAutoSyncEnabledState] = useState<boolean>(true);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);

  // Refs for tracking in intervals/async closures
  const isSyncingRef = useRef(false);
  const syncedIpRef = useRef<string | null>(null);
  const autoSyncEnabledRef = useRef(true);
  const isOnlineRef = useRef<boolean | null>(null);

  syncedIpRef.current = syncedIp;
  autoSyncEnabledRef.current = autoSyncEnabled;
  isOnlineRef.current = isOnline;

  // Load Status from Storage & Server
  const loadStatus = useCallback(async () => {
    try {
      // 1. Server IP
      const ip = await AsyncStorage.getItem('server_ip');
      setSyncedIpState(ip);
      syncedIpRef.current = ip;

      // 2. Auto-Sync Setting
      const autoSyncStr = await AsyncStorage.getItem('auto_sync_enabled');
      const isAutoSync = autoSyncStr === null ? true : autoSyncStr === 'true';
      setAutoSyncEnabledState(isAutoSync);
      autoSyncEnabledRef.current = isAutoSync;

      // 3. Offline Queue
      const queueStr = await AsyncStorage.getItem('offline_queue');
      let currentQueue: any[] = [];
      if (queueStr) {
        try {
          currentQueue = JSON.parse(queueStr);
        } catch {
          currentQueue = [];
        }
      }
      setOfflineQueue(currentQueue);

      // 4. Cache & Stats
      const cachedStats = await AsyncStorage.getItem('dashboard_cache');
      if (cachedStats) {
        try {
          setDashboardStats(JSON.parse(cachedStats));
        } catch {}
      }

      const cacheTime = await AsyncStorage.getItem('inventory_cache_time');
      if (cacheTime) setLastCacheTime(cacheTime);

      const syncTime = await AsyncStorage.getItem('last_sync_time');
      if (syncTime) setLastSyncTime(syncTime);

      // 5. Server Connection Ping & Cache Sync
      if (ip) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);

          const pingRes = await fetch(`${ip}/api/ping`, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (pingRes.ok) {
            const data = await pingRes.json();
            setIsOnline(true);
            isOnlineRef.current = true;
            if (data.device) setDesktopDevice(data.device);

            // Fetch summary stats
            fetch(`${ip}/api/inventory/summary`)
              .then(async res => {
                if (!res.ok) return null;
                const text = await res.text();
                try { return JSON.parse(text); } catch { return null; }
              })
              .then(data => {
                if (data && data.success) {
                  const stats: DashboardStats = { firearms: data.firearms, ammo: data.ammo, components: data.components };
                  setDashboardStats(stats);
                  AsyncStorage.setItem('dashboard_cache', JSON.stringify(stats));
                }
              })
              .catch(() => {});

            // Fetch inventory cache
            fetch(`${ip}/api/inventory/cache`)
              .then(async res => {
                if (!res.ok) return null;
                const text = await res.text();
                try { return JSON.parse(text); } catch { return null; }
              })
              .then(data => {
                if (data && data.success) {
                  AsyncStorage.setItem('inventory_cache', JSON.stringify(data));
                  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  setLastCacheTime(now);
                  AsyncStorage.setItem('inventory_cache_time', now);

                  const skuCount = data.skus ? Object.keys(data.skus).length : 0;
                  setDashboardStats(prev => ({
                    firearms: data.firearms?.length || prev?.firearms || 0,
                    ammo: (data.ammo || []).reduce((sum: number, a: any) => sum + (Number(a.count) || 0), 0),
                    components: data.components?.length || prev?.components || 0,
                    skus: skuCount
                  }));
                }
              })
              .catch(() => {});

            // Trigger Auto-Sync if items exist in queue
            if (currentQueue.length > 0 && isAutoSync && !isSyncingRef.current) {
              triggerSyncInternal(ip, currentQueue, false);
            }
          } else {
            setIsOnline(false);
            isOnlineRef.current = false;
          }
        } catch {
          setIsOnline(false);
          isOnlineRef.current = false;
        }
      } else {
        setIsOnline(false);
        isOnlineRef.current = false;
      }
    } catch (e) {
      console.error('SyncContext loadStatus error:', e);
    }
  }, []);

  // Internal Sync Worker Function
  const triggerSyncInternal = async (
    targetIp: string, 
    queueToProcess: any[], 
    isManual: boolean
  ): Promise<boolean> => {
    if (isSyncingRef.current || queueToProcess.length === 0) return false;

    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
      const chunkSize = 20;
      let processedCount = 0;
      let remainingQueue = [...queueToProcess];
      const chunksTotal = Math.ceil(remainingQueue.length / chunkSize);

      for (let i = 0; i < chunksTotal; i++) {
        setSyncProgress(`Syncing chunk ${i + 1} of ${chunksTotal}...`);
        const chunk = remainingQueue.slice(0, chunkSize);

        const response = await fetch(`${targetIp}/api/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ items: chunk }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'No response body');
          throw new Error(`Server returned ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        if (data.success) {
          processedCount += data.processed || chunk.length;
          remainingQueue = remainingQueue.slice(chunkSize);
          await AsyncStorage.setItem('offline_queue', JSON.stringify(remainingQueue));
          setOfflineQueue(remainingQueue);
        } else {
          throw new Error('Desktop sync endpoint returned success: false');
        }
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSyncTime(nowTime);
      await AsyncStorage.setItem('last_sync_time', nowTime);

      setSyncProgress(null);
      setIsSyncing(false);
      isSyncingRef.current = false;

      // Show non-blocking auto-dismissing toast or confirmation
      if (isManual) {
        showSuccess('Sync Complete', `Successfully synchronized ${processedCount} item(s) to desktop.`);
      } else {
        showToast({
          title: 'Auto-Synced to Desktop',
          message: `Transmitted ${processedCount} change(s) seamlessly.`,
          type: 'success',
          durationMs: 3000
        });
      }

      // Refresh inventory cache post-sync
      refreshCache(true);
      return true;

    } catch (e: any) {
      console.error('Sync failed:', e);
      setSyncProgress(null);
      setIsSyncing(false);
      isSyncingRef.current = false;

      if (isManual) {
        if (e.message && e.message.includes('Network request failed')) {
          showError('Network Error', 'Ensure your phone and desktop are on the same local Wi-Fi network.');
        } else {
          showError('Sync Failed', e.message || 'Unknown error occurred during sync.');
        }
      }
      return false;
    }
  };

  // Public Trigger Sync
  const triggerSync = useCallback(async (options?: { manual?: boolean }): Promise<boolean> => {
    const isManual = options?.manual ?? false;
    const ip = syncedIpRef.current;

    if (!ip) {
      if (isManual) {
        showError('Not Paired', 'Please pair with your desktop ArmoryVault server first.');
      }
      return false;
    }

    const queueStr = await AsyncStorage.getItem('offline_queue');
    const queue = queueStr ? JSON.parse(queueStr) : [];
    if (queue.length === 0) {
      if (isManual) {
        showToast({
          title: 'Already in Sync',
          message: 'No pending offline changes to transmit.',
          type: 'info'
        });
      }
      return true;
    }

    return triggerSyncInternal(ip, queue, isManual);
  }, [showError, showToast, showSuccess]);

  // Add Item(s) to Queue and Auto-Sync if Online
  const addToQueue = useCallback(async (item: any | any[], successMessage?: string): Promise<boolean> => {
    try {
      const itemsToAdd = Array.isArray(item) ? item : [item];
      const queueStr = await AsyncStorage.getItem('offline_queue');
      const queue = queueStr ? JSON.parse(queueStr) : [];
      
      const newQueue = [...queue, ...itemsToAdd];
      await AsyncStorage.setItem('offline_queue', JSON.stringify(newQueue));
      setOfflineQueue(newQueue);

      if (successMessage) {
        showToast({
          message: successMessage,
          type: 'success',
          durationMs: 2500
        });
      }

      // If connected and autoSync is enabled, auto-sync immediately!
      const ip = syncedIpRef.current;
      const isOnlineCurrent = isOnlineRef.current;
      const isAutoSyncCurrent = autoSyncEnabledRef.current;

      if (ip && isOnlineCurrent && isAutoSyncCurrent && !isSyncingRef.current) {
        // Small delay to allow calling screen transition
        setTimeout(() => {
          triggerSyncInternal(ip, newQueue, false);
        }, 300);
      }

      return true;
    } catch (e) {
      console.error('addToQueue error:', e);
      showError('Save Error', 'Failed to store item in local offline queue.');
      return false;
    }
  }, [showToast, showError]);

  // Remove Item from Queue
  const removeFromQueue = useCallback(async (index: number) => {
    try {
      const newQueue = [...offlineQueue];
      newQueue.splice(index, 1);
      await AsyncStorage.setItem('offline_queue', JSON.stringify(newQueue));
      setOfflineQueue(newQueue);
      showToast({ message: 'Item removed from sync queue', type: 'info' });
    } catch (e) {
      console.error('removeFromQueue error:', e);
      showError('Error', 'Failed to remove item from queue.');
    }
  }, [offlineQueue, showToast, showError]);

  // Update Item in Queue
  const updateQueueItem = useCallback(async (index: number, updatedItem: any) => {
    try {
      const newQueue = [...offlineQueue];
      newQueue[index] = updatedItem;
      await AsyncStorage.setItem('offline_queue', JSON.stringify(newQueue));
      setOfflineQueue(newQueue);
      showToast({ message: 'Queue item updated', type: 'success' });
    } catch (e) {
      console.error('updateQueueItem error:', e);
      showError('Error', 'Failed to update item in queue.');
    }
  }, [offlineQueue, showToast, showError]);

  // Clear Entire Queue
  const clearQueue = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('offline_queue');
      setOfflineQueue([]);
      showToast({ message: 'Offline sync queue cleared', type: 'info' });
    } catch (e) {
      console.error('clearQueue error:', e);
      showError('Error', 'Failed to clear offline queue.');
    }
  }, [showToast, showError]);

  // Force Refresh Cache
  const refreshCache = useCallback(async (silent = false): Promise<boolean> => {
    const ip = syncedIpRef.current;
    if (!ip) {
      if (!silent) showError('Error', 'Please connect to desktop server first.');
      return false;
    }

    try {
      const res = await fetch(`${ip}/api/inventory/cache`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          await AsyncStorage.setItem('inventory_cache', JSON.stringify(data));
          const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setLastCacheTime(now);
          await AsyncStorage.setItem('inventory_cache_time', now);

          const skuCount = data.skus ? Object.keys(data.skus).length : 0;
          setDashboardStats({
            firearms: data.firearms?.length || 0,
            ammo: (data.ammo || []).reduce((sum: number, a: any) => sum + (Number(a.count) || 0), 0),
            components: data.components?.length || 0,
            skus: skuCount
          });

          if (!silent) {
            showSuccess(
              'Cache Updated', 
              `Cached ${data.firearms?.length || 0} firearms, ${data.ammo?.length || 0} ammo lots, and ${data.components?.length || 0} reloading components.`
            );
          }
          return true;
        }
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (e: any) {
      if (!silent) {
        showError('Cache Fetch Failed', `Could not refresh cache from ${ip}`);
      }
      return false;
    }
  }, [showSuccess, showError]);

  // Set Auto-Sync Preference
  const setAutoSyncEnabled = useCallback(async (enabled: boolean) => {
    setAutoSyncEnabledState(enabled);
    autoSyncEnabledRef.current = enabled;
    await AsyncStorage.setItem('auto_sync_enabled', String(enabled));

    if (enabled && isOnlineRef.current && syncedIpRef.current && offlineQueue.length > 0 && !isSyncingRef.current) {
      triggerSyncInternal(syncedIpRef.current, offlineQueue, false);
    }
  }, [offlineQueue]);

  // Set Server IP Address
  const setServerIp = useCallback(async (ip: string | null) => {
    if (ip) {
      await AsyncStorage.setItem('server_ip', ip);
      setSyncedIpState(ip);
      syncedIpRef.current = ip;
      loadStatus();
    } else {
      await AsyncStorage.removeItem('server_ip');
      setSyncedIpState(null);
      syncedIpRef.current = null;
      setIsOnline(false);
      isOnlineRef.current = false;
      setDesktopDevice(null);
    }
  }, [loadStatus]);

  // Startup initialization and periodic heartbeat (every 18 seconds)
  useEffect(() => {
    loadStatus();

    const interval = setInterval(() => {
      const currentIp = syncedIpRef.current;
      if (currentIp) {
        fetch(`${currentIp}/api/ping`)
          .then(async res => {
            if (res.ok) {
              const data = await res.json();
              setIsOnline(true);
              isOnlineRef.current = true;
              if (data.device) setDesktopDevice(data.device);

              // Auto-sync check during heartbeat
              const queueStr = await AsyncStorage.getItem('offline_queue');
              const q = queueStr ? JSON.parse(queueStr) : [];
              if (q.length > 0 && autoSyncEnabledRef.current && !isSyncingRef.current) {
                triggerSyncInternal(currentIp, q, false);
              }
            } else {
              setIsOnline(false);
              isOnlineRef.current = false;
            }
          })
          .catch(() => {
            setIsOnline(false);
            isOnlineRef.current = false;
          });
      }
    }, 18000);

    return () => clearInterval(interval);
  }, [loadStatus]);

  return (
    <SyncContext.Provider
      value={{
        syncedIp,
        isOnline,
        desktopDevice,
        isSyncing,
        syncProgress,
        lastSyncTime,
        lastCacheTime,
        offlineQueue,
        offlineQueueCount: offlineQueue.length,
        autoSyncEnabled,
        dashboardStats,
        loadStatus,
        triggerSync,
        addToQueue,
        removeFromQueue,
        updateQueueItem,
        clearQueue,
        refreshCache,
        setAutoSyncEnabled,
        setServerIp,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};
