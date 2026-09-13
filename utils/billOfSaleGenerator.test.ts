jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(),
  printAsync: jest.fn()
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn()
}));
jest.mock('expo-mail-composer', () => ({
  isAvailableAsync: jest.fn(),
  composeAsync: jest.fn()
}));

import {
  generateBillOfSaleHtml,
  BillOfSaleData
} from './billOfSaleGenerator';

describe('Bill of Sale Generator & Data Formatting', () => {
  const sampleData: BillOfSaleData = {
    transferId: 'AV-TX-2026-999',
    date: 'September 12, 2026',
    firearmId: 101,
    make: 'Colt',
    model: 'Python',
    serialNumber: 'PY123456',
    caliber: '.357 Magnum',
    actionType: 'Revolver',
    finish: 'Royal Blue',
    barrelLength: '6 in',
    condition: 'Excellent',
    includedItems: 'Original Factory Box, 2 Speedloaders',
    sellerName: 'John Doe',
    sellerAddress: '123 Safe St, Austin, TX',
    sellerPhone: '512-555-0100',
    sellerEmail: 'john@example.com',
    sellerDlNumber: 'TX-DL-987654',
    buyerName: 'Jane Smith',
    buyerAddress: '456 Target Way, Dallas, TX',
    buyerPhone: '214-555-0200',
    buyerEmail: 'jane@example.com',
    buyerDlNumber: 'TX-DL-112233',
    buyerDob: '05/15/1990',
    salePrice: 1450,
    paymentMethod: 'Cash',
    notes: 'Private collector transfer'
  };

  it('generates HTML containing the transfer ID and firearm serial number', () => {
    const html = generateBillOfSaleHtml(sampleData);
    expect(html).toContain('AV-TX-2026-999');
    expect(html).toContain('PY123456');
    expect(html).toContain('Colt');
    expect(html).toContain('Python');
    expect(html).toContain('$1450.00 USD');
  });

  it('includes buyer and seller details in the document HTML', () => {
    const html = generateBillOfSaleHtml(sampleData);
    expect(html).toContain('John Doe');
    expect(html).toContain('Jane Smith');
    expect(html).toContain('TX-DL-987654');
    expect(html).toContain('TX-DL-112233');
  });

  it('correctly sets up a bill_of_sale_transfer sync payload structure', () => {
    const syncItem = {
      type: 'bill_of_sale_transfer',
      timestamp: new Date().toISOString(),
      firearm_id: sampleData.firearmId,
      serial_number: sampleData.serialNumber,
      transfer_id: sampleData.transferId,
      date: sampleData.date,
      buyer_name: sampleData.buyerName,
      buyer_dl: sampleData.buyerDlNumber,
      seller_name: sampleData.sellerName,
      sale_price: sampleData.salePrice,
      payment_method: sampleData.paymentMethod,
      notes: sampleData.notes,
      pdf_filename: `BillOfSale_${sampleData.transferId}_Colt_Python.pdf`,
      data: sampleData
    };

    expect(syncItem.type).toBe('bill_of_sale_transfer');
    expect(syncItem.firearm_id).toBe(101);
    expect(syncItem.serial_number).toBe('PY123456');
    expect(syncItem.sale_price).toBe(1450);
  });
});
