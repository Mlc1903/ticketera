import { useState } from 'react';
import { Shield, BarChart3, ScanLine, Calendar, Users, Ticket, Loader2, Plus, UserPlus, Trash2, DollarSign, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEvents, useReservations, useOrgMembers } from '@/hooks/useSupabaseData';
import { useAuth } from '@/hooks/useAuth';
import CheckInScanner from '@/components/CheckInScanner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

type Tab = 'overview' | 'checkin' | 'events' | 'rrpp' | 'sales' | 'approvals';

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('overview');
  const { activeOrg, userRole } = useAuth();
  const orgId = activeOrg?.id;
  const { data: events, isLoading: eventsLoading } = useEvents(orgId);
  const { data: reservations } = useReservations({});
  const { data: orgMembers } = useOrgMembers(orgId);
  const queryClient = useQueryClient();

  // Event form state
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm] = useState({ title: '', description: '', date: '', time: '', location: '', capacity: '', is_free_pass: false, free_pass_until: '', general_tables_count: '', vip_tables_count: '', allow_rrpp_guests: true });
  const [savingEvent, setSavingEvent] = useState(false);

  // RRPP assign state
  const [rrppEmail, setRrppEmail] = useState('');
  const [assigningRRPP, setAssigningRRPP] = useState(false);
  const [rrppZone, setRrppZone] = useState('');

  // Ticket type form state
  const [showTicketForm, setShowTicketForm] = useState<string | null>(null);
  const [ticketForm, setTicketForm] = useState({ name: '', type: 'normal' as string, price: '', quantity: '' });
  const [savingTicket, setSavingTicket] = useState(false);

  const totalTickets = reservations?.length || 0;
  const usedTickets = reservations?.filter((r: any) => r.status === 'used').length || 0;
  const activeTickets = reservations?.filter((r: any) => r.status === 'active').length || 0;

  const tabs: { value: Tab; label: string; icon: React.ElementType }[] = [
    { value: 'overview', label: 'Resumen', icon: BarChart3 },
    { value: 'checkin', label: 'Check-in', icon: ScanLine },
    { value: 'events', label: 'Eventos', icon: Calendar },
    { value: 'rrpp', label: 'RRPP', icon: Users },
    { value: 'sales', label: 'Ventas', icon: DollarSign },
    { value: 'approvals', label: 'Aprobaciones', icon: CheckCircle },
  ];

  // Fetch RRPP assignments for this org MUST be unconditionally called before early returns
  const { data: rrppAssignments } = useQuery({
    queryKey: ['admin-rrpp-assignments', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('rrpp_assignments')
        .select('*, events:event_id(title)')
        .eq('organization_id', orgId);
      if (error) throw error;
      // Get profiles for each assignment
      const userIds = [...new Set((data || []).map((a: any) => a.user_id))];
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', userIds);
      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]));
      return (data || []).map((a: any) => ({ ...a, profile: profileMap[a.user_id] }));
    },
    enabled: !!orgId,
  });

  const { data: purchaseRequests } = useQuery({
    queryKey: ['admin-purchase-requests', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('purchase_requests' as any)
        .select('*, events!inner(title, organization_id)')
        .eq('events.organization_id', orgId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const uids = [...new Set((data || []).flatMap((r: any) => [r.user_id, r.rrpp_id]).filter(Boolean))];
      if (uids.length === 0) return data;

      const { data: profiles } = await supabase.from('profiles').select('user_id, name, email').in('user_id', uids);
      const pMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]));
      
      return (data || []).map((r: any) => ({
        ...r,
        buyerProfile: r.user_id ? pMap[r.user_id] : null,
        rrppProfile: r.rrpp_id ? pMap[r.rrpp_id] : null,
      }));
    },
    enabled: !!orgId,
  });

  if (!orgId && userRole !== 'super_admin') {
    return (
      <div className="text-center py-20 space-y-3">
        <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">No perteneces a ninguna organización.</p>
        <p className="text-xs text-muted-foreground">Pide al super admin que te asigne a una discoteca.</p>
      </div>
    );
  }

  if (eventsLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const handleCreateEvent = async () => {
    if (!eventForm.title || !eventForm.date || !eventForm.time || !eventForm.location || !orgId) return;
    setSavingEvent(true);
    try {
      const { data: newEvent, error } = await supabase.from('events').insert({
        title: eventForm.title,
        description: eventForm.description,
        date: eventForm.date,
        time: eventForm.time,
        location: eventForm.location,
        capacity: parseInt(eventForm.capacity) || 0,
        general_tables_count: parseInt(eventForm.general_tables_count) || 0,
        vip_tables_count: parseInt(eventForm.vip_tables_count) || 0,
        organization_id: orgId,
        is_free_pass: eventForm.is_free_pass,
        free_pass_until: eventForm.is_free_pass && eventForm.free_pass_until ? eventForm.free_pass_until : null,
        allow_rrpp_guests: eventForm.allow_rrpp_guests,
      }).select().single();
      
      if (error) throw error;

      if (eventForm.is_free_pass && newEvent) {
        const { error: ticketError } = await supabase.from('ticket_types').insert({
          event_id: newEvent.id,
          name: 'Entrada Free Pass',
          type: 'rrpp_free' as any,
          price: 0,
          quantity: newEvent.capacity > 0 ? newEvent.capacity : 500,
        });
        if (ticketError) console.error('Error creando entrada free pass:', ticketError);
      }

      toast.success('Evento creado');
      setEventForm({ title: '', description: '', date: '', time: '', location: '', capacity: '', is_free_pass: false, free_pass_until: '', general_tables_count: '', vip_tables_count: '', allow_rrpp_guests: true });
      setShowEventForm(false);
      queryClient.invalidateQueries({ queryKey: ['events'] });
    } catch (err: any) {
      toast.error(err.message || 'Error al crear evento');
    }
    setSavingEvent(false);
  };

  const handleAddTicketType = async () => {
    if (!ticketForm.name || !showTicketForm) return;
    setSavingTicket(true);
    try {
      const { error } = await supabase.from('ticket_types').insert({
        event_id: showTicketForm,
        name: ticketForm.name,
        type: ticketForm.type as any,
        price: parseFloat(ticketForm.price) || 0,
        quantity: parseInt(ticketForm.quantity) || 0,
      });
      if (error) throw error;
      toast.success('Tipo de ticket agregado');
      setTicketForm({ name: '', type: 'normal', price: '', quantity: '' });
      setShowTicketForm(null);
      queryClient.invalidateQueries({ queryKey: ['events'] });
    } catch (err: any) {
      toast.error(err.message || 'Error');
    }
    setSavingTicket(false);
  };

  const handleAssignRRPP = async () => {
    if (!rrppEmail || !orgId) return;
    setAssigningRRPP(true);
    try {
      // Find user by email in profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', rrppEmail.trim())
        .maybeSingle();
      
      if (!profile) {
        toast.error('Usuario no encontrado con ese email');
        setAssigningRRPP(false);
        return;
      }

      // Ensure they have rrpp role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', profile.user_id)
        .eq('role', 'rrpp')
        .maybeSingle();

      if (!existingRole) {
        await supabase.from('user_roles').insert({ user_id: profile.user_id, role: 'rrpp' as any });
      }

      // Generate unique code
      const { data: codeData } = await supabase.rpc('generate_ticket_code', { prefix: 'RRPP' });
      const code = codeData || `RRPP-${Date.now()}`;

      // Create assignment
      const { error } = await supabase.from('rrpp_assignments').insert({
        user_id: profile.user_id,
        unique_code: code,
        organization_id: orgId,
        zone_type: rrppZone || null,
      });
      if (error) throw error;
      toast.success('RRPP asignado a la discoteca');
      setRrppEmail('');
      setRrppZone('');
      queryClient.invalidateQueries({ queryKey: ['admin-rrpp-assignments'] });
    } catch (err: any) {
      toast.error(err.message || 'Error al asignar RRPP');
    }
    setAssigningRRPP(false);
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar permanentemente este evento y todas sus reservas?')) return;
    try {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      toast.success('Evento eliminado');
      queryClient.invalidateQueries({ queryKey: ['events'] });
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar');
    }
  };

  const handleDeleteRRPP = async (id: string) => {
    if (!confirm('¿Estás seguro de remover a este RRPP?')) return;
    try {
      const { error } = await supabase.from('rrpp_assignments').delete().eq('id', id);
      if (error) throw error;
      toast.success('RRPP removido');
      queryClient.invalidateQueries({ queryKey: ['admin-rrpp-assignments'] });
    } catch (err: any) {
      toast.error(err.message || 'Error al remover');
    }
  };

  const handleApproveRequest = async (req: any) => {
    if (!confirm('¿Confirmas que recibiste el pago para aprobar esta compra?')) return;
    try {
      const { error: updErr } = await supabase.from('purchase_requests' as any).update({ status: 'approved' }).eq('id', req.id);
      if (updErr) throw updErr;

      const tts = req.ticket_types as any[];
      for (const tt of tts) {
        for (let i = 0; i < tt.quantity; i++) {
          const { data: codeData } = await supabase.rpc('generate_ticket_code', { prefix: req.events.title.substring(0, 4).toUpperCase().replace(/\s/g, '') });
          const code = codeData || `TKT-${req.id.split('-')[0]}-${i}`;

          const { error: resErr } = await supabase.from('reservations').insert({
            code,
            event_id: req.event_id,
            ticket_type_id: tt.ticket_type_id,
            user_id: req.user_id,
            rrpp_id: req.rrpp_id,
            type: tt.type,
            quantity: 1,
            status: 'active'
          });
          if (resErr) console.error('Error insertando ticket', resErr);
        }
      }

      toast.success('Pago aprobado y entradas generadas');
      queryClient.invalidateQueries({ queryKey: ['admin-purchase-requests'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    } catch (err: any) {
      toast.error(err.message || 'Error al aprobar');
    }
  };

  const handleRejectRequest = async (id: string) => {
    if (!confirm('¿Estás seguro de RECHAZAR y eliminar esta solicitud de compra?')) return;
    try {
      const { error } = await supabase.from('purchase_requests' as any).delete().eq('id', id);
      if (error) throw error;
      toast.success('Solicitud rechazada');
      queryClient.invalidateQueries({ queryKey: ['admin-purchase-requests'] });
    } catch (err: any) {
      toast.error(err.message || 'Error al rechazar');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-4xl mx-auto">
      <div>
        <div className="flex items-center gap-2 text-sm text-primary font-semibold mb-1"><Shield className="h-4 w-4" />Panel Administrador</div>
        <h1 className="text-2xl font-black text-foreground">{activeOrg?.name || 'Dashboard'}</h1>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button key={t.value} onClick={() => setTab(t.value)} className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all touch-target ${tab === t.value ? 'bg-primary text-primary-foreground shadow-glow' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Eventos', value: events?.length || 0, icon: Calendar, color: 'text-primary' },
              { label: 'Total Tickets', value: totalTickets, icon: Ticket, color: 'text-foreground' },
              { label: 'Check-ins', value: usedTickets, icon: ScanLine, color: 'text-success' },
              { label: 'Activos', value: activeTickets, icon: BarChart3, color: 'text-warning' },
            ].map((s) => (
              <div key={s.label} className="glass-card p-4 text-center">
                <s.icon className={`h-5 w-5 mx-auto ${s.color}`} />
                <p className="text-2xl font-bold text-foreground mt-2">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="glass-card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Eventos Activos</h3>
            {events?.map((ev) => {
              const sold = ev.ticket_types?.reduce((s, t) => s + t.sold, 0) || 0;
              const pct = ev.capacity > 0 ? Math.round((sold / ev.capacity) * 100) : 0;
              return (
                <div key={ev.id} className="rounded-xl bg-secondary p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{ev.title}</p>
                    <span className="text-xs text-muted-foreground">{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{sold} vendidos</span>
                    <span>{ev.capacity - sold} disponibles</span>
                  </div>
                </div>
              );
            })}
            {(!events || events.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No hay eventos. Crea uno en la pestaña Eventos.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'checkin' && <CheckInScanner />}

      {tab === 'events' && (
        <div className="space-y-4">
          <button onClick={() => setShowEventForm(!showEventForm)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:shadow-glow active:scale-[0.98]">
            <Plus className="h-4 w-4" /> Crear Evento
          </button>

          {showEventForm && (
            <div className="glass-card p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Nuevo Evento</h3>
              <input placeholder="Nombre del evento" value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary" />
              <textarea placeholder="Descripción" value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary min-h-[80px]" />
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={eventForm.date} onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })} className="rounded-xl bg-secondary px-4 py-3 text-sm text-foreground outline-none ring-1 ring-border focus:ring-primary" />
                <input type="time" value={eventForm.time} onChange={(e) => setEventForm({ ...eventForm, time: e.target.value })} className="rounded-xl bg-secondary px-4 py-3 text-sm text-foreground outline-none ring-1 ring-border focus:ring-primary" />
              </div>
              <input placeholder="Ubicación" value={eventForm.location} onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })} className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary" />
              <input type="number" placeholder="Aforo total" value={eventForm.capacity} onChange={(e) => setEventForm({ ...eventForm, capacity: e.target.value })} className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary" />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="Mesas General (Opcional)" value={eventForm.general_tables_count} onChange={(e) => setEventForm({ ...eventForm, general_tables_count: e.target.value })} className="rounded-xl bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary" />
                <input type="number" placeholder="Mesas VIP (Opcional)" value={eventForm.vip_tables_count} onChange={(e) => setEventForm({ ...eventForm, vip_tables_count: e.target.value })} className="rounded-xl bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary" />
              </div>
              <div className="flex items-center gap-3 bg-secondary/50 p-3 rounded-xl ring-1 ring-border">
                <input type="checkbox" id="allowRRPPGuests" checked={eventForm.allow_rrpp_guests} onChange={(e) => setEventForm({ ...eventForm, allow_rrpp_guests: e.target.checked })} className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary" />
                <label htmlFor="allowRRPPGuests" className="text-sm text-foreground flex-1 cursor-pointer">Permitir Listas de Invitados (VIP Gratis) para RRPP</label>
              </div>
              <div className="flex items-center gap-3 bg-secondary/50 p-3 rounded-xl ring-1 ring-border">
                <input type="checkbox" id="freePassToggle" checked={eventForm.is_free_pass} onChange={(e) => setEventForm({ ...eventForm, is_free_pass: e.target.checked })} className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary" />
                <label htmlFor="freePassToggle" className="text-sm text-foreground flex-1 cursor-pointer">Activar Modo Free Pass (Límite de hora)</label>
                {eventForm.is_free_pass && (
                  <input type="time" title="Hora límite" value={eventForm.free_pass_until} onChange={(e) => setEventForm({ ...eventForm, free_pass_until: e.target.value })} className="rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none ring-1 ring-border focus:ring-primary" />
                )}
              </div>
              <button onClick={handleCreateEvent} disabled={savingEvent || !eventForm.title || !eventForm.date || !eventForm.time || !eventForm.location || (eventForm.is_free_pass && !eventForm.free_pass_until)} className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:shadow-glow disabled:opacity-40">
                {savingEvent ? 'Creando...' : 'Crear Evento'}
              </button>
            </div>
          )}

          {events?.map((ev) => (
            <div key={ev.id} className="glass-card p-4 space-y-2 relative">
              <button onClick={() => handleDeleteEvent(ev.id)} className="absolute top-4 right-4 text-muted-foreground hover:text-destructive transition-colors touch-target">
                <Trash2 className="h-4 w-4" />
              </button>
              <h3 className="font-semibold text-foreground pr-8">{ev.title}</h3>
              <p className="text-sm text-muted-foreground">{ev.date} · {ev.time?.substring(0, 5)} · {ev.location}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {ev.ticket_types?.map((tt) => (
                  <span key={tt.id} className="rounded-lg bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
                    {tt.name}: {tt.sold}/{tt.quantity} · Bs.{tt.price}
                  </span>
                ))}
              </div>
              <button onClick={() => setShowTicketForm(showTicketForm === ev.id ? null : ev.id)} className="text-xs text-primary font-medium hover:underline mt-1">
                + Agregar tipo de ticket
              </button>
              {showTicketForm === ev.id && (
                <div className="rounded-xl bg-secondary/50 p-3 space-y-2 mt-2">
                  <input placeholder="Nombre (ej: General, VIP)" value={ticketForm.name} onChange={(e) => setTicketForm({ ...ticketForm, name: e.target.value })} className="w-full rounded-lg bg-secondary px-3 py-2 text-sm text-foreground outline-none ring-1 ring-border focus:ring-primary" />
                  <select value={ticketForm.type} onChange={(e) => setTicketForm({ ...ticketForm, type: e.target.value })} className="w-full rounded-lg bg-secondary px-3 py-2 text-sm text-foreground ring-1 ring-border">
                    <option value="normal">Normal</option>
                    <option value="vip">VIP</option>
                    <option value="mesa_vip">Mesa VIP</option>
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" placeholder="Precio (Bs)" value={ticketForm.price} onChange={(e) => setTicketForm({ ...ticketForm, price: e.target.value })} className="rounded-lg bg-secondary px-3 py-2 text-sm text-foreground outline-none ring-1 ring-border focus:ring-primary" />
                    <input type="number" placeholder="Cantidad" value={ticketForm.quantity} onChange={(e) => setTicketForm({ ...ticketForm, quantity: e.target.value })} className="rounded-lg bg-secondary px-3 py-2 text-sm text-foreground outline-none ring-1 ring-border focus:ring-primary" />
                  </div>
                  <button onClick={handleAddTicketType} disabled={savingTicket || !ticketForm.name} className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40">
                    {savingTicket ? 'Guardando...' : 'Agregar'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'rrpp' && (
        <div className="space-y-4">
          <div className="glass-card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary" /> Asignar RRPP a la Discoteca</h3>
            <input type="email" placeholder="Email del RRPP" value={rrppEmail} onChange={(e) => setRrppEmail(e.target.value)} className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary" />
            <select value={rrppZone} onChange={(e) => setRrppZone(e.target.value)} className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground ring-1 ring-border cursor-pointer">
              <option value="">Todas las zonas (Por Defecto)</option>
              <option value="general">Solo General</option>
              <option value="vip">Solo VIP</option>
            </select>
            <button onClick={handleAssignRRPP} disabled={assigningRRPP || !rrppEmail} className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:shadow-glow disabled:opacity-40">
              {assigningRRPP ? 'Asignando...' : 'Asignar RRPP'}
            </button>
          </div>

          <div className="glass-card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">RRPP Asignados</h3>
            {rrppAssignments?.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl bg-secondary p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{a.profile?.name || 'RRPP'}</p>
                  <p className="text-xs text-muted-foreground">{a.profile?.email} · RRPP Oficial {a.zone_type ? `(${a.zone_type === 'vip' ? 'Solo VIP' : 'Solo General'})` : '(Todas las Zonas)'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-primary/15 px-2 py-1 text-xs font-mono text-primary">{a.unique_code}</span>
                  <button onClick={() => handleDeleteRRPP(a.id)} className="text-muted-foreground hover:text-destructive transition-colors touch-target">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {(!rrppAssignments || rrppAssignments.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No hay RRPP asignados aún</p>
            )}
          </div>
        </div>
      )}
      {tab === 'sales' && (
        <div className="space-y-4">
          <div className="glass-card p-4 space-y-3">
             <h3 className="text-sm font-semibold text-foreground">Registro General de Ventas (Reservas Activas / Usadas)</h3>
             {reservations?.length === 0 ? (
               <p className="text-sm text-muted-foreground text-center py-4">No hay ventas registradas.</p>
             ) : (
               <div className="space-y-2">
                 {reservations?.map((r: any) => {
                    const evt = events?.find(e => e.id === r.event_id);
                    const isFreeLog = r.type === 'rrpp_free' || r.type === 'mesa_vip';
                    const isRRPP = !!r.rrpp_id;
                    const rrppName = isRRPP ? (rrppAssignments?.find(a => a.user_id === r.rrpp_id)?.profile?.name || 'RRPP') : null;
                    return (
                      <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl bg-secondary p-3 gap-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">{evt?.title || 'Evento'} <span className="text-muted-foreground font-normal">({r.type})</span></p>
                          <p className="text-xs text-muted-foreground font-mono">{r.code} · {r.status}</p>
                        </div>
                        <div className="text-left sm:text-right flex flex-row sm:flex-col justify-between sm:justify-center items-center sm:items-end">
                          <p className={`text-sm font-bold ${isFreeLog ? 'text-success' : 'text-primary'}`}>
                            {isFreeLog ? 'Cortesía' : 'Venta'}
                          </p>
                          <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                            {isRRPP ? `RRPP: ${rrppName}` : `Cliente Directo Vía App`}
                          </p>
                        </div>
                      </div>
                    );
                 })}
               </div>
             )}
          </div>
        </div>
      )}

      {tab === 'approvals' && (
        <div className="space-y-4">
          <div className="glass-card p-4 space-y-3">
             <h3 className="text-sm font-semibold text-foreground">Solicitudes de Compra Pendientes</h3>
             {purchaseRequests?.length === 0 ? (
               <p className="text-sm text-muted-foreground text-center py-4">No hay pagos pendientes por verificar.</p>
             ) : (
               <div className="space-y-3">
                 {purchaseRequests?.map((r: any) => {
                    const isRRPP = !!r.rrpp_id;
                    const profileName = isRRPP ? (r.rrppProfile?.name || 'RRPP') : (r.buyerProfile?.name || 'Cliente');
                    const profileEmail = isRRPP ? (r.rrppProfile?.email || '') : (r.buyerProfile?.email || '');
                    return (
                      <div key={r.id} className="rounded-xl bg-secondary p-4 space-y-3 relative overflow-hidden">
                        <div className="flex justify-between items-start">
                           <div>
                             <p className="font-semibold text-foreground text-base">Bs. {r.total_amount}</p>
                             <p className="text-xs text-muted-foreground">Solicitado por: <span className="font-medium text-foreground">{profileName}</span></p>
                             <p className="text-xs text-muted-foreground">Email: {profileEmail}</p>
                             <p className="text-xs text-muted-foreground border-t border-border mt-1 pt-1">Evento: <span className="font-medium">{r.events.title}</span></p>
                           </div>
                           <span className="bg-warning/20 text-warning px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                             Pendiente
                           </span>
                        </div>
                        <div className="bg-background/50 rounded-lg p-2 space-y-1 ring-1 ring-border">
                           <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Detalle del Pedido:</p>
                           {r.ticket_types.map((tt: any, i: number) => (
                             <p key={i} className="text-sm text-foreground">• {tt.quantity}x {tt.name} (Bs. {tt.price} c/u)</p>
                           ))}
                        </div>
                        <div className="flex items-center gap-2 pt-1 border-t border-border mt-2">
                          <button onClick={() => handleApproveRequest(r)} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:shadow-glow transition-all active:scale-[0.98]">
                            Aprobar Pago
                          </button>
                          <button onClick={() => handleRejectRequest(r.id)} className="flex-1 rounded-xl bg-destructive/10 text-destructive py-2.5 text-sm font-semibold hover:bg-destructive/20 transition-all active:scale-[0.98]">
                            Rechazar
                          </button>
                        </div>
                      </div>
                    );
                 })}
               </div>
             )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
