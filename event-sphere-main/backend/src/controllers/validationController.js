import { TicketModel } from '../models/Ticket.js';
import { EventModel } from '../models/Event.js';

export const ValidationController = {
  /**
   * POST /validate-ticket
   * Expects { token: "XYZ" } in the body
   */
  async validateTicket(req, res) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ status: 'INVALID', message: 'Token is required' });
      }

      // 1. Check if ticket exists
      const ticket = await TicketModel.findByToken(token);
      if (!ticket) {
        return res.status(404).json({ status: 'INVALID', message: 'Ticket does not exist' });
      }

      // 2. Check if already used
      if (ticket.is_used) {
        return res.status(400).json({ 
          status: 'ALREADY USED', 
          message: 'This ticket has already been used.',
          used_at: ticket.used_at
        });
      }

      // 3. Check event existence
      const event = await EventModel.findById(ticket.event_id);
      if (!event) {
        return res.status(404).json({ status: 'INVALID', message: 'Associated event not found' });
      }

      // 4. Apply time rules
      // Note: We use the local time from the system. In production, this should always be UTC matched.
      const now = new Date(); 

      if (ticket.type === 'FREE_PASS') {
        // FREE_PASS validation
        if (!event.free_pass_enabled) {
          return res.status(403).json({ status: 'INVALID', message: 'Free passes are not allowed for this event.' });
        }
        
        // Ensure strictly before or equal to free pass end time
        if (event.free_pass_end_time && now > new Date(event.free_pass_end_time)) {
          return res.status(403).json({ status: 'INVALID', message: 'Free pass expired' });
        }
      } else if (ticket.type === 'PAID') {
        // PAID validation: Must be between start_date and end_date
        const startDate = new Date(event.start_date);
        const endDate = new Date(event.end_date);
        
        if (now < startDate) {
          return res.status(403).json({ status: 'INVALID', message: 'Event has not started yet' });
        }
        if (now > endDate) {
          return res.status(403).json({ status: 'INVALID', message: 'Event has already ended' });
        }
      } else {
        return res.status(400).json({ status: 'INVALID', message: 'Unknown ticket type' });
      }

      // 5. Validation successful. Mark as used.
      // OPTIONAL IMPROVEMENT: Wrap this in a DB transaction to prevent double spending / race conditions in high traffic.
      const usedTicket = await TicketModel.markAsUsed(ticket.token);

      // Log successful scan (OPTIONAL IMPROVEMENT logic here)
      console.log(`[SCAN LOG]: Ticket ${token} successfully validated at ${usedTicket.used_at}`);

      // 6. Return response
      return res.status(200).json({
        status: 'VALID',
        message: 'Ticket successfully validated! Allow entry.',
        ticket: {
          token: usedTicket.token,
          type: usedTicket.type,
          used_at: usedTicket.used_at
        }
      });
      
    } catch (error) {
      console.error('[Validation Error]:', error);
      return res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
  }
};
