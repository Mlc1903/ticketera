import { useState } from 'react';
import { Shield, BarChart3, ScanLine, Calendar, Users, Ticket, Loader2, Plus, UserPlus, Trash2, DollarSign, CheckCircle, MapPin, Edit, ArrowLeft, Zap, QrCode, X, Share2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEvents, useReservations, useOrgMembers, useZones, ZoneTable, useScanners, useTicketCategories } from '@/hooks/useSupabaseData';
import { useAuth } from '@/hooks/useAuth';
import CheckInScanner from '@/components/CheckInScanner';
import MapEditor from '@/components/MapEditor';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import EventMapStatus from '@/components/EventMapStatus';
import { Info } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

type Tab = 'overview' | 'checkin' | 'events' | 'zones' | 'rrpp' | 'sales' | 'consumo' | 'scanners';

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
  const [eventForm, setEventForm] = useState({ title: '', description: '', date: '', time: '', location: '', capacity: '', is_free_pass: false, free_pass_until: '', general_tables_count: '', vip_tables_count: '', allow_rrpp_guests: true, rrpp_guests_per_promoter: '', rrpp_vip_guests_per_promoter: '', consumo_general_requirement: '', consumo_vip_requirement: '' });
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
  const [zoneCategory, setZoneCategory] = useState<'general' | 'vip'>('general');
  const [statusEventId, setStatusEventId] = useState<string | null>(null);
  const [statusMode, setStatusMode] = useState<'config' | 'status'>('config');
  const [selectedEventStatsId, setSelectedEventStatsId] = useState<string | null>(null);
  const [selectedConsumoEventId, setSelectedConsumoEventId] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Ticket type form state
  const [showTicketForm, setShowTicketForm] = useState<string | null>(null);
  const [ticketForm, setTicketForm] = useState({ name: '', type: 'normal' as string, price: '', quantity: '' });
  const [savingTicket, setSavingTicket] = useState(false);

  // Scanner form state
  const [showScannerForm, setShowScannerForm] = useState(false);
  const [scannerForm, setScannerForm] = useState({ name: '', allowed_types: [] as string[] });
  const { data: scanners } = useScanners(orgId);
  const { data: ticketCategories } = useTicketCategories(orgId);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingScanner, setSavingScanner] = useState(false);
  const [bulkGenForm, setBulkGenForm] = useState({ eventId: '', guestName: '', quantity: '1' });
  const [generatingBulk, setGeneratingBulk] = useState(false);
  const [viewingQR, setViewingQR] = useState<{code: string, name: string} | null>(null);
  const [bulkGeneratedTickets, setBulkGeneratedTickets] = useState<any[] | null>(null);
  const [sharingTickets, setSharingTickets] = useState(false);

  const totalTickets = reservations?.length || 0;
  const usedTickets = reservations?.filter((r: any) => r.status === 'used').length || 0;
  const activeTickets = reservations?.filter((r: any) => r.status === 'active').length || 0;

  const adminMemberIds = orgMembers?.filter(m => m.role === 'admin' || m.role === 'owner').map(m => m.user_id) || [];
  if (userRole === 'super_admin' && user?.id) adminMemberIds.push(user.id);

  const tabs: { value: Tab; label: string; icon: React.ElementType }[] = [
    { value: 'overview', label: 'Resumen', icon: BarChart3 },
    { value: 'checkin', label: 'Check-in', icon: ScanLine },
    { value: 'events', label: 'Eventos', icon: Calendar },
    { value: 'zones', label: 'Mesas', icon: MapPin },
    { value: 'rrpp', label: 'RRPP', icon: Users },
    { value: 'sales', label: 'Gestión', icon: DollarSign },
    { value: 'consumo', label: 'Consumo', icon: Zap },
    { value: 'scanners', label: 'Accesos', icon: ScanLine },
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
          rrpp_guests_per_promoter: parseInt(eventForm.rrpp_guests_per_promoter as string) || 0,
          rrpp_vip_guests_per_promoter: parseInt(eventForm.rrpp_vip_guests_per_promoter as string) || 0,
          consumo_general_requirement: parseInt(eventForm.consumo_general_requirement as string) || 0,
          consumo_vip_requirement: parseInt(eventForm.consumo_vip_requirement as string) || 0,
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
          rrpp_guests_per_promoter: parseInt(eventForm.rrpp_guests_per_promoter as string) || 0,
          rrpp_vip_guests_per_promoter: parseInt(eventForm.rrpp_vip_guests_per_promoter as string) || 0,
          consumo_general_requirement: parseInt(eventForm.consumo_general_requirement as string) || 0,
          consumo_vip_requirement: parseInt(eventForm.consumo_vip_requirement as string) || 0,
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
      setEventForm({ title: '', description: '', date: '', time: '', location: '', capacity: '', is_free_pass: false, free_pass_until: '', general_tables_count: '', vip_tables_count: '', allow_rrpp_guests: true, rrpp_guests_per_promoter: '', rrpp_vip_guests_per_promoter: '', consumo_general_requirement: '', consumo_vip_requirement: '' });
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
      setRrppZone('');
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
        category: zoneCategory,
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

  const handleSaveScanner = async () => {
    if (!scannerForm.name || !orgId) return;
    setSavingScanner(true);
    try {
      const { error } = await supabase.from('organization_scanners').insert({
        organization_id: orgId,
        name: scannerForm.name,
        allowed_ticket_types: scannerForm.allowed_types.length > 0 ? scannerForm.allowed_types : null,
      });
      if (error) throw error;
      toast.success('Escáner creado');
      setScannerForm({ name: '', allowed_types: [] });
      setShowScannerForm(false);
      queryClient.invalidateQueries({ queryKey: ['organization_scanners'] });
    } catch (err: any) {
      toast.error('Error al crear escáner');
    }
    setSavingScanner(false);
  };

  const handleDeleteScanner = async (id: string) => {
    if (!confirm('¿Eliminar este escáner?')) return;
    const { error } = await supabase.from('organization_scanners').delete().eq('id', id);
    if (!error) {
      toast.success('Escáner eliminado');
      queryClient.invalidateQueries({ queryKey: ['organization_scanners'] });
    }
  };

  const handleBulkGenerate = async (category: 'general' | 'vip') => {
    if (!bulkGenForm.eventId || !orgId) {
      toast.error('Selecciona un evento primero');
      return;
    }
    const qty = parseInt(bulkGenForm.quantity) || 1;
    if (qty <= 0) return;

    setGeneratingBulk(true);
    try {
      const event = events?.find(e => e.id === bulkGenForm.eventId);
      const ticketType = event?.ticket_types?.find(t => 
        category === 'vip' 
          ? (t.type === 'vip' || t.name.toLowerCase().includes('vip'))
          : (t.type === 'normal' || t.name.toLowerCase().includes('general'))
      );

      if (!ticketType) {
        toast.error(`No se encontró un tipo de entrada ${category} en este evento`);
        setGeneratingBulk(false);
        return;
      }

      const reservations = [];
      for (let i = 0; i < qty; i++) {
        const { data: code } = await supabase.rpc('generate_ticket_code', { prefix: category.toUpperCase() });
        reservations.push({
          code: code || `${category.toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          event_id: bulkGenForm.eventId,
          ticket_type_id: ticketType.id,
          guest_name: bulkGenForm.guestName || `Invitado ${category.toUpperCase()}`,
          type: 'normal',
          status: 'active',
          quantity: 1,
          rrpp_id: user?.id
        });
      }

      const { data, error } = await supabase.from('reservations').insert(reservations).select('*, ticket_types(name)');
      if (error) throw error;

      toast.success(`${qty} entradas ${category.toUpperCase()} generadas con éxito`);
      setBulkGenForm({ ...bulkGenForm, guestName: '', quantity: '1' });
      setBulkGeneratedTickets(data);
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    } catch (err: any) {
      toast.error('Error al generar entradas: ' + err.message);
    }
    setGeneratingBulk(false);
  };

  const handleShareTickets = async () => {
    setSharingTickets(true);
    try {
      const nodes = document.querySelectorAll('.export-ticket-card');
      const files: File[] = [];

      const { toBlob } = await import('html-to-image');

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i] as HTMLElement;
        const blob = await toBlob(node, { quality: 0.95 });
        if (blob) {
          files.push(new File([blob], `entrada-${i + 1}.png`, { type: 'image/png' }));
        }
      }

      if (navigator.canShare && navigator.canShare({ files })) {
        await navigator.share({
          files,
          title: 'Entradas',
          text: 'Aquí tienes tus entradas generadas',
        });
        toast.success('Compartido con éxito');
      } else {
        files.forEach(file => {
          const url = URL.createObjectURL(file);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        });
        toast.success('Imágenes descargadas. Ya puedes enviarlas por WhatsApp.');
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        toast.error('Error al generar imágenes: ' + error.message);
      }
    }
    setSharingTickets(false);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !orgId) return;
    setSavingCategory(true);
    const { error } = await supabase.from('organization_ticket_categories').insert({
      organization_id: orgId,
      name: newCategoryName.trim().toUpperCase()
    });
    if (!error) {
      toast.success('Categoría agregada');
      setNewCategoryName('');
      queryClient.invalidateQueries({ queryKey: ['ticket_categories'] });
    } else {
      toast.error('La categoría ya existe o hubo un error');
    }
    setSavingCategory(false);
  };

  const handleDeleteCategory = async (id: string) => {
    const { error } = await supabase.from('organization_ticket_categories').delete().eq('id', id);
    if (!error) {
      toast.success('Categoría eliminada');
      queryClient.invalidateQueries({ queryKey: ['ticket_categories'] });
    }
  };

  const handleDeleteZone = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este croquis? Se eliminarán todas las mesas vinculadas a él.')) return;
    try {
      const { error } = await supabase.from('organization_zones').delete().eq('id', id);
      if (error) throw error;
      toast.success('Croquis eliminado');
      queryClient.invalidateQueries({ queryKey: ['organization_zones'] });
    } catch (err: any) {
      toast.error('Error al eliminar croquis');
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
          <button onClick={() => { setEditEventId(null); setEventForm({ title: '', description: '', date: '', time: '', location: '', capacity: '', is_free_pass: false, free_pass_until: '', general_tables_count: '', vip_tables_count: '', allow_rrpp_guests: true, rrpp_guests_per_promoter: '', rrpp_vip_guests_per_promoter: '', consumo_general_requirement: '', consumo_vip_requirement: '' }); setShowEventForm(!showEventForm); }} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:shadow-glow transition-all">
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

                <div className="flex items-center gap-3 ml-auto">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" checked={eventForm.allow_rrpp_guests} onChange={(e) => setEventForm({ ...eventForm, allow_rrpp_guests: e.target.checked })} className="w-5 h-5 rounded-lg border-border text-primary focus:ring-primary bg-secondary" />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">Lista RRPP</span>
                      <span className="text-[10px] text-muted-foreground">Permitir invitados</span>
                    </div>
                  </label>
                  {eventForm.allow_rrpp_guests && (
                    <div className="flex items-center gap-4 animate-in slide-in-from-right-2 duration-300">
                      <div className="flex items-center gap-1.5">
                        <input 
                          type="number" 
                          placeholder="Límite" 
                          value={eventForm.rrpp_guests_per_promoter} 
                          onChange={(e) => setEventForm({ ...eventForm, rrpp_guests_per_promoter: e.target.value })} 
                          className="w-14 rounded-lg bg-background px-2 py-1.5 text-xs border border-primary/30 outline-none focus:ring-2 focus:ring-primary/20 text-foreground text-center" 
                        />
                        <span className="text-[9px] font-black text-primary uppercase">General</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input 
                          type="number" 
                          placeholder="Límite" 
                          value={eventForm.rrpp_vip_guests_per_promoter} 
                          onChange={(e) => setEventForm({ ...eventForm, rrpp_vip_guests_per_promoter: e.target.value })} 
                          className="w-14 rounded-lg bg-background px-2 py-1.5 text-xs border border-warning/30 outline-none focus:ring-2 focus:ring-warning/20 text-foreground text-center" 
                        />
                        <span className="text-[9px] font-black text-warning uppercase">VIP</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-primary/5 rounded-xl border border-primary/20">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-primary uppercase px-1">Meta Consumo General</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      placeholder="Check-ins req." 
                      value={eventForm.consumo_general_requirement} 
                      onChange={(e) => setEventForm({ ...eventForm, consumo_general_requirement: e.target.value })} 
                      className="w-full rounded-lg bg-background px-3 py-2 text-sm border border-primary/20 outline-none focus:ring-2 focus:ring-primary/20 text-foreground" 
                    />
                    <Zap className="h-4 w-4 text-primary shrink-0" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-warning uppercase px-1">Meta Consumo VIP</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      placeholder="Check-ins req." 
                      value={eventForm.consumo_vip_requirement} 
                      onChange={(e) => setEventForm({ ...eventForm, consumo_vip_requirement: e.target.value })} 
                      className="w-full rounded-lg bg-background px-3 py-2 text-sm border border-warning/20 outline-none focus:ring-2 focus:ring-warning/20 text-foreground" 
                    />
                    <Zap className="h-4 w-4 text-warning shrink-0" />
                  </div>
                </div>
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
                  <button 
                    onClick={() => { 
                      setEditEventId(ev.id); 
                      setEventForm({ 
                        ...ev, 
                        capacity: ev.capacity.toString(), 
                        general_tables_count: '', 
                        vip_tables_count: '', 
                        rrpp_guests_per_promoter: ev.rrpp_guests_per_promoter?.toString() || '', 
                        rrpp_vip_guests_per_promoter: (ev as any).rrpp_vip_guests_per_promoter?.toString() || '', 
                        consumo_general_requirement: ev.consumo_general_requirement?.toString() || '', 
                        consumo_vip_requirement: ev.consumo_vip_requirement?.toString() || '' 
                      } as any); 
                      setShowEventForm(true); 
                    }} 
                    className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-primary hover:bg-primary/10"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDeleteEvent(ev.id)} className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </button>
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
                    <option value="all">Visibilidad: Todos</option>
                    <option value="rrpp_only">Solo RRPP</option>
                    <option value="rrpp_tl_only">Solo TLs</option>
                    <option value="admin_only">Solo Admin</option>
                  </select>
                  <select value={zoneCategory} onChange={(e) => setZoneCategory(e.target.value as 'general' | 'vip')} className="w-full rounded-xl bg-secondary px-4 py-3 text-sm">
                    <option value="general">Categoría: General</option>
                    <option value="vip">Categoría: VIP</option>
                  </select>
                  <button onClick={handleCreateZone} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white">Guardar</button>
                </div>
              )}
              {zones?.map(zone => (
                <div key={zone.id} className="glass-card p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold">{zone.name}</h3>
                    <button 
                      onClick={() => handleDeleteZone(zone.id)}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      title="Eliminar Croquis"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
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
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 px-1">
                <input type="checkbox" id="tl" checked={isTeamLeader} onChange={(e) => setIsTeamLeader(e.target.checked)} className="rounded border-border text-primary focus:ring-primary" />
                <label htmlFor="tl" className="text-xs font-medium text-foreground">Team Leader</label>
              </div>
              <select 
                value={rrppZone} 
                onChange={(e) => setRrppZone(e.target.value)} 
                className="rounded-lg bg-secondary px-3 py-2 text-xs border border-border focus:ring-1 focus:ring-primary outline-none"
              >
                <option value="">Rango (Default)</option>
                <option value="general">General</option>
                <option value="vip">VIP</option>
              </select>
            </div>
            <button onClick={handleAssignRRPP} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white hover:shadow-glow transition-all active:scale-[0.98]">Asignar</button>
          </div>
          <div className="space-y-2">
            {rrppAssignments?.map(a => (
              <div key={a.id} className="glass-card p-3 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold">{a.profile?.name} {a.is_team_leader && '(TL)'}</p>
                    {a.zone_type && (
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${a.zone_type === 'vip' ? 'bg-warning/20 text-warning border border-warning/30' : 'bg-primary/20 text-primary border border-primary/30'}`}>
                        {a.zone_type}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Por: {a.creatorProfile?.name || 'Admin'}</p>
                </div>
                <button onClick={() => handleDeleteRRPP(a.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'consumo' && (
        <div className="space-y-4">
          <div className="glass-card p-4 space-y-4">
            <h3 className="font-bold text-lg text-foreground">Configuración de Consumo</h3>
            <select 
              value={selectedConsumoEventId || ''} 
              onChange={(e) => setSelectedConsumoEventId(e.target.value)}
              className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground outline-none ring-1 ring-border focus:ring-primary cursor-pointer"
            >
              <option value="">-- Seleccionar Evento --</option>
              {events?.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.title} ({ev.date})</option>
              ))}
            </select>

            {selectedConsumoEventId && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 space-y-2">
                  <p className="text-[10px] font-black text-primary uppercase">Meta RRPP General</p>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={events?.find(e => e.id === selectedConsumoEventId)?.consumo_general_requirement || 0}
                      readOnly
                      className="w-16 bg-background rounded-lg px-2 py-1.5 text-center font-bold text-sm border border-border"
                    />
                    <span className="text-xs text-muted-foreground">Check-ins requeridos</span>
                  </div>
                  <p className="text-[9px] text-muted-foreground italic">* Configúralo al editar el evento</p>
                </div>
                <div className="p-4 bg-warning/5 rounded-xl border border-warning/20 space-y-2">
                  <p className="text-[10px] font-black text-warning uppercase">Meta RRPP VIP</p>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={events?.find(e => e.id === selectedConsumoEventId)?.consumo_vip_requirement || 0}
                      readOnly
                      className="w-16 bg-background rounded-lg px-2 py-1.5 text-center font-bold text-sm border border-border"
                    />
                    <span className="text-xs text-muted-foreground">Check-ins requeridos</span>
                  </div>
                  <p className="text-[9px] text-muted-foreground italic">* Configúralo al editar el evento</p>
                </div>
              </div>
            )}
          </div>

          {selectedConsumoEventId && (
            <div className="glass-card p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold">Estado de RRPP</h3>
                <div className="flex gap-4 text-[10px] font-bold text-muted-foreground">
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-success"></div> Habilitado</div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-muted"></div> Pendiente</div>
                </div>
              </div>
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                {rrppAssignments?.map(a => {
                  const checkins = reservations?.filter(r => r.event_id === selectedConsumoEventId && r.rrpp_id === a.user_id && r.status === 'used').length || 0;
                  const goal = a.zone_type === 'vip' 
                    ? (events?.find(e => e.id === selectedConsumoEventId)?.consumo_vip_requirement || 0)
                    : (events?.find(e => e.id === selectedConsumoEventId)?.consumo_general_requirement || 0);
                  const isQualified = goal > 0 && checkins >= goal;

                  return (
                    <div key={a.id} className={`flex items-center justify-between p-3 rounded-xl transition-all border ${isQualified ? 'bg-success/5 border-success/20' : 'bg-secondary/50 border-border/50'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-1.5 h-8 rounded-full ${isQualified ? 'bg-success shadow-glow-success' : 'bg-muted'}`}></div>
                        <div>
                          <p className="text-sm font-bold text-foreground">{a.profile?.name}</p>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${a.zone_type === 'vip' ? 'bg-warning/20 text-warning' : 'bg-primary/20 text-primary'}`}>
                              {a.zone_type || 'General'}
                            </span>
                            {a.is_team_leader && <span className="text-[9px] font-black uppercase text-muted-foreground">TL</span>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-black ${isQualified ? 'text-success' : 'text-foreground'}`}>{checkins} / {goal}</p>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{isQualified ? 'Habilitado' : 'Pendiente'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'sales' && (
        <div className="space-y-4">
          {!selectedEventStatsId ? (
            <div className="space-y-4">
              <h3 className="font-bold text-lg text-foreground px-1">Gestión por Evento</h3>
              
              {/* Quick Bulk Generation (Standalone) */}
              <div className="glass-card p-6 border-2 border-primary/10 shadow-glow-sm bg-primary/5">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Generación Express de Entradas</h3>
                    <p className="text-xs text-muted-foreground">Crea entradas instantáneas para venta en puerta o invitados</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Evento</label>
                    <select 
                      value={bulkGenForm.eventId} 
                      onChange={(e) => setBulkGenForm({ ...bulkGenForm, eventId: e.target.value })}
                      className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground outline-none ring-1 ring-border focus:ring-primary appearance-none cursor-pointer"
                    >
                      <option value="">-- Seleccionar Evento --</option>
                      {events?.map(e => (
                        <option key={e.id} value={e.id}>{e.title}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Nombre (Opcional)</label>
                    <input 
                      placeholder="Ej: Invitado" 
                      value={bulkGenForm.guestName}
                      onChange={(e) => setBulkGenForm({ ...bulkGenForm, guestName: e.target.value })}
                      className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground outline-none ring-1 ring-border focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Cantidad</label>
                    <input 
                      type="number" 
                      min="1"
                      max="50"
                      value={bulkGenForm.quantity}
                      onChange={(e) => setBulkGenForm({ ...bulkGenForm, quantity: e.target.value })}
                      className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground outline-none ring-1 ring-border focus:ring-primary text-center font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleBulkGenerate('general')}
                    disabled={generatingBulk || !bulkGenForm.eventId}
                    className="group relative overflow-hidden rounded-2xl bg-secondary py-4 transition-all hover:bg-primary active:scale-95 disabled:opacity-50"
                  >
                    <div className="relative z-10 flex flex-col items-center gap-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-primary-foreground/70">Sector</span>
                      <span className="text-lg font-black text-foreground group-hover:text-primary-foreground">GENERAL</span>
                    </div>
                  </button>

                  <button
                    onClick={() => handleBulkGenerate('vip')}
                    disabled={generatingBulk || !bulkGenForm.eventId}
                    className="group relative overflow-hidden rounded-2xl bg-secondary py-4 transition-all hover:bg-warning active:scale-95 disabled:opacity-50"
                  >
                    <div className="relative z-10 flex flex-col items-center gap-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-warning-foreground/70">Sector</span>
                      <span className="text-lg font-black text-foreground group-hover:text-warning-foreground">VIP</span>
                    </div>
                  </button>
                </div>
                {generatingBulk && <div className="text-center text-xs text-primary mt-2 animate-pulse">Generando...</div>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {events?.map((ev) => (
                  <button 
                    key={ev.id} 
                    onClick={() => setSelectedEventStatsId(ev.id)}
                    className="glass-card p-4 text-left hover:border-primary/50 transition-all group"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">{ev.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {ev.date}
                        </p>
                      </div>
                      <span className="text-[10px] font-black uppercase px-2 py-1 bg-primary/10 text-primary rounded-lg">Ver Detalles</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <button 
                onClick={() => setSelectedEventStatsId(null)} 
                className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Volver a la lista
              </button>
              
              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-black text-foreground">
                  {events?.find(e => e.id === selectedEventStatsId)?.title}
                </h3>
                <p className="text-sm text-muted-foreground">Gestión y Estadísticas por Sector</p>
              </div>

              {/* Summary Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Control de Acceso Box */}
                <div className="glass-card overflow-hidden border-l-4 border-info">
                  <div className="w-full p-5 text-left">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-info/10 text-info">
                          <ScanLine className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-bold text-muted-foreground uppercase">Control de Acceso</span>
                      </div>
                      {(scanners?.length || 0) > 1 && (
                        <button 
                          onClick={() => setExpandedCardId(expandedCardId === 'access' ? null : 'access')}
                          className="text-[10px] font-bold text-primary hover:underline uppercase"
                        >
                          {expandedCardId === 'access' ? 'Ocultar' : 'Ver Detalle'}
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-success uppercase tracking-wider">Ingresaron</p>
                        <p className="text-2xl font-black text-foreground">
                          {reservations?.filter(r => r.event_id === selectedEventStatsId && r.status === 'used').length || 0}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-warning uppercase tracking-wider">No ingresaron</p>
                        <p className="text-2xl font-black text-foreground">
                          {reservations?.filter(r => r.event_id === selectedEventStatsId && r.status === 'active').length || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                  {expandedCardId === 'access' && (scanners?.length || 0) > 1 && (
                    <div className="bg-secondary/30 border-t border-border p-3 animate-in fade-in slide-in-from-top-1">
                      <div className="space-y-2">
                        {scanners?.map(s => {
                          const scannerUsed = reservations?.filter(r => r.event_id === selectedEventStatsId && r.status === 'used' && r.validated_by_scanner_id === s.id).length || 0;
                          return (
                            <div key={s.id} className="flex justify-between items-center p-2 bg-background rounded-lg border border-border/50">
                              <span className="text-[11px] font-bold text-foreground">{s.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-success">{scannerUsed}</span>
                                <span className="text-[9px] text-muted-foreground">check-ins</span>
                              </div>
                            </div>
                          );
                        })}
                        {/* Sin especificar / Otros */}
                        {(() => {
                          const others = reservations?.filter(r => r.event_id === selectedEventStatsId && r.status === 'used' && !r.validated_by_scanner_id).length || 0;
                          if (others > 0) return (
                            <div className="flex justify-between items-center p-2 bg-background/50 rounded-lg border border-dashed border-border/50">
                              <span className="text-[11px] font-medium text-muted-foreground italic">Otros / Manual</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-success">{others}</span>
                                <span className="text-[9px] text-muted-foreground">check-ins</span>
                              </div>
                            </div>
                          );
                          return null;
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Total Recaudación General Box */}
                <div className="glass-card p-6 bg-primary/5 border-l-4 border-primary">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-black text-primary uppercase tracking-wider">Recaudación Total</p>
                      <p className="text-3xl font-black text-foreground mt-1">
                        Bs. {reservations?.filter(r => r.event_id === selectedEventStatsId && (!r.rrpp_id || !adminMemberIds.includes(r.rrpp_id))).reduce((acc, r) => acc + (r.ticket_types?.price || 0), 0) || 0}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Tickets</p>
                      <p className="text-xl font-black text-foreground">
                        {reservations?.filter(r => r.event_id === selectedEventStatsId).length || 0}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Categorized Sections */}
              {(() => {
                const eventRes = reservations?.filter(r => r.event_id === selectedEventStatsId) || [];
                const eventAssignments = rrppAssignments?.filter(a => a.event_id === selectedEventStatsId) || [];
                
                const processData = (groupName: 'general' | 'vip') => {
                  const filtered = eventRes.filter(r => {
                    if (r.type === 'rrpp_free') {
                      if (r.rrpp_id) {
                        const assignment = eventAssignments.find(a => a.user_id === r.rrpp_id);
                        if (assignment) return (assignment.zone_type || 'general') === groupName;
                      }
                      return groupName === 'general';
                    }
                    
                    if (r.type === 'mesa_vip') {
                      const zoneId = r.zone_table_id?.split(':')[0];
                      const zone = zones?.find(z => z.id === zoneId);
                      return (zone?.category || 'general') === groupName;
                    }
                    
                    if (r.rrpp_id) {
                      const assignment = eventAssignments.find(a => a.user_id === r.rrpp_id);
                      if (assignment) return (assignment.zone_type || 'general') === groupName;
                    }
                    
                    // Door / Direct
                    return (r.ticket_types?.type === 'vip' ? 'vip' : 'general') === groupName;
                  });

                  const sources = {
                    'Admin': filtered.filter(r => r.rrpp_id && adminMemberIds.includes(r.rrpp_id) && r.type !== 'mesa_vip'),
                    'Free Pass': filtered.filter(r => r.type === 'rrpp_free'),
                    'Mesa': filtered.filter(r => r.type === 'mesa_vip'),
                    'RRPP': filtered.filter(r => r.rrpp_id && !adminMemberIds.includes(r.rrpp_id) && r.type !== 'rrpp_free' && r.type !== 'mesa_vip' && eventAssignments.some(a => a.user_id === r.rrpp_id)),
                    'Puerta': filtered.filter(r => !r.rrpp_id || (!adminMemberIds.includes(r.rrpp_id) && r.type !== 'rrpp_free' && r.type !== 'mesa_vip' && !eventAssignments.some(a => a.user_id === r.rrpp_id)))
                  };

                  return { filtered, sources };
                };

                const groups = [
                  { name: 'general', label: 'Sector General', data: processData('general'), color: 'primary' },
                  { name: 'vip', label: 'Sector VIP', data: processData('vip'), color: 'warning' }
                ];

                return (
                  <div className="space-y-10">
                    {groups.map(group => (
                      <div key={group.name} className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-1.5 rounded-full bg-${group.color}`}></div>
                          <h4 className="text-lg font-black text-foreground uppercase tracking-tight">{group.label}</h4>
                          <span className="text-xs font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-lg">
                            {group.data.filtered.length} Entradas
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          {Object.entries(group.data.sources).map(([source, resList]) => {
                            
                            let money = 0;
                            if (source === 'Mesa') {
                              const uniqueTableIds = new Set(resList.map(r => r.table_id || r.zone_table_id));
                              money = Array.from(uniqueTableIds).reduce((acc, tableId) => {
                                if (!tableId) return acc;
                                const zoneId = tableId.split(':')[0];
                                const zone = zones?.find(z => z.id === zoneId);
                                const tableData = (zone?.tables_data as ZoneTable[] || []).find((t: any) => t.id === tableId);
                                return acc + (tableData?.price || 0);
                              }, 0);
                            } else {
                              money = resList.reduce((acc, r) => acc + (r.ticket_types?.price || 0), 0);
                            }
                            
                            const cardId = `${group.name}-${source}`;
                            const isExpanded = expandedCardId === cardId;

                            return (
                              <div key={source} className={`glass-card overflow-hidden border-t-2 ${resList.length > 0 ? `border-${group.color}` : 'border-border opacity-60'}`}>
                                <button 
                                  onClick={() => setExpandedCardId(isExpanded ? null : cardId)}
                                  className="w-full p-4 text-left hover:bg-secondary/30 transition-all"
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{source}</span>
                                    {resList.length > 0 && <Info className="h-3 w-3 text-muted-foreground" />}
                                  </div>
                                  <div className="flex justify-between items-end">
                                    <p className="text-2xl font-black text-foreground">{resList.length}</p>
                                    {source !== 'Admin' && <p className={`text-xs font-bold text-${group.color}`}>Bs. {money}</p>}
                                    {source === 'Admin' && <p className="text-[10px] font-bold text-muted-foreground uppercase">Sin Costo</p>}
                                  </div>
                                </button>
                                
                                {isExpanded && resList.length > 0 && (
                                  <div className="bg-secondary/30 border-t border-border p-3 animate-in fade-in slide-in-from-top-1">
                                    <div className="max-h-40 overflow-y-auto space-y-1">
                                      {resList.map(r => (
                                        <div key={r.id} className="flex flex-col p-2 bg-background rounded-lg border border-border/50 text-[10px]">
                                          <div className="flex justify-between font-bold">
                                            <span className="truncate">{r.guest_name || 'Comprador'}</span>
                                            <span className="text-primary shrink-0">
                                              {source === 'Mesa' ? '' : `Bs. ${source === 'Admin' ? 0 : (r.ticket_types?.price || 0)}`}
                                            </span>
                                          </div>
                                          <div className="flex justify-between items-center text-muted-foreground mt-0.5">
                                            <div className="flex flex-col gap-0.5">
                                              <span>{r.ticket_types?.name}</span>
                                              <span className="font-mono text-[9px] text-primary bg-primary/10 px-1 py-0.5 rounded w-max">{r.code}</span>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                              <span className="italic">{r.rrpp?.name || (r.rrpp_id ? 'Puerta' : 'Directo')}</span>
                                              <button 
                                                onClick={() => setViewingQR({ code: r.code, name: r.guest_name || 'Comprador' })}
                                                className="flex items-center gap-1 text-[9px] font-bold text-primary hover:underline bg-primary/10 px-1.5 py-0.5 rounded-md"
                                              >
                                                <QrCode className="h-3 w-3" /> Ver QR
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}


      {tab === 'scanners' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-foreground">Gestión de Accesos (Escáneres)</h2>
            <button 
              onClick={() => setShowScannerForm(!showScannerForm)}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-glow transition-all"
            >
              <Plus className="h-4 w-4" /> Nuevo Escáner
            </button>
          </div>

          {showScannerForm && (
            <div className="glass-card p-5 space-y-4 border-2 border-primary/20 animate-in fade-in zoom-in-95 duration-200">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Nombre del Punto de Acceso</label>
                <input 
                  placeholder="Ej: Puerta Principal, Entrada VIP" 
                  value={scannerForm.name} 
                  onChange={(e) => setScannerForm({ ...scannerForm, name: e.target.value })} 
                  className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground outline-none ring-1 ring-border focus:ring-primary" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Restringir a categorías de entrada</label>
                <div className="flex flex-wrap gap-2">
                  {ticketCategories?.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        const types = scannerForm.allowed_types.includes(cat.name)
                          ? scannerForm.allowed_types.filter(t => t !== cat.name)
                          : [...scannerForm.allowed_types, cat.name];
                        setScannerForm({ ...scannerForm, allowed_types: types });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border ${
                        scannerForm.allowed_types.includes(cat.name) 
                          ? 'bg-primary text-primary-foreground border-primary shadow-glow' 
                          : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                  {ticketCategories?.length === 0 && <p className="text-xs text-muted-foreground italic">Primero crea categorías abajo.</p>}
                </div>
                <p className="text-[10px] text-muted-foreground italic">Si no eliges ninguna, el escáner validará todos los tipos.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowScannerForm(false)} className="flex-1 rounded-xl bg-secondary py-3 text-sm font-bold">Cancelar</button>
                <button 
                  onClick={handleSaveScanner} 
                  disabled={savingScanner || !scannerForm.name}
                  className="flex-[2] rounded-xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {savingScanner ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Guardar Escáner'}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scanners?.map(s => (
              <div key={s.id} className="glass-card p-4 flex justify-between items-start group">
                <div className="space-y-1">
                  <h3 className="font-bold text-foreground">{s.name}</h3>
                  <div className="flex flex-wrap gap-1">
                    {s.allowed_ticket_types && s.allowed_ticket_types.length > 0 ? (
                      s.allowed_ticket_types.map((t: string) => (
                        <span key={t} className="text-[8px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase">
                          {t.replace('_', ' ')}
                        </span>
                      ))
                    ) : (
                      <span className="text-[8px] font-black bg-success/10 text-success px-1.5 py-0.5 rounded uppercase">
                        Todos los tipos
                      </span>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => handleDeleteScanner(s.id)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {scanners?.length === 0 && (
              <div className="col-span-full py-10 text-center space-y-2 bg-secondary/20 rounded-2xl border border-dashed border-border">
                <ScanLine className="h-8 w-8 text-muted-foreground mx-auto opacity-20" />
                <p className="text-sm text-muted-foreground">No hay escáneres configurados.</p>
                <p className="text-xs text-muted-foreground/60">Crea uno para empezar a trackear accesos específicos.</p>
              </div>
            )}
          </div>

          {/* Master Categories Management */}
          <div className="pt-6 border-t border-border/50">
            <h3 className="text-sm font-bold text-foreground mb-4">Maestro de Categorías de Entrada</h3>
            <div className="glass-card p-4 space-y-4">
              <div className="flex gap-2">
                <input 
                  placeholder="Nueva categoría (ej: VIP GOLD)" 
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="flex-1 rounded-xl bg-secondary px-4 py-2 text-sm text-foreground outline-none ring-1 ring-border focus:ring-primary"
                />
                <button 
                  onClick={handleAddCategory}
                  disabled={savingCategory || !newCategoryName.trim()}
                  className="rounded-xl bg-secondary px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10 disabled:opacity-50"
                >
                  {savingCategory ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Añadir'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {ticketCategories?.map(cat => (
                  <div key={cat.id} className="flex items-center gap-1 bg-primary/5 border border-primary/10 rounded-lg pl-3 pr-1 py-1">
                    <span className="text-[10px] font-bold text-primary uppercase">{cat.name}</span>
                    <button onClick={() => handleDeleteCategory(cat.id)} className="p-1 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* QR Code Modal */}
      {viewingQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="glass-card w-full max-w-sm overflow-hidden border-2 border-primary/20 shadow-glow animate-in zoom-in-95 duration-200 relative">
            <button 
              onClick={() => setViewingQR(null)}
              className="absolute top-4 right-4 p-2 bg-secondary/80 rounded-full text-muted-foreground hover:text-foreground z-10"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="p-8 flex flex-col items-center justify-center text-center space-y-6">
              <h3 className="text-xl font-black text-foreground">{viewingQR.name}</h3>
              <div className="p-4 bg-white rounded-2xl shadow-xl w-64 h-64 flex items-center justify-center mx-auto">
                <QRCodeSVG
                  value={viewingQR.code}
                  size={220}
                  level="H"
                  includeMargin={false}
                  className="w-full h-full"
                />
              </div>
              <p className="font-mono text-xl tracking-[0.2em] font-black text-primary bg-primary/10 px-4 py-2 rounded-xl">
                {viewingQR.code}
              </p>
            </div>
            <div className="p-4 bg-secondary/50 flex justify-center">
              <button 
                onClick={() => setViewingQR(null)}
                className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-glow"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instant QR Generation Modal */}
      {bulkGeneratedTickets && bulkGeneratedTickets.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="glass-card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border-2 border-primary/20 shadow-glow animate-in zoom-in-95 duration-200 relative">
            <div className="p-6 border-b border-border flex items-center justify-between bg-secondary/50">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-success" />
                <h3 className="text-xl font-black text-foreground">¡{bulkGeneratedTickets.length} Entradas Generadas!</h3>
              </div>
              <button 
                onClick={() => setBulkGeneratedTickets(null)}
                className="p-2 bg-background rounded-full text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {bulkGeneratedTickets.map(r => {
                  const generatedEvent = events?.find(e => e.id === bulkGenForm.eventId);
                  const eventImageUrl = generatedEvent?.image_url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=2000&auto=format&fit=crop';
                  return (
                    <div key={r.id} className="export-ticket-card relative overflow-hidden rounded-2xl shadow-xl w-full max-w-sm mx-auto aspect-[3/4] flex flex-col justify-end group bg-black">
                      {/* Background Image */}
                      <img src={eventImageUrl} alt="Event Background" crossOrigin="anonymous" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
                      
                      {/* Content */}
                      <div className="relative z-10 p-6 flex flex-col items-center justify-end h-full space-y-5">
                        <div className="text-center w-full">
                          <h4 className="text-xl font-black text-white leading-tight drop-shadow-md">{generatedEvent?.title || 'EVENTO'}</h4>
                          <p className="text-sm font-bold text-primary mt-1">{r.guest_name}</p>
                        </div>
                        
                        <div className="p-3 bg-white rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.15)] w-44 h-44 flex items-center justify-center">
                          <QRCodeSVG value={r.code} size={150} level="H" includeMargin={false} className="w-full h-full" />
                        </div>
                        
                        <div className="w-full text-center space-y-1.5 pt-2">
                          <p className="font-mono text-sm tracking-[0.3em] font-black text-white/90 bg-white/10 py-2 rounded-xl backdrop-blur-md">
                            {r.code}
                          </p>
                          <p className="text-[11px] text-white/50 font-bold uppercase tracking-widest">
                            {r.type === 'mesa_vip' ? 'MESA' : (r.ticket_types?.name || 'ENTRADA')}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="p-4 border-t border-border bg-secondary/50 flex justify-end">
              <div className="flex gap-3 w-full sm:w-auto">
                <button 
                  onClick={handleShareTickets}
                  disabled={sharingTickets}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 rounded-xl bg-success py-3 text-sm font-bold text-success-foreground shadow-glow hover:bg-success/90 transition-all disabled:opacity-50"
                >
                  {sharingTickets ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                  {sharingTickets ? 'Generando...' : 'Compartir / Descargar QRs'}
                </button>
                <button 
                  onClick={() => setBulkGeneratedTickets(null)}
                  className="px-6 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-glow hover:bg-primary/90 transition-all"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </motion.div>
  );
}

