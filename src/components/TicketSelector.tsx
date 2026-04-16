import { useState } from 'react';
import { Minus, Plus, ShoppingCart, LogIn, Download, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import type { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';
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
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const updateQty = (id: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, Math.min(10, current + delta));
      return { ...prev, [id]: next };
    });
  };

  const total = ticketTypes.reduce((sum, tt) => sum + (quantities[tt.id] || 0) * tt.price, 0);
  const totalQty = Object.values(quantities).reduce((s, q) => s + q, 0);

  const handleRequestPurchase = async () => {
    if (!user) return;
    setLoading(true);

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
      const { error } = await supabase.from('purchase_requests' as any).insert({
        event_id: eventId,
        user_id: user.id,
        rrpp_id: asRRPP ? user.id : null,
        ticket_types: typesToRequest,
        total_amount: total
      });

      if (error) throw error;
      setPurchased(true); 
      setCodes([]); // we don't dispense code immediately 
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
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-warning/20 text-warning mb-2">
          <Info className="h-6 w-6" />
        </div>
        <h3 className="text-xl font-bold text-foreground">¡Solicitud en Proceso!</h3>
        <p className="text-sm text-muted-foreground mt-1">Hemos recibido tu solicitud de pago.</p>
        <div className="rounded-xl bg-secondary/50 p-4 border border-border">
           <p className="text-sm text-foreground mb-1">Tu solicitud está pendiente de verificación por un administrador.</p>
           <p className="text-xs text-muted-foreground">Una vez que validemos la transferencia, las entradas aparecerán automáticamente en tu panel de "Mis Tickets".</p>
        </div>
        <button onClick={() => { setPurchased(false); setShowPayment(false); setQrDownloaded(false); setQuantities({}); }} className="w-full text-sm font-semibold text-primary hover:text-primary-hover transition-colors mt-4">
          Volver al Inicio
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
          return (
            <div key={tt.id} className={`flex items-center justify-between rounded-xl bg-secondary p-3 ${soldOut ? 'opacity-50' : ''}`}>
              <div>
                <p className="font-medium text-foreground text-sm">{tt.name}</p>
                <p className="text-xs text-muted-foreground">Bs. {tt.price} · {available} disponibles</p>
              </div>
              {soldOut ? (
                <span className="text-xs font-medium text-destructive">Agotado</span>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(tt.id, -1)} disabled={qty === 0} className="touch-target flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground disabled:opacity-30 transition-colors hover:bg-card-hover">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold text-foreground">{qty}</span>
                  <button onClick={() => updateQty(tt.id, 1)} disabled={qty >= available} className="touch-target flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-30 transition-colors">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {totalQty > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{totalQty} entrada(s)</span>
            <span className="text-lg font-bold text-foreground">Bs. {total}</span>
          </div>
          {user ? (
            <button
              onClick={() => setShowPayment(true)}
              disabled={loading}
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
