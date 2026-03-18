export type Role = 'ADMIN' | 'RRPP' | 'USER';
export type TicketStatus = 'PENDING' | 'ACTIVE' | 'USED' | 'CANCELLED';
export type TicketType = 'NORMAL' | 'VIP' | 'MESA_VIP' | 'RRPP_FREE' | 'RRPP_PAID';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  capacity: number;
  imageUrl: string;
  ticketTypes: TicketTypeConfig[];
  promoterIds: string[];
}

export interface TicketTypeConfig {
  id: string;
  eventId: string;
  name: string;
  type: TicketType;
  price: number;
  quantity: number;
  sold: number;
}

export interface Reservation {
  id: string;
  code: string;
  status: TicketStatus;
  userId?: string;
  rrppId?: string;
  ticketTypeId: string;
  eventId: string;
  guestName?: string;
  type: TicketType;
  quantity: number;
  checkedInAt?: string;
  createdAt: string;
}

export interface RRPP {
  id: string;
  name: string;
  email: string;
  phone: string;
  uniqueCode: string;
  assignedEventIds: string[];
}
