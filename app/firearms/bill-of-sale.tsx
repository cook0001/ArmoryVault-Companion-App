import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Platform, Switch, Modal, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Linking from 'expo-linking';
import { useDialog } from '../../context/DialogContext';
import { useSync } from '../../context/SyncContext';
import { parseDriverLicenseBarcode, ParsedLicenseData } from '../../utils/pdf417Parser';
import { 
  BillOfSaleData, 
  createBillOfSalePdf, 
  printBillOfSale,
  emailBillOfSale, 
  shareBillOfSale 
} from '../../utils/billOfSaleGenerator';

const PAYMENT_METHODS = [
  'Cash',
  'Card / Debit',
  'Cash App',
  'PayPal',
  'Venmo',
  'Zelle',
  'Money Order',
  'Personal Check',
  'Bank Cashier\'s Check'
];

type PayProvider = 'cashapp' | 'paypal' | 'venmo' | 'stripe' | 'zelle';

export default function BillOfSaleScreen() {
  const router = useRouter();
  const { firearmId } = useLocalSearchParams<{ firearmId?: string }>();
  const { showToast, showError, showSuccess } = useDialog();
  const { addToQueue } = useSync();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [firearms, setFirearms] = useState<any[]>([]);
  const [selectedFirearmId, setSelectedFirearmId] = useState<number | null>(
    firearmId ? Number(firearmId) : null
  );

  // Scanner Modal State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState<'dl' | 'ccl'>('dl');
  const [scannedOnce, setScannedOnce] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const isScanningRef = useRef(false);

  // Scanned Preview Modal State & Raw Inspector Toggle
  const [scannedPreview, setScannedPreview] = useState<ParsedLicenseData | null>(null);
  const [showRawInspector, setShowRawInspector] = useState(false);

  // Card Payment Modal & Provider State
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [payProvider, setPayProvider] = useState<PayProvider>('cashapp');
  const [cashAppTag, setCashAppTag] = useState('');
  const [paypalUsername, setPaypalUsername] = useState('');
  const [venmoUsername, setVenmoUsername] = useState('');
  const [stripeLink, setStripeLink] = useState('');
  const [zelleContact, setZelleContact] = useState('');

  // Transfer Type Toggle
  const [isFflTransfer, setIsFflTransfer] = useState(false);
  const [fflName, setFflName] = useState('');
  const [fflNumber, setFflNumber] = useState('');

  // Seller Details (With Local Persistence)
  const [sellerName, setSellerName] = useState('');
  const [sellerAddress, setSellerAddress] = useState('');
  const [sellerPhone, setSellerPhone] = useState('');
  const [sellerEmail, setSellerEmail] = useState('');
  const [sellerDl, setSellerDl] = useState('');
  const [showSellerEdit, setShowSellerEdit] = useState(false);

  // Form Fields
  const [salePrice, setSalePrice] = useState('650');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [checkOrMoNumber, setCheckOrMoNumber] = useState('');
  const [includedItems, setIncludedItems] = useState('2x Magazines, Original Hard Case, Chamber Lock');
  const [notes, setNotes] = useState('Private party transfer conducted in compliance with state regulations.');

  // Buyer Details
  const [buyerName, setBuyerName] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [buyerDlNumber, setBuyerDlNumber] = useState('');
  const [buyerDob, setBuyerDob] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerCcl, setBuyerCcl] = useState('');
  const [buyerCclState, setBuyerCclState] = useState('');
  const [buyerCclExp, setBuyerCclExp] = useState('');

  // Statutory Affirmation Checkboxes
  const [affirmedAge, setAffirmedAge] = useState(true);
  const [affirmedNonProhibited, setAffirmedNonProhibited] = useState(true);
  const [affirmedResidency, setAffirmedResidency] = useState(true);
  const [affirmedOwnership, setAffirmedOwnership] = useState(true);

  // Generated PDF state
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [transferId] = useState(`AV-BOS-${Date.now().toString().slice(-6)}`);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadCachedFirearms();
    loadSellerProfile();
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

  const loadSellerProfile = async () => {
    try {
      const saved = await AsyncStorage.getItem('vault_owner_seller_profile');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.sellerName) setSellerName(data.sellerName);
        if (data.sellerAddress) setSellerAddress(data.sellerAddress);
        if (data.sellerPhone) setSellerPhone(data.sellerPhone);
        if (data.sellerEmail) setSellerEmail(data.sellerEmail);
        if (data.sellerDl) setSellerDl(data.sellerDl);
        if (data.cashAppTag) setCashAppTag(data.cashAppTag);
        if (data.paypalUsername) setPaypalUsername(data.paypalUsername);
        if (data.venmoUsername) setVenmoUsername(data.venmoUsername);
        if (data.stripeLink) setStripeLink(data.stripeLink);
        if (data.zelleContact) setZelleContact(data.zelleContact);
      } else {
        setSellerName('Vault Owner');
        setSellerAddress('Private Address On File');
      }
    } catch (e) {
      console.error('Error loading seller profile', e);
    }
  };

  const saveSellerProfile = async () => {
    try {
      const profile = {
        sellerName,
        sellerAddress,
        sellerPhone,
        sellerEmail,
        sellerDl,
        cashAppTag,
        paypalUsername,
        venmoUsername,
        stripeLink,
        zelleContact
      };
      await AsyncStorage.setItem('vault_owner_seller_profile', JSON.stringify(profile));
      setShowSellerEdit(false);
      showSuccess('Saved Seller Profile', 'Your profile and payment accounts are saved for future transfers.');
    } catch (e) {
      console.error(e);
      showError('Save Error', 'Failed to save seller profile');
    }
  };

  const selectedFirearm = firearms.find(f => f.id === selectedFirearmId);

  // Compute live checkout URL based on selected provider and sale price
  const formattedPriceNum = useMemo(() => {
    const p = parseFloat(salePrice) || 0;
    return p.toFixed(2);
  }, [salePrice]);

  const activeCheckoutUrl = useMemo(() => {
    if (payProvider === 'cashapp') {
      const tag = cashAppTag.replace('$', '').trim();
      return tag ? `https://cash.app/$${tag}/${formattedPriceNum}` : `https://cash.app/`;
    } else if (payProvider === 'paypal') {
      const user = paypalUsername.replace('https://paypal.me/', '').replace('paypal.me/', '').trim();
      return user ? `https://paypal.me/${user}/${formattedPriceNum}` : `https://paypal.me/`;
    } else if (payProvider === 'venmo') {
      const user = venmoUsername.replace('@', '').trim();
      return user ? `https://venmo.com/${user}?txn=pay&amount=${formattedPriceNum}&note=Firearm%20Transfer%20${transferId}` : `https://venmo.com/`;
    } else if (payProvider === 'stripe') {
      return stripeLink.trim() || `https://buy.stripe.com/`;
    } else if (payProvider === 'zelle') {
      return `Zelle Payment to: ${zelleContact || sellerEmail || sellerPhone} (Amount: $${formattedPriceNum})`;
    }
    return '';
  }, [payProvider, cashAppTag, paypalUsername, venmoUsername, stripeLink, zelleContact, formattedPriceNum, transferId, sellerEmail, sellerPhone]);

  // Open Integrated Scanner
  const openScanner = async (target: 'dl' | 'ccl') => {
    if (!cameraPermission?.granted) {
      const res = await requestCameraPermission();
      if (!res.granted) {
        showToast({ message: 'Camera permission required to scan barcode', type: 'error' });
        return;
      }
    }
    setScanTarget(target);
    setShowRawInspector(false);
    isScanningRef.current = false;
    setScannedOnce(false);
    setIsScannerOpen(true);
  };

  const handleBarcodeScanned = ({ data }: { type: string, data: string }) => {
    if (isScanningRef.current) return;
    isScanningRef.current = true;
    setScannedOnce(true);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    if (scanTarget === 'dl') {
      const parsed = parseDriverLicenseBarcode(data);
      if (parsed) {
        setScannedPreview(parsed);
      } else {
        showToast({ message: 'Scanned barcode was not readable', type: 'warning' });
        isScanningRef.current = false;
        setScannedOnce(false);
      }
    } else if (scanTarget === 'ccl') {
      const parsed = parseDriverLicenseBarcode(data);
      if (parsed) {
        if (parsed.licenseNumber) setBuyerCcl(parsed.licenseNumber);
        if (parsed.state) setBuyerCclState(parsed.state);
        if (parsed.expirationDate) setBuyerCclExp(parsed.expirationDate);
        showSuccess('CCW Permit Auto-Filled', `Permit #${parsed.licenseNumber}`);
      } else {
        const cleanVal = data.trim();
        if (cleanVal.length <= 25 && !cleanVal.includes('\n')) {
          setBuyerCcl(cleanVal);
          showToast({ message: `Captured CCW Permit #${cleanVal}`, type: 'info' });
        } else {
          showToast({ message: 'Scanned barcode was not standard CCW format', type: 'warning' });
        }
      }
      setIsScannerOpen(false);
    }
  };

  const applyScannedPreview = () => {
    if (!scannedPreview) return;
    if (scannedPreview.fullName) setBuyerName(scannedPreview.fullName);
    const fullAddr = [scannedPreview.addressStreet, scannedPreview.city, scannedPreview.state, scannedPreview.zipCode].filter(Boolean).join(', ');
    if (fullAddr) setBuyerAddress(fullAddr);
    if (scannedPreview.licenseNumber) setBuyerDlNumber(scannedPreview.licenseNumber);
    if (scannedPreview.dateOfBirth) setBuyerDob(scannedPreview.dateOfBirth);

    setScannedPreview(null);
    setIsScannerOpen(false);
    showSuccess('ID Applied to Form', `${scannedPreview.fullName} • DL: ${scannedPreview.licenseNumber || 'On File'}`);
  };

  const handleGeneratePdf = async () => {
    if (!selectedFirearm) {
      showToast({ message: 'Please select a firearm from vault', type: 'warning' });
      return;
    }
    if (!buyerName.trim() || !buyerDlNumber.trim()) {
      showToast({ message: 'Please enter Buyer Legal Name and Driver License Number', type: 'warning' });
      return;
    }
    if (!affirmedAge || !affirmedNonProhibited || !affirmedResidency || !affirmedOwnership) {
      showToast({ message: 'Please confirm all legal affirmations', type: 'warning' });
      return;
    }

    setIsGenerating(true);
    try {
      const billData: BillOfSaleData = {
        transferId,
        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        isFflTransfer,
        fflName: isFflTransfer ? fflName : undefined,
        fflNumber: isFflTransfer ? fflNumber : undefined,
        firearmId: selectedFirearm.id,
        make: selectedFirearm.make,
        model: selectedFirearm.model,
        serialNumber: selectedFirearm.serial_number || 'N/A',
        caliber: selectedFirearm.caliber || 'N/A',
        actionType: selectedFirearm.action_type || selectedFirearm.type || 'Semi-Automatic',
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
        buyerAddress: buyerAddress.trim() || 'Address on ID',
        buyerPhone,
        buyerEmail,
        buyerDlNumber: buyerDlNumber.trim(),
        buyerDob,
        buyerCclNumber: buyerCcl.trim(),
        buyerCclState: buyerCclState.trim(),
        buyerCclExp: buyerCclExp.trim(),
        salePrice: parseFloat(salePrice) || 0,
        paymentMethod,
        checkOrMoNumber: checkOrMoNumber.trim() || undefined,
        notes
      };

      const uri = await createBillOfSalePdf(billData);
      setPdfUri(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showSuccess('Bill of Sale Ready', `Document ID: ${transferId}`);
    } catch (e: any) {
      console.error(e);
      showError('PDF Error', e.message || 'Failed to generate Bill of Sale');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrintPdf = async () => {
    if (!selectedFirearm) return;
    try {
      const billData: BillOfSaleData = {
        transferId,
        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        isFflTransfer,
        fflName,
        fflNumber,
        firearmId: selectedFirearm.id,
        make: selectedFirearm.make,
        model: selectedFirearm.model,
        serialNumber: selectedFirearm.serial_number || 'N/A',
        caliber: selectedFirearm.caliber || 'N/A',
        condition: selectedFirearm.condition || 'Used',
        includedItems,
        sellerName,
        sellerAddress,
        sellerPhone,
        sellerEmail,
        sellerDlNumber: sellerDl,
        buyerName,
        buyerAddress,
        buyerDlNumber,
        buyerDob,
        buyerCclNumber: buyerCcl,
        buyerCclState,
        buyerCclExp,
        salePrice: parseFloat(salePrice) || 0,
        paymentMethod,
        checkOrMoNumber: checkOrMoNumber.trim() || undefined,
        notes
      };
      await printBillOfSale(billData);
    } catch (e) {
      console.error(e);
    }
  };

  const handleEmailPdf = async () => {
    if (!pdfUri || !selectedFirearm) return;
    const billData: BillOfSaleData = {
      transferId,
      date: new Date().toLocaleDateString('en-US'),
      firearmId: selectedFirearm.id,
      make: selectedFirearm.make,
      model: selectedFirearm.model,
      serialNumber: selectedFirearm.serial_number || 'N/A',
      caliber: selectedFirearm.caliber || 'N/A',
      condition: 'Used',
      sellerName,
      sellerAddress,
      buyerName,
      buyerAddress,
      buyerDlNumber,
      buyerEmail,
      sellerEmail,
      salePrice: parseFloat(salePrice) || 0,
      paymentMethod,
      checkOrMoNumber: checkOrMoNumber.trim() || undefined
    };
    await emailBillOfSale(pdfUri, billData);
  };

  const handleShareNative = async () => {
    if (!pdfUri) return;
    await shareBillOfSale(pdfUri, `ArmoryVault Bill of Sale - ${selectedFirearm?.make} ${selectedFirearm?.model}`);
  };

  const requiresCheckNumber = ['Money Order', 'Personal Check', 'Bank Cashier\'s Check', 'Zelle', 'Cash App', 'Venmo', 'PayPal'].includes(paymentMethod);
  const isCardSelected = paymentMethod === 'Card / Debit' || paymentMethod === 'PayPal' || paymentMethod === 'Cash App' || paymentMethod === 'Venmo' || paymentMethod === 'Zelle';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* 1. Firearm Selector */}
      <Text style={styles.sectionHeader}>1. Select Transferred Firearm</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalRow}>
        {firearms.map(f => (
          <Pressable
            key={f.id}
            style={[styles.gunCard, selectedFirearmId === f.id && styles.gunCardActive]}
            onPress={() => setSelectedFirearmId(f.id)}
          >
            <Text style={styles.gunMake}>{f.make}</Text>
            <Text style={styles.gunModel}>{f.model}</Text>
            <Text style={styles.gunSerial}>S/N: {f.serial_number || 'N/A'}</Text>
            <View style={styles.caliberBadge}>
              <Text style={styles.caliberBadgeText}>{f.caliber}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* 2. Seller / Vault Owner Profile Card */}
      <View style={styles.sellerProfileCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={styles.sellerCardTitle}>Seller Profile & Payment Handles</Text>
            <Text style={styles.sellerCardSub}>{sellerName || 'Not Set'} • {sellerAddress || 'No Address'}</Text>
          </View>
          <Pressable 
            style={styles.editProfileBtn} 
            onPress={() => setShowSellerEdit(!showSellerEdit)}
          >
            <Ionicons name={showSellerEdit ? "chevron-up" : "create-outline"} size={16} color="#38bdf8" style={{ marginRight: 4 }} />
            <Text style={styles.editProfileText}>{showSellerEdit ? 'Close' : 'Edit Profile'}</Text>
          </Pressable>
        </View>

        {showSellerEdit && (
          <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 10 }}>
            <Text style={styles.inputLabel}>Seller Full Legal Name</Text>
            <TextInput
              style={styles.textInput}
              value={sellerName}
              onChangeText={setSellerName}
              placeholder="e.g. Jane Doe"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.inputLabel}>Seller Residential Address</Text>
            <TextInput
              style={styles.textInput}
              value={sellerAddress}
              onChangeText={setSellerAddress}
              placeholder="e.g. 123 Main St, City, ST 12345"
              placeholderTextColor="#64748b"
            />

            <View style={styles.fieldRow2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Seller DL / State ID</Text>
                <TextInput
                  style={styles.textInput}
                  value={sellerDl}
                  onChangeText={setSellerDl}
                  placeholder="DL-XXXXXXX"
                  placeholderTextColor="#64748b"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Seller Phone</Text>
                <TextInput
                  style={styles.textInput}
                  value={sellerPhone}
                  onChangeText={setSellerPhone}
                  placeholder="(555) 000-0000"
                  placeholderTextColor="#64748b"
                />
              </View>
            </View>

            <Text style={[styles.sectionHeader, { marginTop: 10, marginBottom: 4 }]}>Saved Payment Handles (Auto-Loaded)</Text>
            
            <View style={styles.fieldRow2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Cash App $Tag</Text>
                <TextInput
                  style={styles.textInput}
                  value={cashAppTag}
                  onChangeText={setCashAppTag}
                  placeholder="$YourVault"
                  placeholderTextColor="#64748b"
                  autoCapitalize="none"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>PayPal.me Handle</Text>
                <TextInput
                  style={styles.textInput}
                  value={paypalUsername}
                  onChangeText={setPaypalUsername}
                  placeholder="paypal.me/user"
                  placeholderTextColor="#64748b"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.fieldRow2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>@Venmo Username</Text>
                <TextInput
                  style={styles.textInput}
                  value={venmoUsername}
                  onChangeText={setVenmoUsername}
                  placeholder="@YourUser"
                  placeholderTextColor="#64748b"
                  autoCapitalize="none"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Zelle Email / Phone</Text>
                <TextInput
                  style={styles.textInput}
                  value={zelleContact}
                  onChangeText={setZelleContact}
                  placeholder="user@bank.com"
                  placeholderTextColor="#64748b"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Stripe / Square Hosted Checkout URL (Optional)</Text>
            <TextInput
              style={styles.textInput}
              value={stripeLink}
              onChangeText={setStripeLink}
              placeholder="https://buy.stripe.com/... or https://square.link/..."
              placeholderTextColor="#64748b"
              autoCapitalize="none"
            />

            <Pressable style={styles.saveProfileBtn} onPress={saveSellerProfile}>
              <Ionicons name="save-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.saveProfileText}>Save Default Profile & Handles</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* 3. Transfer Mode Selector */}
      <View style={styles.modeCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={styles.modeTitle}>
              {isFflTransfer ? 'FFL Dealer Consignment / Transfer' : 'Private Party Transfer (In-State)'}
            </Text>
            <Text style={styles.modeSubtitle}>
              {isFflTransfer ? 'Includes FFL Dealer # & Bound Book details' : 'Standard direct person-to-person transfer'}
            </Text>
          </View>
          <Switch 
            value={isFflTransfer} 
            onValueChange={setIsFflTransfer}
            trackColor={{ false: '#475569', true: '#38bdf8' }}
          />
        </View>

        {isFflTransfer && (
          <View style={{ marginTop: 12, gap: 8 }}>
            <TextInput
              style={styles.textInput}
              placeholder="FFL Dealer Business Name (e.g. Apex Tactical FFL)..."
              placeholderTextColor="#64748b"
              value={fflName}
              onChangeText={setFflName}
            />
            <TextInput
              style={styles.textInput}
              placeholder="FFL Number (e.g. 9-87-XXX-XX-XX-XXXXX)..."
              placeholderTextColor="#64748b"
              value={fflNumber}
              onChangeText={setFflNumber}
            />
          </View>
        )}
      </View>

      {/* 4. Buyer Information Card */}
      <Text style={styles.sectionHeader}>2. Transferee / Buyer Information</Text>
      <View style={styles.formCard}>
        {/* Prominent Scan Driver's License Action Banner */}
        <Pressable style={styles.scanIdBannerBtn} onPress={() => openScanner('dl')}>
          <Ionicons name="camera" size={20} color="#38bdf8" style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.scanIdBannerTitle}>Scan Buyer's Driver License / ID</Text>
            <Text style={styles.scanIdBannerSub}>Supports FL, TX, CA, NY and all 50 State 2D Matrix PDF417</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#38bdf8" />
        </Pressable>

        <Text style={styles.inputLabel}>Full Legal Name *</Text>
        <TextInput
          style={styles.textInput}
          placeholder="e.g. Johnathan Q. Public"
          placeholderTextColor="#64748b"
          value={buyerName}
          onChangeText={setBuyerName}
        />

        <View style={styles.fieldRow2}>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Driver's License / ID *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. DL-12345678"
              placeholderTextColor="#64748b"
              value={buyerDlNumber}
              onChangeText={setBuyerDlNumber}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Date of Birth</Text>
            <TextInput
              style={styles.textInput}
              placeholder="MM/DD/YYYY"
              placeholderTextColor="#64748b"
              value={buyerDob}
              onChangeText={setBuyerDob}
            />
          </View>
        </View>

        <Text style={styles.inputLabel}>Residential Address *</Text>
        <TextInput
          style={styles.textInput}
          placeholder="e.g. 456 Elm St, City, State ZIP"
          placeholderTextColor="#64748b"
          value={buyerAddress}
          onChangeText={setBuyerAddress}
        />

        {/* Concealed Carry Permit Details */}
        <View style={styles.cclCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#38bdf8" style={{ marginRight: 6 }} />
              <Text style={styles.cclTitle}>Concealed Carry License (CCW / CCL)</Text>
            </View>
            <Pressable style={styles.miniScanBtn} onPress={() => openScanner('ccl')}>
              <Ionicons name="camera-outline" size={12} color="#38bdf8" style={{ marginRight: 3 }} />
              <Text style={styles.miniScanBtnText}>Scan CCW</Text>
            </Pressable>
          </View>
          <View style={styles.fieldRow3}>
            <TextInput
              style={[styles.textInput, { flex: 1.5 }]}
              placeholder="Permit #"
              placeholderTextColor="#64748b"
              value={buyerCcl}
              onChangeText={setBuyerCcl}
            />
            <TextInput
              style={[styles.textInput, { flex: 1 }]}
              placeholder="State (e.g. FL)"
              placeholderTextColor="#64748b"
              value={buyerCclState}
              onChangeText={setBuyerCclState}
            />
            <TextInput
              style={[styles.textInput, { flex: 1 }]}
              placeholder="Exp Date"
              placeholderTextColor="#64748b"
              value={buyerCclExp}
              onChangeText={setBuyerCclExp}
            />
          </View>
        </View>

        <View style={styles.fieldRow2}>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Buyer Phone</Text>
            <TextInput
              style={styles.textInput}
              placeholder="(555) 000-0000"
              placeholderTextColor="#64748b"
              value={buyerPhone}
              onChangeText={setBuyerPhone}
              keyboardType="phone-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Buyer Email</Text>
            <TextInput
              style={styles.textInput}
              placeholder="buyer@domain.com"
              placeholderTextColor="#64748b"
              value={buyerEmail}
              onChangeText={setBuyerEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>
      </View>

      {/* 5. Sale Terms & Payment Selector */}
      <Text style={styles.sectionHeader}>3. Sale Terms & Consideration</Text>
      <View style={styles.formCard}>
        <View style={styles.fieldRow2}>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Agreed Sale Price ($ USD)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="650"
              placeholderTextColor="#64748b"
              value={salePrice}
              onChangeText={setSalePrice}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Payment Method Selector */}
        <Text style={styles.inputLabel}>Payment Method</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.paymentScrollRow}>
          {PAYMENT_METHODS.map(method => {
            const isSelected = paymentMethod === method;
            return (
              <Pressable
                key={method}
                style={[styles.paymentChip, isSelected && styles.paymentChipActive]}
                onPress={() => {
                  setPaymentMethod(method);
                  if (method === 'Cash App') setPayProvider('cashapp');
                  else if (method === 'PayPal') setPayProvider('paypal');
                  else if (method === 'Venmo') setPayProvider('venmo');
                  else if (method === 'Card / Debit') setPayProvider('cashapp');
                  else if (method === 'Zelle') setPayProvider('zelle');
                }}
              >
                <Text style={[styles.paymentChipText, isSelected && styles.paymentChipTextActive]}>
                  {method}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Card / Electronic Payment Trigger Banner */}
        {isCardSelected && (
          <Pressable style={styles.cardPayBannerBtn} onPress={() => setIsCardModalOpen(true)}>
            <Ionicons name="qr-code" size={20} color="#34d399" style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardPayBannerTitle}>Accept Digital / Card Payment (${formattedPriceNum} USD)</Text>
              <Text style={styles.cardPayBannerSub}>Generate instant payment QR code with pre-filled amount</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#34d399" />
          </Pressable>
        )}

        {/* Conditional Money Order / Check # Field */}
        {requiresCheckNumber && (
          <View style={{ marginTop: 6 }}>
            <Text style={styles.inputLabel}>
              {paymentMethod.includes('Check') ? 'Check Number' : paymentMethod.includes('Money Order') ? 'Money Order Number' : 'Transaction Reference / Auth #'}
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. MO-98765432, Check #1042, or Auth ID"
              placeholderTextColor="#64748b"
              value={checkOrMoNumber}
              onChangeText={setCheckOrMoNumber}
            />
          </View>
        )}

        <Text style={styles.inputLabel}>Included Accessories & Magazines</Text>
        <TextInput
          style={styles.textInput}
          placeholder="e.g. 3x 15rd mags, Holster, Original Box, Manual..."
          placeholderTextColor="#64748b"
          value={includedItems}
          onChangeText={setIncludedItems}
        />
      </View>

      {/* 6. Statutory Legal Affirmations */}
      <Text style={styles.sectionHeader}>4. Statutory Legal Affirmations</Text>
      <View style={styles.formCard}>
        <Pressable style={styles.checkboxRow} onPress={() => setAffirmedAge(!affirmedAge)}>
          <Ionicons name={affirmedAge ? "checkbox" : "square-outline"} size={20} color={affirmedAge ? "#10b981" : "#64748b"} />
          <Text style={styles.checkboxLabel}>Buyer is of legal statutory age (18+ Long Guns / 21+ Handguns)</Text>
        </Pressable>

        <Pressable style={styles.checkboxRow} onPress={() => setAffirmedNonProhibited(!affirmedNonProhibited)}>
          <Ionicons name={affirmedNonProhibited ? "checkbox" : "square-outline"} size={20} color={affirmedNonProhibited ? "#10b981" : "#64748b"} />
          <Text style={styles.checkboxLabel}>Buyer affirms they are NOT a prohibited person under 18 U.S.C. § 922(g)</Text>
        </Pressable>

        <Pressable style={styles.checkboxRow} onPress={() => setAffirmedResidency(!affirmedResidency)}>
          <Ionicons name={affirmedResidency ? "checkbox" : "square-outline"} size={20} color={affirmedResidency ? "#10b981" : "#64748b"} />
          <Text style={styles.checkboxLabel}>Buyer confirms in-state residency matching Driver's License</Text>
        </Pressable>

        <Pressable style={styles.checkboxRow} onPress={() => setAffirmedOwnership(!affirmedOwnership)}>
          <Ionicons name={affirmedOwnership ? "checkbox" : "square-outline"} size={20} color={affirmedOwnership ? "#10b981" : "#64748b"} />
          <Text style={styles.checkboxLabel}>Seller certifies lawful unencumbered ownership free of liens</Text>
        </Pressable>
      </View>

      {/* 7. Action Buttons */}
      <Pressable 
        style={[styles.generateBtn, isGenerating && { opacity: 0.7 }]} 
        onPress={handleGeneratePdf}
        disabled={isGenerating}
      >
        <Ionicons name="document-text" size={20} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.generateBtnText}>
          {isGenerating ? 'Rendering PDF...' : 'Generate Official Bill of Sale PDF'}
        </Text>
      </Pressable>

      {/* PDF Output Actions */}
      {pdfUri && (
        <View style={styles.pdfReadyCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Ionicons name="checkmark-circle" size={22} color="#10b981" style={{ marginRight: 8 }} />
            <Text style={styles.pdfReadyTitle}>Bill of Sale Ready ({transferId})</Text>
          </View>

          <View style={styles.pdfActionGrid}>
            <Pressable style={styles.pdfActionBtn} onPress={handlePrintPdf}>
              <Ionicons name="print-outline" size={18} color="#38bdf8" style={{ marginRight: 6 }} />
              <Text style={styles.pdfActionText}>Print</Text>
            </Pressable>

            <Pressable style={styles.pdfActionBtn} onPress={handleShareNative}>
              <Ionicons name="share-social-outline" size={18} color="#38bdf8" style={{ marginRight: 6 }} />
              <Text style={styles.pdfActionText}>Share / SMS</Text>
            </Pressable>

            <Pressable style={styles.pdfActionBtn} onPress={handleEmailPdf}>
              <Ionicons name="mail-outline" size={18} color="#38bdf8" style={{ marginRight: 6 }} />
              <Text style={styles.pdfActionText}>Email</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Dynamic Payment QR Modal */}
      <Modal visible={isCardModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 8 }}>
              <Text style={styles.modalTitle}>Receive Payment: ${formattedPriceNum}</Text>
              <Pressable onPress={() => setIsCardModalOpen(false)}>
                <Ionicons name="close" size={22} color="#94a3b8" />
              </Pressable>
            </View>

            {/* Provider Selector Tabs */}
            <View style={styles.providerTabBar}>
              {[
                { id: 'cashapp', label: 'Cash App' },
                { id: 'paypal', label: 'PayPal' },
                { id: 'venmo', label: 'Venmo' },
                { id: 'stripe', label: 'Stripe/Square' },
                { id: 'zelle', label: 'Zelle' }
              ].map(p => (
                <Pressable
                  key={p.id}
                  style={[styles.providerTab, payProvider === p.id && styles.providerTabActive]}
                  onPress={() => setPayProvider(p.id as PayProvider)}
                >
                  <Text style={[styles.providerTabText, payProvider === p.id && styles.providerTabTextActive]}>
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Provider Handle Configuration Input with Instant Auto-Save */}
            <View style={{ width: '100%', marginVertical: 6 }}>
              {payProvider === 'cashapp' && (
                <TextInput
                  style={styles.handleInput}
                  placeholder="Enter your $Cashtag (e.g. $YourVault)..."
                  placeholderTextColor="#64748b"
                  value={cashAppTag}
                  onChangeText={(val) => {
                    setCashAppTag(val);
                    AsyncStorage.getItem('vault_owner_seller_profile').then(str => {
                      const cur = str ? JSON.parse(str) : {};
                      AsyncStorage.setItem('vault_owner_seller_profile', JSON.stringify({ ...cur, cashAppTag: val }));
                    });
                  }}
                  autoCapitalize="none"
                />
              )}
              {payProvider === 'paypal' && (
                <TextInput
                  style={styles.handleInput}
                  placeholder="Enter your PayPal.me username (e.g. JohnVault)..."
                  placeholderTextColor="#64748b"
                  value={paypalUsername}
                  onChangeText={(val) => {
                    setPaypalUsername(val);
                    AsyncStorage.getItem('vault_owner_seller_profile').then(str => {
                      const cur = str ? JSON.parse(str) : {};
                      AsyncStorage.setItem('vault_owner_seller_profile', JSON.stringify({ ...cur, paypalUsername: val }));
                    });
                  }}
                  autoCapitalize="none"
                />
              )}
              {payProvider === 'venmo' && (
                <TextInput
                  style={styles.handleInput}
                  placeholder="Enter your @Venmo username..."
                  placeholderTextColor="#64748b"
                  value={venmoUsername}
                  onChangeText={(val) => {
                    setVenmoUsername(val);
                    AsyncStorage.getItem('vault_owner_seller_profile').then(str => {
                      const cur = str ? JSON.parse(str) : {};
                      AsyncStorage.setItem('vault_owner_seller_profile', JSON.stringify({ ...cur, venmoUsername: val }));
                    });
                  }}
                  autoCapitalize="none"
                />
              )}
              {payProvider === 'stripe' && (
                <TextInput
                  style={styles.handleInput}
                  placeholder="Paste Stripe / Square Payment Link URL..."
                  placeholderTextColor="#64748b"
                  value={stripeLink}
                  onChangeText={(val) => {
                    setStripeLink(val);
                    AsyncStorage.getItem('vault_owner_seller_profile').then(str => {
                      const cur = str ? JSON.parse(str) : {};
                      AsyncStorage.setItem('vault_owner_seller_profile', JSON.stringify({ ...cur, stripeLink: val }));
                    });
                  }}
                  autoCapitalize="none"
                />
              )}
              {payProvider === 'zelle' && (
                <TextInput
                  style={styles.handleInput}
                  placeholder="Enter Zelle Email or Phone Number..."
                  placeholderTextColor="#64748b"
                  value={zelleContact}
                  onChangeText={(val) => {
                    setZelleContact(val);
                    AsyncStorage.getItem('vault_owner_seller_profile').then(str => {
                      const cur = str ? JSON.parse(str) : {};
                      AsyncStorage.setItem('vault_owner_seller_profile', JSON.stringify({ ...cur, zelleContact: val }));
                    });
                  }}
                  autoCapitalize="none"
                />
              )}
            </View>

            {/* Dynamic Generated Payment QR Code */}
            <View style={styles.qrContainer}>
              <Image 
                source={{ 
                  uri: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(activeCheckoutUrl)}` 
                }} 
                style={{ width: 170, height: 170, borderRadius: 6 }} 
              />
            </View>

            <Text style={{ color: '#cbd5e1', fontSize: 11, textAlign: 'center', marginBottom: 8 }}>
              Buyer scans with phone camera to pay <Text style={{ color: '#34d399', fontWeight: 'bold' }}>${formattedPriceNum} USD</Text>
            </Text>

            {/* Action Buttons inside Payment Modal */}
            <View style={{ width: '100%', gap: 8 }}>
              {activeCheckoutUrl.startsWith('http') && (
                <Pressable 
                  style={styles.testLinkBtn} 
                  onPress={() => Linking.openURL(activeCheckoutUrl).catch(() => {})}
                >
                  <Ionicons name="open-outline" size={15} color="#38bdf8" style={{ marginRight: 6 }} />
                  <Text style={styles.testLinkText}>Preview Checkout Link on This Device</Text>
                </Pressable>
              )}

              <Pressable 
                style={styles.markPaidBtn} 
                onPress={() => {
                  saveSellerProfile();
                  const refPrefix = payProvider.toUpperCase();
                  setCheckOrMoNumber(`${refPrefix}-${Date.now().toString().slice(-6)}`);
                  setIsCardModalOpen(false);
                  showSuccess('Payment Confirmed', `Logged reference #${refPrefix}-${Date.now().toString().slice(-6)}`);
                }}
              >
                <Ionicons name="checkmark-done-circle" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.markPaidBtnText}>Mark Paid & Set Reference #</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Scanned ID Review Sheet / Modal */}
      <Modal visible={Boolean(scannedPreview)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="id-card" size={20} color="#38bdf8" style={{ marginRight: 6 }} />
                <Text style={styles.modalTitle}>Scanned ID Preview</Text>
              </View>
              <View style={[styles.badgePill, scannedPreview?.isFull2D ? styles.badge2D : styles.badge1D]}>
                <Text style={styles.badgeText}>{scannedPreview?.isFull2D ? '2D Matrix' : '1D Barcode'}</Text>
              </View>
            </View>

            {scannedPreview && (
              <View style={{ width: '100%', backgroundColor: '#0f172a', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <Text style={styles.previewLabel}>Full Legal Name (First Middle Last):</Text>
                <Text style={styles.previewValue}>{scannedPreview.fullName || 'Not detected'}</Text>

                <Text style={styles.previewLabel}>Driver's License / ID #:</Text>
                <Text style={[styles.previewValue, !scannedPreview.licenseNumber && { color: '#94a3b8' }]}>
                  {scannedPreview.licenseNumber || 'Not detected in barcode'}
                </Text>

                <Text style={styles.previewLabel}>Residential Address:</Text>
                <Text style={[styles.previewValue, !scannedPreview.addressStreet && { color: '#94a3b8' }]}>
                  {[scannedPreview.addressStreet, scannedPreview.city, scannedPreview.state, scannedPreview.zipCode].filter(Boolean).join(', ') || 'Not detected in barcode'}
                </Text>

                <Text style={styles.previewLabel}>Date of Birth:</Text>
                <Text style={[styles.previewValue, !scannedPreview.dateOfBirth && { color: '#94a3b8' }]}>
                  {scannedPreview.dateOfBirth || 'Not detected in barcode'}
                </Text>

                {/* Collapsible Raw Inspector Toggle */}
                <Pressable 
                  style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }} 
                  onPress={() => setShowRawInspector(!showRawInspector)}
                >
                  <Ionicons name={showRawInspector ? "chevron-up" : "code-slash-outline"} size={13} color="#38bdf8" style={{ marginRight: 4 }} />
                  <Text style={{ color: '#38bdf8', fontSize: 10, fontWeight: 'bold' }}>
                    {showRawInspector ? 'Hide Raw Barcode String' : 'Inspect Raw Barcode String'}
                  </Text>
                </Pressable>

                {showRawInspector && (
                  <View style={{ marginTop: 6, backgroundColor: '#020617', padding: 8, borderRadius: 6 }}>
                    <Text style={{ color: '#64748b', fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                      {scannedPreview.rawText}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={{ width: '100%', gap: 8 }}>
              <Pressable style={styles.markPaidBtn} onPress={applyScannedPreview}>
                <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.markPaidBtnText}>
                  {scannedPreview?.isFull2D ? 'Apply Full ID to Form' : 'Apply Detected Info to Form'}
                </Text>
              </Pressable>

              <Pressable 
                style={styles.testLinkBtn} 
                onPress={() => {
                  setScannedPreview(null);
                  isScanningRef.current = false;
                  setScannedOnce(false);
                }}
              >
                <Ionicons name="refresh" size={16} color="#38bdf8" style={{ marginRight: 6 }} />
                <Text style={styles.testLinkText}>Rescan ID Card</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Embedded Barcode & Driver's License Camera Scanner Modal */}
      <Modal visible={isScannerOpen} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torchOn}
            barcodeScannerSettings={{
              barcodeTypes: ['pdf417', 'code128', 'code39', 'qr'],
            }}
            onBarcodeScanned={scannedOnce ? undefined : handleBarcodeScanned}
          />

          {/* Target Reticle */}
          <View style={styles.cameraOverlay} pointerEvents="none">
            <View style={styles.idReticle} />
            <Text style={styles.cameraGuideText}>
              Align Barcode on back of ID inside box
            </Text>
          </View>

          {/* Top Bar */}
          <View style={styles.cameraTopBar}>
            <Pressable onPress={() => setTorchOn(!torchOn)} style={styles.cameraTorchBtn}>
              <Ionicons name={torchOn ? "flash" : "flash-outline"} size={20} color="#fff" />
            </Pressable>
            <Pressable onPress={() => {
              setIsScannerOpen(false);
              setScannedPreview(null);
            }} style={styles.cameraCloseBtn}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </View>
        </View>
      </Modal>
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
    fontSize: 13,
    fontWeight: 'bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 8,
  },
  horizontalRow: {
    flexDirection: 'row',
    marginBottom: 12,
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
    backgroundColor: '#065f46',
    borderColor: '#10b981',
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
    marginVertical: 2,
  },
  gunSerial: {
    color: '#cbd5e1',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
  sellerProfileCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  sellerCardTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: 'bold',
  },
  sellerCardSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#38bdf8',
  },
  editProfileText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  saveProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  saveProfileText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modeCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  modeTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modeSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  formCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  scanIdBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38bdf8',
    marginBottom: 12,
  },
  scanIdBannerTitle: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: 'bold',
  },
  scanIdBannerSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  cardPayBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    marginBottom: 8,
  },
  cardPayBannerTitle: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardPayBannerSub: {
    color: '#94a3b8',
    fontSize: 11,
  },
  inputLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 4,
    marginTop: 6,
  },
  textInput: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 6,
  },
  fieldRow2: {
    flexDirection: 'row',
    gap: 8,
  },
  fieldRow3: {
    flexDirection: 'row',
    gap: 6,
  },
  cclCard: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginVertical: 6,
  },
  cclTitle: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  miniScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#38bdf8',
  },
  miniScanBtnText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  paymentScrollRow: {
    flexDirection: 'row',
    marginBottom: 8,
    marginTop: 2,
  },
  paymentChip: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  paymentChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38bdf8',
  },
  paymentChipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  paymentChipTextActive: {
    color: '#38bdf8',
    fontWeight: 'bold',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#334155',
  },
  checkboxLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    marginLeft: 10,
    flex: 1,
    lineHeight: 16,
  },
  generateBtn: {
    flexDirection: 'row',
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  generateBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  pdfReadyCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#10b981',
    marginTop: 14,
  },
  pdfReadyTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: 'bold',
  },
  pdfActionGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  pdfActionBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  pdfActionText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Dynamic Payment Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 14,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: 'bold',
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badge2D: {
    backgroundColor: '#065f46',
  },
  badge1D: {
    backgroundColor: '#854d0e',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  providerTabBar: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 3,
    marginVertical: 6,
    width: '100%',
  },
  providerTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  providerTabActive: {
    backgroundColor: '#0284c7',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  providerTabText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  providerTabTextActive: {
    color: '#ffffff',
  },
  handleInput: {
    backgroundColor: '#0f172a',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#0284c7',
    width: '100%',
  },
  qrContainer: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 8,
    marginVertical: 8,
  },
  testLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#475569',
  },
  testLinkText: {
    color: '#f1f5f9',
    fontSize: 13,
    fontWeight: 'bold',
  },
  markPaidBtn: {
    flexDirection: 'row',
    backgroundColor: '#10b981',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  markPaidBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Scanned ID Preview
  previewLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  previewValue: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  // Camera Modal Styles
  cameraOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  idReticle: {
    width: 300,
    height: 180,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#38bdf8',
    backgroundColor: 'transparent',
  },
  cameraGuideText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  cameraTopBar: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cameraTorchBtn: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    padding: 10,
    borderRadius: 20,
  },
  cameraCloseBtn: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    padding: 10,
    borderRadius: 20,
  },
});
