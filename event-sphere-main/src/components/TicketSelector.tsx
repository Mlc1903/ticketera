import { useState } from 'react';
import { Minus, Plus, ShoppingCart, LogIn } from 'lucide-react';
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
}

export default function TicketSelector({ ticketTypes, eventId, eventTitle }: Props) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
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

  const handlePurchase = async () => {
    if (!user) return;
    setLoading(true);
    const newCodes: string[] = [];

    try {
      for (const tt of ticketTypes) {
        const qty = quantities[tt.id] || 0;
        if (qty === 0) continue;

        for (let i = 0; i < qty; i++) {
          const { data: codeData } = await supabase.rpc('generate_ticket_code', {
            prefix: eventTitle.substring(0, 4).toUpperCase().replace(/\s/g, ''),
          });
          const code = codeData || `TKT-${Date.now()}-${i}`;

          const { error } = await supabase.from('reservations').insert({
            code,
            event_id: eventId,
            ticket_type_id: tt.id,
            user_id: user.id,
            type: tt.type,
            quantity: 1,
            status: 'active',
          });

          if (error) throw error;
          newCodes.push(code);
        }
      }

      setCodes(newCodes);
      setPurchased(true);
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success(`¡${newCodes.length} entrada(s) reservada(s)!`);
    } catch (err: any) {
      toast.error(err.message || 'Error al reservar');
    }
    setLoading(false);
  };

  if (purchased) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-6 space-y-4">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-success/20 text-success mb-3">
            <ShoppingCart className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-foreground">¡Reserva Confirmada!</h3>
          <p className="text-sm text-muted-foreground mt-1">Presenta estos códigos en la entrada</p>
        </div>
        <div className="space-y-2">
          {codes.map((code, i) => (
            <div key={i} className="rounded-xl bg-secondary p-3 text-center font-mono text-sm text-primary">{code}</div>
          ))}
        </div>
        <button onClick={() => { setPurchased(false); setQuantities({}); setCodes([]); }} className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors">
          Comprar más entradas
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
              onClick={handlePurchase}
              disabled={loading}
              className="w-full touch-target rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:shadow-glow active:scale-[0.98] disabled:opacity-40"
            >
              {loading ? 'Reservando...' : 'Reservar Entradas'}
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
