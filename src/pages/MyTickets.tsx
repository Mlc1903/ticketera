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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-md mx-auto pb-20">
      <div className="px-4">
        <div className="flex items-center gap-2 text-sm text-primary font-semibold mb-1"><Ticket className="h-4 w-4" />Mis Tickets</div>
        <h1 className="text-2xl font-black text-foreground">Mis Entradas</h1>
      </div>

      {!reservations?.length ? (
        <div className="glass-card p-8 text-center mx-4">
          <QrCode className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No tienes entradas aún</p>
          <Link to="/" className="text-primary hover:underline text-sm mt-2 inline-block">Ver eventos</Link>
        </div>
      ) : (
        <div className="space-y-8 px-4">
          {reservations.map((r: any, i: number) => {
            const event = r.events as any;
            return (
              <motion.div 
                key={r.id} 
                initial={{ opacity: 0, y: 15 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: i * 0.1 }} 
                className="relative overflow-hidden rounded-[20px] bg-gradient-to-b from-[#0a1931] to-[#010613] shadow-2xl pb-6 border border-white/5"
              >
                {/* Event Image Top */}
                <div className="relative w-full h-48 bg-muted">
                  {event?.image_url ? (
                    <img 
                      src={event.image_url} 
                      alt={event.title} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                      <Ticket className="h-12 w-12 text-white/20" />
                    </div>
                  )}
                  {/* Subtle fade to blend with background */}
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0a1931] to-transparent pointer-events-none"></div>
                  
                  {/* Status Badge */}
                  <div className="absolute top-4 right-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md ${
                      r.status === 'used' ? 'bg-red-500/80 text-white' : 
                      r.status === 'active' ? 'bg-green-500/80 text-white' : 
                      'bg-black/50 text-white'
                    }`}>
                      {r.status === 'used' ? 'Usado' : r.status === 'active' ? 'Activo' : r.status}
                    </span>
                  </div>
                </div>

                <div className="px-6 space-y-5 -mt-2 relative z-10">
                  {/* Title and location */}
                  <div className="flex items-start gap-3">
                    <Ticket className="h-6 w-6 text-white shrink-0 mt-1" />
                    <div>
                      <h2 className="font-bold text-white text-xl uppercase leading-tight tracking-wide">{event?.title || 'Evento'}</h2>
                      <p className="text-gray-300 mt-1">{event?.location || 'Ubicación no especificada'}</p>
                      <p className="text-gray-300">{r.quantity || 1} entrada(s) - <span className="font-medium text-white uppercase">{r.type?.replace('_', ' ')}</span></p>
                    </div>
                  </div>

                  {/* Code Box */}
                  <div className="space-y-1">
                    <p className="font-semibold text-white text-lg">Código de Impresión:</p>
                    <div className="bg-[#4b4b4b] rounded-lg py-2.5 px-4 text-center shadow-inner">
                      <p className="font-mono text-gray-200 tracking-[0.2em] text-lg">{r.code}</p>
                    </div>
                  </div>

                  {/* QR Code central */}
                  <div className="flex justify-center my-6">
                    <div className="bg-white rounded-[20px] p-6 shadow-xl">
                      <QRCodeSVG value={r.code} size={200} level="H" />
                    </div>
                  </div>

                  {/* Footer Data */}
                  <div className="space-y-1 pt-2">
                    <p className="text-white text-[15px]">
                      <span className="font-bold">Fecha:</span> {event?.date ? new Date(event.date).toLocaleDateString('es-ES', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Por definir'}
                    </p>
                    <p className="text-white text-[15px]">
                      <span className="font-bold">Hora:</span> {event?.time ? event.time.substring(0, 5) : 'Por definir'}
                    </p>
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
