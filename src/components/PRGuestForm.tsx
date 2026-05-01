import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { UserPlus, Share2, CheckCircle, Ticket, RotateCcw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEvent } from '@/hooks/useSupabaseData';
import InteractiveMapSelector from './InteractiveMapSelector';
import { toast } from 'sonner';

type GuestType = 'rrpp_free' | 'rrpp_paid' | 'mesa_vip';

interface Props {
  eventId: string;
  eventTitle: string;
  allowGuests?: boolean;
}

export default function PRGuestForm({ eventId, eventTitle, allowGuests = true }: Props) {
  const [name, setName] = useState('');
  const [guestType, setGuestType] = useState<GuestType>('rrpp_free');
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [selectedTable, setSelectedTable] = useState<{ id: string, zoneName: string, label: string } | null>(null);
  const { user } = useAuth();
  const { data: eventData } = useEvent(eventId);

  const { data: usedGuestsCount = 0, refetch: refetchCount } = useQuery({
    queryKey: ['used-guests-count', eventId, user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('rrpp_id', user.id)
        .eq('type', 'rrpp_free');
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user && !!eventId,
  });

  const guestLimit = eventData?.rrpp_guests_per_promoter || 0;
  const isLimitReached = guestLimit > 0 && usedGuestsCount >= guestLimit;

  useEffect(() => {
    if (!allowGuests && guestType === 'rrpp_free') {
      setGuestType('mesa_vip');
    }
  }, [allowGuests, guestType]);

  const handleAddGuest = async () => {
    if (!name.trim() || !user) return;
    setLoading(true);

    try {
      const { data: codeData } = await supabase.rpc('generate_ticket_code', {
        prefix: eventTitle.substring(0, 4).toUpperCase().replace(/\s/g, ''),
      });
      const code = codeData || `RRPP-${Date.now()}`;

      // Get a ticket_type_id for this event
      const { data: ticketTypes } = await supabase
        .from('ticket_types')
        .select('id')
        .eq('event_id', eventId)
        .limit(1);

      if (!ticketTypes?.length) throw new Error('No hay tipos de ticket');

      const { error } = await supabase.from('reservations').insert({
        code,
        event_id: eventId,
        ticket_type_id: ticketTypes[0].id,
        rrpp_id: user.id,
        guest_name: name,
        type: guestType,
        quantity: 1,
        status: 'active',
        zone_table_id: guestType === 'mesa_vip' && selectedTable ? selectedTable.id : null,
      });

      if (error) throw error;
      setGeneratedCode(code);
      refetchCount();
      toast.success('Pase generado exitosamente');
    } catch (err: any) {
      toast.error(err.message || 'Error al generar pase');
    }
    setLoading(false);
  };

  const shareToWhatsApp = () => {
    const typeLabel = guestType === 'rrpp_free' ? 'VIP Gratis' : 'Mesa VIP';
    const text = encodeURIComponent(
      `🎉 ¡Hola ${name}! Tienes un pase *${typeLabel}* para *${eventTitle}*\n🎟️ Código: *${generatedCode}*\n\nPresenta este código en la entrada. ¡Nos vemos!`
    );
    window.open(`https://wa.me/?text=${text}`);
  };

  const reset = () => { setGeneratedCode(null); setName(''); };

  const typeOptions: { value: GuestType; label: string; desc: string }[] = allowGuests ? [
    { 
      value: 'rrpp_free', 
      label: 'VIP Gratis', 
      desc: eventData?.free_pass_until 
        ? `Válido hasta ${eventData.free_pass_until.substring(0, 5)}` 
        : 'Invitación gratuita' 
    }
  ] : [];

  if (!allowGuests) {
    return (
      <div className="glass-card p-5 text-center space-y-2">
        <UserPlus className="h-8 w-8 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">Este evento no permite pases de cortesía.</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-5 space-y-4">
      <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-primary" />
        Agregar Invitado
      </h3>

      {guestLimit > 0 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Cupo de Invitados</span>
          <span className={`text-xs font-black ${isLimitReached ? 'text-destructive' : 'text-primary'}`}>
            {usedGuestsCount} / {guestLimit}
          </span>
        </div>
      )}

      {!generatedCode ? (
        <div className="space-y-4">

          <input
            type="text"
            placeholder="Nombre completo del invitado"
            className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary transition-all"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <button
            onClick={handleAddGuest}
            disabled={loading || !name.trim() || (guestType === 'mesa_vip' && !selectedTable) || (guestType === 'rrpp_free' && isLimitReached)}
            className="w-full touch-target rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:shadow-glow active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Ticket className="h-4 w-4" />
            {loading ? 'Generando...' : isLimitReached && guestType === 'rrpp_free' ? 'Límite alcanzado' : 'Generar Pase'}
          </button>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-4">
          <div className="flex justify-center text-success"><CheckCircle className="h-12 w-12" /></div>
          <p className="text-sm text-muted-foreground">Pase generado para <span className="text-foreground font-bold">{name}</span></p>
          <div className="flex justify-center">
            <div className="rounded-2xl bg-foreground p-3 inline-block">
              <QRCodeSVG value={generatedCode} size={140} />
            </div>
          </div>
          <div className="rounded-xl bg-secondary p-3 font-mono text-sm text-primary">{generatedCode}</div>
          <button onClick={shareToWhatsApp} className="w-full touch-target rounded-xl bg-whatsapp py-3 text-sm font-semibold text-success-foreground transition-all active:scale-[0.98] flex items-center justify-center gap-2">
            <Share2 className="h-4 w-4" />
            Enviar por WhatsApp
          </button>
          <button onClick={reset} className="flex items-center justify-center gap-1.5 w-full text-sm text-muted-foreground hover:text-foreground transition-colors">
            <RotateCcw className="h-3.5 w-3.5" />
            Agregar otro invitado
          </button>
        </motion.div>
      )}
    </div>
  );
}
