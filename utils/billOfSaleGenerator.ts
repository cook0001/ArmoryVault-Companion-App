import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';

export interface BillOfSaleData {
  transferId: string;
  date: string;
  isFflTransfer?: boolean;
  fflNumber?: string;
  fflName?: string;
  
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
  sellerSignatureSvg?: string; // base64 / path

  // Buyer
  buyerName: string;
  buyerAddress: string;
  buyerPhone?: string;
  buyerEmail?: string;
  buyerDlNumber: string;
  buyerDob?: string;
  buyerCclNumber?: string;
  buyerCclState?: string;
  buyerCclExp?: string;
  buyerSignatureSvg?: string;

  // Terms
  salePrice: number;
  paymentMethod: string;
  checkOrMoNumber?: string;
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
          @page { size: letter portrait; margin: 0.4in; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            line-height: 1.3;
            font-size: 10.5px;
            margin: 0;
            padding: 0;
          }
          .header {
            border-bottom: 2px solid #0f172a;
            padding-bottom: 6px;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .title {
            font-size: 17px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 0;
            color: #0f172a;
          }
          .subtitle {
            font-size: 10.5px;
            color: #475569;
            margin-top: 2px;
            font-weight: 600;
          }
          .transfer-meta {
            text-align: right;
            font-size: 10.5px;
          }
          .transfer-meta strong {
            color: #0f172a;
          }
          .section {
            margin-bottom: 8px;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            padding: 6px 10px;
          }
          .section-title {
            font-size: 10.5px;
            font-weight: bold;
            text-transform: uppercase;
            background: #f1f5f9;
            margin: -6px -10px 6px -10px;
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
            font-size: 8.5px;
            color: #334155;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            padding: 6px 8px;
            margin-bottom: 8px;
            line-height: 1.25;
          }
          .signature-grid {
            display: flex;
            gap: 20px;
            margin-top: 8px;
          }
          .sig-box {
            flex: 1;
            border-top: 1px solid #0f172a;
            padding-top: 4px;
          }
          .watermark {
            text-align: center;
            font-size: 8px;
            color: #94a3b8;
            margin-top: 8px;
            border-top: 1px dashed #cbd5e1;
            padding-top: 4px;
          }
          .ffl-badge {
            background: #e0f2fe;
            border: 1px solid #0284c7;
            color: #0369a1;
            font-weight: bold;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 9px;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">FIREARM BILL OF SALE & TRANSFER RECEIPT</div>
            <div class="subtitle">
              ${data.isFflTransfer ? `<span class="ffl-badge">FFL DEALER CONSIGNMENT / TRANSFER</span> • ` : 'PRIVATE PARTY TRANSFER • '}ArmoryVault Ledger
            </div>
          </div>
          <div class="transfer-meta">
            <div><strong>Transfer ID:</strong> ${data.transferId}</div>
            <div><strong>Date of Transfer:</strong> ${data.date}</div>
          </div>
        </div>

        <!-- 1. Firearm Details -->
        <div class="section">
          <div class="section-title">1. Firearm Description & Identification</div>
          <div class="grid-2">
            <div class="col">
              <div class="field-row"><span class="field-label">Make / Manufacturer:</span> <strong>${data.make}</strong></div>
              <div class="field-row"><span class="field-label">Model:</span> <strong>${data.model}</strong></div>
              <div class="field-row"><span class="field-label">Serial Number:</span> <strong style="font-family: monospace; font-size: 12px; background: #fef08a; padding: 1px 4px;">${data.serialNumber}</strong></div>
              <div class="field-row"><span class="field-label">Caliber / Gauge:</span> <strong>${data.caliber}</strong></div>
            </div>
            <div class="col">
              <div class="field-row"><span class="field-label">Action / Type:</span> ${data.actionType || 'Semi-Automatic'}</div>
              <div class="field-row"><span class="field-label">Barrel Length / Finish:</span> ${data.barrelLength || 'Standard'} • ${data.finish || 'Standard'}</div>
              <div class="field-row"><span class="field-label">Condition:</span> ${data.condition}</div>
              <div class="field-row"><span class="field-label">Included Accessories/Mags:</span> ${data.includedItems || 'Firearm only'}</div>
            </div>
          </div>
        </div>

        <!-- 2. Buyer & Seller Details -->
        <div class="grid-2">
          <div class="col section">
            <div class="section-title">2. Seller / Transferor Information</div>
            <div class="field-row"><span class="field-label">Full Name:</span> <strong>${data.sellerName}</strong></div>
            <div class="field-row"><span class="field-label">Address:</span> ${data.sellerAddress}</div>
            <div class="field-row"><span class="field-label">DL / State ID Number:</span> ${data.sellerDlNumber || 'On File'}</div>
            <div class="field-row"><span class="field-label">Phone / Email:</span> ${data.sellerPhone || 'N/A'} ${data.sellerEmail ? `• ${data.sellerEmail}` : ''}</div>
          </div>

          <div class="col section">
            <div class="section-title">3. Buyer / Transferee Information</div>
            <div class="field-row"><span class="field-label">Full Legal Name:</span> <strong>${data.buyerName}</strong></div>
            <div class="field-row"><span class="field-label">Address:</span> ${data.buyerAddress}</div>
            <div class="field-row"><span class="field-label">DL / ID Number:</span> <strong>${data.buyerDlNumber}</strong> ${data.buyerDob ? `(DOB: ${data.buyerDob})` : ''}</div>
            ${data.buyerCclNumber ? `
              <div class="field-row"><span class="field-label">Concealed Carry Permit:</span> <strong>${data.buyerCclNumber}</strong> (${data.buyerCclState || 'State'} ${data.buyerCclExp ? `• Exp: ${data.buyerCclExp}` : ''})</div>
            ` : ''}
            <div class="field-row"><span class="field-label">Phone / Email:</span> ${data.buyerPhone || 'N/A'} ${data.buyerEmail ? `• ${data.buyerEmail}` : ''}</div>
          </div>
        </div>

        <!-- 3. Terms & FFL Info -->
        <div class="section">
          <div class="section-title">4. Purchase Terms & Consideration</div>
          <div class="grid-2">
            <div class="col">
              <div class="field-row"><span class="field-label">Agreed Sale Price:</span> <strong style="font-size: 13px; color: #047857;">$${data.salePrice.toFixed(2)} USD</strong></div>
              <div class="field-row"><span class="field-label">Payment Method:</span> <strong>${data.paymentMethod}</strong>${data.checkOrMoNumber ? ` (Ref / Check #: ${data.checkOrMoNumber})` : ''}</div>
              ${data.isFflTransfer ? `
                <div class="field-row"><span class="field-label">FFL Dealer:</span> ${data.fflName || 'FFL Dealer'} (${data.fflNumber || 'FFL Number On File'})</div>
              ` : ''}
            </div>
            <div class="col">
              <div class="field-row"><span class="field-label">Warranty / As-Is:</span> Sold "AS-IS" with no warranties expressed or implied.</div>
              ${data.notes ? `<div class="field-row"><span class="field-label">Notes:</span> ${data.notes}</div>` : ''}
            </div>
          </div>
        </div>

        <!-- 4. Legal Affirmations -->
        <div class="legal-box">
          <strong>STATUTORY FEDERAL & STATE LEGAL AFFIRMATIONS:</strong><br/>
          <strong>Buyer Certification:</strong> The Buyer explicitly affirms under penalty of perjury that they are of legal statutory age (18+ for long guns / 21+ for handguns/frames) and are NOT a prohibited person under 18 U.S.C. § 922(g) or state law, including but not limited to being under indictment, convicted of a felony or misdemeanor crime of domestic violence, subject to a restraining/protective order, an unlawful user of or addicted to controlled substances, adjudicated mentally defective, or dishonorably discharged. The Buyer confirms in-state residency matching their Driver's License.<br/>
          <strong>Seller Certification:</strong> The Seller certifies that they are the lawful and sole owner of the firearm described above, with complete authority to convey unencumbered title free and clear of all liens and claims, and to the best of their knowledge, the Buyer is not legally disqualified from possession.
        </div>

        <!-- 5. Signatures -->
        <div class="signature-grid">
          <div class="sig-box">
            <div><strong>SELLER SIGNATURE:</strong></div>
            <div style="height: 34px; margin: 2px 0;">
              ${data.sellerSignatureSvg ? `<img src="${data.sellerSignatureSvg}" style="max-height: 32px;" />` : `<span style="font-family: cursive; font-size: 16px;">${data.sellerName}</span>`}
            </div>
            <div>Printed: ${data.sellerName} &bull; Date: ${data.date}</div>
          </div>

          <div class="sig-box">
            <div><strong>BUYER SIGNATURE:</strong></div>
            <div style="height: 34px; margin: 2px 0;">
              ${data.buyerSignatureSvg ? `<img src="${data.buyerSignatureSvg}" style="max-height: 32px;" />` : `<span style="font-family: cursive; font-size: 16px;">${data.buyerName}</span>`}
            </div>
            <div>Printed: ${data.buyerName} &bull; Date: ${data.date}</div>
          </div>
        </div>

        <div class="watermark">
          ArmoryVault Air-Gapped Firearm Transfer Record &bull; Generated: ${new Date().toLocaleString()} &bull; Verification Hash: ${data.transferId}
        </div>
      </body>
    </html>
  `;
}

/**
 * Creates and returns the URI of the Bill of Sale PDF.
 */
export async function createBillOfSalePdf(data: BillOfSaleData): Promise<string> {
  const html = generateBillOfSaleHtml(data);
  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}

/**
 * Direct print using system print dialog (AirPrint / Android Print).
 */
export async function printBillOfSale(data: BillOfSaleData): Promise<void> {
  const html = generateBillOfSaleHtml(data);
  await Print.printAsync({ html });
}

/**
 * Shares the PDF via email to both parties.
 */
export async function emailBillOfSale(pdfUri: string, data: BillOfSaleData): Promise<boolean> {
  const isAvailable = await MailComposer.isAvailableAsync();
  if (!isAvailable) {
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
    body: `Please find attached the official signed Bill of Sale for the transfer of the ${data.make} ${data.model} (Serial #: ${data.serialNumber}) on ${data.date}.\n\nTransfer ID: ${data.transferId}\n\nGenerated securely via ArmoryVault.`,
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
