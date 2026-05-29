import QRCode from 'qrcode';
import generatePayload from 'promptpay-qr';

export async function generatePromptPayQRBase64(promptPayId: string, amount?: number): Promise<string> {
  try {
    const payload = generatePayload(promptPayId, { amount });
    const qrBase64 = await QRCode.toDataURL(payload, {
      margin: 2,
      width: 200,
      color: {
        dark: '#0f172a', // slate-900
        light: '#ffffff' // white
      }
    });
    return qrBase64;
  } catch (error) {
    console.error('Failed to generate QR code', error);
    throw error;
  }
}
