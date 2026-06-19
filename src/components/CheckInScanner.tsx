import { Scanner, IDetectedBarcode } from '@yudiel/react-qr-scanner';
import { useAuth } from '@/hooks/useAuth';
import { useEvents, useScanners } from '@/hooks/useSupabaseData';
import { Info, ScanLine, Camera, Keyboard, CheckCircle, XCircle, Wifi, WifiOff, RefreshCw, Download } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

type ScanResult = {
  status: 'SUCCESS' | 'ALREADY_USED' | 'ERROR' | 'EXPIRED';
  message: string;
  guestName?: string;
  ticketType?: string;
} | null;

export default function CheckInScanner() {
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult>(null);
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [cooldown, setCooldown] = useState(false);
  const { activeOrg } = useAuth();
  const { data: scanners } = useScanners(activeOrg?.id);
  const { data: events } = useEvents(activeOrg?.id);
  
  // Offline states
  const [eventId, setEventId] = useState<string>('');
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(navigator.onLine);
  const [offlineTickets, setOfflineTickets] = useState<any[]>([]);
  const [syncQueue, setSyncQueue] = useState<any[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [selectedScannerId, setSelectedScannerId] = useState<string>('');

  // Double-scan prevention debounce states
  const [lastScannedCode, setLastScannedCode] = useState<string>('');
  const [lastScanTime, setLastScanTime] = useState<number>(0);

  // Monitor browser online status
  useEffect(() => {
    const handleOnline = () => setIsBrowserOnline(true);
    const handleOffline = () => setIsBrowserOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-select first event
  useEffect(() => {
    if (events && events.length > 0 && !eventId) {
      setEventId(events[0].id);
    }
  }, [events, eventId]);

  // Load offline data from localStorage when event changes
  useEffect(() => {
    if (eventId) {
      const cached = localStorage.getItem(`nitepass_offline_tickets_${eventId}`);
      const queue = localStorage.getItem(`nitepass_sync_queue_${eventId}`);
      const syncTime = localStorage.getItem(`nitepass_last_sync_time_${eventId}`);
      
      setOfflineTickets(cached ? JSON.parse(cached) : []);
      setSyncQueue(queue ? JSON.parse(queue) : []);
      setLastSyncTime(syncTime ? new Date(syncTime) : null);
    }
  }, [eventId]);

  // Background sync and refresh interval every 30 seconds
  useEffect(() => {
    if (!eventId) return;

    // Sync on mount/event select
    syncOfflineQueue();

    const interval = setInterval(() => {
      syncOfflineQueue();
    }, 30000);

    return () => clearInterval(interval);
  }, [eventId]);

  const syncOfflineQueue = async (force = false) => {
    if (!eventId) return;
    const currentlyOnline = navigator.onLine && !isOffline;
    if (!currentlyOnline) {
      if (force) {
        toast.error('Sin conexión a internet. No se puede sincronizar.');
      }
      return;
    }

    setSyncing(true);
    try {
      // 1. Upload pending local scans
      const currentQueue = JSON.parse(localStorage.getItem(`nitepass_sync_queue_${eventId}`) || '[]');
      if (currentQueue.length > 0) {
        const failed = [];
        for (const item of currentQueue) {
          try {
            const { data, error } = await supabase.rpc('validate_ticket' as any, {
              p_code: item.code.trim().toUpperCase(),
              p_scanner_id: selectedScannerId || null
            });
            // If server reports validation processed or already validated elsewhere, count it as synced
            if (error && error.message !== 'Ticket ya usado') {
              failed.push(item);
            }
          } catch {
            failed.push(item);
          }
        }
        localStorage.setItem(`nitepass_sync_queue_${eventId}`, JSON.stringify(failed));
        setSyncQueue(failed);
        if (failed.length === 0 && currentQueue.length > 0) {
          toast.success('Entradas offline sincronizadas con éxito');
        }
      }

      // 2. Fetch/Refresh tickets database from server
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id,
          code,
          status,
          guest_name,
          type,
          ticket_types(name)
        `)
        .eq('event_id', eventId);

      if (error) throw error;

      const formatted = (data || []).map((r: any) => ({
        id: r.id,
        code: r.code,
        status: r.status,
        guest_name: r.guest_name,
        type: r.type,
        ticket_type_name: r.ticket_types?.name || 'Entrada'
      }));

      // Preserve local check-in states that haven't synced yet
      const unsyncedCodes = new Set(
        JSON.parse(localStorage.getItem(`nitepass_sync_queue_${eventId}`) || '[]').map((x: any) => x.code.toUpperCase())
      );

      const merged = formatted.map((t: any) => {
        if (unsyncedCodes.has(t.code.toUpperCase())) {
          return { ...t, status: 'used' };
        }
        return t;
      });

      localStorage.setItem(`nitepass_offline_tickets_${eventId}`, JSON.stringify(merged));
      const now = new Date();
      localStorage.setItem(`nitepass_last_sync_time_${eventId}`, now.toISOString());
      
      setOfflineTickets(merged);
      setLastSyncTime(now);
      if (force) {
        toast.success('Base de datos local actualizada correctamente');
      }
    } catch (err: any) {
      console.error(err);
      if (force) {
        toast.error('Error al sincronizar: ' + err.message);
      }
    } finally {
      setSyncing(false);
    }
  };

  const validateOffline = (codeToUse: string): ScanResult => {
    const tickets = JSON.parse(localStorage.getItem(`nitepass_offline_tickets_${eventId}`) || '[]');
    const ticket = tickets.find((t: any) => t.code.toUpperCase() === codeToUse.trim().toUpperCase());

    if (!ticket) {
      return {
        status: 'ERROR',
        message: 'Entrada no encontrada en la base local (¿posible compra de último minuto sin sincronizar?)'
      };
    }

    if (ticket.status === 'used') {
      return {
        status: 'ALREADY_USED',
        message: 'Ticket ya usado localmente',
        guestName: ticket.guest_name,
        ticketType: ticket.ticket_type_name
      };
    }

    // Mark as used locally
    ticket.status = 'used';
    localStorage.setItem(`nitepass_offline_tickets_${eventId}`, JSON.stringify(tickets));
    setOfflineTickets(tickets);

    // Enqueue for syncing
    const queue = JSON.parse(localStorage.getItem(`nitepass_sync_queue_${eventId}`) || '[]');
    queue.push({ id: ticket.id, code: ticket.code, scannedAt: new Date().toISOString() });
    localStorage.setItem(`nitepass_sync_queue_${eventId}`, JSON.stringify(queue));
    setSyncQueue(queue);

    return {
      status: 'SUCCESS',
      message: 'Acceso Permitido (Local - Offline)',
      guestName: ticket.guest_name,
      ticketType: ticket.ticket_type_name
    };
  };

  const handleValidate = async (overrideCode?: string) => {
    const codeToUse = overrideCode || code;
    if (cooldown || !codeToUse.trim()) return;
    
    // If scanners exist, one must be selected
    if (scanners && scanners.length > 0 && !selectedScannerId) {
      toast.error('Por favor, selecciona un punto de acceso (escáner)');
      return;
    }

    setScanning(true);
    setResult(null); // Clear previous result immediately
    setCooldown(true); // Start cooldown period

    const effectiveOffline = isOffline || !isBrowserOnline;

    if (effectiveOffline) {
      // Validate offline directly
      const offlineResult = validateOffline(codeToUse);
      setResult(offlineResult);
      if (offlineResult.status !== 'SUCCESS' && navigator.vibrate) {
        navigator.vibrate(200);
      }
      setScanning(false);
      
      // Cooldown timer
      setTimeout(() => {
        setCooldown(false);
        setCode('');
      }, 3000);
      return;
    }

    // Online Validation (with Timeout fallback)
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 2500)
      );
      
      const callPromise = supabase.rpc('validate_ticket' as any, { 
        p_code: codeToUse.trim().toUpperCase(),
        p_scanner_id: selectedScannerId || null
      });

      const { data, error } = await Promise.race([callPromise, timeoutPromise]) as any;
      if (error) throw error;

      if (!data) {
        throw new Error('No response data');
      }

      setResult({
        status: data.status as any,
        message: data.message,
        guestName: data.guestName,
        ticketType: data.ticketType,
      });

      // Keep local cache in sync upon successful online check-in
      if (data.status === 'SUCCESS') {
        const tickets = JSON.parse(localStorage.getItem(`nitepass_offline_tickets_${eventId}`) || '[]');
        const index = tickets.findIndex((t: any) => t.code.toUpperCase() === codeToUse.trim().toUpperCase());
        if (index !== -1) {
          tickets[index].status = 'used';
          localStorage.setItem(`nitepass_offline_tickets_${eventId}`, JSON.stringify(tickets));
          setOfflineTickets(tickets);
        }
      }

      if (data.status !== 'SUCCESS' && navigator.vibrate) {
        navigator.vibrate(200);
      }
    } catch (err: any) {
      console.warn('Network issue or timeout, fallback to local offline DB...', err);
      
      // Fallback check against local DB if network fails
      const localTickets = JSON.parse(localStorage.getItem(`nitepass_offline_tickets_${eventId}`) || '[]');
      const ticketExistsLocal = localTickets.some((t: any) => t.code.toUpperCase() === codeToUse.trim().toUpperCase());

      if (ticketExistsLocal) {
        const offlineResult = validateOffline(codeToUse);
        if (offlineResult.status === 'SUCCESS') {
          offlineResult.message = 'Acceso Permitido (Conexión inestable/Offline)';
        }
        setResult(offlineResult);
        if (offlineResult.status !== 'SUCCESS' && navigator.vibrate) {
          navigator.vibrate(200);
        }
        toast.warning('Señal inestable: Entrada validada localmente.');
      } else {
        setResult({
          status: 'ERROR',
          message: 'Sin conexión a internet y ticket no encontrado en la base local (¿venta reciente?)'
        });
      }
    }

    setScanning(false);
    
    // Cooldown timer
    setTimeout(() => {
      setCooldown(false);
      setCode('');
    }, 3000); 
  };

  const onScan = (detectedCodes: IDetectedBarcode[]) => {
    if (scanning || cooldown) return;
    if (detectedCodes && detectedCodes.length > 0) {
      const scannedText = detectedCodes[0].rawValue;
      if (scannedText) {
        const now = Date.now();
        // Ignore duplicate scan of the same code within 8 seconds
        if (scannedText === lastScannedCode && now - lastScanTime < 8000) {
          return;
        }
        setLastScannedCode(scannedText);
        setLastScanTime(now);
        setCode(scannedText);
        handleValidate(scannedText);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Event Selection and Sync control panel */}
      <div className="glass-card p-4 space-y-3 border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase">
            <Wifi className="h-4 w-4" /> Control Offline & Sincronización
          </div>
          {/* Offline manual switch */}
          <label className="flex items-center gap-2 cursor-pointer group">
            <div 
              onClick={() => setIsOffline(!isOffline)}
              className={`w-9 h-5 rounded-full p-1 transition-colors duration-200 ease-in-out ${isOffline ? 'bg-destructive' : 'bg-success'}`}
            >
              <div className={`w-3 h-3 bg-white rounded-full transition-transform duration-200 ease-in-out ${isOffline ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <span className="text-[10px] font-black uppercase text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-1">
              {isOffline ? <WifiOff className="h-3.5 w-3.5 text-destructive" /> : <Wifi className="h-3.5 w-3.5 text-success" />}
              {isOffline ? 'Offline' : 'Online'}
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-muted-foreground uppercase ml-1">Seleccionar Evento</label>
            <select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              className="w-full rounded-xl bg-secondary px-3 py-2.5 text-xs text-foreground outline-none ring-1 ring-border"
            >
              <option value="">-- Elige un evento --</option>
              {events?.map((e: any) => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col justify-end">
            <button
              onClick={() => syncOfflineQueue(true)}
              disabled={syncing || !eventId}
              className="w-full touch-target rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all text-xs font-bold py-2.5 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              Sincronizar y Descargar
            </button>
          </div>
        </div>

        {/* Local database status */}
        {eventId && (
          <div className="border-t border-border/50 pt-2.5 mt-2 flex flex-wrap gap-x-4 gap-y-1.5 justify-between text-[10px] text-muted-foreground font-medium">
            <div>
              Base Local: <span className="font-bold text-foreground">{offlineTickets.length} tickets</span>
            </div>
            <div>
              Última Sinc: <span className="font-bold text-foreground">
                {lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'Nunca'}
              </span>
            </div>
            <div>
              Cola Pendiente: <span className={`font-bold ${syncQueue.length > 0 ? 'text-warning animate-pulse' : 'text-foreground'}`}>
                {syncQueue.length} por subir
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Access point scanner selection */}
      {scanners && scanners.length > 0 && (
        <div className="glass-card p-4 space-y-3 border-primary/20">
          <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase">
            <ScanLine className="h-4 w-4" /> Seleccionar Punto de Acceso
          </div>
          <select 
            value={selectedScannerId}
            onChange={(e) => setSelectedScannerId(e.target.value)}
            className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground outline-none ring-1 ring-border focus:ring-primary appearance-none cursor-pointer"
          >
            <option value="">-- Elige un acceso --</option>
            {scanners.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {selectedScannerId && (
            <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg border border-primary/10">
              <Info className="h-3.5 w-3.5 text-primary" />
              <p className="text-[10px] text-muted-foreground">
                Configurado para: <span className="font-bold text-primary">
                  {scanners.find((s: any) => s.id === selectedScannerId)?.allowed_ticket_types?.join(', ') || 'Todos los tickets'}
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 bg-secondary p-1 rounded-xl w-max mx-auto md:mx-0">
        <button 
          onClick={() => setMode('camera')} 
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${mode === 'camera' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Camera className="h-4 w-4" /> Cámara
        </button>
        <button 
          onClick={() => setMode('manual')} 
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${mode === 'manual' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Keyboard className="h-4 w-4" /> Manual
        </button>
      </div>

      {mode === 'camera' ? (
        <div className="glass-card p-4 space-y-3">
          <div className="rounded-xl overflow-hidden ring-1 ring-border aspect-square sm:aspect-video w-full max-w-sm mx-auto relative bg-black flex items-center justify-center">
            {!scanning ? (
              <Scanner onScan={onScan} />
            ) : (
              <div className="text-white text-sm font-medium animate-pulse">Procesando código...</div>
            )}
          </div>
          <p className="text-center text-xs text-muted-foreground">Apunta la cámara al código QR de la entrada</p>
        </div>
      ) : (
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
              onClick={() => handleValidate()}
              disabled={scanning || !code.trim()}
              className="touch-target rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:shadow-glow active:scale-[0.98] disabled:opacity-40 flex items-center gap-2"
            >
              <ScanLine className="h-4 w-4" />
              Validar
            </button>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={result.status + Date.now()} 
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
                <p className="text-lg font-bold text-foreground">
                  {result.status === 'ALREADY_USED' ? 'Ticket Ya Usado' : 
                   result.status === 'EXPIRED' ? 'Ticket Vencido' : 'Código Inválido'}
                </p>
                <p className="text-sm text-muted-foreground">{result.message}</p>
                {(result.guestName || result.ticketType) && (
                  <p className="text-sm font-semibold mt-2 text-foreground/80">
                    {result.guestName} <span className="text-muted-foreground text-xs">({result.ticketType})</span>
                  </p>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
