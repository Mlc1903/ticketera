import QRCode from 'qrcode';

export const QrService = {
  /**
   * Generates a base64 encoded QR Code string for a specific token or URL
   * @param {string} token - The unique ticket token
   * @param {string} baseUrl - (Optional) The base URL for validation. E.g., 'https://api.myapp.com/validate'
   * @returns {Promise<string>} - Base64 Image String
   */
  async generateQRCode(token, baseUrl = null) {
    try {
      // If a baseUrl is provided, construct the full URL. Otherwise, just embed the token.
      const payload = baseUrl ? `${baseUrl}?token=${token}` : token;

      // Generate the QR code as a Data URI (base64 image)
      const qrDataUri = await QRCode.toDataURL(payload, {
        errorCorrectionLevel: 'H',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      
      return qrDataUri;
    } catch (error) {
      console.error("Error generating QR code:", error);
      throw new Error("Failed to generate QR Code");
    }
  }
};
