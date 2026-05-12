import { useState } from 'react';
import { Ticket, Loader2, CheckCircle, CreditCard, Share2, RotateCcw, Minus, Plus, Printer } from 'lucide-react';
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
  const [generatedTickets, setGeneratedTickets] = useState<{ code: string, typeName: string, price: number }[] | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  if (!orgId && !hasRole('super_admin') && !hasRole('puerta') && !hasRole('admin')) {
    return (
      <div className="text-center py-20 space-y-3">
        <Ticket className="h-12 w-12 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">No tienes acceso a esta sección o no perteneces a ninguna organización.</p>
      </div>
    );
  }  const handleQuantityChange = (id: string, delta: number, max: number) => {
    setQuantities(prev => {
      const current = prev[id] || 1;
      const next = Math.max(1, Math.min(max, current + delta));
      return { ...prev, [id]: next };
    });
  };

  const handleSellTicket = async (ticketTypeId: string, ticketType: string, ticketTypeName: string, eventTitle: string, price: number, available: number) => {
    const qty = quantities[ticketTypeId] || 1;
    if (qty > available) {
      toast.error('No hay suficientes entradas disponibles');
      return;
    }
    const total = price * qty;
    if (!confirm(`¿Confirmas la venta en efectivo por Bs. ${total} (${qty} entradas)?`)) return;
    
    setLoading(true);
    try {
      const newTickets = [];
      for (let i = 0; i < qty; i++) {
        // Create code
        const { data: codeData } = await supabase.rpc('generate_ticket_code', { 
          prefix: eventTitle.substring(0, 4).toUpperCase().replace(/\s/g, '') 
        });
        const code = codeData || `TKT-${Date.now()}-${i}`;

        // Create reservation
        const { error } = await supabase.from('reservations').insert({
          code,
          event_id: selectedEventId,
          ticket_type_id: ticketTypeId,
          type: ticketType as any,
          quantity: 1, // Generate single active ticket so Guardia can scan it
          status: 'active', 
          rrpp_id: user?.id, // Use door user id to track who sold it
        });

        if (error) throw error;
        newTickets.push({ code, typeName: ticketTypeName, price });
      }
      
      setGeneratedTickets(newTickets);
      toast.success(`¡Venta de ${qty} entrada(s) Registrada!`);
    } catch (error: any) {
      toast.error(error.message || 'Error al procesar la venta');
    }
    setLoading(false);
  };

  const selectedEvent = events?.find(e => e.id === selectedEventId);
  const availableTickets = selectedEvent?.ticket_types?.filter(t => t.price > 0 && t.quantity > t.sold) || [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-2xl mx-auto print:max-w-none print:w-full print:m-0">
      <div className="print:hidden">
        <div className="flex items-center gap-2 text-sm text-primary font-semibold mb-1">
          <Ticket className="h-4 w-4" /> Venta en Puerta
        </div>
        <h1 className="text-2xl font-black text-foreground">Registro de Ventas (Efectivo)</h1>
      </div>

      <div className="glass-card p-4 space-y-4 print:hidden">
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

      {selectedEvent && !generatedTickets && (
        <div className="space-y-4 print:hidden">
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
                  
                  <div className="flex flex-col items-end gap-3">
                    <p className="text-xl font-black text-primary">Bs. {tt.price}</p>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="flex items-center bg-secondary rounded-xl overflow-hidden ring-1 ring-border h-10">
                        <button 
                          onClick={() => handleQuantityChange(tt.id, -1, tt.quantity - tt.sold)}
                          className="px-3 h-full flex items-center justify-center text-foreground hover:bg-black/5 active:bg-black/10 transition-colors"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center font-bold text-sm">
                          {quantities[tt.id] || 1}
                        </span>
                        <button 
                          onClick={() => handleQuantityChange(tt.id, 1, tt.quantity - tt.sold)}
                          className="px-3 h-full flex items-center justify-center text-foreground hover:bg-black/5 active:bg-black/10 transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <button 
                        onClick={() => handleSellTicket(tt.id, tt.type, tt.name, selectedEvent.title, tt.price, tt.quantity - tt.sold)}
                        disabled={loading}
                        className="h-10 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:shadow-glow active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2 min-w-[120px]"
                      >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                        Vender {(quantities[tt.id] || 1) > 1 && `(${(quantities[tt.id] || 1)})`}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {generatedTickets && generatedTickets.length > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-8 text-center space-y-6 print:hidden">
          <div className="flex justify-center text-success">
            <div className="bg-success/10 p-3 rounded-full">
              <CheckCircle className="h-12 w-12" />
            </div>
          </div>
          
          <div>
            <h2 className="text-2xl font-black text-foreground">¡Venta Exitosa!</h2>
            <p className="text-muted-foreground">
              {generatedTickets.length === 1 
                ? 'Se generó 1 entrada' 
                : `Se generaron ${generatedTickets.length} entradas`}
            </p>
          </div>

          {generatedTickets.length === 1 ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-3xl shadow-xl">
                  <QRCodeSVG value={generatedTickets[0].code} size={200} />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-lg font-mono font-black text-primary tracking-widest">{generatedTickets[0].code}</p>
                <div className="flex justify-center gap-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>{generatedTickets[0].typeName}</span>
                  <span>Bs. {generatedTickets[0].price}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto p-2">
              {generatedTickets.map((t, idx) => (
                <div key={idx} className="bg-white p-4 rounded-3xl shadow-md flex flex-col items-center">
                  <QRCodeSVG value={t.code} size={120} />
                  <p className="text-sm font-mono font-black text-primary mt-3">{t.code}</p>
                  <p className="text-xs font-bold text-muted-foreground">{t.typeName} - Bs. {t.price}</p>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 flex flex-col gap-3">
            <button 
              onClick={() => window.print()}
              className="w-full rounded-xl bg-primary py-4 text-sm font-bold text-primary-foreground hover:shadow-glow transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Printer className="h-4 w-4" /> Imprimir Entradas
            </button>
            <button 
              onClick={() => {
                const isMultiple = generatedTickets.length > 1;
                const ticketsText = generatedTickets.map(t => `- *${t.typeName}*: ${t.code}`).join('\\n');
                const text = encodeURIComponent(`🎟️ ${isMultiple ? 'Tus entradas' : 'Tu entrada'} para *${selectedEvent?.title}*\\n\\n${ticketsText}\\n\\n¡Te esperamos!`);
                window.open(`https://wa.me/?text=${text}`);
              }}
              className="w-full rounded-xl bg-[#25D366] py-4 text-sm font-bold text-white hover:shadow-glow transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Share2 className="h-4 w-4" /> Compartir por WhatsApp
            </button>
            <button 
              onClick={() => {
                setGeneratedTickets(null);
                setQuantities({});
              }}
              className="w-full rounded-xl bg-secondary py-4 text-sm font-bold text-foreground hover:bg-secondary/80 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <RotateCcw className="h-4 w-4" /> Vender otras entradas
            </button>
          </div>
        </motion.div>
      )}

      {/* Print View for 80mm Termal Printer */}
      {generatedTickets && generatedTickets.length > 0 && (
        <div className="hidden print:block text-black bg-white">
          <style>{`
            @media print {
              @page { margin: 0; size: 80mm auto; }
              body { background: white; margin: 0; padding: 0; }
              /* Force hide header if Layout logic missed it */
              header { display: none !important; }
              /* Force hide background */
              body::before { display: none !important; }
              html, body { width: 80mm; min-height: 100vh; }
            }
          `}</style>
          {generatedTickets.map((ticket, idx) => (
            <div key={idx} className="flex flex-col items-center justify-center pt-8 pb-4 px-4 text-center font-mono w-[80mm] mx-auto" style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>
              <img 
                src="https://res.cloudinary.com/dv8t8ym36/image/upload/f_auto,q_auto/NIGHTPASS_lkz1lb" 
                alt="Logo" 
                className="h-10 w-10 object-contain mb-2 grayscale"
              />
              <h1 className="text-base font-bold uppercase leading-tight mb-2 px-2">{selectedEvent?.title}</h1>
              <p className="text-sm font-bold border-y border-black border-dashed py-1 w-full my-1">
                {ticket.typeName} - Bs. {ticket.price}
              </p>
              
              <div className="my-3">
                <QRCodeSVG value={ticket.code} size={160} level="H" />
              </div>
              
              <p className="text-lg font-black tracking-widest my-1">{ticket.code}</p>
              
              <div className="text-xs mt-2 mb-6">
                <p>¡Gracias por tu compra!</p>
                <p>Presenta este código en puerta</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
