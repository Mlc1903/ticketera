import { useParams, Link } from 'react-router-dom';
import { Calendar, MapPin, Users, ArrowLeft, Clock, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEvent } from '@/hooks/useSupabaseData';
import TicketSelector from '@/components/TicketSelector';

import eventNeon from '@/assets/event-neon.jpg';
import eventReggaeton from '@/assets/event-reggaeton.jpg';
import eventTechno from '@/assets/event-techno.jpg';

const fallbackImages = [eventNeon, eventReggaeton, eventTechno];

export default function EventDetail() {
  const { id } = useParams();
  const { data: event, isLoading } = useEvent(id);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-lg text-muted-foreground">Evento no encontrado</p>
        <Link to="/" className="text-primary hover:underline text-sm">Volver a eventos</Link>
      </div>
    );
  }

  const ticketTypes = event.ticket_types || [];
  const totalSold = ticketTypes.reduce((s, t) => s + t.sold, 0);
  const formattedDate = new Date(event.date + 'T' + event.time).toLocaleDateString('es-BO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const imageUrl = event.image_url || fallbackImages[Math.floor(Math.random() * fallbackImages.length)];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-2xl mx-auto">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Volver a eventos
      </Link>

      <div className="relative aspect-[16/9] rounded-2xl overflow-hidden">
        <img src={imageUrl} alt={event.title} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
      </div>

      <div className="space-y-3">
        <h1 className="text-2xl md:text-3xl font-black text-foreground">
          {event.title} {event.organizations?.name ? `- ${event.organizations.name}` : ''}
        </h1>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-primary" />{formattedDate}</span>
          <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-primary" />{event.time?.substring(0, 5)} hrs</span>
          <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary" />{event.location}</span>
          <span className="flex items-center gap-1.5"><Users className="h-4 w-4 text-primary" />{event.capacity - totalSold} lugares disponibles</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{event.description}</p>
      </div>

      <TicketSelector ticketTypes={ticketTypes} eventId={event.id} eventTitle={event.title} />
    </motion.div>
  );
}
