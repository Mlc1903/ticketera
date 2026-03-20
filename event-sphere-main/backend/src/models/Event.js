// In a real application, this would use an ORM like Prisma or Sequelize to connect to PostgreSQL/Supabase.
// This is a mocked data layer matching the exact schema requirements for demonstration.

export const eventsDb = [
  {
    id: "evt-001",
    title: "Awesome Friday Party",
    start_date: new Date("2026-03-20T22:00:00Z"), // 10 PM
    end_date: new Date("2026-03-21T05:00:00Z"),   // 5 AM next day
    free_pass_enabled: true,
    free_pass_end_time: new Date("2026-03-20T23:30:00Z") // 11:30 PM threshold
  },
  {
    id: "evt-002",
    title: "Exclusive VIP Night",
    start_date: new Date("2026-03-21T21:00:00Z"),
    end_date: new Date("2026-03-22T04:00:00Z"),
    free_pass_enabled: false,
    free_pass_end_time: null
  }
];

export const EventModel = {
  /**
   * Fetch an event by its ID
   * @param {string} eventId 
   * @returns {Promise<Object|null>}
   */
  async findById(eventId) {
    // Mock DB call: SELECT * FROM events WHERE id = $1
    const event = eventsDb.find(e => e.id === eventId);
    return event || null;
  }
};
