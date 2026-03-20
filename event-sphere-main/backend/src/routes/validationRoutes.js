import express from 'express';
import { ValidationController } from '../controllers/validationController.js';
import { QrService } from '../services/qrService.js';
import { TicketModel } from '../models/Ticket.js';

const router = express.Router();

/**
 * Route: POST /api/tickets/validate-ticket
 * Validates a scanned QR code ticket payload.
 */
router.post('/validate-ticket', ValidationController.validateTicket);

/**
 * Route: GET /api/tickets/generate (Helper specific to requirements)
 * Demonstrates the QR service.
 */
router.get('/generate', async (req, res) => {
  try {
    const token = req.query.token || TicketModel.generateToken();
    const useUrlFormat = req.query.urlFormat === 'true'; // e.g. ?urlFormat=true
    
    // Suggestion: Environment variable for BASE URL
    const validationBaseUrl = useUrlFormat ? 'http://localhost:3000/validate' : null;
    
    const qrImageResponse = await QrService.generateQRCode(token, validationBaseUrl);
    
    res.json({
      status: 'SUCCESS',
      token,
      qr_image: qrImageResponse
    });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

export default router;
