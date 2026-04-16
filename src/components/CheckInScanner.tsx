import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanLine, CheckCircle, XCircle, Keyboard, Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Scanner, IDetectedBarcode } from '@yudiel/react-qr-scanner';

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

  const handleValidate = async (overrideCode?: string) => {
    const codeToUse = overrideCode || code;
    if (!codeToUse.trim()) return;
    setScanning(true);
    setResult(null);

    try {
      const { data: rawData, error } = await supabase.rpc('validate_ticket' as any, { p_code: codeToUse.trim().toUpperCase() });
      const data = rawData as any;
      if (error) throw error;

      if (!data) {
        setResult({ status: 'ERROR', message: 'Error de servidor' });
      } else {
        setResult({
          status: data.status as any,
          message: data.message,
          guestName: data.guestName,
          ticketType: data.ticketType,
        });
        if (data.status !== 'SUCCESS' && navigator.vibrate) {
          navigator.vibrate(200);
        }
      }
    } catch {
      setResult({ status: 'ERROR', message: 'Error de servidor' });
    }

    setScanning(false);
    setTimeout(() => {
      setCode('');
      // Limpiar resultado despues de corto tiempo si escanea automatico, o dejar para que el guardia vea?
      // Es mejor dejar que el guardia vea el color en pantalla unos 3 segundos, pero setCode vacío permite
      // escanear de una el siguiente ticket
    }, 2000); 
  };

  const onScan = (detectedCodes: IDetectedBarcode[]) => {
    if (scanning) return;
    if (detectedCodes && detectedCodes.length > 0) {
      const scannedText = detectedCodes[0].rawValue;
      if (scannedText) {
        setCode(scannedText);
        handleValidate(scannedText);
      }
    }
  };

  return (
    <div className="space-y-4">
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
