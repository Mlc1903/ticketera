import { v4 as uuidv4 } from 'uuid';

// In a real application, this connects to the database.
// Mocked data layout representing the schema requirements.
export const ticketsDb = [
  {
    id: 1,
    event_id: "evt-001",
    user_id: "usr-999",
    token: "valid-free-token-123",
    type: "FREE_PASS",
    is_used: false,
    used_at: null
  },
  {
    id: 2,
    event_id: "evt-001",
    user_id: "usr-888",
    token: "used-paid-token-456",
    type: "PAID",
    is_used: true,
    used_at: new Date("2026-03-20T22:15:00Z")
  },
  {
    id: 3,
    event_id: "evt-002",
    user_id: "usr-777",
    token: "valid-paid-token-789",
    type: "PAID",
    is_used: false,
    used_at: null
  }
];

export const TicketModel = {
  /**
   * Fetch a ticket by its secure token
   * @param {string} token 
   * @returns {Promise<Object|null>}
   */
  async findByToken(token) {
    // Mock DB Call: SELECT * FROM tickets WHERE token = $1
    const ticket = ticketsDb.find(t => t.token === token);
    return ticket || null;
  },

  /**
   * Mark a ticket as used
   * @param {string} token 
   * @returns {Promise<Object>} The updated ticket
   */
  async markAsUsed(token) {
    // Mock DB Call: UPDATE tickets SET is_used = true, used_at = NOW() WHERE token = $1
    const ticketIndex = ticketsDb.findIndex(t => t.token === token);
    if (ticketIndex === -1) throw new Error("Ticket not found");
    
    ticketsDb[ticketIndex].is_used = true;
    ticketsDb[ticketIndex].used_at = new Date();
    
    return ticketsDb[ticketIndex];
  },

  /**
   * Generates a new unique ticket token.
   * @returns {string} UUIDv4 secure token
   */
  generateToken() {
    return uuidv4();
  }
};
