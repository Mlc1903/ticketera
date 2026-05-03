import { useState } from 'react';
import { Ticket, Loader2, CheckCircle, CreditCard, Share2, RotateCcw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useEvents } from '@/hooks/useSupabaseData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function PuertaDashboard() {
  const { activeOrg, hasRole, user } = useAuth();
  const orgId = activeOrg?.id;
  const { data: events, isLoading: eventsLoading } = useEvents(orgId);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [generatedTicket, setGeneratedTicket] = useState<{ code: string, typeName: string, price: number } | null>(null);

  if (!orgId && !hasRole('super_admin') && !hasRole('puerta') && !hasRole('admin')) {
    return (
      <div className="text-center py-20 space-y-3">
        <Ticket className="h-12 w-12 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">No tienes acceso a esta sección o no perteneces a ninguna organización.</p>
      </div>
    );
  }  const handleSellTicket = async (ticketTypeId: string, ticketType: string, ticketTypeName: string, eventTitle: string, price: number) => {
    if (!confirm(`¿Confirmas la venta en efectivo por Bs. ${price}?`)) return;
    setLoading(true);
    try {
      // Create code
      const { data: codeData } = await supabase.rpc('generate_ticket_code', { 
        prefix: eventTitle.substring(0, 4).toUpperCase().replace(/\s/g, '') 
      });
      const code = codeData || `TKT-${Date.now()}`;

      // Create reservation
      const { error } = await supabase.from('reservations').insert({
        code,
        event_id: selectedEventId,
        ticket_type_id: ticketTypeId,
        type: ticketType as any,
        quantity: 1,
        status: 'active', // Generate active ticket so Guardia can scan it
        rrpp_id: user?.id, // Use door user id to track who sold it
      });

      if (error) throw error;
      
      setGeneratedTicket({ code, typeName: ticketTypeName, price });
      toast.success(`¡Venta Registrada!`);
    } catch (error: any) {
      toast.error(error.message || 'Error al procesar la venta');
    }
    setLoading(false);
  };

  const selectedEvent = events?.find(e => e.id === selectedEventId);
  const availableTickets = selectedEvent?.ticket_types?.filter(t => t.price > 0 && t.quantity > t.sold) || [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-2xl mx-auto">
      <div>
        <div className="flex items-center gap-2 text-sm text-primary font-semibold mb-1">
          <Ticket className="h-4 w-4" /> Venta en Puerta
        </div>
        <h1 className="text-2xl font-black text-foreground">Registro de Ventas (Efectivo)</h1>
      </div>

      <div className="glass-card p-4 space-y-4">
        <label className="text-sm font-semibold text-foreground">Seleccionar Evento</label>
        {eventsLoading ? (
          <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <select 
            value={selectedEventId} 
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground outline-none ring-1 ring-border focus:ring-primary cursor-pointer"
          >
            <option value="">-- Elige un evento activo --</option>
            {events?.map(ev => (
              <option key={ev.id} value={ev.id}>{ev.title}</option>
            ))}
          </select>
        )}
      </div>

      {selectedEvent && !generatedTicket && (
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground text-lg border-b border-border pb-2">Entradas Disponibles - {selectedEvent.title}</h3>
          
          {availableTickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay entradas de pago disponibles para este evento.</p>
          ) : (
            <div className="grid gap-3">
              {availableTickets.map(tt => (
                <div key={tt.id} className="glass-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-foreground text-lg">{tt.name}</h4>
                    <p className="text-sm text-muted-foreground mt-1">Disponibles: <span className="text-foreground font-medium">{tt.quantity - tt.sold}</span> / {tt.quantity}</p>
                    <p className="text-sm text-muted-foreground">Tipo: {tt.type === 'normal' ? 'General' : tt.type === 'vip' ? 'VIP' : tt.type}</p>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-xl font-black text-primary">Bs. {tt.price}</p>
                    <button 
                      onClick={() => handleSellTicket(tt.id, tt.type, tt.name, selectedEvent.title, tt.price)}
                      disabled={loading}
                      className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:shadow-glow active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2 w-full sm:w-auto min-w-[140px]"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                      Vender
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {generatedTicket && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-8 text-center space-y-6">
          <div className="flex justify-center text-success">
            <div className="bg-success/10 p-3 rounded-full">
              <CheckCircle className="h-12 w-12" />
            </div>
          </div>
          
          <div>
            <h2 className="text-2xl font-black text-foreground">¡Venta Exitosa!</h2>
            <p className="text-muted-foreground">Muestra este código al cliente</p>
          </div>

          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-3xl shadow-xl">
              <QRCodeSVG value={generatedTicket.code} size={200} />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-lg font-mono font-black text-primary tracking-widest">{generatedTicket.code}</p>
            <div className="flex justify-center gap-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <span>{generatedTicket.typeName}</span>
              <span>Bs. {generatedTicket.price}</span>
            </div>
          </div>

          <div className="pt-4 flex flex-col gap-3">
            <button 
              onClick={() => {
                const text = encodeURIComponent(`🎟️ Tu entrada para *${selectedEvent?.title}*\n✨ Tipo: *${generatedTicket.typeName}*\n🎟️ Código: *${generatedTicket.code}*\n\n¡Te esperamos!`);
                window.open(`https://wa.me/?text=${text}`);
              }}
              className="w-full rounded-xl bg-[#25D366] py-4 text-sm font-bold text-white hover:shadow-glow transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Share2 className="h-4 w-4" /> Compartir por WhatsApp
            </button>
            <button 
              onClick={() => setGeneratedTicket(null)}
              className="w-full rounded-xl bg-secondary py-4 text-sm font-bold text-foreground hover:bg-secondary/80 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <RotateCcw className="h-4 w-4" /> Vender otra entrada
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
