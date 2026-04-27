import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, CheckCircle2, XCircle, Info, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { OrganizationZone, ZoneTable } from '@/hooks/useSupabaseData';

interface Props {
  eventId: string;
  zone: OrganizationZone;
  asAdmin?: boolean;
}

export default function EventMapStatus({ eventId, zone, asAdmin = false }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTable, setSelectedTable] = useState<ZoneTable | null>(null);
  const [selling, setSelling] = useState(false);
  const [guestName, setGuestName] = useState('');

  // Fetch reservations for this specific zone/event
  const { data: reservations, isLoading } = useQuery({
    queryKey: ['table-reservations', eventId], // Key simplified to share cache
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('event_id', eventId)
        .not('table_id', 'is', null);
      if (error) throw error;
      return data || [];
    },
  });

  const isTableSold = (tableId: string) => {
    return reservations?.some(r => r.table_id === tableId && (r.status === 'active' || r.status === 'used'));
  };

  const handleSellTable = async () => {
    if (!selectedTable || !user) return;
    setSelling(true);
    try {
      // 1. Find ticket type
      let { data: ticketTypes } = await supabase
        .from('ticket_types')
        .select('*')
        .eq('event_id', eventId)
        .eq('type', 'mesa_vip')
        .limit(1);
      
      let ticketType = ticketTypes?.[0];

      if (!ticketType) {
        const { data: anyTickets } = await supabase
          .from('ticket_types')
          .select('*')
          .eq('event_id', eventId)
          .limit(1);
        ticketType = anyTickets?.[0];
      }

      if (!ticketType) {
        throw new Error('Este evento no tiene tipos de entrada configurados.');
      }

      // 2. Create a purchase request instead of immediate reservation
      const { error } = await supabase.from('purchase_requests' as any).insert({
        event_id: eventId,
        user_id: user.id,
        total_amount: selectedTable.price || 0,
        status: 'pending',
        ticket_types: [{
          ticket_type_id: ticketType.id,
          name: `${selectedTable.label} - Mesa`,
          price: selectedTable.price || 0,
          quantity: 1, // One table
          type: 'mesa_vip',
          zone_table_id: selectedTable.id
        }]
      });

      if (error) throw error;

      // 3. Create a placeholder reservation with 'pending' status to block the table on the map
      const { data: codeData } = await supabase.rpc('generate_ticket_code', { prefix: 'WAIT' });
      await supabase.from('reservations').insert({
        code: codeData || `P-${Date.now()}`,
        event_id: eventId,
        ticket_type_id: ticketType.id,
        user_id: user.id,
        guest_name: `${selectedTable.label} - ${guestName || 'Pendiente'}`,
        type: 'mesa_vip',
        quantity: selectedTable.tickets_included || 1,
        table_id: selectedTable.id,
        status: 'pending' // Important: pending status blocks it but doesn't activate it
      });

      toast.success(`Solicitud de mesa ${selectedTable.label} enviada. Espera la aprobación del pago.`);
      setSelectedTable(null);
      setGuestName('');
      queryClient.invalidateQueries({ queryKey: ['table-reservations'] });
    } catch (err: any) {
      toast.error(err.message || 'Error al solicitar mesa');
    }
    setSelling(false);
  };

  const [showPayment, setShowPayment] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const [qrDownloaded, setQrDownloaded] = useState(false);

  const handleRequestTable = async () => {
    if (!selectedTable || !user) return;
    setSelling(true);
    try {
      let { data: ticketTypes } = await supabase
        .from('ticket_types')
        .select('*')
        .eq('event_id', eventId)
        .eq('type', 'mesa_vip')
        .limit(1);
      
      let ticketType = ticketTypes?.[0];
      if (!ticketType) {
        const { data: anyTickets } = await supabase.from('ticket_types').select('*').eq('event_id', eventId).limit(1);
        ticketType = anyTickets?.[0];
      }

      if (!ticketType) throw new Error('No hay tipos de entrada configurados.');

      // Create purchase request
      const { error } = await supabase.from('purchase_requests' as any).insert({
        event_id: eventId,
        user_id: user.id,
        total_amount: selectedTable.price || 0,
        status: 'pending',
        ticket_types: [{
          ticket_type_id: ticketType.id,
          name: `${selectedTable.label} - Mesa`,
          price: selectedTable.price || 0,
          quantity: 1,
          type: 'mesa_vip',
          zone_table_id: selectedTable.id
        }]
      });

      if (error) throw error;

      // Create pending reservation to block table
      const { data: codeData } = await supabase.rpc('generate_ticket_code', { prefix: 'WAIT' });
      await supabase.from('reservations').insert({
        code: codeData || `P-${Date.now()}`,
        event_id: eventId,
        ticket_type_id: ticketType.id,
        user_id: user.id,
        guest_name: `${selectedTable.label} - ${guestName || 'Pendiente'}`,
        type: 'mesa_vip',
        quantity: selectedTable.tickets_included || 1,
        table_id: selectedTable.id,
        status: 'pending'
      });

      setPurchased(true);
      queryClient.invalidateQueries({ queryKey: ['table-reservations'] });
    } catch (err: any) {
      toast.error(err.message || 'Error al solicitar mesa');
    }
    setSelling(false);
  };

  if (purchased) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-6 space-y-4 text-center max-w-sm mx-auto">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-warning/20 text-warning mb-2">
          <Info className="h-6 w-6" />
        </div>
        <h3 className="text-xl font-bold text-foreground">¡Solicitud Enviada!</h3>
        <p className="text-sm text-muted-foreground">Tu solicitud de mesa está pendiente de verificación.</p>
        <div className="rounded-xl bg-secondary/50 p-4 border border-border">
           <p className="text-xs text-muted-foreground">Una vez validada la transferencia, recibirás tu ticket de mesa en el panel de "Mis Tickets".</p>
        </div>
        <button onClick={() => { setPurchased(false); setShowPayment(false); setSelectedTable(null); }} className="w-full text-sm font-semibold text-primary mt-4">
          Cerrar
        </button>
      </motion.div>
    );
  }

  if (showPayment) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-6 space-y-4 max-w-sm mx-auto">
        <h3 className="text-lg font-bold text-foreground text-center uppercase tracking-wider">Pago de Mesa</h3>
        <div className="bg-secondary/50 p-3 rounded-xl border border-border text-center">
          <p className="text-xs text-muted-foreground uppercase font-bold">Mesa Seleccionada</p>
          <p className="text-lg font-black text-foreground">{selectedTable?.label}</p>
          <p className="text-primary font-bold text-xl">Bs. {selectedTable?.price}</p>
        </div>
        
        <p className="text-xs text-muted-foreground text-center">Escanea el QR para realizar la transferencia bancaria:</p>
        
        <div className="flex justify-center my-2">
           <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=PagoMesa+EventSphere" alt="QR de Pago" className="rounded-xl ring-2 ring-primary max-w-[180px]" />
        </div>
        
        <button 
           onClick={async () => {
             const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=PagoMesa+EventSphere";
             try {
               const response = await fetch(qrUrl);
               const blob = await response.blob();
               const url = window.URL.createObjectURL(blob);
               const link = document.createElement('a');
               link.href = url;
               link.download = 'QR_Pago_Banco.png';
               document.body.appendChild(link);
               link.click();
               document.body.removeChild(link);
               window.URL.revokeObjectURL(url);
               setQrDownloaded(true);
             } catch (err) {
               window.open(qrUrl, '_blank');
               setQrDownloaded(true);
             }
           }}
           className="w-full rounded-xl bg-secondary py-3 text-xs font-bold text-foreground border border-border hover:bg-secondary/80 transition-all"
        >
          1. Descargar QR
        </button>

        <button 
           onClick={handleRequestTable}
           disabled={selling || !qrDownloaded}
           className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-40 transition-all"
        >
          {selling ? 'Enviando...' : '2. Ya realicé el Pago'}
        </button>
        
        <button onClick={() => setShowPayment(false)} className="w-full text-xs text-muted-foreground font-medium hover:text-foreground">
          Volver atrás
        </button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Info & Action Panel */}
        <div className="md:col-span-1 space-y-4">
          <div className="glass-card p-4 space-y-3">
            <h4 className="font-bold text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" /> Leyenda
            </h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <div className="h-3 w-3 rounded-full bg-success border border-success/50" /> Disponible
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <div className="h-3 w-3 rounded-full bg-destructive border border-destructive/50" /> Vendida
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <div className="h-3 w-3 rounded-full bg-warning border border-warning/50" /> Seleccionada
              </div>
            </div>
          </div>

          {selectedTable && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-5 space-y-4 ring-2 ring-primary/20 shadow-glow border-primary/20"
            >
              <div>
                <p className="text-[10px] font-black text-primary uppercase tracking-widest">Mesa Seleccionada</p>
                <h4 className="text-2xl font-black text-foreground">{selectedTable.label}</h4>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-lg font-black text-foreground">Bs. {selectedTable.price || 0}</p>
                  <span className="text-[10px] bg-secondary px-2 py-1 rounded-lg font-bold text-muted-foreground">
                    {selectedTable.tickets_included || 0} Entradas
                  </span>
                </div>
              </div>

              {!isTableSold(selectedTable.id) ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Nombre para el Ticket</label>
                    <input 
                      placeholder="Tu nombre completo" 
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="w-full rounded-xl bg-secondary px-4 py-3 text-sm outline-none ring-1 ring-border focus:ring-primary text-foreground"
                    />
                  </div>
                  <button 
                    onClick={() => setShowPayment(true)}
                    className="w-full rounded-xl bg-primary py-3.5 text-sm font-black text-primary-foreground hover:shadow-glow transition-all active:scale-[0.98] flex items-center justify-center gap-2 uppercase tracking-tight"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Reservar Mesa
                  </button>
                </div>
              ) : (
                <div className="rounded-xl bg-destructive/10 p-4 flex flex-col items-center gap-2 text-destructive border border-destructive/20">
                  <XCircle className="h-6 w-6" />
                  <span className="text-xs font-black uppercase tracking-tighter">Esta mesa ya no está disponible</span>
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Map Container */}
        <div className="md:col-span-3 glass-card p-2 overflow-hidden bg-black/40 backdrop-blur-md relative rounded-[2rem] border-2 border-white/5 shadow-2xl">
          <div className="relative inline-block w-full h-full">
            <img 
              src={zone.image_url} 
              alt={zone.name} 
              className="w-full h-auto block rounded-2xl opacity-90 brightness-75"
              draggable={false}
            />
            
            {(zone.tables_data as ZoneTable[] || []).map(table => {
              const sold = isTableSold(table.id);
              const selected = selectedTable?.id === table.id;
              
              return (
                <button
                  key={table.id}
                  onClick={() => setSelectedTable(table)}
                  className={`absolute flex items-center justify-center transition-all duration-500 border-2 shadow-2xl overflow-hidden group/btn ${
                    selected 
                      ? 'bg-warning border-white text-warning-foreground scale-125 z-10 shadow-warning/50 ring-4 ring-warning/30' 
                      : sold 
                        ? 'bg-destructive/60 border-destructive/40 text-white cursor-not-allowed opacity-60' 
                        : 'bg-success/60 border-white/20 text-white hover:scale-110 hover:bg-success hover:border-white hover:z-10 shadow-success/30'
                  }`}
                  style={{
                    left: `calc(${table.x}% - ${table.radius}%)`,
                    top: `calc(${table.y}% - ${table.radius}%)`,
                    width: `${table.radius * 2}%`,
                    aspectRatio: '1/1',
                    borderRadius: '50%',
                  }}
                >
                  <div className="flex flex-col items-center justify-center gap-0">
                    <span className="text-[7px] md:text-[11px] font-black truncate px-0.5 uppercase tracking-tighter drop-shadow-md">
                      {table.label}
                    </span>
                    {!sold && !selected && (
                      <span className="text-[5px] md:text-[8px] font-bold opacity-0 group-hover/btn:opacity-100 transition-opacity drop-shadow-md">
                        Bs.{table.price}
                      </span>
                    )}
                    {sold && <XCircle className="h-2 w-2 md:h-4 md:w-4" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
