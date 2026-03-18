import { useEvents } from '@/hooks/useSupabaseData';
import EventCard from '@/components/EventCard';
import { Ticket, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Index() {
  const { data: events, isLoading } = useEvents();

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-3 py-4"
      >
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
          <Ticket className="h-3.5 w-3.5" />
          Plataforma de Eventos Bolivia
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">
          Próximos Eventos
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Encuentra los mejores eventos, compra tus entradas y accede con tu código único.
        </p>
      </motion.div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events?.map((event, i) => (
            <EventCard key={event.id} event={event} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
