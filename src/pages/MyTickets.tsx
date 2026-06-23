import { useState } from 'react';
import { motion } from 'framer-motion';
import { Ticket, QrCode, Loader2, Search, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/hooks/useAuth';
import { useReservations } from '@/hooks/useSupabaseData';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export default function MyTickets() {
  const { user } = useAuth();
  const { data: allReservations, isLoading, error } = useReservations({ userId: user?.id });
  const [searchQuery, setSearchQuery] = useState('');

  const handleDownloadImage = async (ticketId: string, guestName: string) => {
    const node = document.getElementById(`ticket-card-${ticketId}`);
    if (!node) {
      toast.error("No se pudo encontrar el ticket en la pantalla.");
      return;
    }
    
    const toastId = toast.loading("Generando imagen del ticket...");
    try {
      const { toPng } = await import('html-to-image');
      
      const dataUrl = await toPng(node, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#010613',
        filter: (domNode: any) => {
          return !domNode.classList?.contains('no-export');
        }
      });
      
      const link = document.createElement('a');
      const cleanedName = guestName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      link.download = `ticket-${cleanedName || 'entrada'}-${ticketId.substring(0, 6)}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.dismiss(toastId);
      toast.success("Ticket descargado como imagen con éxito.");
    } catch (error: any) {
      toast.dismiss(toastId);
      console.error("Error al descargar ticket:", error);
      toast.error("Error al generar la imagen del ticket: " + error.message);
    }
  };

  const reservations = allReservations?.filter((r: any) => r.status === 'active' || r.status === 'used') || [];

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
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Cargando tus entradas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 px-6 space-y-4">
        <div className="bg-destructive/10 p-4 rounded-2xl inline-block text-destructive mb-2">
          <Ticket className="h-8 w-8" />
        </div>
        <p className="text-foreground font-semibold">Error al cargar entradas</p>
        <p className="text-sm text-muted-foreground">{(error as any).message || "Hubo un problema al conectar con el servidor."}</p>
        <button onClick={() => window.location.reload()} className="text-primary hover:underline text-sm font-medium">Reintentar</button>
      </div>
    );
  }

  const filteredReservations = reservations.filter((r: any) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const eventTitle = (r.events?.title || '').toLowerCase();
    const guestName = (r.guest_name || '').toLowerCase();
    const ticketCode = (r.code || '').toLowerCase();
    const ticketTypeName = (r.ticket_types?.name || '').toLowerCase();
    return eventTitle.includes(query) || 
           guestName.includes(query) || 
           ticketCode.includes(query) || 
           ticketTypeName.includes(query);
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-md mx-auto pb-20">
      <div className="px-4 space-y-3">
        <div className="flex items-center gap-2 text-sm text-primary font-semibold mb-1"><Ticket className="h-4 w-4" />Mis Tickets</div>
        <h1 className="text-2xl font-black text-foreground">Mis Entradas</h1>
        
        {/* Search bar */}
        {reservations.length > 0 && (
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por evento, nombre o código..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-secondary text-sm placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none border border-border/40"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}
      </div>

      {!filteredReservations?.length ? (
        <div className="glass-card p-8 text-center mx-4">
          <QrCode className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            {searchQuery.trim() ? 'No se encontraron resultados' : 'No tienes entradas aún'}
          </p>
          {searchQuery.trim() ? (
            <button onClick={() => setSearchQuery('')} className="text-primary hover:underline text-sm mt-2 inline-block">
              Limpiar búsqueda
            </button>
          ) : (
            <Link to="/" className="text-primary hover:underline text-sm mt-2 inline-block">Ver eventos</Link>
          )}
        </div>
      ) : (
        <div className="space-y-8 px-4">
          {filteredReservations.map((r: any, i: number) => {
            const event = r.events as any;
            return (
              <motion.div 
                key={r.id} 
                id={`ticket-card-${r.id}`}
                initial={{ opacity: 0, y: 15 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: i * 0.1 }} 
                className="relative overflow-hidden rounded-[20px] bg-gradient-to-b from-[#0a1931] to-[#010613] shadow-2xl pb-6 border border-white/5"
              >
                {/* Download Button */}
                <div className="absolute top-4 left-4 z-20 no-export">
                  <button 
                    onClick={() => handleDownloadImage(r.id, r.guest_name || 'ticket')}
                    className="p-2 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-md transition-colors border border-white/10"
                    title="Descargar ticket como imagen"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>

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
                      <p className="text-gray-300">{r.quantity || 1} entrada(s) - <span className="font-medium text-white uppercase">{r.type === 'mesa_vip' ? `MESA - ${(r.ticket_types?.name || 'VIP').toUpperCase()}` : (r.ticket_types?.name || r.type?.replace('_', ' '))}</span></p>
                      {r.guest_name && (() => {
                        const parts = r.guest_name.split(' - ');
                        const displayName = parts.length >= 2 ? parts[1] : r.guest_name;
                        return (
                          <p className="text-sm text-gray-300 font-semibold mt-1">
                            {displayName}
                          </p>
                        );
                      })()}
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
                      <span className="font-bold">Fecha:</span> {event?.date ? (() => {
                        const [year, month, day] = event.date.split('-').map(Number);
                        const localDate = new Date(year, month - 1, day);
                        return localDate.toLocaleDateString('es-ES', { month: 'long', day: 'numeric', year: 'numeric' });
                      })() : 'Por definir'}
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
