import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, CheckCircle2, XCircle, Info, Loader2, Plus, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { OrganizationZone, ZoneTable } from '@/hooks/useSupabaseData';
import pagoqr from '@/assets/pagoqr.jpeg';

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
  const [qtyToBuy, setQtyToBuy] = useState(1);

  useEffect(() => {
    setQtyToBuy(1);
    setGuestName('');
  }, [selectedTable]);

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

  const getTableReservationStats = (tableId: string, limit: number) => {
    const tableRes = reservations?.filter(
      r => r.table_id === tableId && (r.status === 'active' || r.status === 'used' || r.status === 'pending')
    ) || [];
    const totalSold = tableRes.reduce((sum, r) => sum + (r.quantity || 0), 0);
    return {
      sold: totalSold,
      available: Math.max(0, limit - totalSold),
    };
  };

  const isTableSold = (table: ZoneTable) => {
    if (table.is_shared) {
      const stats = getTableReservationStats(table.id, table.tickets_included || 1);
      return stats.available <= 0;
    }
    return reservations?.some(r => r.table_id === table.id && (r.status === 'active' || r.status === 'used' || r.status === 'pending'));
  };


  const [showPayment, setShowPayment] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const [qrDownloaded, setQrDownloaded] = useState(false);

  const handleRequestTable = async () => {
    if (!selectedTable || !user) return;
    setSelling(true);
    try {
      // 1. Find or create ticket type matching the zone category
      const categoryName = zone.category || 'Mesa';
      let { data: ticketTypesByCat } = await supabase
        .from('ticket_types')
        .select('*')
        .eq('event_id', eventId)
        .ilike('name', categoryName)
        .limit(1);
        
      let ticketType = ticketTypesByCat?.[0];
      
      if (!ticketType) {
        // Automatically create the ticket type
        const { data: newType, error: createError } = await supabase
          .from('ticket_types')
          .insert({
            event_id: eventId,
            name: categoryName,
            type: 'mesa_vip',
            price: selectedTable.price || 0,
            quantity: 100, // Stock suitable for tables
            only_admin: true // Hide from public list
          })
          .select()
          .single();
          
        if (createError) throw createError;
        ticketType = newType;
      }

      const limit = selectedTable.tickets_included || 1;
      const unitPrice = selectedTable.is_shared ? ((selectedTable.price || 0) / limit) : (selectedTable.price || 0);
      const totalPrice = selectedTable.is_shared ? unitPrice * qtyToBuy : (selectedTable.price || 0);
      const qty = selectedTable.is_shared ? qtyToBuy : 1;
      const resQty = selectedTable.is_shared ? qtyToBuy : limit;
      const guestNameForRes = `${selectedTable.label} - ${guestName || 'Pendiente'}${selectedTable.is_shared ? ` (${qtyToBuy} ent.)` : ''}`;

      // Create purchase request
      const { error } = await supabase.from('purchase_requests' as any).insert({
        event_id: eventId,
        user_id: user.id,
        total_amount: totalPrice,
        status: 'pending',
        ticket_types: [{
          ticket_type_id: ticketType.id,
          name: `${selectedTable.label} - Mesa${selectedTable.is_shared ? ' (Compartida)' : ''}`,
          price: unitPrice,
          quantity: qty,
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
        guest_name: guestNameForRes,
        type: 'mesa_vip',
        quantity: resQty,
        table_id: selectedTable.id,
        zone_table_id: selectedTable.id, // Write both!
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
    const limit = selectedTable?.tickets_included || 1;
    const unitPrice = selectedTable?.is_shared ? ((selectedTable.price || 0) / limit) : (selectedTable?.price || 0);
    const totalPrice = selectedTable?.is_shared ? unitPrice * qtyToBuy : (selectedTable?.price || 0);

    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-6 space-y-4 max-w-sm mx-auto">
        <h3 className="text-lg font-bold text-foreground text-center uppercase tracking-wider">Pago de Mesa</h3>
        <div className="bg-secondary/50 p-3 rounded-xl border border-border text-center">
          <p className="text-xs text-muted-foreground uppercase font-bold">Mesa Seleccionada</p>
          <p className="text-lg font-black text-foreground">{selectedTable?.label} {selectedTable?.is_shared ? '(Compartida)' : ''}</p>
          <p className="text-primary font-bold text-xl">Bs. {totalPrice.toFixed(2)}</p>
          {selectedTable?.is_shared && (
            <p className="text-xs text-muted-foreground mt-1">
              {qtyToBuy} {qtyToBuy === 1 ? 'entrada' : 'entradas'} de esta mesa
            </p>
          )}
        </div>
        
        <p className="text-xs text-muted-foreground text-center">Escanea el QR para realizar la transferencia bancaria:</p>
        
        <div className="flex justify-center my-2">
           <img src={pagoqr} alt="QR de Pago" className="rounded-xl ring-2 ring-primary max-w-[180px]" />
        </div>
        
        <button 
           onClick={async () => {
             const qrUrl = pagoqr;
             try {
               const response = await fetch(qrUrl);
               const blob = await response.blob();
               const url = window.URL.createObjectURL(blob);
               const link = document.createElement('a');
               link.href = url;
               link.download = 'QR_Pago_Banco.jpeg';
               document.body.appendChild(link);
               link.click();
               document.body.removeChild(link);
               window.URL.revokeObjectURL(url);
               setQrDownloaded(true);
             } catch (err) {
               const link = document.createElement('a');
               link.href = qrUrl;
               link.download = 'QR_Pago_Banco.jpeg';
               document.body.appendChild(link);
               link.click();
               document.body.removeChild(link);
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

          {selectedTable && (() => {
            const limit = selectedTable.tickets_included || 1;
            const stats = getTableReservationStats(selectedTable.id, limit);
            const unitPrice = selectedTable.is_shared ? ((selectedTable.price || 0) / limit) : (selectedTable.price || 0);
            const totalPrice = selectedTable.is_shared ? unitPrice * qtyToBuy : (selectedTable.price || 0);
            const sold = isTableSold(selectedTable);

            return (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-5 space-y-4 ring-2 ring-primary/20 shadow-glow border-primary/20"
              >
                <div>
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center justify-between">
                    <span>Mesa Seleccionada</span>
                    {selectedTable.is_shared && <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded font-black text-[8px]">COMPARTIDA</span>}
                  </p>
                  <h4 className="text-2xl font-black text-foreground">{selectedTable.label}</h4>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-lg font-black text-foreground">
                      Bs. {totalPrice.toFixed(2)}
                    </p>
                    <span className="text-[10px] bg-secondary px-2 py-1 rounded-lg font-bold text-muted-foreground">
                      {selectedTable.is_shared 
                        ? `${stats.available} de ${limit} disp.`
                        : `${limit} Entradas`
                      }
                    </span>
                  </div>
                  {selectedTable.is_shared && (
                    <p className="text-[10px] text-muted-foreground mt-1 font-medium">
                      Precio individual: Bs. {unitPrice.toFixed(2)} por entrada
                    </p>
                  )}
                </div>

                {!sold ? (
                  <div className="space-y-3">
                    {selectedTable.is_shared && (
                      <div className="space-y-1 bg-secondary/30 p-2.5 rounded-xl border border-border/40">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1 block">
                          Entradas a comprar / vender
                        </label>
                        <div className="flex items-center justify-between mt-1 px-1">
                          <button 
                            type="button"
                            onClick={() => setQtyToBuy(prev => Math.max(1, prev - 1))}
                            disabled={qtyToBuy <= 1}
                            className="h-8 w-8 rounded-lg bg-secondary text-foreground hover:bg-card-hover disabled:opacity-30 flex items-center justify-center transition-colors"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="text-base font-bold text-foreground">{qtyToBuy}</span>
                          <button 
                            type="button"
                            onClick={() => setQtyToBuy(prev => Math.min(stats.available, prev + 1))}
                            disabled={qtyToBuy >= stats.available}
                            className="h-8 w-8 rounded-lg bg-primary text-primary-foreground disabled:opacity-30 flex items-center justify-center transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
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
                      {selectedTable.is_shared ? 'Reservar Entrada(s)' : 'Reservar Mesa'}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl bg-destructive/10 p-4 flex flex-col items-center gap-2 text-destructive border border-destructive/20">
                    <XCircle className="h-6 w-6" />
                    <span className="text-xs font-black uppercase tracking-tighter">Esta mesa ya no está disponible</span>
                  </div>
                )}
              </motion.div>
            );
          })()}
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
              const sold = isTableSold(table);
              const selected = selectedTable?.id === table.id;
              const stats = table.is_shared ? getTableReservationStats(table.id, table.tickets_included || 1) : null;
              
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
                    {table.is_shared && stats && (
                      <span className="text-[5px] md:text-[8px] font-bold text-white/95 tracking-tighter drop-shadow-md">
                        {stats.sold}/{table.tickets_included || 1}
                      </span>
                    )}
                    {!sold && !selected && !table.is_shared && (
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
