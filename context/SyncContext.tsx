import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useDialog } from './DialogContext';
import type { SyncQueueItem, StorageLocation, DashboardStats } from '../types';

export type { DashboardStats } from '../types';

interface SyncContextType {
  syncedIp: string | null;
  isOnline: boolean | null;
  isVaultLocked: boolean | null;
  desktopDevice: string | null;
  isSyncing: boolean;
  syncProgress: string | null;
  lastSyncTime: string | null;
  lastCacheTime: string | null;
  offlineQueue: SyncQueueItem[];
  offlineQueueCount: number;
  autoSyncEnabled: boolean;
  dashboardStats: DashboardStats | null;
  storageLocations: StorageLocation[];
  
  // Actions
  loadStatus: () => Promise<void>;
  triggerSync: (options?: { manual?: boolean }) => Promise<boolean>;
  addToQueue: (item: SyncQueueItem | SyncQueueItem[], successMessage?: string) => Promise<boolean>;
  removeFromQueue: (index: number) => Promise<void>;
  updateQueueItem: (index: number, updatedItem: SyncQueueItem) => Promise<void>;
  clearQueue: () => Promise<void>;
  refreshCache: (silent?: boolean) => Promise<boolean>;
  remoteLockVault: () => Promise<boolean>;
  setAutoSyncEnabled: (enabled: boolean) => Promise<void>;
  setServerIp: (ip: string | null, explicitToken?: string) => Promise<void>;
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
  const [isVaultLocked, setIsVaultLocked] = useState<boolean | null>(null);
  const [desktopDevice, setDesktopDevice] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [lastCacheTime, setLastCacheTime] = useState<string | null>(null);
  const [offlineQueue, setOfflineQueue] = useState<SyncQueueItem[]>([]);
  const [autoSyncEnabled, setAutoSyncEnabledState] = useState<boolean>(true);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);

  // Pairing token for authenticated API calls
  const pairingTokenRef = useRef<string | null>(null);

  // Helper to build auth headers for all authenticated API calls
  const getAuthHeaders = useCallback((extra?: Record<string, string>) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
    if (pairingTokenRef.current) {
      headers['Authorization'] = `Bearer ${pairingTokenRef.current}`;
    }
    return headers;
  }, []);

  // Refs for tracking in intervals/async closures
  const isSyncingRef = useRef(false);
  const syncedIpRef = useRef<string | null>(null);
  const autoSyncEnabledRef = useRef(true);
  const isOnlineRef = useRef<boolean | null>(null);
  const isVaultLockedRef = useRef<boolean | null>(null);

  syncedIpRef.current = syncedIp;
  autoSyncEnabledRef.current = autoSyncEnabled;
  isOnlineRef.current = isOnline;
  isVaultLockedRef.current = isVaultLocked;

  // Remote Lock Desktop Vault (Desktop locks, mobile cache is preserved for offline use)
  const remoteLockVault = useCallback(async (): Promise<boolean> => {
    const ip = syncedIpRef.current;
    if (!ip) {
      showError('Not Paired', 'Please pair with your desktop ArmoryVault server first.');
      return false;
    }

    try {
      let res = await fetch(`${ip}/api/vault/lock`, {
        method: 'POST',
        headers: getAuthHeaders(),
      }).catch(() => null);

      if (!res || res.status === 404) {
        res = await fetch(`${ip}/api/lock`, {
          method: 'POST',
          headers: getAuthHeaders(),
        }).catch(() => null);
      }

      if (res && res.ok) {
        setIsVaultLocked(true);
        isVaultLockedRef.current = true;
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showSuccess('Desktop Vault Locked', 'Desktop database locked. Your mobile cache remains active for offline use.');
        return true;
      } else if (res && res.status === 404) {
        showError(
          'Desktop Restart Needed', 
          'The desktop app needs to be restarted once to load the new remote lock endpoint.'
        );
        return false;
      } else {
        throw new Error(`HTTP ${res?.status || 'Network Error'}`);
      }
    } catch (e: any) {
      console.error('remoteLockVault error:', e);
      showError('Lock Failed', 'Could not reach desktop server to execute remote lock.');
      return false;
    }
  }, [showSuccess, showError]);

  // Load Status from Storage & Server
  const loadStatus = useCallback(async () => {
    try {
      // 1. Server IP
      const ip = await AsyncStorage.getItem('server_ip');
      setSyncedIpState(ip);
      syncedIpRef.current = ip;

      // 2a. Pairing Token
      const token = await AsyncStorage.getItem('pairing_token');
      pairingTokenRef.current = token;

      // 3. Auto-Sync Setting
      const autoSyncStr = await AsyncStorage.getItem('auto_sync_enabled');
      const isAutoSync = autoSyncStr === null ? true : autoSyncStr === 'true';
      setAutoSyncEnabledState(isAutoSync);
      autoSyncEnabledRef.current = isAutoSync;

      // 3. Offline Queue
      const queueStr = await AsyncStorage.getItem('offline_queue');
      let currentQueue: SyncQueueItem[] = [];
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

      const cachedStorage = await AsyncStorage.getItem('storage_locations_cache');
      if (cachedStorage) {
        try {
          setStorageLocations(JSON.parse(cachedStorage));
        } catch {}
      }

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

            const locked = Boolean(data.isLocked);
            setIsVaultLocked(locked);
            isVaultLockedRef.current = locked;

            if (!locked) {
              // Fetch summary stats
              fetch(`${ip}/api/inventory/summary`, { headers: getAuthHeaders() })
                .then(async res => {
                  if (!res.ok) return null;
                  const text = await res.text();
                  try { return JSON.parse(text); } catch { return null; }
                })
                .then(data => {
                  if (data && data.success && !data.isLocked) {
                    const stats: DashboardStats = { firearms: data.firearms, ammo: data.ammo, components: data.components };
                    setDashboardStats(stats);
                    AsyncStorage.setItem('dashboard_cache', JSON.stringify(stats));
                  }
                })
                .catch(() => {});

              // Fetch inventory cache
              fetch(`${ip}/api/inventory/cache`, { headers: getAuthHeaders() })
                .then(async res => {
                  if (!res.ok) return null;
                  const text = await res.text();
                  try { return JSON.parse(text); } catch { return null; }
                })
                .then(data => {
                  if (data && data.success && !data.isLocked) {
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

                    if (data.storageLocations) {
                      setStorageLocations(data.storageLocations);
                      AsyncStorage.setItem('storage_locations_cache', JSON.stringify(data.storageLocations));
                    } else if (ip) {
                      fetch(`${ip}/api/storage-locations`, { headers: getAuthHeaders() })
                        .then(r => r.json())
                        .then(sData => {
                          if (sData && sData.locations) {
                            setStorageLocations(sData.locations);
                            AsyncStorage.setItem('storage_locations_cache', JSON.stringify(sData.locations));
                          }
                        })
                        .catch(() => {});
                    }
                  }
                })
                .catch(() => {});

              // Trigger Auto-Sync if items exist in queue
              if (currentQueue.length > 0 && isAutoSync && !isSyncingRef.current) {
                triggerSyncInternal(ip, currentQueue, false);
              }
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
    queueToProcess: SyncQueueItem[], 
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
          headers: getAuthHeaders(),
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
  const MAX_QUEUE_SIZE = 500;
  const addToQueue = useCallback(async (item: SyncQueueItem | SyncQueueItem[], successMessage?: string): Promise<boolean> => {
    try {
      const itemsToAdd = Array.isArray(item) ? item : [item];
      const queueStr = await AsyncStorage.getItem('offline_queue');
      const queue: SyncQueueItem[] = queueStr ? JSON.parse(queueStr) : [];
      
      let newQueue = [...queue, ...itemsToAdd];

      // Enforce queue size limit with FIFO eviction
      if (newQueue.length > MAX_QUEUE_SIZE) {
        const evicted = newQueue.length - MAX_QUEUE_SIZE;
        newQueue = newQueue.slice(-MAX_QUEUE_SIZE);
        console.warn(`Queue limit reached: evicted ${evicted} oldest item(s)`);
      }

      await AsyncStorage.setItem('offline_queue', JSON.stringify(newQueue));
      setOfflineQueue(newQueue);

      // Warn when queue is getting large
      if (newQueue.length > 400 && !isSyncingRef.current) {
        showToast({
          message: `Offline queue has ${newQueue.length} items. Connect to desktop to sync.`,
          type: 'warning',
          durationMs: 4000,
        });
      }

      if (successMessage) {
        showToast({
          message: successMessage,
          type: 'success',
          durationMs: 2500
        });
      }

      const ip = syncedIpRef.current;
      const isOnlineCurrent = isOnlineRef.current;
      const isAutoSyncCurrent = autoSyncEnabledRef.current;

      if (ip && isOnlineCurrent && isAutoSyncCurrent && !isSyncingRef.current) {
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
  const updateQueueItem = useCallback(async (index: number, updatedItem: SyncQueueItem) => {
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
      const res = await fetch(`${ip}/api/inventory/cache`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && !data.isLocked) {
          await AsyncStorage.setItem('inventory_cache', JSON.stringify(data));
          const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setLastCacheTime(now);
          await AsyncStorage.setItem('inventory_cache_time', now);
          setIsVaultLocked(false);
          isVaultLockedRef.current = false;

          const skuCount = data.skus ? Object.keys(data.skus).length : 0;
          setDashboardStats({
            firearms: data.firearms?.length || 0,
            ammo: (data.ammo || []).reduce((sum: number, a: any) => sum + (Number(a.count) || 0), 0),
            components: data.components?.length || 0,
            skus: skuCount
          });

          if (data.storageLocations) {
            setStorageLocations(data.storageLocations);
            await AsyncStorage.setItem('storage_locations_cache', JSON.stringify(data.storageLocations));
          } else {
            try {
              const sRes = await fetch(`${ip}/api/storage-locations`, { headers: getAuthHeaders() });
              if (sRes.ok) {
                const sData = await sRes.json();
                if (sData && sData.locations) {
                  setStorageLocations(sData.locations);
                  await AsyncStorage.setItem('storage_locations_cache', JSON.stringify(sData.locations));
                }
              }
            } catch {}
          }
        } else if (data?.isLocked) {
          setIsVaultLocked(true);
          isVaultLockedRef.current = true;
          if (!silent) {
            showToast({ title: 'Desktop Vault Locked', message: 'Vault is locked on desktop. Mobile app will use offline cache.', type: 'info' });
          }
          return false;
        }
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (e: any) {
      if (!silent) {
        showError('Cache Fetch Failed', `Could not refresh cache from ${ip}`);
      }
      return false;
    }
  }, [showSuccess, showError, showToast]);

  // Set Auto-Sync Preference
  const setAutoSyncEnabled = useCallback(async (enabled: boolean) => {
    setAutoSyncEnabledState(enabled);
    autoSyncEnabledRef.current = enabled;
    await AsyncStorage.setItem('auto_sync_enabled', String(enabled));

    if (enabled && isOnlineRef.current && syncedIpRef.current && offlineQueue.length > 0 && !isSyncingRef.current) {
      triggerSyncInternal(syncedIpRef.current, offlineQueue, false);
    }
  }, [offlineQueue]);

  // Set Server IP Address and initiate pairing
  const setServerIp = useCallback(async (ip: string | null, explicitToken?: string) => {
    if (ip) {
      await AsyncStorage.setItem('server_ip', ip);
      setSyncedIpState(ip);
      syncedIpRef.current = ip;

      if (explicitToken) {
        pairingTokenRef.current = explicitToken;
        await AsyncStorage.setItem('pairing_token', explicitToken);
      }

      // Attempt to pair and obtain auth token
      try {
        const pairHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        const activeToken = explicitToken || (await AsyncStorage.getItem('pairing_token'));
        if (activeToken) {
          pairHeaders['Authorization'] = `Bearer ${activeToken}`;
        }

        const pairRes = await fetch(`${ip}/api/pair`, {
          method: 'POST',
          headers: pairHeaders,
          body: JSON.stringify({ deviceName: 'Mobile Companion' }),
        });

        if (pairRes.ok) {
          const pairData = await pairRes.json();
          if (pairData.pairingToken) {
            pairingTokenRef.current = pairData.pairingToken;
            await AsyncStorage.setItem('pairing_token', pairData.pairingToken);
          }
        }
      } catch (e) {
        console.warn('Pairing token exchange failed:', e);
      }

      loadStatus();
    } else {
      await AsyncStorage.removeItem('server_ip');
      await AsyncStorage.removeItem('pairing_token');
      pairingTokenRef.current = null;
      setSyncedIpState(null);
      syncedIpRef.current = null;
      setIsOnline(false);
      isOnlineRef.current = false;
      setIsVaultLocked(null);
      isVaultLockedRef.current = null;
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

              const locked = Boolean(data.isLocked);
              const wasLocked = isVaultLockedRef.current;
              setIsVaultLocked(locked);
              isVaultLockedRef.current = locked;

              if (!locked && wasLocked === true) {
                // Desktop was just unlocked! Refresh cache automatically
                refreshCache(true);
              }

              // Auto-sync check during heartbeat
              const queueStr = await AsyncStorage.getItem('offline_queue');
              const q = queueStr ? JSON.parse(queueStr) : [];
              if (q.length > 0 && autoSyncEnabledRef.current && !isSyncingRef.current && !locked) {
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
  }, [loadStatus, refreshCache]);

  return (
    <SyncContext.Provider
      value={{
        syncedIp,
        isOnline,
        isVaultLocked,
        desktopDevice,
        isSyncing,
        syncProgress,
        lastSyncTime,
        lastCacheTime,
        offlineQueue,
        offlineQueueCount: offlineQueue.length,
        autoSyncEnabled,
        dashboardStats,
        storageLocations,
        loadStatus,
        triggerSync,
        addToQueue,
        removeFromQueue,
        updateQueueItem,
        clearQueue,
        refreshCache,
        remoteLockVault,
        setAutoSyncEnabled,
        setServerIp,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};
