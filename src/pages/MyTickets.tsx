import { motion } from 'framer-motion';
import { Ticket, QrCode, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/hooks/useAuth';
import { useReservations } from '@/hooks/useSupabaseData';
import { Link } from 'react-router-dom';

export default function MyTickets() {
  const { user } = useAuth();
  const { data: reservations, isLoading } = useReservations({ userId: user?.id });

  if (!user) {
    return (
      <div className="text-center py-20 space-y-4">
        <Ticket className="h-12 w-12 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">Inicia sesión para ver tus tickets</p>
        <Link to="/login" className="text-primary hover:underline text-sm">Iniciar sesión</Link>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-2xl mx-auto">
      <div>
        <div className="flex items-center gap-2 text-sm text-primary font-semibold mb-1"><Ticket className="h-4 w-4" />Mis Tickets</div>
        <h1 className="text-2xl font-black text-foreground">Mis Entradas</h1>
      </div>

      {!reservations?.length ? (
        <div className="glass-card p-8 text-center">
          <QrCode className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No tienes entradas aún</p>
          <Link to="/" className="text-primary hover:underline text-sm mt-2 inline-block">Ver eventos</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {reservations.map((r: any, i: number) => {
            const event = r.events as any;
            return (
              <motion.div key={r.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-card p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">{event?.title || 'Evento'}</h3>
                    <p className="text-xs text-muted-foreground">{event?.date} · {event?.time?.substring(0, 5)}</p>
                    <p className="text-xs text-muted-foreground">{event?.location}</p>
                  </div>
                  <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                    r.status === 'used' ? 'bg-success/15 text-success' : r.status === 'active' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    {r.status === 'used' ? 'Usado' : r.status === 'active' ? 'Activo' : r.status}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="rounded-xl bg-foreground p-2">
                    <QRCodeSVG value={r.code} size={80} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Código</p>
                    <p className="font-mono text-sm text-primary font-semibold">{r.code}</p>
                    <p className="text-xs text-muted-foreground mt-1">Tipo: {r.type}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
