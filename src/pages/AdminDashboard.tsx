import { useState } from 'react';
import { Shield, BarChart3, ScanLine, Calendar, Users, Ticket, Loader2, Plus, UserPlus, Trash2, DollarSign, CheckCircle, MapPin, Edit } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEvents, useReservations, useOrgMembers, useZones, ZoneTable } from '@/hooks/useSupabaseData';
import { useAuth } from '@/hooks/useAuth';
import CheckInScanner from '@/components/CheckInScanner';
import MapEditor from '@/components/MapEditor';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import EventMapStatus from '@/components/EventMapStatus';

type Tab = 'overview' | 'checkin' | 'events' | 'rrpp' | 'sales' | 'approvals' | 'zones';

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('overview');
  const { activeOrg, userRole, user } = useAuth();
  const orgId = activeOrg?.id;
  const { data: events, isLoading: eventsLoading } = useEvents(orgId);
  const { data: reservations } = useReservations({});
  const { data: orgMembers } = useOrgMembers(orgId);
  const { data: zones, isLoading: zonesLoading } = useZones(orgId);
  const queryClient = useQueryClient();

  // Event form state
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm] = useState({ title: '', description: '', date: '', time: '', location: '', capacity: '', is_free_pass: false, free_pass_until: '', general_tables_count: '', vip_tables_count: '', allow_rrpp_guests: true });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [savingEvent, setSavingEvent] = useState(false);
  const [editEventId, setEditEventId] = useState<string | null>(null);

  // Zone form state
  const [showZoneForm, setShowZoneForm] = useState(false);
  const [zoneName, setZoneName] = useState('');
  const [zoneImageFile, setZoneImageFile] = useState<File | null>(null);
  const [savingZone, setSavingZone] = useState(false);
  const [activeZoneEditorId, setActiveZoneEditorId] = useState<string | null>(null);
  const [savingZoneLayout, setSavingZoneLayout] = useState(false);

  // RRPP assign state
  const [rrppEmail, setRrppEmail] = useState('');
  const [assigningRRPP, setAssigningRRPP] = useState(false);
  const [rrppZone, setRrppZone] = useState('');
  const [isTeamLeader, setIsTeamLeader] = useState(false);
  const [zoneVisibility, setZoneVisibility] = useState('all');
  const [statusEventId, setStatusEventId] = useState<string | null>(null);
  const [statusMode, setStatusMode] = useState<'config' | 'status'>('config');

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
    { value: 'zones', label: 'Croquis', icon: MapPin },
    { value: 'rrpp', label: 'RRPP', icon: Users },
    { value: 'sales', label: 'Ventas', icon: DollarSign },
  ];

  // Fetch RRPP assignments
  const { data: rrppAssignments } = useQuery({
    queryKey: ['admin-rrpp-assignments', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('rrpp_assignments')
        .select('*, events:event_id(title)')
        .eq('organization_id', orgId);
      if (error) throw error;
      const rids = (data || []).map((a: any) => a.user_id);
      const cids = (data || []).map((a: any) => a.created_by).filter(Boolean);
      const uids = [...new Set([...rids, ...cids])];
      if (uids.length === 0) return [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', uids);
      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]));
      return (data || []).map((a: any) => ({ 
        ...a, 
        profile: profileMap[a.user_id],
        creatorProfile: a.created_by ? profileMap[a.created_by] : null
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

  const handleSaveEvent = async () => {
    if (!eventForm.title || !eventForm.date || !eventForm.time || !eventForm.location || !orgId) return;
    setSavingEvent(true);
    try {
      let uploadedImageUrl = null;
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const filePath = `${orgId}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('events').upload(filePath, imageFile);
        if (uploadError) throw new Error('Error al subir la imagen: ' + uploadError.message);
        const { data: publicUrlData } = supabase.storage.from('events').getPublicUrl(filePath);
        uploadedImageUrl = publicUrlData.publicUrl;
      }

      if (editEventId) {
        const { error } = await supabase.from('events').update({
          title: eventForm.title,
          description: eventForm.description,
          date: eventForm.date,
          time: eventForm.time,
          location: eventForm.location,
          capacity: parseInt(eventForm.capacity) || 0,
          general_tables_count: parseInt(eventForm.general_tables_count) || 0,
          vip_tables_count: parseInt(eventForm.vip_tables_count) || 0,
          is_free_pass: eventForm.is_free_pass,
          free_pass_until: eventForm.is_free_pass && eventForm.free_pass_until ? eventForm.free_pass_until : null,
          allow_rrpp_guests: eventForm.allow_rrpp_guests,
          ...(uploadedImageUrl ? { image_url: uploadedImageUrl } : {}),
        }).eq('id', editEventId);
        if (error) throw error;
        toast.success('Evento actualizado');
      } else {
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
          image_url: uploadedImageUrl,
        }).select().single();
        if (error) throw error;
        if (eventForm.is_free_pass && newEvent) {
          await supabase.from('ticket_types').insert({
            event_id: newEvent.id,
            name: 'Entrada Free Pass',
            type: 'rrpp_free' as any,
            price: 0,
            quantity: newEvent.capacity > 0 ? newEvent.capacity : 500,
          });
        }
        toast.success('Evento creado');
      }
      setEventForm({ title: '', description: '', date: '', time: '', location: '', capacity: '', is_free_pass: false, free_pass_until: '', general_tables_count: '', vip_tables_count: '', allow_rrpp_guests: true });
      setImageFile(null);
      setShowEventForm(false);
      setEditEventId(null);
      queryClient.invalidateQueries({ queryKey: ['events'] });
    } catch (err: any) {
      toast.error(err.message || 'Error');
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
      const { data: profile } = await supabase.from('profiles').select('user_id').eq('email', rrppEmail.trim()).maybeSingle();
      if (!profile) {
        toast.error('Usuario no encontrado');
        setAssigningRRPP(false);
        return;
      }
      const { data: existingRole } = await supabase.from('user_roles').select('id').eq('user_id', profile.user_id).eq('role', 'rrpp').maybeSingle();
      if (!existingRole) {
        await supabase.from('user_roles').insert({ user_id: profile.user_id, role: 'rrpp' as any });
      }
      const { data: codeData } = await supabase.rpc('generate_ticket_code', { prefix: 'RRPP' });
      const code = codeData || `RRPP-${Date.now()}`;
      const { error } = await supabase.from('rrpp_assignments').insert({
        user_id: profile.user_id,
        unique_code: code,
        organization_id: orgId,
        zone_type: rrppZone || null,
        is_team_leader: isTeamLeader,
        created_by: user?.id,
      });
      if (error) throw error;
      toast.success('RRPP asignado');
      setRrppEmail('');
      setIsTeamLeader(false);
      queryClient.invalidateQueries({ queryKey: ['admin-rrpp-assignments'] });
    } catch (err: any) {
      toast.error(err.message || 'Error');
    }
    setAssigningRRPP(false);
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('¿Eliminar evento?')) return;
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (!error) {
      toast.success('Evento eliminado');
      queryClient.invalidateQueries({ queryKey: ['events'] });
    }
  };

  const handleDeleteRRPP = async (id: string) => {
    if (!confirm('¿Remover RRPP?')) return;
    const { error } = await supabase.from('rrpp_assignments').delete().eq('id', id);
    if (!error) {
      toast.success('RRPP removido');
      queryClient.invalidateQueries({ queryKey: ['admin-rrpp-assignments'] });
    }
  };

  const handleCreateZone = async () => {
    if (!zoneName || !zoneImageFile || !orgId) return;
    setSavingZone(true);
    try {
      const fileName = `zone-${Math.random().toString(36).substring(2, 15)}`;
      const filePath = `${orgId}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('events').upload(filePath, zoneImageFile);
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage.from('events').getPublicUrl(filePath);
      const { error } = await supabase.from('organization_zones').insert({
        organization_id: orgId,
        name: zoneName,
        image_url: publicUrlData.publicUrl,
        visibility: zoneVisibility,
        tables_data: [],
      });
      if (error) throw error;
      toast.success('Zona creada');
      setZoneName('');
      setZoneImageFile(null);
      setShowZoneForm(false);
      queryClient.invalidateQueries({ queryKey: ['organization_zones'] });
    } catch (err: any) {
      toast.error('Error al crear zona');
    }
    setSavingZone(false);
  };

  const handleSaveZoneLayout = async (zoneId: string, tablesData: ZoneTable[]) => {
    setSavingZoneLayout(true);
    const { error } = await supabase.from('organization_zones').update({ tables_data: tablesData }).eq('id', zoneId);
    if (!error) {
      toast.success('Layout guardado');
      queryClient.invalidateQueries({ queryKey: ['organization_zones'] });
      setActiveZoneEditorId(null);
    }
    setSavingZoneLayout(false);
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
                    <div className={`h-full rounded-full ${pct > 80 ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'checkin' && <CheckInScanner />}

      {tab === 'events' && (
        <div className="space-y-4">
          <button onClick={() => { setEditEventId(null); setEventForm({ title: '', description: '', date: '', time: '', location: '', capacity: '', is_free_pass: false, free_pass_until: '', general_tables_count: '', vip_tables_count: '', allow_rrpp_guests: true }); setShowEventForm(!showEventForm); }} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:shadow-glow transition-all">
            <Plus className="h-4 w-4" /> {showEventForm ? 'Cerrar Formulario' : 'Crear Evento'}
          </button>

          {showEventForm && (
            <div className="glass-card p-5 space-y-4 border-2 border-primary/20 animate-in fade-in zoom-in-95 duration-200">
              <h3 className="font-bold text-lg text-foreground">{editEventId ? 'Editar Evento' : 'Nuevo Evento'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Título</label>
                  <input placeholder="Título del evento" value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground ring-1 ring-border focus:ring-primary outline-none transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Ubicación</label>
                  <input placeholder="Ubicación" value={eventForm.location} onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })} className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground ring-1 ring-border focus:ring-primary outline-none transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Fecha</label>
                  <input type="date" value={eventForm.date} onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })} className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground ring-1 ring-border focus:ring-primary outline-none transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Hora</label>
                  <input type="time" value={eventForm.time} onChange={(e) => setEventForm({ ...eventForm, time: e.target.value })} className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground ring-1 ring-border focus:ring-primary outline-none transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Capacidad Total</label>
                  <input placeholder="Capacidad" type="number" value={eventForm.capacity} onChange={(e) => setEventForm({ ...eventForm, capacity: e.target.value })} className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground ring-1 ring-border focus:ring-primary outline-none transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Imagen (Flyer)</label>
                  <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Descripción del Evento</label>
                <textarea 
                  placeholder="Escribe aquí los detalles del evento..." 
                  value={eventForm.description} 
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} 
                  className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground ring-1 ring-border focus:ring-primary outline-none transition-all min-h-[100px] resize-none"
                />
              </div>

              <div className="flex flex-wrap gap-4 p-4 bg-secondary/30 rounded-xl border border-border/50">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={eventForm.is_free_pass} onChange={(e) => setEventForm({ ...eventForm, is_free_pass: e.target.checked })} className="w-5 h-5 rounded-lg border-border text-primary focus:ring-primary bg-secondary" />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">Modo Free Pass</span>
                    <span className="text-[10px] text-muted-foreground">Activa entradas gratuitas por lista</span>
                  </div>
                </label>

                {eventForm.is_free_pass && (
                  <div className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-300">
                    <span className="text-[10px] text-primary font-black uppercase">Válido hasta:</span>
                    <input type="time" value={eventForm.free_pass_until} onChange={(e) => setEventForm({ ...eventForm, free_pass_until: e.target.value })} className="rounded-lg bg-background px-3 py-1.5 text-xs border border-primary/30 outline-none focus:ring-2 focus:ring-primary/20 text-foreground" />
                  </div>
                )}

                <label className="flex items-center gap-3 cursor-pointer group ml-auto">
                  <input type="checkbox" checked={eventForm.allow_rrpp_guests} onChange={(e) => setEventForm({ ...eventForm, allow_rrpp_guests: e.target.checked })} className="w-5 h-5 rounded-lg border-border text-primary focus:ring-primary bg-secondary" />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">Lista RRPP</span>
                    <span className="text-[10px] text-muted-foreground">Permitir que RRPPs anoten invitados</span>
                  </div>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowEventForm(false)} className="flex-1 rounded-xl bg-secondary py-3.5 text-sm font-bold text-foreground hover:bg-secondary/80 transition-all active:scale-[0.98]">Cancelar</button>
                <button onClick={handleSaveEvent} disabled={savingEvent} className="flex-[2] rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground hover:shadow-glow transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingEvent ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {savingEvent ? 'Guardando...' : editEventId ? 'Actualizar Evento' : 'Publicar Evento'}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {events?.map((ev) => (
              <div key={ev.id} className="glass-card p-4 space-y-3 relative group border-border/50 hover:border-primary/30 transition-all">
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditEventId(ev.id); setEventForm({ ...ev, capacity: ev.capacity.toString(), general_tables_count: '', vip_tables_count: '' } as any); setShowEventForm(true); }} className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-primary hover:bg-primary/10"><Edit className="h-4 w-4" /></button>
                  <button onClick={() => handleDeleteEvent(ev.id)} className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div>
                  <h3 className="font-bold text-foreground pr-16">{ev.title}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Calendar className="h-3 w-3" /> {ev.date} · {ev.location}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowTicketForm(showTicketForm === ev.id ? null : ev.id)} className="text-[10px] bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-black uppercase hover:bg-primary/20 transition-all">
                    + Gestionar Tickets
                  </button>
                </div>
                {showTicketForm === ev.id && (
                  <div className="bg-secondary/30 p-3 rounded-xl space-y-3 mt-2 border border-border/50 animate-in slide-in-from-top-2">
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase">Agregar Tipo de Entrada</h4>
                    <input placeholder="Nombre (Ej: General, VIP)" value={ticketForm.name} onChange={(e) => setTicketForm({ ...ticketForm, name: e.target.value })} className="w-full rounded-lg bg-background px-3 py-2 text-sm border border-border outline-none focus:ring-1 focus:ring-primary" />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" placeholder="Precio (Bs)" value={ticketForm.price} onChange={(e) => setTicketForm({ ...ticketForm, price: e.target.value })} className="rounded-lg bg-background px-3 py-2 text-sm border border-border outline-none" />
                      <input type="number" placeholder="Stock" value={ticketForm.quantity} onChange={(e) => setTicketForm({ ...ticketForm, quantity: e.target.value })} className="rounded-lg bg-background px-3 py-2 text-sm border border-border outline-none" />
                    </div>
                    <button onClick={handleAddTicketType} className="w-full rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground hover:shadow-glow transition-all">Guardar Ticket</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'zones' && (
        <div className="space-y-4">
          <div className="flex gap-2 bg-secondary p-1 rounded-xl w-fit">
            <button onClick={() => setStatusMode('config')} className={`px-4 py-2 rounded-lg text-xs font-bold ${statusMode === 'config' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>CONFIG</button>
            <button onClick={() => setStatusMode('status')} className={`px-4 py-2 rounded-lg text-xs font-bold ${statusMode === 'status' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>ESTADO</button>
          </div>
          {statusMode === 'config' ? (
            <>
              <button onClick={() => setShowZoneForm(!showZoneForm)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Nueva Zona</button>
              {showZoneForm && (
                <div className="glass-card p-4 space-y-3">
                  <input placeholder="Nombre" value={zoneName} onChange={(e) => setZoneName(e.target.value)} className="w-full rounded-xl bg-secondary px-4 py-3 text-sm" />
                  <input type="file" onChange={(e) => setZoneImageFile(e.target.files?.[0] || null)} className="w-full text-sm" />
                  <select value={zoneVisibility} onChange={(e) => setZoneVisibility(e.target.value)} className="w-full rounded-xl bg-secondary px-4 py-3 text-sm">
                    <option value="all">Todos</option>
                    <option value="rrpp_only">Solo RRPP</option>
                    <option value="rrpp_tl_only">Solo TLs</option>
                    <option value="admin_only">Solo Admin</option>
                  </select>
                  <button onClick={handleCreateZone} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white">Guardar</button>
                </div>
              )}
              {zones?.map(zone => (
                <div key={zone.id} className="glass-card p-4">
                  <h3 className="font-bold">{zone.name}</h3>
                  {activeZoneEditorId === zone.id ? (
                    <MapEditor imageUrl={zone.image_url} initialTables={zone.tables_data || []} onSave={(t) => handleSaveZoneLayout(zone.id, t)} />
                  ) : (
                    <button onClick={() => setActiveZoneEditorId(zone.id)} className="text-sm text-primary font-bold">Editar Mesas</button>
                  )}
                </div>
              ))}
            </>
          ) : (
            <div className="space-y-4">
              <select onChange={(e) => setStatusEventId(e.target.value)} className="w-full rounded-xl bg-secondary px-4 py-3 text-sm">
                <option value="">Seleccionar Evento</option>
                {events?.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
              {statusEventId && zones?.map(zone => <EventMapStatus key={zone.id} eventId={statusEventId} zone={zone} asAdmin={true} />)}
            </div>
          )}
        </div>
      )}

      {tab === 'rrpp' && (
        <div className="space-y-4">
          <div className="glass-card p-4 space-y-3">
            <h3 className="font-bold text-sm">Asignar RRPP</h3>
            <input placeholder="Email" value={rrppEmail} onChange={(e) => setRrppEmail(e.target.value)} className="w-full rounded-xl bg-secondary px-4 py-3 text-sm" />
            <div className="flex items-center gap-2">
              <input type="checkbox" id="tl" checked={isTeamLeader} onChange={(e) => setIsTeamLeader(e.target.checked)} />
              <label htmlFor="tl" className="text-sm">Team Leader</label>
            </div>
            <button onClick={handleAssignRRPP} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white">Asignar</button>
          </div>
          <div className="space-y-2">
            {rrppAssignments?.map(a => (
              <div key={a.id} className="glass-card p-3 flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold">{a.profile?.name} {a.is_team_leader && '(TL)'}</p>
                  <p className="text-xs text-muted-foreground">Por: {a.creatorProfile?.name || 'Admin'}</p>
                </div>
                <button onClick={() => handleDeleteRRPP(a.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'sales' && (
        <div className="glass-card p-4 space-y-4">
          <h3 className="font-bold">Registro de Ventas</h3>
          <div className="space-y-2">
            {reservations?.map(r => (
              <div key={r.id} className="rounded-xl bg-secondary p-3 flex justify-between">
                <div>
                  <p className="text-sm font-bold">{r.guest_name || 'Cliente'}</p>
                  <p className="text-xs text-muted-foreground">{r.code}</p>
                </div>
                <p className="text-sm font-bold text-primary">Bs. {r.ticket_types?.price || 0}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
