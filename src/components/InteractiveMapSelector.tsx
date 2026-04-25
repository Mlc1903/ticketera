import { useState } from 'react';
import { useZones, useReservations } from '@/hooks/useSupabaseData';
import { Loader2 } from 'lucide-react';

interface InteractiveMapSelectorProps {
  organizationId: string;
  eventId: string;
  selectedTableId: string | null;
  onSelectTable: (tableId: string | null, zoneName: string, label: string) => void;
}

export default function InteractiveMapSelector({ organizationId, eventId, selectedTableId, onSelectTable }: InteractiveMapSelectorProps) {
  const { data: zones, isLoading: zonesLoading } = useZones(organizationId);
  const { data: reservations, isLoading: resLoading } = useReservations({ eventId });
  const [activeZoneIdx, setActiveZoneIdx] = useState(0);

  if (zonesLoading || resLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!zones || zones.length === 0) {
    return <div className="p-4 text-center text-sm text-muted-foreground bg-secondary rounded-xl">No hay croquis configurados.</div>;
  }

  const activeZone = zones[activeZoneIdx];
  const tables = activeZone?.tables_data || [];

  // Get occupied table IDs for this event
  // A table is occupied if there's an active or used reservation for it
  const occupiedTableIds = new Set(
    reservations
      ?.filter((r: any) => r.zone_table_id && (r.status === 'active' || r.status === 'used'))
      .map((r: any) => r.zone_table_id)
  );

  return (
    <div className="space-y-4">
      {zones.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {zones.map((zone, i) => (
            <button 
              key={zone.id} 
              onClick={() => setActiveZoneIdx(i)}
              className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                i === activeZoneIdx ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {zone.name}
            </button>
          ))}
        </div>
      )}

      <div className="text-xs flex gap-4 text-muted-foreground justify-center mb-2">
        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-success"></span> Libre</div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-destructive"></span> Ocupada</div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-warning"></span> Seleccionada</div>
      </div>

      <div className="w-full bg-secondary rounded-xl border border-border overflow-hidden relative">
        <img 
          src={activeZone.image_url} 
          alt={activeZone.name} 
          className="w-full h-auto block select-none pointer-events-none" 
        />
        
        {tables.map(table => {
          const isOccupied = occupiedTableIds.has(table.id);
          const isSelected = selectedTableId === table.id;

          let bgClass = 'bg-success/80 border-success-foreground/50 text-success-foreground';
          if (isOccupied) bgClass = 'bg-destructive/90 border-destructive-foreground/50 text-destructive-foreground opacity-60 cursor-not-allowed';
          else if (isSelected) bgClass = 'bg-warning border-warning-foreground text-warning-foreground z-10 shadow-glow';

          return (
            <button
              key={table.id}
              onClick={(e) => {
                e.preventDefault();
                if (isOccupied) return;
                onSelectTable(isSelected ? null : table.id, activeZone.name, table.label);
              }}
              className={`absolute flex items-center justify-center border-2 shadow-sm transition-all hover:scale-105 active:scale-95 ${bgClass} ${!isOccupied && !isSelected ? 'hover:bg-success hover:z-10' : ''}`}
              style={{
                left: `calc(${table.x}% - ${table.radius}%)`,
                top: `calc(${table.y}% - ${table.radius}%)`,
                width: `${table.radius * 2}%`,
                aspectRatio: '1/1',
                borderRadius: '50%',
              }}
            >
              <span className="text-[10px] md:text-xs font-bold truncate max-w-full px-1">{table.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
