import type { Event, Reservation, RRPP, User } from './types';

export const mockUsers: User[] = [
  { id: 'u1', name: 'Admin Principal', email: 'admin@nitepass.bo', role: 'ADMIN' },
  { id: 'u2', name: 'Carlos Mendoza', email: 'carlos@rrpp.bo', phone: '+59171234567', role: 'RRPP' },
  { id: 'u3', name: 'María López', email: 'maria@gmail.com', phone: '+59176543210', role: 'USER' },
];

export const mockRRPPs: RRPP[] = [
  {
    id: 'rrpp1',
    name: 'Carlos Mendoza',
    email: 'carlos@rrpp.bo',
    phone: '+59171234567',
    uniqueCode: 'CARLOS-2024',
    assignedEventIds: ['e1', 'e2'],
  },
  {
    id: 'rrpp2',
    name: 'Ana Torres',
    email: 'ana@rrpp.bo',
    phone: '+59177654321',
    uniqueCode: 'ANA-2024',
    assignedEventIds: ['e1'],
  },
];

export const mockEvents: Event[] = [
  {
    id: 'e1',
    title: 'NEON NIGHTS — Edición Especial',
    description: 'La fiesta más épica de Santa Cruz. DJs internacionales, barra premium y experiencia VIP inigualable. Dress code: elegante.',
    date: '2026-03-28',
    time: '22:00',
    location: 'Forum Club — Av. San Martín, Santa Cruz',
    capacity: 500,
    imageUrl: '',
    ticketTypes: [
      { id: 'tt1', eventId: 'e1', name: 'General', type: 'NORMAL', price: 80, quantity: 300, sold: 145 },
      { id: 'tt2', eventId: 'e1', name: 'VIP', type: 'VIP', price: 150, quantity: 100, sold: 62 },
      { id: 'tt3', eventId: 'e1', name: 'Mesa VIP (4 personas)', type: 'MESA_VIP', price: 800, quantity: 20, sold: 8 },
    ],
    promoterIds: ['rrpp1', 'rrpp2'],
  },
  {
    id: 'e2',
    title: 'REGGAETON FEST 2026',
    description: 'Una noche dedicada al perreo intenso. Los mejores DJs de reggaetón, luces láser y ambiente puro fuego.',
    date: '2026-04-05',
    time: '21:00',
    location: 'Kukaramakara — Zona Sur, La Paz',
    capacity: 800,
    imageUrl: '',
    ticketTypes: [
      { id: 'tt4', eventId: 'e2', name: 'General', type: 'NORMAL', price: 50, quantity: 500, sold: 230 },
      { id: 'tt5', eventId: 'e2', name: 'VIP', type: 'VIP', price: 120, quantity: 200, sold: 89 },
      { id: 'tt6', eventId: 'e2', name: 'Mesa VIP (6 personas)', type: 'MESA_VIP', price: 1200, quantity: 15, sold: 5 },
    ],
    promoterIds: ['rrpp1'],
  },
  {
    id: 'e3',
    title: 'TECHNO UNDERGROUND',
    description: 'Para los verdaderos amantes del techno. Set de 6 horas, sonido envolvente y una experiencia sensorial única.',
    date: '2026-04-12',
    time: '23:00',
    location: 'Warehouse 42 — Zona Norte, Cochabamba',
    capacity: 300,
    imageUrl: '',
    ticketTypes: [
      { id: 'tt7', eventId: 'e3', name: 'Early Bird', type: 'NORMAL', price: 60, quantity: 100, sold: 100 },
      { id: 'tt8', eventId: 'e3', name: 'General', type: 'NORMAL', price: 90, quantity: 150, sold: 45 },
      { id: 'tt9', eventId: 'e3', name: 'VIP Backstage', type: 'VIP', price: 200, quantity: 50, sold: 12 },
    ],
    promoterIds: [],
  },
];

export const mockReservations: Reservation[] = [
  {
    id: 'r1', code: 'NEON-A1B2C3', status: 'ACTIVE', userId: 'u3',
    ticketTypeId: 'tt1', eventId: 'e1', type: 'NORMAL', quantity: 2,
    createdAt: '2026-03-15T10:30:00Z',
  },
  {
    id: 'r2', code: 'NEON-D4E5F6', status: 'ACTIVE', rrppId: 'rrpp1',
    ticketTypeId: 'tt2', eventId: 'e1', guestName: 'Juan Pérez',
    type: 'RRPP_FREE', quantity: 1, createdAt: '2026-03-14T18:00:00Z',
  },
  {
    id: 'r3', code: 'NEON-G7H8I9', status: 'USED', userId: 'u3',
    ticketTypeId: 'tt2', eventId: 'e1', type: 'VIP', quantity: 1,
    checkedInAt: '2026-03-28T22:45:00Z', createdAt: '2026-03-10T09:00:00Z',
  },
  {
    id: 'r4', code: 'REGG-J1K2L3', status: 'ACTIVE', rrppId: 'rrpp1',
    ticketTypeId: 'tt4', eventId: 'e2', guestName: 'Sofía Vargas',
    type: 'RRPP_FREE', quantity: 1, createdAt: '2026-03-16T11:00:00Z',
  },
];

// Helper to generate unique codes
export function generateTicketCode(eventPrefix: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${eventPrefix}-${code}`;
}
