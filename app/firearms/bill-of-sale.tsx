import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import { useDialog } from '../../context/DialogContext';
import { useSync } from '../../context/SyncContext';
import { parseDriverLicenseBarcode } from '../../utils/pdf417Parser';
import { 
  BillOfSaleData, 
  createBillOfSalePdf, 
  emailBillOfSale, 
  shareBillOfSale 
} from '../../utils/billOfSaleGenerator';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function BillOfSaleScreen() {
  const router = useRouter();
  const { firearmId } = useLocalSearchParams<{ firearmId?: string }>();
  const { showToast, showError, showSuccess } = useDialog();
  const { addToQueue } = useSync();

  const [firearms, setFirearms] = useState<any[]>([]);
  const [selectedFirearmId, setSelectedFirearmId] = useState<number | null>(
    firearmId ? Number(firearmId) : null
  );

  // Form Fields
  const [salePrice, setSalePrice] = useState('650');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [includedItems, setIncludedItems] = useState('2x Original Magazines, Hard Case, Lock');
  const [notes, setNotes] = useState('Private party transfer conducted in compliance with state regulations.');

  // Seller Details
  const [sellerName, setSellerName] = useState('Vault Owner');
  const [sellerAddress, setSellerAddress] = useState('123 Private Way');
  const [sellerPhone, setSellerPhone] = useState('');
  const [sellerEmail, setSellerEmail] = useState('');
  const [sellerDl, setSellerDl] = useState('');

  // Buyer Details
  const [buyerName, setBuyerName] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [buyerDlNumber, setBuyerDlNumber] = useState('');
  const [buyerDob, setBuyerDob] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerCcl, setBuyerCcl] = useState('');

  // Generated PDF state
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [transferId, setTransferId] = useState(`AV-BOS-${Date.now().toString().slice(-6)}`);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadCachedFirearms();
  }, [firearmId]);

  const loadCachedFirearms = async () => {
    try {
      const cacheStr = await AsyncStorage.getItem('inventory_cache');
      if (cacheStr) {
        const cache = JSON.parse(cacheStr);
        const fList = cache.firearms || [];
        setFirearms(fList);

        if (!selectedFirearmId && fList.length > 0) {
          setSelectedFirearmId(fList[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const selectedFirearm = firearms.find(f => f.id === selectedFirearmId);

  // Scanner Simulator / Auto-fill
  const handleScanLicense = () => {
    showToast({ 
      message: 'Position Driver License 2D Barcode in camera or enter below', 
      type: 'info', 
      durationMs: 2500 
    });
    // Pre-populate sample AAMVA parse if requested
    router.push('/scanner');
  };

  const handleGeneratePdf = async () => {
    if (!selectedFirearm) {
      showToast({ message: 'Please select a firearm', type: 'warning' });
      return;
    }
    if (!buyerName.trim() || !buyerDlNumber.trim()) {
      showToast({ message: 'Please enter Buyer Legal Name and Driver License Number', type: 'warning' });
      return;
    }

    setIsGenerating(true);
    try {
      const billData: BillOfSaleData = {
        transferId,
        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        firearmId: selectedFirearm.id,
        make: selectedFirearm.make,
        model: selectedFirearm.model,
        serialNumber: selectedFirearm.serial_number || 'N/A',
        caliber: selectedFirearm.caliber || 'N/A',
        actionType: selectedFirearm.action_type || 'Semi-Automatic',
        finish: selectedFirearm.finish || 'Standard',
        barrelLength: selectedFirearm.barrel_length || 'Standard',
        condition: selectedFirearm.condition || 'Very Good (Used)',
        includedItems,
        sellerName: sellerName || 'Seller on File',
        sellerAddress: sellerAddress || 'Private Address on File',
        sellerPhone,
        sellerEmail,
        sellerDlNumber: sellerDl,
        buyerName: buyerName.trim(),
        buyerAddress: buyerAddress.trim() || 'Address Verified on ID',
        buyerPhone,
        buyerEmail,
        buyerDlNumber: buyerDlNumber.trim(),
        buyerDob,
        buyerCclNumber: buyerCcl,
        salePrice: parseFloat(salePrice) || 0,
        paymentMethod,
        notes
      };

      const uri = await createBillOfSalePdf(billData);
      setPdfUri(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showSuccess('Bill of Sale Generated', `Receipt ready for ${selectedFirearm.make} ${selectedFirearm.model}`);
    } catch (e: any) {
      console.error(e);
      showError('PDF Error', e.message || 'Failed to generate Bill of Sale');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEmailPdf = async () => {
    if (!pdfUri || !selectedFirearm) return;
    const billData: BillOfSaleData = {
      transferId,
      date: new Date().toLocaleDateString(),
      firearmId: selectedFirearm.id,
      make: selectedFirearm.make,
      model: selectedFirearm.model,
      serialNumber: selectedFirearm.serial_number || 'N/A',
      caliber: selectedFirearm.caliber || 'N/A',
      condition: selectedFirearm.condition || 'Used',
      sellerName,
      sellerAddress,
      sellerEmail,
      buyerName,
      buyerAddress,
      buyerEmail,
      buyerDlNumber,
      salePrice: parseFloat(salePrice) || 0,
      paymentMethod
    };
    await emailBillOfSale(pdfUri, billData);
  };

  const handleSharePdf = async () => {
    if (!pdfUri) return;
    await shareBillOfSale(pdfUri, `Bill of Sale - ${selectedFirearm?.make} ${selectedFirearm?.model}`);
  };

  const handlePrintPdf = async () => {
    if (!pdfUri) return;
    await Print.printAsync({ uri: pdfUri });
  };

  const handleSaveAndSyncTransfer = async () => {
    if (!pdfUri || !selectedFirearm) {
      showToast({ message: 'Generate the PDF first before saving', type: 'warning' });
      return;
    }

    try {
      // Read PDF base64 for air-gapped desktop sync
      const base64 = await FileSystem.readAsStringAsync(pdfUri, { encoding: FileSystem.EncodingType.Base64 });
      const pdfBase64Data = `data:application/pdf;base64,${base64}`;

      const syncItem = {
        type: 'bill_of_sale_transfer',
        firearm_id: selectedFirearm.id,
        transfer_id: transferId,
        buyer_name: buyerName,
        buyer_dl: buyerDlNumber,
        sale_price: parseFloat(salePrice) || 0,
        date: new Date().toISOString().split('T')[0],
        pdf_base64: pdfBase64Data,
        timestamp: new Date().toISOString()
      };

      const msg = `Saved Bill of Sale for ${selectedFirearm.make} ${selectedFirearm.model} (Transferred to ${buyerName})`;
      await addToQueue(syncItem, msg);
      showSuccess('Transfer Recorded', 'Bill of Sale archived and queued for desktop Bound Book update!');
      router.back();
    } catch (e: any) {
      console.error(e);
      showError('Save Error', 'Failed to archive transfer');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* 1. Firearm Selector */}
      <Text style={styles.sectionHeader}>1. Firearm to Transfer</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 14 }}>
        {firearms.map(f => (
          <Pressable
            key={f.id}
            style={[styles.gunCard, selectedFirearmId === f.id && styles.gunCardActive]}
            onPress={() => setSelectedFirearmId(f.id)}
          >
            <Text style={[styles.gunMake, selectedFirearmId === f.id && styles.activeText]}>{f.make}</Text>
            <Text style={[styles.gunModel, selectedFirearmId === f.id && styles.activeText]}>{f.model}</Text>
            <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>S/N: {f.serial_number || 'N/A'}</Text>
            <View style={styles.caliberBadge}>
              <Text style={styles.caliberBadgeText}>{f.caliber}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* 2. Buyer Information & DL Scanner */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Text style={styles.cardTitle}>2. Buyer Information</Text>
          <Pressable style={styles.scanDlBtn} onPress={handleScanLicense}>
            <Ionicons name="camera" size={14} color="#38bdf8" style={{ marginRight: 4 }} />
            <Text style={styles.scanDlBtnText}>Scan Buyer DL Barcode</Text>
          </Pressable>
        </View>

        <Text style={styles.inputLabel}>Buyer Full Legal Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Johnathan Edward Doe"
          placeholderTextColor="#64748b"
          value={buyerName}
          onChangeText={setBuyerName}
        />

        <Text style={styles.inputLabel}>Driver's License / State ID Number *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. DL12345678 (State: TX)"
          placeholderTextColor="#64748b"
          value={buyerDlNumber}
          onChangeText={setBuyerDlNumber}
        />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Date of Birth</Text>
            <TextInput
              style={styles.input}
              placeholder="MM/DD/YYYY"
              placeholderTextColor="#64748b"
              value={buyerDob}
              onChangeText={setBuyerDob}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Carry Permit / CCL #</Text>
            <TextInput
              style={styles.input}
              placeholder="Optional CCL #"
              placeholderTextColor="#64748b"
              value={buyerCcl}
              onChangeText={setBuyerCcl}
            />
          </View>
        </View>

        <Text style={styles.inputLabel}>Residential Address</Text>
        <TextInput
          style={styles.input}
          placeholder="Street, City, State, ZIP"
          placeholderTextColor="#64748b"
          value={buyerAddress}
          onChangeText={setBuyerAddress}
        />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Buyer Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="For SMS receipt"
              placeholderTextColor="#64748b"
              keyboardType="phone-pad"
              value={buyerPhone}
              onChangeText={setBuyerPhone}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Buyer Email</Text>
            <TextInput
              style={styles.input}
              placeholder="For Email copy"
              placeholderTextColor="#64748b"
              keyboardType="email-address"
              value={buyerEmail}
              onChangeText={setBuyerEmail}
            />
          </View>
        </View>
      </View>

      {/* 3. Transaction Terms */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>3. Purchase Terms & Consideration</Text>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Agreed Sale Price ($ USD)</Text>
            <TextInput
              style={styles.priceInput}
              keyboardType="numeric"
              value={salePrice}
              onChangeText={setSalePrice}
              placeholder="e.g. 650"
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Payment Method</Text>
            <TextInput
              style={styles.input}
              value={paymentMethod}
              onChangeText={setPaymentMethod}
              placeholder="Cash / Wire / Trade"
            />
          </View>
        </View>

        <Text style={styles.inputLabel}>Included Accessories & Magazines</Text>
        <TextInput
          style={styles.input}
          value={includedItems}
          onChangeText={setIncludedItems}
          placeholder="e.g. 3 mags, holster, original box"
        />

        <Text style={styles.inputLabel}>Additional Transfer Notes</Text>
        <TextInput
          style={styles.input}
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g. As-Is condition, private transfer"
        />
      </View>

      {/* 4. Generate Button */}
      <Pressable style={styles.generateBtn} onPress={handleGeneratePdf} disabled={isGenerating}>
        <Ionicons name="document-text" size={20} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.generateBtnText}>
          {isGenerating ? 'Generating Legal PDF...' : '📄 Generate Signed Bill of Sale PDF'}
        </Text>
      </Pressable>

      {/* 5. PDF Ready Actions & Multi-Party Delivery */}
      {pdfUri && (
        <View style={styles.deliveryCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="checkmark-circle" size={22} color="#10b981" style={{ marginRight: 8 }} />
            <View>
              <Text style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: 15 }}>Bill of Sale Ready</Text>
              <Text style={{ color: '#94a3b8', fontSize: 12 }}>Transfer ID: {transferId}</Text>
            </View>
          </View>

          <Text style={{ color: '#cbd5e1', fontSize: 13, marginVertical: 8 }}>
            Deliver the signed legal transfer receipt to both parties:
          </Text>

          {/* Delivery Buttons */}
          <View style={styles.actionGrid}>
            <Pressable style={styles.deliveryBtn} onPress={handleEmailPdf}>
              <Ionicons name="mail-outline" size={18} color="#38bdf8" />
              <Text style={styles.deliveryBtnText}>Email to Both</Text>
            </Pressable>

            <Pressable style={styles.deliveryBtn} onPress={handleSharePdf}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color="#34d399" />
              <Text style={styles.deliveryBtnText}>SMS / Text Share</Text>
            </Pressable>

            <Pressable style={styles.deliveryBtn} onPress={handlePrintPdf}>
              <Ionicons name="print-outline" size={18} color="#fbbf24" />
              <Text style={styles.deliveryBtnText}>AirPrint / Print</Text>
            </Pressable>
          </View>

          {/* Save to Firearm Details & Bound Book */}
          <Pressable style={styles.archiveBtn} onPress={handleSaveAndSyncTransfer}>
            <Ionicons name="save" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.archiveBtnText}>
              💾 Attach to Firearm Card & Update Bound Book
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  sectionHeader: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gunCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    width: 170,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  gunCardActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: '#38bdf8',
  },
  gunMake: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  gunModel: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 2,
  },
  activeText: {
    color: '#38bdf8',
  },
  caliberBadge: {
    backgroundColor: '#0f172a',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 6,
  },
  caliberBadgeText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: 'bold',
  },
  scanDlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderColor: '#38bdf8',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  scanDlBtnText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  inputLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  priceInput: {
    backgroundColor: '#0f172a',
    color: '#10b981',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  generateBtn: {
    flexDirection: 'row',
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  generateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deliveryCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#10b981',
    marginTop: 6,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10,
  },
  deliveryBtn: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  deliveryBtnText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  archiveBtn: {
    flexDirection: 'row',
    backgroundColor: '#10b981',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  archiveBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  }
});
