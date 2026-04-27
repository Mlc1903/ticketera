import { useState } from 'react';
import { Users, BarChart3, Ticket, UserCheck, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import PRGuestForm from '@/components/PRGuestForm';
import TicketSelector from '@/components/TicketSelector';
import TeamManager from '@/components/TeamManager';
import EventMapStatus from '@/components/EventMapStatus';
import { useEvents, useReservations, useRRPPAssignments, useRRPPEvents, useZones } from '@/hooks/useSupabaseData';

export default function RRPPDashboard() {
  const { user } = useAuth();
  const { data: assignedEvents, isLoading: loadingEvents } = useRRPPEvents(user?.id);
  const [activeIdx, setActiveIdx] = useState(0);
  const [rrppTab, setRrppTab] = useState<'guest'|'sell'|'team'|'maps'>('guest');
  const activeEvent = assignedEvents?.[activeIdx];

  const { data: assignments, isLoading: loadingAssignments } = useRRPPAssignments(user?.id);
  const { data: zones } = useZones(activeEvent?.organization_id);
  const isTL = assignments?.find(a => a.organization_id === activeEvent?.organization_id)?.is_team_leader;

  const visibleZones = zones?.filter(z => {
    if (z.visibility === 'all') return true;
    if (z.visibility === 'rrpp_only') return true;
    if (z.visibility === 'rrpp_tl_only' && isTL) return true;
    return false;
  });

  const { data: rrppReservations } = useReservations({
    eventId: activeEvent?.id,
    rrppId: user?.id,
  });

  const isLoading = loadingAssignments || loadingEvents;

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!assignments?.length) {
    return (
      <div className="text-center py-20 space-y-3">
        <Users className="h-12 w-12 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">No eres RRPP de ninguna discoteca todavía.</p>
        <p className="text-xs text-muted-foreground">Pide al administrador de una discoteca que te asigne.</p>
      </div>
    );
  }

  if (!assignedEvents?.length) {
    return (
      <div className="text-center py-20 space-y-3">
        <Users className="h-12 w-12 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">No hay eventos activos en tus discotecas.</p>
      </div>
    );
  }

  const stats = {
    invitados: rrppReservations?.filter((r: any) => r.type === 'rrpp_free').length || 0,
    vendidas: rrppReservations?.filter((r: any) => r.type === 'rrpp_paid').length || 0,
    mesas: rrppReservations?.filter((r: any) => r.type === 'mesa_vip').length || 0,
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-primary font-semibold mb-1"><Users className="h-4 w-4" />Panel RRPP</div>
          <h1 className="text-2xl font-black text-foreground">Mi Panel</h1>
        </div>
        {activeEvent && (
          <div className="text-right">
            {assignments?.find(a => a.organization_id === activeEvent.organization_id)?.zone_type && (
              <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border ${
                assignments.find(a => a.organization_id === activeEvent.organization_id)?.zone_type === 'vip' 
                ? 'bg-warning/20 text-warning border-warning/30' 
                : 'bg-primary/20 text-primary border-primary/30'
              }`}>
                Rango: {assignments.find(a => a.organization_id === activeEvent.organization_id)?.zone_type}
              </span>
            )}
          </div>
        )}
      </div>

      {assignedEvents.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {assignedEvents.map((ev: any, i: number) => (
            <button key={ev.id} onClick={() => setActiveIdx(i)} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all touch-target ${activeIdx === i ? 'bg-primary text-primary-foreground shadow-glow' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              {ev.title} {ev.organizations?.name ? `- ${ev.organizations.name}` : ''}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Invitados', value: stats.invitados, icon: UserCheck, color: 'text-success' },
          { label: 'Vendidas', value: stats.vendidas, icon: Ticket, color: 'text-primary' },
          { label: 'Mesas', value: stats.mesas, icon: BarChart3, color: 'text-warning' },
        ].map((s) => (
          <div key={s.label} className="glass-card p-3 text-center">
            <s.icon className={`h-5 w-5 mx-auto ${s.color}`} />
            <p className="text-xl font-bold text-foreground mt-1">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {activeEvent && (
        <div className="flex gap-2 bg-secondary p-1 rounded-xl w-max mx-auto my-4 transition-all overflow-hidden items-center justify-center">
          <button onClick={() => setRrppTab('guest')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${rrppTab === 'guest' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            Generar Pase
          </button>
          <button onClick={() => setRrppTab('sell')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${rrppTab === 'sell' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            Vender Entradas
          </button>
          {visibleZones && visibleZones.length > 0 && (
            <button onClick={() => setRrppTab('maps')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${rrppTab === 'maps' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              Mesas
            </button>
          )}
          {isTL && (
            <button onClick={() => setRrppTab('team')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${rrppTab === 'team' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              Mi Equipo
            </button>
          )}
        </div>
      )}

      {activeEvent && rrppTab === 'guest' && <PRGuestForm eventId={activeEvent.id} eventTitle={activeEvent.title} allowGuests={activeEvent.allow_rrpp_guests} />}
      {activeEvent && rrppTab === 'sell' && <TicketSelector eventId={activeEvent.id} eventTitle={activeEvent.title} ticketTypes={activeEvent.ticket_types || []} asRRPP={true} />}
      {activeEvent && rrppTab === 'team' && isTL && <TeamManager organizationId={activeEvent.organization_id!} />}
      {activeEvent && rrppTab === 'maps' && visibleZones && (
        <div className="space-y-6">
          {visibleZones.map(zone => (
            <div key={zone.id} className="space-y-2">
              <h3 className="text-lg font-bold text-foreground px-1">{zone.name}</h3>
              <EventMapStatus eventId={activeEvent.id} zone={zone} />
            </div>
          ))}
        </div>
      )}

      {rrppReservations && rrppReservations.length > 0 && (
        <div className="glass-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Lista de Invitados</h3>
          <div className="space-y-2">
            {rrppReservations.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl bg-secondary p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{r.guest_name || 'Sin nombre'}</p>
                  <p className="text-xs text-muted-foreground font-mono">{r.code}</p>
                </div>
                <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                  r.status === 'used' ? 'bg-success/15 text-success' : r.status === 'active' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  {r.status === 'used' ? 'Ingresó' : r.status === 'active' ? 'Activo' : r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
