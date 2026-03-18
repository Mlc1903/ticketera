import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanLine, CheckCircle, XCircle, Keyboard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type ScanResult = {
  status: 'SUCCESS' | 'ALREADY_USED' | 'ERROR';
  message: string;
  guestName?: string;
  ticketType?: string;
} | null;

export default function CheckInScanner() {
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult>(null);

  const handleValidate = async () => {
    if (!code.trim()) return;
    setScanning(true);
    setResult(null);

    try {
      const { data: reservation, error } = await supabase
        .from('reservations')
        .select('*, ticket_types:ticket_type_id(name, type)')
        .eq('code', code.trim().toUpperCase())
        .maybeSingle();

      if (error) throw error;

      if (!reservation) {
        setResult({ status: 'ERROR', message: 'Código no encontrado o inválido' });
        if (navigator.vibrate) navigator.vibrate(200);
      } else if (reservation.status === 'used') {
        setResult({
          status: 'ALREADY_USED',
          message: `Ticket ya usado el ${new Date(reservation.checked_in_at!).toLocaleString('es-BO')}`,
        });
        if (navigator.vibrate) navigator.vibrate(200);
      } else {
        // Mark as used
        await supabase
          .from('reservations')
          .update({ status: 'used', checked_in_at: new Date().toISOString() })
          .eq('id', reservation.id);

        const ticketInfo = reservation.ticket_types as any;
        setResult({
          status: 'SUCCESS',
          message: 'Acceso Permitido',
          guestName: reservation.guest_name || 'Cliente General',
          ticketType: ticketInfo?.name || reservation.type,
        });
      }
    } catch {
      setResult({ status: 'ERROR', message: 'Error de servidor' });
    }

    setScanning(false);
    setTimeout(() => setCode(''), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Keyboard className="h-4 w-4" />
          Ingreso Manual de Código
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ej: NEON-A1B2C3"
            className="flex-1 rounded-xl bg-secondary px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary transition-all uppercase"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
          />
          <button
            onClick={handleValidate}
            disabled={scanning || !code.trim()}
            className="touch-target rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:shadow-glow active:scale-[0.98] disabled:opacity-40 flex items-center gap-2"
          >
            <ScanLine className="h-4 w-4" />
            Validar
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={result.status}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`glass-card p-6 text-center space-y-3 ${
              result.status === 'SUCCESS'
                ? 'animate-flash-green ring-1 ring-success/30'
                : 'animate-flash-red ring-1 ring-destructive/30'
            }`}
          >
            {result.status === 'SUCCESS' ? (
              <>
                <CheckCircle className="h-16 w-16 text-success mx-auto" />
                <p className="text-2xl font-bold text-foreground">{result.guestName}</p>
                <span className="inline-block rounded-lg bg-success/20 px-3 py-1 text-sm font-semibold text-success">{result.ticketType}</span>
                <p className="text-success font-semibold">{result.message}</p>
              </>
            ) : (
              <>
                <XCircle className="h-16 w-16 text-destructive mx-auto" />
                <p className="text-lg font-bold text-foreground">{result.status === 'ALREADY_USED' ? 'Ticket Ya Usado' : 'Código Inválido'}</p>
                <p className="text-sm text-muted-foreground">{result.message}</p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
