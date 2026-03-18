import { useState } from 'react';
import { Shield, BarChart3, ScanLine, Calendar, Users, Ticket, Loader2, Plus, UserPlus, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEvents, useReservations, useOrgMembers } from '@/hooks/useSupabaseData';
import { useAuth } from '@/hooks/useAuth';
import CheckInScanner from '@/components/CheckInScanner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

type Tab = 'overview' | 'checkin' | 'events' | 'rrpp';

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
  const [eventForm, setEventForm] = useState({ title: '', description: '', date: '', time: '', location: '', capacity: '' });
  const [savingEvent, setSavingEvent] = useState(false);

  // RRPP assign state
  const [rrppEmail, setRrppEmail] = useState('');
  const [assigningRRPP, setAssigningRRPP] = useState(false);

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
      const { error } = await supabase.from('events').insert({
        title: eventForm.title,
        description: eventForm.description,
        date: eventForm.date,
        time: eventForm.time,
        location: eventForm.location,
        capacity: parseInt(eventForm.capacity) || 0,
        organization_id: orgId,
      });
      if (error) throw error;
      toast.success('Evento creado');
      setEventForm({ title: '', description: '', date: '', time: '', location: '', capacity: '' });
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
      });
      if (error) throw error;
      toast.success('RRPP asignado a la discoteca');
      setRrppEmail('');
      queryClient.invalidateQueries({ queryKey: ['admin-rrpp-assignments'] });
    } catch (err: any) {
      toast.error(err.message || 'Error al asignar RRPP');
    }
    setAssigningRRPP(false);
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
              <button onClick={handleCreateEvent} disabled={savingEvent || !eventForm.title || !eventForm.date || !eventForm.time || !eventForm.location} className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:shadow-glow disabled:opacity-40">
                {savingEvent ? 'Creando...' : 'Crear Evento'}
              </button>
            </div>
          )}

          {events?.map((ev) => (
            <div key={ev.id} className="glass-card p-4 space-y-2">
              <h3 className="font-semibold text-foreground">{ev.title}</h3>
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
                  <p className="text-xs text-muted-foreground">{a.profile?.email} · RRPP Oficial</p>
                </div>
                <span className="rounded-lg bg-primary/15 px-2 py-1 text-xs font-mono text-primary">{a.unique_code}</span>
              </div>
            ))}
            {(!rrppAssignments || rrppAssignments.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No hay RRPP asignados aún</p>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
