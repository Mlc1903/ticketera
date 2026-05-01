import { useState } from 'react';
import { Minus, Plus, ShoppingCart, LogIn, Download, Info, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import type { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { MapPin } from 'lucide-react';
import { useEvent } from '@/hooks/useSupabaseData';
import InteractiveMapSelector from './InteractiveMapSelector';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  ticketTypes: Tables<'ticket_types'>[];
  eventId: string;
  eventTitle: string;
  asRRPP?: boolean;
}

export default function TicketSelector({ ticketTypes, eventId, eventTitle, asRRPP }: Props) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [showPayment, setShowPayment] = useState(false);
  const [qrDownloaded, setQrDownloaded] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const [codes, setCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [selectedTable, setSelectedTable] = useState<{ id: string, zoneName: string, label: string } | null>(null);
  const [successMessage, setSuccessMessage] = useState<{ title: string, body: string } | null>(null);
  
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: eventData } = useEvent(eventId);

  const updateQty = (id: string, type: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[id] || 0;
      const maxAllowed = type === 'rrpp_free' ? 1 : 10;
      const next = Math.max(0, Math.min(maxAllowed, current + delta));
      return { ...prev, [id]: next };
    });
  };

  const total = ticketTypes.reduce((sum, tt) => sum + (quantities[tt.id] || 0) * tt.price, 0);
  const totalQty = Object.values(quantities).reduce((s, q) => s + q, 0);

  const hasFreePass = ticketTypes.some(tt => tt.type === 'rrpp_free' && (quantities[tt.id] || 0) > 0);
  const hasPaidTicket = ticketTypes.some(tt => tt.type !== 'rrpp_free' && (quantities[tt.id] || 0) > 0);

  const handleRequestPurchase = async () => {
    if (!user) return;
    setLoading(true);

    const isAutomatedFreePassActive = eventData?.organizations?.automated_free_pass;
    const typesToRequest = ticketTypes
      .filter(tt => quantities[tt.id] > 0)
      .map(tt => ({
        ticket_type_id: tt.id,
        quantity: quantities[tt.id],
        price: tt.price,
        name: tt.name,
        type: tt.type
      }));

    if (typesToRequest.length === 0) {
      setLoading(false);
      return;
    }

    try {
      // 1. Handle Automated Free Pass for Public Users
      if (isAutomatedFreePassActive && !asRRPP) {
        const freePassType = typesToRequest.find(t => t.type === 'rrpp_free');
        if (freePassType) {
          // Check if user already has a free pass for this event
          const { count } = await supabase
            .from('reservations')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', eventId)
            .eq('user_id', user.id)
            .eq('type', 'rrpp_free');

          if ((count || 0) > 0) {
            toast.error("Ya tienes una entrada Free Pass para este evento.");
            setLoading(false);
            return;
          }

          if (freePassType.quantity > 1) {
            toast.error("Solo puedes generar una entrada Free Pass por cuenta.");
            setLoading(false);
            return;
          }

          // Generate the free pass immediately
          const { data: codeData } = await supabase.rpc('generate_ticket_code', { 
            prefix: eventTitle.substring(0, 3).toUpperCase().replace(/\s/g, '') 
          });
          const code = codeData || `FREE-${Date.now()}`;

          const { error: freeErr } = await supabase.from('reservations').insert({
            code,
            event_id: eventId,
            ticket_type_id: freePassType.ticket_type_id,
            user_id: user.id,
            type: 'rrpp_free',
            quantity: 1,
            status: 'active'
          });

          if (freeErr) throw freeErr;
          
          // Remove from typesToRequest
          const index = typesToRequest.findIndex(t => t.type === 'rrpp_free');
          typesToRequest.splice(index, 1);
          
          if (typesToRequest.length === 0) {
            setSuccessMessage({
              title: "¡Free Pass Generado!",
              body: "Tu entrada de cortesía ya está activa. Puedes encontrarla en la sección 'Mis Tickets'."
            });
            setPurchased(true);
            setLoading(false);
            return;
          }
        }
      }

      // 2. Normal Request flow for remaining tickets
      const { error } = await supabase.from('purchase_requests' as any).insert({
        event_id: eventId,
        user_id: user.id,
        rrpp_id: asRRPP ? user.id : null,
        ticket_types: typesToRequest.map(tt => ({
          ...tt,
          zone_table_id: tt.type === 'mesa_vip' && selectedTable ? selectedTable.id : null
        })),
        total_amount: typesToRequest.reduce((acc, t) => acc + (t.price * t.quantity), 0)
      });

      if (error) throw error;
      
      setSuccessMessage({
        title: "¡Solicitud en Proceso!",
        body: "Hemos recibido tu solicitud de pago. Una vez que validemos la transferencia, las entradas aparecerán en tu panel."
      });
      setPurchased(true); 
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success(`Solicitud enviada correctamente`);
    } catch (err: any) {
      toast.error(err.message || 'Error al solicitar');
    }
    setLoading(false);
  };

  if (purchased) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-6 space-y-4 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-success/20 text-success mb-2">
          <CheckCircle className="h-6 w-6" />
        </div>
        <h3 className="text-xl font-bold text-foreground">{successMessage?.title || '¡Listo!'}</h3>
        <p className="text-sm text-muted-foreground mt-1">{successMessage?.body}</p>
        <div className="pt-4">
          <Link to="/mis-tickets" className="block w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-glow transition-all active:scale-[0.98]">
            Ver mis Tickets
          </Link>
        </div>
        <button onClick={() => { setPurchased(false); setShowPayment(false); setQrDownloaded(false); setQuantities({}); setSuccessMessage(null); }} className="w-full text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mt-2">
          Volver al Evento
        </button>
      </motion.div>
    );
  }

  if (showPayment && !purchased) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-6 space-y-4">
        <h3 className="text-lg font-bold text-foreground text-center">Realiza el Pago</h3>
        <p className="text-sm text-muted-foreground text-center">Escanea u obtén el Código QR a continuación para abonar *Bs. {total}*</p>
        <div className="flex justify-center my-4 relative">
           <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=PagoEstandar+Ticket" alt="QR de Pago" className="rounded-xl ring-2 ring-primary max-w-[200px]" />
        </div>
        
        <button 
           onClick={async () => {
             const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=PagoEstandar+Ticket";
             try {
               const response = await fetch(qrUrl);
               const blob = await response.blob();
               const blobUrl = URL.createObjectURL(blob);
               const link = document.createElement('a');
               link.href = blobUrl;
               link.download = 'QR_Pago_Banco.png';
               document.body.appendChild(link);
               link.click();
               document.body.removeChild(link);
               URL.revokeObjectURL(blobUrl);
               setQrDownloaded(true);
             } catch (err) {
               // Failsafe por si hay bloqueo CORS
               const link = document.createElement('a');
               link.href = qrUrl;
               link.target = "_blank";
               link.download = 'QR_Pago_Banco.png';
               document.body.appendChild(link);
               link.click();
               document.body.removeChild(link);
               setQrDownloaded(true);
             }
           }}
           className="w-full rounded-xl bg-secondary py-3 text-sm font-semibold text-foreground transition-all hover:bg-secondary/80 flex justify-center items-center gap-2 border border-border"
        >
          <Download className="h-4 w-4" /> 1. Descargar QR
        </button>

        <button 
           onClick={handleRequestPurchase}
           disabled={loading || !qrDownloaded}
           className="w-full touch-target rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:shadow-glow active:scale-[0.98] disabled:opacity-40"
        >
          {loading ? 'Enviando...' : '2. Verificar Pago'}
        </button>
      </motion.div>
    );
  }

  return (
    <div className="glass-card p-4 space-y-4">
      <h3 className="text-base font-semibold text-foreground">Selecciona tus entradas</h3>
      <div className="space-y-3">
        {ticketTypes.map((tt) => {
          const available = tt.quantity - tt.sold;
          const qty = quantities[tt.id] || 0;
          const soldOut = available <= 0;
          const isConflictDisabled = (tt.type !== 'rrpp_free' && hasFreePass) || (tt.type === 'rrpp_free' && hasPaidTicket);
          return (
            <div key={tt.id} className={`flex items-center justify-between rounded-xl bg-secondary p-3 ${(soldOut || isConflictDisabled) ? 'opacity-50' : ''}`}>
              <div>
                <p className="font-medium text-foreground text-sm">{tt.name}</p>
                <p className="text-xs text-muted-foreground">Bs. {tt.price} · {available} disponibles</p>
                {tt.type === 'rrpp_free' && eventData?.free_pass_until && (
                  <p className="text-[10px] text-primary font-semibold mt-0.5">
                    Ingreso válido hasta las {eventData.free_pass_until.substring(0, 5)} hrs
                  </p>
                )}
              </div>
              {soldOut ? (
                <span className="text-xs font-medium text-destructive">Agotado</span>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(tt.id, tt.type, -1)} disabled={qty === 0} className="touch-target flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground disabled:opacity-30 transition-colors hover:bg-card-hover">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold text-foreground">{qty}</span>
                  <button onClick={() => updateQty(tt.id, tt.type, 1)} disabled={qty >= available || (tt.type === 'rrpp_free' && qty >= 1) || isConflictDisabled} className="touch-target flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-30 transition-colors">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Map selector for VIP Tables if selected */}
      {ticketTypes.some(tt => tt.type === 'mesa_vip' && (quantities[tt.id] || 0) > 0) && eventData?.organization_id && (
        <div className="mt-4 p-4 rounded-xl border border-warning bg-warning/5 space-y-3">
           <h4 className="font-semibold text-warning text-sm flex items-center gap-2">
             <MapPin className="h-4 w-4" /> Selección de Mesa VIP requerida
           </h4>
           {selectedTable ? (
             <div className="flex items-center justify-between bg-background p-3 rounded-xl border border-border">
               <div>
                 <p className="text-sm font-semibold">{selectedTable.label}</p>
                 <p className="text-xs text-muted-foreground">{selectedTable.zoneName}</p>
               </div>
               <button onClick={() => setShowMap(true)} className="text-xs text-primary font-medium hover:underline">
                 Cambiar
               </button>
             </div>
           ) : (
             <button onClick={() => setShowMap(true)} className="w-full rounded-xl bg-warning text-warning-foreground py-2 text-sm font-semibold transition-all hover:bg-warning/90">
               Elegir Mesa
             </button>
           )}

           {showMap && (
             <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex justify-center pb-20 items-center overflow-y-auto w-full">
               <div className="w-full max-w-2xl bg-card rounded-2xl shadow-xl border border-border p-4 mx-4">
                 <div className="flex justify-between items-center mb-4">
                   <h3 className="font-bold">Mesas</h3>
                   <button onClick={() => setShowMap(false)} className="text-muted-foreground hover:text-foreground text-sm font-semibold">Cerrar</button>
                 </div>
                 <InteractiveMapSelector 
                   organizationId={eventData.organization_id} 
                   eventId={eventId} 
                   selectedTableId={selectedTable?.id || null} 
                   onSelectTable={(id, zone, label) => id ? setSelectedTable({ id, zoneName: zone, label }) : setSelectedTable(null)} 
                 />
                 <div className="mt-4 flex justify-end">
                   <button onClick={() => setShowMap(false)} disabled={!selectedTable} className="rounded-xl bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40 hover:shadow-glow">
                     Confirmar Mesa
                   </button>
                 </div>
               </div>
             </div>
           )}
        </div>
      )}

      {totalQty > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{totalQty} entrada(s)</span>
            <span className="text-lg font-bold text-foreground">Bs. {total}</span>
          </div>
          {user ? (
            <button
              onClick={() => {
                const isAutomatedFreePassActive = eventData?.organizations?.automated_free_pass;
                if (isAutomatedFreePassActive && !asRRPP && total === 0 && totalQty === 1) {
                  handleRequestPurchase();
                } else {
                  setShowPayment(true);
                }
              }}
              disabled={loading || (ticketTypes.some(tt => tt.type === 'mesa_vip' && (quantities[tt.id] || 0) > 0) && !selectedTable)}
              className="w-full touch-target rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:shadow-glow active:scale-[0.98] disabled:opacity-40"
            >
              {asRRPP ? 'Registrar Venta de Entradas' : 'Reservar Entradas'}
            </button>
          ) : (
            <Link
              to="/login"
              className="w-full touch-target rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:shadow-glow flex items-center justify-center gap-2"
            >
              <LogIn className="h-4 w-4" />
              Inicia sesión para comprar
            </Link>
          )}
        </motion.div>
      )}
    </div>
  );
}
