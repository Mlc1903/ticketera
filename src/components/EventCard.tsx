import { Link } from 'react-router-dom';
import { Calendar, MapPin, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import type { EventWithTickets } from '@/hooks/useSupabaseData';

import eventNeon from '@/assets/event-neon.jpg';
import eventReggaeton from '@/assets/event-reggaeton.jpg';
import eventTechno from '@/assets/event-techno.jpg';

const fallbackImages = [eventNeon, eventReggaeton, eventTechno];

export default function EventCard({ event, index }: { event: EventWithTickets; index: number }) {
  const ticketTypes = event.ticket_types || [];
  const totalSold = ticketTypes.reduce((sum, t) => sum + t.sold, 0);
  const lowestPrice = ticketTypes.length ? Math.min(...ticketTypes.map((t) => t.price)) : 0;
  const capacityPercent = event.capacity > 0 ? Math.round((totalSold / event.capacity) * 100) : 0;

  const formattedDate = new Date(event.date + 'T' + event.time).toLocaleDateString('es-BO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const imageUrl = event.image_url || fallbackImages[index % fallbackImages.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Link to={`/evento/${event.id}`} className="block group">
        <div className="glass-card overflow-hidden transition-all hover:shadow-glow">
          <div className="relative aspect-[16/9] overflow-hidden">
            <img
              src={imageUrl}
              alt={event.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
              <span className="rounded-lg bg-primary/90 px-2.5 py-1 text-xs font-semibold text-primary-foreground backdrop-blur-sm">
                Desde Bs. {lowestPrice}
              </span>
              {/*<span className={`rounded-lg px-2.5 py-1 text-xs font-semibold backdrop-blur-sm ${
                capacityPercent > 80 ? 'bg-destructive/90 text-destructive-foreground' : 'bg-success/90 text-success-foreground'
              }`}>
                {capacityPercent}% vendido
              </span>*/}
            </div>
          </div>
          <div className="p-4 space-y-2">
            <h3 className="text-lg font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
              {event.title} {event.organizations?.name ? `- ${event.organizations.name}` : ''}
            </h3>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {formattedDate} — {event.time?.substring(0, 5)}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {event.location.split('—')[0].trim()}
              </span>
              {/*<span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {event.capacity - totalSold} disponibles
              </span>*/}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
