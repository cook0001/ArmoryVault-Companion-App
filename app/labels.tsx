import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  LabelPrinterIcon,
  CartridgesIcon,
  AmmoCanIcon,
  SafeIcon,
} from './components/CustomMobileIcons';
import { useSync } from '../context/SyncContext';
import { useDialog } from '../context/DialogContext';
import type { Ammo, Firearm, StorageLocation } from '../types';

interface PrintableLabelItem {
  id: string;
  type: 'ammo' | 'firearm' | 'storage';
  title: string;
  subtitle: string;
  code: string;
  detail1: string;
  detail2: string;
  barcode: string;
  qrPayload: string;
}

export default function LabelsScreen() {
  const { isModuleInstalled, syncedIp } = useSync();
  const { showSuccess, showError } = useDialog();

  const [activeTab, setActiveTab] = useState<'ammo' | 'firearm' | 'storage'>('ammo');
  const [selectedFormat, setSelectedFormat] = useState<'thermal_62mm' | 'ammo_can_3x2'>('ammo_can_3x2');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [ammoList, setAmmoList] = useState<Ammo[]>([]);
  const [firearmsList, setFirearmsList] = useState<Firearm[]>([]);
  const [storageList, setStorageList] = useState<StorageLocation[]>([]);

  const loadData = async () => {
    try {
      const cacheStr = await AsyncStorage.getItem('inventory_cache');
      if (cacheStr) {
        const parsed = JSON.parse(cacheStr);
        if (Array.isArray(parsed.ammo)) setAmmoList(parsed.ammo);
        if (Array.isArray(parsed.firearms)) setFirearmsList(parsed.firearms);
        if (Array.isArray(parsed.storageLocations)) setStorageList(parsed.storageLocations);
      }
    } catch (e) {
      console.warn('Failed to load labels cache:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compile all printable items
  const allPrintableItems = useMemo<PrintableLabelItem[]>(() => {
    const list: PrintableLabelItem[] = [];

    if (activeTab === 'ammo') {
      ammoList.forEach((a) => {
        const brand = a.manufacturer || 'Standard';
        const grain = a.grain ? `${a.grain} gr` : '';
        const proj = a.projectile || '';
        const countStr = `${a.count || 0} Rounds`;
        const shotgunInfo = a.shell_length ? `${a.shell_length}" ${a.shot_size || ''}` : '';

        list.push({
          id: `ammo-${a.id}`,
          type: 'ammo',
          title: a.caliber || 'Ammunition',
          subtitle: `${brand} ${a.type === 'handload' ? 'Handload' : ''}`.trim(),
          code: a.upc_code || `AV-AMMO-${a.id}`,
          detail1: [grain, proj, shotgunInfo].filter(Boolean).join(' • ') || 'Ammunition Lot',
          detail2: countStr,
          barcode: a.upc_code || `AV${a.id}`,
          qrPayload: `armoryvault://ammo/${a.id}`,
        });
      });
    } else if (activeTab === 'firearm') {
      firearmsList.forEach((f) => {
        list.push({
          id: `firearm-${f.id}`,
          type: 'firearm',
          title: `${f.make} ${f.model}`.trim(),
          subtitle: `SN: ${f.serial_number || 'N/A'}`,
          code: f.serial_number || `AV-GUN-${f.id}`,
          detail1: `Caliber: ${f.caliber}`,
          detail2: f.type || f.action_type || 'Armory Inventory',
          barcode: f.serial_number || `AV-GUN-${f.id}`,
          qrPayload: `armoryvault://firearm/${f.id}`,
        });
      });
    } else if (activeTab === 'storage') {
      storageList.forEach((s) => {
        list.push({
          id: `storage-${s.id}`,
          type: 'storage',
          title: s.name,
          subtitle: `Type: ${s.type || 'Locker / Safe'}`,
          code: `AV-LOC-${s.id}`,
          detail1: s.notes || 'Secured Storage',
          detail2: s.capacity ? `Capacity: ${s.capacity} units` : 'Storage Vault',
          barcode: `AV-LOC-${s.id}`,
          qrPayload: `armoryvault://storage/${s.id}`,
        });
      });
    }

    return list;
  }, [activeTab, ammoList, firearmsList, storageList]);

  // Filter by search
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allPrintableItems;
    return allPrintableItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.detail1.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q)
    );
  }, [allPrintableItems, searchQuery]);

  // Toggle selection
  const toggleSelect = (id: string) => {
    Haptics.selectionAsync();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    Haptics.selectionAsync();
    const next = new Set<string>();
    filteredItems.forEach((i) => next.add(i.id));
    setSelectedIds(next);
  };

  const clearSelection = () => {
    Haptics.selectionAsync();
    setSelectedIds(new Set());
  };

  // Generate HTML for Print / PDF Export
  const generateLabelsHtml = (itemsToPrint: PrintableLabelItem[]): string => {
    const is3x2 = selectedFormat === 'ammo_can_3x2';
    const labelWidth = is3x2 ? '3.2in' : '2.4in';
    const labelHeight = is3x2 ? '2.1in' : 'auto';

    const cardsHtml = itemsToPrint
      .map(
        (item) => `
      <div class="label-box">
        <div class="header-row">
          <div class="title">${item.title}</div>
          <div class="tag">${item.type.toUpperCase()}</div>
        </div>
        <div class="subtitle">${item.subtitle}</div>
        <div class="divider"></div>
        <div class="detail">${item.detail1}</div>
        <div class="detail-bold">${item.detail2}</div>
        <div class="barcode-container">
          <div class="barcode-lines">||| | | |||| | || | ||| |||| | | ||</div>
          <div class="code-text">${item.code}</div>
        </div>
      </div>
    `
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            @page {
              size: auto;
              margin: 10mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #000;
              margin: 0;
              padding: 10px;
              background-color: #fff;
            }
            .labels-grid {
              display: flex;
              flex-wrap: wrap;
              gap: 12px;
              justify-content: flex-start;
            }
            .label-box {
              width: ${labelWidth};
              ${is3x2 ? `height: ${labelHeight};` : ''}
              border: 2px solid #000;
              border-radius: 6px;
              padding: 10px;
              box-sizing: border-box;
              background: #fff;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              page-break-inside: avoid;
            }
            .header-row {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .title {
              font-size: 16px;
              font-weight: 800;
              letter-spacing: -0.5px;
              line-height: 1.2;
            }
            .tag {
              font-size: 9px;
              font-weight: 800;
              border: 1px solid #000;
              padding: 1px 4px;
              border-radius: 3px;
            }
            .subtitle {
              font-size: 11px;
              font-weight: 600;
              color: #222;
              margin-top: 3px;
            }
            .divider {
              height: 1px;
              background-color: #000;
              margin: 6px 0;
            }
            .detail {
              font-size: 10px;
              color: #444;
            }
            .detail-bold {
              font-size: 12px;
              font-weight: 700;
              margin-top: 2px;
            }
            .barcode-container {
              margin-top: 8px;
              text-align: center;
              border-top: 1px dashed #666;
              padding-top: 4px;
            }
            .barcode-lines {
              font-family: monospace;
              letter-spacing: 2px;
              font-size: 13px;
              font-weight: bold;
            }
            .code-text {
              font-family: monospace;
              font-size: 9px;
              color: #333;
              letter-spacing: 1px;
            }
          </style>
        </head>
        <body>
          <div class="labels-grid">
            ${cardsHtml}
          </div>
        </body>
      </html>
    `;
  };

  // Print Handler
  const handlePrint = async () => {
    const itemsToPrint = allPrintableItems.filter((i) => selectedIds.has(i.id));
    if (itemsToPrint.length === 0) {
      showError('Please select at least one item to print.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const html = generateLabelsHtml(itemsToPrint);
      await Print.printAsync({ html });
    } catch (e: any) {
      console.warn('Print error:', e);
      showError(e?.message || 'Failed to print labels.');
    }
  };

  // PDF Export / Share Handler
  const handleSharePdf = async () => {
    const itemsToPrint = allPrintableItems.filter((i) => selectedIds.has(i.id));
    if (itemsToPrint.length === 0) {
      showError('Please select at least one item to export.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const html = generateLabelsHtml(itemsToPrint);
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      } else {
        showSuccess('PDF created successfully at: ' + uri);
      }
    } catch (e: any) {
      console.warn('Share error:', e);
      showError(e?.message || 'Failed to export PDF.');
    }
  };

  const isLabelsInstalled = isModuleInstalled('labels');
  const selectedCount = selectedIds.size;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIconContainer}>
          <LabelPrinterIcon size={24} color="#6366f1" />
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Label Studio</Text>
          <Text style={styles.headerSubtitle}>
            Printable Ammo Can, Storage & Armory Labels
          </Text>
        </View>
      </View>

      {/* Module Status Warning */}
      {syncedIp && !isLabelsInstalled && (
        <View style={styles.warningBanner}>
          <Ionicons name="information-circle" size={20} color="#f59e0b" />
          <Text style={styles.warningText}>
            Labels module is disabled on your Desktop. Mobile printing and PDF export remain fully operational.
          </Text>
        </View>
      )}

      {/* Format Selector */}
      <View style={styles.formatSelector}>
        <Text style={styles.formatLabel}>Format:</Text>
        <Pressable
          style={[styles.formatChip, selectedFormat === 'ammo_can_3x2' && styles.formatChipActive]}
          onPress={() => setSelectedFormat('ammo_can_3x2')}
        >
          <Text style={[styles.formatChipText, selectedFormat === 'ammo_can_3x2' && styles.formatChipTextActive]}>
            3" x 2" Ammo Can
          </Text>
        </Pressable>
        <Pressable
          style={[styles.formatChip, selectedFormat === 'thermal_62mm' && styles.formatChipActive]}
          onPress={() => setSelectedFormat('thermal_62mm')}
        >
          <Text style={[styles.formatChipText, selectedFormat === 'thermal_62mm' && styles.formatChipTextActive]}>
            Continuous 62mm
          </Text>
        </Pressable>
      </View>

      {/* Category Tabs */}
      <View style={styles.tabsContainer}>
        <Pressable
          style={[styles.tabButton, activeTab === 'ammo' && styles.activeTabButton]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('ammo');
          }}
        >
          <CartridgesIcon size={16} color={activeTab === 'ammo' ? '#ffffff' : '#94a3b8'} />
          <Text style={[styles.tabButtonText, activeTab === 'ammo' && styles.activeTabButtonText]}>
            Ammo Cans
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabButton, activeTab === 'firearm' && styles.activeTabButton]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('firearm');
          }}
        >
          <Ionicons name="shield-outline" size={16} color={activeTab === 'firearm' ? '#ffffff' : '#94a3b8'} />
          <Text style={[styles.tabButtonText, activeTab === 'firearm' && styles.activeTabButtonText]}>
            Firearms
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabButton, activeTab === 'storage' && styles.activeTabButton]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('storage');
          }}
        >
          <SafeIcon size={16} color={activeTab === 'storage' ? '#ffffff' : '#94a3b8'} />
          <Text style={[styles.tabButtonText, activeTab === 'storage' && styles.activeTabButtonText]}>
            Storage
          </Text>
        </Pressable>
      </View>

      {/* Search & Bulk Select Toolbar */}
      <View style={styles.toolbarRow}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={16} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search items to label..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>

        <Pressable style={styles.bulkBtn} onPress={selectedCount > 0 ? clearSelection : selectAll}>
          <Text style={styles.bulkBtnText}>{selectedCount > 0 ? 'Clear' : 'Select All'}</Text>
        </Pressable>
      </View>

      {/* Printable Items List */}
      <ScrollView contentContainerStyle={styles.listContent}>
        {filteredItems.length === 0 ? (
          <View style={styles.emptyState}>
            <AmmoCanIcon size={44} color="#64748b" />
            <Text style={styles.emptyTitle}>No Items Found</Text>
            <Text style={styles.emptySubtitle}>
              Connect with ArmoryVault Desktop to load your inventory for label generation.
            </Text>
          </View>
        ) : (
          filteredItems.map((item) => {
            const isSelected = selectedIds.has(item.id);
            return (
              <Pressable
                key={item.id}
                style={[styles.labelPreviewCard, isSelected && styles.labelPreviewCardSelected]}
                onPress={() => toggleSelect(item.id)}
              >
                {/* Selection Checkbox */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.previewTag}>
                    <Text style={styles.previewTagText}>{item.type.toUpperCase()}</Text>
                  </View>
                  <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color="#ffffff" />}
                  </View>
                </View>

                {/* Simulated Label View */}
                <View style={styles.simulatedLabel}>
                  <Text style={styles.labelTitle}>{item.title}</Text>
                  <Text style={styles.labelSubtitle}>{item.subtitle}</Text>
                  <View style={styles.labelDivider} />
                  <Text style={styles.labelDetail}>{item.detail1}</Text>
                  <Text style={styles.labelDetailBold}>{item.detail2}</Text>
                  <View style={styles.labelBarcode}>
                    <Text style={styles.barcodeLines}>||| | | |||| | || | ||| |||| | | ||</Text>
                    <Text style={styles.barcodeCode}>{item.code}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Floating Bottom Action Bar */}
      {selectedCount > 0 && (
        <View style={styles.bottomBar}>
          <View style={styles.selectionInfo}>
            <Text style={styles.selectionCount}>{selectedCount}</Text>
            <Text style={styles.selectionLabel}>
              {selectedCount === 1 ? 'item selected' : 'items selected'}
            </Text>
          </View>

          <View style={styles.actionsGroup}>
            <Pressable style={styles.actionBtnSecondary} onPress={handleSharePdf}>
              <Ionicons name="share-outline" size={18} color="#6366f1" />
              <Text style={styles.actionBtnSecondaryText}>Export PDF</Text>
            </Pressable>

            <Pressable style={styles.actionBtnPrimary} onPress={handlePrint}>
              <Ionicons name="print-outline" size={18} color="#ffffff" />
              <Text style={styles.actionBtnPrimaryText}>Print</Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 16,
    marginTop: 8,
    gap: 8,
  },
  warningText: {
    flex: 1,
    color: '#f59e0b',
    fontSize: 12,
    lineHeight: 16,
  },
  formatSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  formatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  formatChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  formatChipActive: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  formatChipText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  formatChipTextActive: {
    color: '#a5b4fc',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    gap: 6,
  },
  activeTabButton: {
    backgroundColor: '#6366f1',
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  activeTabButtonText: {
    color: '#ffffff',
  },
  toolbarRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 13,
  },
  bulkBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkBtnText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 90,
    gap: 12,
  },
  labelPreviewCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  labelPreviewCardSelected: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  previewTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#64748b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  simulatedLabel: {
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#0f172a',
  },
  labelTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  labelSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginTop: 1,
  },
  labelDivider: {
    height: 1,
    backgroundColor: '#0f172a',
    marginVertical: 6,
  },
  labelDetail: {
    fontSize: 11,
    color: '#475569',
  },
  labelDetailBold: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  labelBarcode: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  barcodeLines: {
    fontFamily: 'monospace',
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  barcodeCode: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#475569',
    letterSpacing: 1,
    marginTop: 1,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectionCount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#6366f1',
  },
  selectionLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  actionsGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  actionBtnSecondaryText: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '700',
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  actionBtnPrimaryText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
