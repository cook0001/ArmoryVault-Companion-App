import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import { Platform } from 'react-native';

export interface BillOfSaleData {
  transferId: string;
  date: string;
  
  // Firearm Details
  firearmId: number;
  make: string;
  model: string;
  serialNumber: string;
  caliber: string;
  actionType?: string;
  finish?: string;
  barrelLength?: string;
  condition: string;
  includedItems?: string;

  // Seller
  sellerName: string;
  sellerAddress: string;
  sellerPhone?: string;
  sellerEmail?: string;
  sellerDlNumber?: string;
  sellerSignatureSvg?: string; // base64 or path

  // Buyer
  buyerName: string;
  buyerAddress: string;
  buyerPhone?: string;
  buyerEmail?: string;
  buyerDlNumber: string;
  buyerDob?: string;
  buyerCclNumber?: string;
  buyerSignatureSvg?: string;

  // Terms
  salePrice: number;
  paymentMethod: string;
  notes?: string;
}

export function generateBillOfSaleHtml(data: BillOfSaleData): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Firearm Bill of Sale - ${data.transferId}</title>
        <style>
          @page { size: letter portrait; margin: 0.5in; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            line-height: 1.35;
            font-size: 11px;
            margin: 0;
            padding: 0;
          }
          .header {
            border-bottom: 2px solid #0f172a;
            padding-bottom: 8px;
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .title {
            font-size: 18px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 0;
          }
          .subtitle {
            font-size: 11px;
            color: #475569;
            margin-top: 2px;
          }
          .transfer-meta {
            text-align: right;
            font-size: 11px;
          }
          .transfer-meta strong {
            color: #0f172a;
          }
          .section {
            margin-bottom: 10px;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            padding: 8px 10px;
          }
          .section-title {
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
            background: #f1f5f9;
            margin: -8px -10px 8px -10px;
            padding: 4px 10px;
            border-bottom: 1px solid #cbd5e1;
            color: #1e293b;
          }
          .grid-2 {
            display: flex;
            gap: 12px;
          }
          .col {
            flex: 1;
          }
          .field-row {
            margin-bottom: 3px;
          }
          .field-label {
            font-weight: bold;
            color: #475569;
          }
          .legal-box {
            font-size: 9px;
            color: #334155;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 6px 8px;
            margin-bottom: 10px;
            line-height: 1.25;
          }
          .signature-grid {
            display: flex;
            gap: 20px;
            margin-top: 10px;
          }
          .sig-box {
            flex: 1;
            border-top: 1px solid #0f172a;
            padding-top: 4px;
          }
          .watermark {
            text-align: center;
            font-size: 8.5px;
            color: #94a3b8;
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">FIREARM BILL OF SALE & TRANSFER RECEIPT</div>
            <div class="subtitle">Private Party Legal Transfer Document • ArmoryVault Ledger</div>
          </div>
          <div class="transfer-meta">
            <div><strong>Transfer ID:</strong> ${data.transferId}</div>
            <div><strong>Date:</strong> ${data.date}</div>
          </div>
        </div>

        <!-- 1. Firearm Details -->
        <div class="section">
          <div class="section-title">1. Firearm Description & Identification</div>
          <div class="grid-2">
            <div class="col">
              <div class="field-row"><span class="field-label">Make / Manufacturer:</span> <strong>${data.make}</strong></div>
              <div class="field-row"><span class="field-label">Model:</span> <strong>${data.model}</strong></div>
              <div class="field-row"><span class="field-label">Serial Number:</span> <strong style="font-family: monospace; font-size: 13px;">${data.serialNumber}</strong></div>
              <div class="field-row"><span class="field-label">Caliber:</span> ${data.caliber}</div>
            </div>
            <div class="col">
              <div class="field-row"><span class="field-label">Action / Type:</span> ${data.actionType || 'N/A'}</div>
              <div class="field-row"><span class="field-label">Barrel Length / Finish:</span> ${data.barrelLength || 'Standard'} • ${data.finish || 'Standard'}</div>
              <div class="field-row"><span class="field-label">Condition:</span> ${data.condition}</div>
              <div class="field-row"><span class="field-label">Included Accessories/Mags:</span> ${data.includedItems || 'Firearm only'}</div>
            </div>
          </div>
        </div>

        <!-- 2. Buyer & Seller Details -->
        <div class="grid-2">
          <div class="col section">
            <div class="section-title">2. Seller Information</div>
            <div class="field-row"><span class="field-label">Full Name:</span> <strong>${data.sellerName}</strong></div>
            <div class="field-row"><span class="field-label">Address:</span> ${data.sellerAddress}</div>
            <div class="field-row"><span class="field-label">DL / ID Number:</span> ${data.sellerDlNumber || 'On File'}</div>
            <div class="field-row"><span class="field-label">Phone / Email:</span> ${data.sellerPhone || ''} ${data.sellerEmail || ''}</div>
          </div>

          <div class="col section">
            <div class="section-title">3. Buyer Information</div>
            <div class="field-row"><span class="field-label">Full Legal Name:</span> <strong>${data.buyerName}</strong></div>
            <div class="field-row"><span class="field-label">Address:</span> ${data.buyerAddress}</div>
            <div class="field-row"><span class="field-label">DL / ID Number:</span> <strong>${data.buyerDlNumber}</strong></div>
            <div class="field-row"><span class="field-label">DOB / Carry Permit #:</span> ${data.buyerDob || 'N/A'} ${data.buyerCclNumber ? `• CCL: ${data.buyerCclNumber}` : ''}</div>
          </div>
        </div>

        <!-- 3. Terms & Consideration -->
        <div class="section">
          <div class="section-title">4. Purchase Terms & Consideration</div>
          <div class="grid-2">
            <div class="col">
              <div class="field-row"><span class="field-label">Agreed Purchase Price:</span> <strong style="font-size: 13px;">$${data.salePrice.toFixed(2)} USD</strong></div>
              <div class="field-row"><span class="field-label">Payment Method:</span> ${data.paymentMethod}</div>
            </div>
            <div class="col">
              <div class="field-row"><span class="field-label">Warranty / As-Is:</span> Sold "AS IS" with no warranties implied or expressed.</div>
              ${data.notes ? `<div class="field-row"><span class="field-label">Notes:</span> ${data.notes}</div>` : ''}
            </div>
          </div>
        </div>

        <!-- 4. Legal Affirmations -->
        <div class="legal-box">
          <strong>STATUTORY BUYER & SELLER ACKNOWLEDGMENTS:</strong><br/>
          <strong>Buyer Certification:</strong> The Buyer affirms under penalty of law that they are of legal age (18+/21+) and are NOT prohibited by federal, state, or local law from purchasing, owning, or possessing firearms, including but not limited to being under indictment, convicted of a felony or misdemeanor crime of domestic violence, subject to a protective order, or an unlawful user of controlled substances.<br/>
          <strong>Seller Certification:</strong> The Seller certifies that they are the lawful owner of the aforementioned firearm with legal authority to transfer ownership free of any liens, and to the best of their knowledge the firearm is not stolen and the Buyer is not legally disqualified from possession.
        </div>

        <!-- 5. Signatures -->
        <div class="signature-grid">
          <div class="sig-box">
            <div><strong>SELLER SIGNATURE:</strong></div>
            <div style="height: 35px; margin: 4px 0;">
              ${data.sellerSignatureSvg ? `<img src="${data.sellerSignatureSvg}" style="max-height: 32px;" />` : `<span style="font-family: cursive; font-size: 16px;">${data.sellerName}</span>`}
            </div>
            <div>Printed: ${data.sellerName} &bull; Date: ${data.date}</div>
          </div>

          <div class="sig-box">
            <div><strong>BUYER SIGNATURE:</strong></div>
            <div style="height: 35px; margin: 4px 0;">
              ${data.buyerSignatureSvg ? `<img src="${data.buyerSignatureSvg}" style="max-height: 32px;" />` : `<span style="font-family: cursive; font-size: 16px;">${data.buyerName}</span>`}
            </div>
            <div>Printed: ${data.buyerName} &bull; Date: ${data.date}</div>
          </div>
        </div>

        <div class="watermark">
          ArmoryVault Air-Gapped Firearm Transfer Record &bull; Generated on ${new Date().toLocaleString()} &bull; Doc ID: ${data.transferId}
        </div>
      </body>
    </html>
  `;
}

/**
 * Creates and prints or shares the PDF.
 */
export async function createBillOfSalePdf(data: BillOfSaleData): Promise<string> {
  const html = generateBillOfSaleHtml(data);
  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}

/**
 * Shares the PDF via email to both parties.
 */
export async function emailBillOfSale(pdfUri: string, data: BillOfSaleData): Promise<boolean> {
  const isAvailable = await MailComposer.isAvailableAsync();
  if (!isAvailable) {
    // Fallback to standard share sheet
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(pdfUri, { mimeType: 'application/pdf', dialogTitle: 'Share Bill of Sale' });
      return true;
    }
    return false;
  }

  const recipients = [data.buyerEmail, data.sellerEmail].filter(Boolean) as string[];

  await MailComposer.composeAsync({
    recipients,
    subject: `ArmoryVault Firearm Bill of Sale - ${data.make} ${data.model} (${data.serialNumber})`,
    body: `Please find attached the signed Bill of Sale for the transfer of the ${data.make} ${data.model} (Serial #: ${data.serialNumber}) completed on ${data.date}.\n\nTransfer ID: ${data.transferId}\n\nGenerated via ArmoryVault.`,
    attachments: [pdfUri]
  });

  return true;
}

/**
 * Shares the PDF via SMS/Native share sheet.
 */
export async function shareBillOfSale(pdfUri: string, dialogTitle: string = 'Share Firearm Bill of Sale'): Promise<boolean> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(pdfUri, {
      mimeType: 'application/pdf',
      dialogTitle,
      UTI: 'com.adobe.pdf'
    });
    return true;
  }
  return false;
}
