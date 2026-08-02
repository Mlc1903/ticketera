import { useState } from 'react';
import { useZones, useReservations } from '@/hooks/useSupabaseData';
import { Loader2 } from 'lucide-react';

interface InteractiveMapSelectorProps {
  organizationId: string;
  eventId: string;
  selectedTableId: string | null;
  onSelectTable: (table: any | null, zoneName: string) => void;
  requiredQty?: number;
}

export default function InteractiveMapSelector({ organizationId, eventId, selectedTableId, onSelectTable, requiredQty = 1 }: InteractiveMapSelectorProps) {
  const { data: zones, isLoading: zonesLoading } = useZones(organizationId);
  const { data: reservations, isLoading: resLoading } = useReservations({ eventId });
  const [activeZoneIdx, setActiveZoneIdx] = useState(0);

  if (zonesLoading || resLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!zones || zones.length === 0) {
    return <div className="p-4 text-center text-sm text-muted-foreground bg-secondary rounded-xl">No hay mesas configuradas.</div>;
  }

  const activeZone = zones[activeZoneIdx];
  const tables = activeZone?.tables_data || [];

  const getTableReservationStats = (table: any) => {
    const tableRes = reservations?.filter((r: any) => 
      (r.zone_table_id === table.id || r.table_id === table.id) && 
      (r.status === 'active' || r.status === 'used' || r.status === 'pending')
    ) || [];
    const totalSold = tableRes.reduce((sum: number, r: any) => sum + (r.quantity || 0), 0);
    const limit = table.tickets_included || 1;
    return {
      sold: totalSold,
      available: Math.max(0, limit - totalSold),
    };
  };

  const isTableOccupied = (table: any) => {
    const stats = getTableReservationStats(table);
    if (table.is_shared) {
      return stats.available < requiredQty;
    }
    return stats.sold > 0;
  };

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
          const stats = getTableReservationStats(table);
          const isOccupied = isTableOccupied(table);
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
                onSelectTable(isSelected ? null : table, activeZone.name);
              }}
              className={`absolute flex flex-col items-center justify-center border-2 shadow-sm transition-all hover:scale-105 active:scale-95 ${bgClass} ${!isOccupied && !isSelected ? 'hover:bg-success hover:z-10' : ''}`}
              style={{
                left: `calc(${table.x}% - ${table.radius}%)`,
                top: `calc(${table.y}% - ${table.radius}%)`,
                width: `${table.radius * 2}%`,
                aspectRatio: '1/1',
                borderRadius: '50%',
              }}
            >
              <span className="text-[9px] md:text-xs font-black truncate max-w-full px-1">{table.label}</span>
              {table.is_shared && (
                <span className="text-[6px] md:text-[8px] font-bold text-white/95 leading-none">
                  {stats.available}/{table.tickets_included}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
