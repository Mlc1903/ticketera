import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Settings2, Save } from 'lucide-react';
import { ZoneTable } from '@/hooks/useSupabaseData';

interface MapEditorProps {
  imageUrl: string;
  initialTables?: ZoneTable[];
  onSave: (tables: ZoneTable[]) => void;
  isSaving?: boolean;
}

export default function MapEditor({ imageUrl, initialTables = [], onSave, isSaving = false }: MapEditorProps) {
  const [tables, setTables] = useState<ZoneTable[]>(initialTables);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialTables.length > 0 && tables.length === 0) {
      setTables(initialTables);
    }
  }, [initialTables]);

  const handleImageClick = (e: React.MouseEvent) => {
    if (selectedTableId) {
      setSelectedTableId(null);
      return;
    }

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    // Position percentage based on click
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    const newTable: ZoneTable = {
      id: crypto.randomUUID(),
      label: `Mesa ${tables.length + 1}`,
      x: xPct,
      y: yPct,
      radius: 4, // 4% width
    };

    setTables([...tables, newTable]);
    setSelectedTableId(newTable.id);
  };

  const handleDragEnd = (id: string, e: any) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const el = document.getElementById(`table-${id}`);
    
    if (el) {
      const elRect = el.getBoundingClientRect();
      const xPct = ((elRect.left + elRect.width / 2 - rect.left) / rect.width) * 100;
      const yPct = ((elRect.top + elRect.height / 2 - rect.top) / rect.height) * 100;

      // Update state, and the `key` change will reset framer-motion x/y
      setTables(tables.map(t => t.id === id ? { ...t, x: xPct, y: yPct } : t));
    }
  };

  const updateTable = (id: string, updates: Partial<ZoneTable>) => {
    setTables(tables.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const deleteTable = (id: string) => {
    setTables(tables.filter(t => t.id !== id));
    setSelectedTableId(null);
  };

  const selectedTable = tables.find(t => t.id === selectedTableId);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-foreground">Editor de Croquis</h3>
        <button 
          onClick={() => onSave(tables)}
          disabled={isSaving}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 hover:shadow-glow"
        >
          <Save className="h-4 w-4" /> {isSaving ? 'Guardando...' : 'Guardar Layout'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Toolbox */}
        <div className="order-2 md:order-1 glass-card p-4 space-y-4 md:col-span-1">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>1. <strong>Click en la imagen</strong> para agregar una mesa.</p>
            <p>2. <strong>Arrastra</strong> la mesa para moverla.</p>
            <p>3. <strong>Selecciona</strong> una mesa para editar.</p>
          </div>

          {selectedTable ? (
            <div className="space-y-3 mt-4 pt-4 border-t border-border">
              <h4 className="font-medium text-foreground text-sm flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" /> Editar Mesa
              </h4>
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Etiqueta / Número</label>
                <input 
                  type="text" 
                  value={selectedTable.label}
                  onChange={(e) => updateTable(selectedTable.id, { label: e.target.value })}
                  className="w-full rounded-lg bg-secondary px-3 py-2 text-sm outline-none ring-1 ring-border focus:ring-primary text-foreground"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Tamaño (Radio %)</label>
                <input 
                  type="number" 
                  step="0.5"
                  value={selectedTable.radius}
                  onChange={(e) => updateTable(selectedTable.id, { radius: parseFloat(e.target.value) || 1 })}
                  className="w-full rounded-lg bg-secondary px-3 py-2 text-sm outline-none ring-1 ring-border focus:ring-primary text-foreground"
                />
              </div>
              <button 
                onClick={() => deleteTable(selectedTable.id)}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 px-3 py-2 text-sm font-medium transition-colors mt-2"
              >
                <Trash2 className="h-4 w-4" /> Eliminar Mesa
              </button>
            </div>
          ) : (
            <div className="mt-4 pt-4 border-t border-border text-center text-sm text-muted-foreground">
              Ninguna mesa seleccionada
            </div>
          )}
        </div>

        {/* Map Container */}
        <div className="order-1 md:order-2 md:col-span-3 border border-border rounded-xl flex items-start justify-center overflow-hidden bg-secondary w-full">
          <div ref={containerRef} className="relative inline-block w-full" style={{ userSelect: 'none' }}>
            {/* The Image */}
            <img 
              src={imageUrl} 
              alt="Croquis" 
              className="w-full h-auto cursor-crosshair pointer-events-auto block"
              onClick={handleImageClick}
              draggable={false}
            />
            
            {tables.map(table => (
              <motion.div
                key={`${table.id}-${table.x}-${table.y}`} // forces re-render after drop to reset framer transform
                id={`table-${table.id}`}
                drag
                dragMomentum={false}
                onDragEnd={(e: any) => handleDragEnd(table.id, e)}
                onClick={(e: any) => { e.stopPropagation(); setSelectedTableId(table.id); }}
                className={`absolute flex items-center justify-center cursor-grab active:cursor-grabbing border shadow-lg transition-colors overflow-hidden ${
                  selectedTableId === table.id 
                    ? 'bg-warning/90 border-warning text-warning-foreground z-10' 
                    : 'bg-success/80 border-success-foreground/50 backdrop-blur-md text-success-foreground'
                }`}
                style={{
                  position: 'absolute',
                  left: `calc(${table.x}% - ${table.radius}%)`,
                  top: `calc(${table.y}% - ${table.radius}%)`,
                  width: `${table.radius * 2}%`,
                  aspectRatio: '1/1',
                  borderRadius: '50%',
                  x: 0,
                  y: 0
                }}
              >
                <span className="text-[10px] md:text-xs font-bold truncate px-1 pointer-events-none">
                  {table.label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
