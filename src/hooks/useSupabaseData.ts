import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type EventWithTickets = Tables<'events'> & {
  ticket_types: Tables<'ticket_types'>[];
  organizations?: { name: string };
  allow_rrpp_guests?: boolean;
  general_tables_count?: number;
  vip_tables_count?: number;
};

export function useEvents(organizationId?: string) {
  return useQuery({
    queryKey: ['events', organizationId],
    queryFn: async (): Promise<EventWithTickets[]> => {
      let query = supabase
        .from('events')
        .select('*, ticket_types(*), organizations(name)')
        .order('date', { ascending: true });
      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data as EventWithTickets[]) || [];
    },
  });
}

export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: ['event', id],
    queryFn: async (): Promise<EventWithTickets | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('events')
        .select('*, ticket_types(*), organizations(name)')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as EventWithTickets | null;
    },
    enabled: !!id,
  });
}

export function useReservations(filters?: { eventId?: string; rrppId?: string; userId?: string }) {
  return useQuery({
    queryKey: ['reservations', filters],
    queryFn: async () => {
      let query = supabase.from('reservations').select('*, ticket_types:ticket_type_id(name, type), events:event_id(title, date, time, location, image_url)');
      if (filters?.eventId) query = query.eq('event_id', filters.eventId);
      if (filters?.rrppId) query = query.eq('rrpp_id', filters.rrppId);
      if (filters?.userId) query = query.eq('user_id', filters.userId);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useRRPPAssignments(userId?: string) {
  return useQuery({
    queryKey: ['rrpp_assignments', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('rrpp_assignments')
        .select('*, organization:organization_id(id, name), events:event_id(id, title, date, time, location, capacity)')
        .eq('user_id', userId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });
}

export function useRRPPEvents(userId?: string) {
  return useQuery({
    queryKey: ['rrpp_events', userId],
    queryFn: async (): Promise<EventWithTickets[]> => {
      if (!userId) return [];
      
      // 1. Get organizations where user is RRPP
      const { data: assignments, error: assignError } = await supabase
        .from('rrpp_assignments')
        .select('organization_id')
        .eq('user_id', userId);
      
      if (assignError) throw assignError;
      const orgIds = assignments?.map(a => a.organization_id).filter(Boolean) as string[];
      
      if (!orgIds || orgIds.length === 0) return [];

      // 2. Get all events for those organizations
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('*, ticket_types(*), organizations(name)')
        .in('organization_id', orgIds)
        .order('date', { ascending: true });
      
      if (eventsError) throw eventsError;
      return (events as EventWithTickets[]) || [];
    },
    enabled: !!userId,
  });
}

export function useOrgRRPPAssignments(organizationId?: string) {
  return useQuery({
    queryKey: ['org_rrpp_assignments', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('rrpp_assignments')
        .select('*, events:event_id(id, title, date, time, location)')
        .eq('organization_id', organizationId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });
}

export function useOrgMembers(organizationId?: string) {
  return useQuery({
    queryKey: ['org_members', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('org_members')
        .select('*, profiles:user_id(name, email)')
        .eq('organization_id', organizationId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });
}

export interface ZoneTable {
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number;
  price?: number;
  tickets_included?: number;
}

export interface OrganizationZone {
  id: string;
  organization_id: string;
  name: string;
  image_url: string;
  tables_data: ZoneTable[];
}

export function useZones(organizationId?: string) {
  return useQuery({
    queryKey: ['organization_zones', organizationId],
    queryFn: async (): Promise<OrganizationZone[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('organization_zones')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as any) || [];
    },
    enabled: !!organizationId,
  });
}
