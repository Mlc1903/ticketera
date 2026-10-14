import { useMemo, useState } from 'react';
import { MapPin, Calendar, Ticket, DollarSign, Crown, X, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CITIES = ['Tarija', 'Cochabamba', 'Sucre', 'Santa Cruz', 'La Paz'];

const normalize = (s?: string | null) =>
  (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

interface Props {
  events: any[];
  reservations: any[];
  rrppAssignments: any[];
  sales?: any[];
}

export default function SalesByCity({ events, reservations, rrppAssignments, sales: salesLog = [] }: Props) {
  const [eventId, setEventId] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [selectedTL, setSelectedTL] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (!eventId || !city) return [];
    const leaders = rrppAssignments.filter(
      (a) => a.is_team_leader && normalize(a.city) === normalize(city)
    );
    // Avoid duplicates if a TL has more than one assignment row
    const unique = Array.from(new Map(leaders.map((l) => [l.user_id, l])).values());

    return unique
      .map((tl) => {
        const sold = reservations.filter(
          (r) =>
            r.event_id === eventId &&
            r.rrpp_id === tl.user_id &&
            (r.status === 'active' || r.status === 'used') &&
            r.type !== 'rrpp_free'
        );
        const qty = sold.reduce((acc, r) => acc + (r.quantity || 1), 0);
        const amount = sold.reduce((acc, r) => acc + (r.quantity || 1) * Number(r.ticket_types?.price || 0), 0);
        const name = tl.profile?.name || tl.profile?.email || 'Sin nombre';
        const tlCity = tl.city || city;

        // One row per sale registered at "Verificar Pago"
        const sales = salesLog
          .filter((s) => s.event_id === eventId && s.rrpp_id === tl.user_id)
          .map((s) => ({
            qty: Number(s.quantity || 0),
            amount: Number(s.total_amount || 0),
            rrpp: (s.seller_name || '').trim() || '—',
            city: tlCity,
            tl: name,
            date: s.created_at,
          }));
        return { id: tl.user_id, name, qty, amount, sales };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [eventId, city, reservations, rrppAssignments, salesLog]);

  const detail = rows.find((r) => r.id === selectedTL);

  const totals = rows.reduce((acc, r) => ({ qty: acc.qty + r.qty, amount: acc.amount + r.amount }), { qty: 0, amount: 0 });

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Step 1: event */}
      <div className="glass-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" /> 1. Elige el evento
        </h3>
        <select
          id="ventas-event-select"
          value={eventId}
          onChange={(e) => { setEventId(e.target.value); setCity(''); setSelectedTL(null); }}
          className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground ring-1 ring-border outline-none focus:ring-primary"
        >
          <option value="">Seleccionar evento</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.title} — {ev.date}</option>
          ))}
        </select>
      </div>

      {/* Step 2: city */}
      {eventId && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" /> 2. Elige la ciudad
          </h3>
          <div className="flex flex-wrap gap-2">
            {CITIES.map((c) => (
              <button
                key={c}
                id={`ventas-city-${normalize(c).replace(/\s/g, '-')}`}
                onClick={() => { setCity(c); setSelectedTL(null); }}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-all active:scale-95 ${
                  city === c ? 'bg-primary text-primary-foreground shadow-glow' : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Step 3: table */}
      {eventId && city && (
        <motion.div key={city} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Crown className="h-4 w-4 text-warning" /> Team Leaders — {city}
          </h3>

          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No hay Team Leaders registrados en {city}.</p>
          ) : (
            <div className="overflow-hidden rounded-xl ring-1 ring-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/80 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Team Leader</th>
                    <th className="text-center px-4 py-3"><span className="inline-flex items-center gap-1"><Ticket className="h-3.5 w-3.5" />Ventas</span></th>
                    <th className="text-right px-4 py-3"><span className="inline-flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />Monto</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border hover:bg-secondary/40 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        <button
                          id={`ventas-tl-${r.id}`}
                          onClick={() => setSelectedTL(selectedTL === r.id ? null : r.id)}
                          className={`inline-flex items-center gap-1 transition-colors hover:text-primary hover:underline ${selectedTL === r.id ? 'text-primary' : 'text-foreground'}`}
                        >
                          {r.name}
                          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${selectedTL === r.id ? 'rotate-90' : ''}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-lg font-bold text-primary">{r.qty}</span>
                        <p className="text-[10px] text-muted-foreground">entradas</p>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-success">Bs. {r.amount.toLocaleString('es-BO')}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-secondary/60 border-t border-border">
                  <tr>
                    <td className="px-4 py-3 font-bold text-foreground">Total</td>
                    <td className="px-4 py-3 text-center font-bold text-foreground">{totals.qty}</td>
                    <td className="px-4 py-3 text-right font-bold text-foreground">Bs. {totals.amount.toLocaleString('es-BO')}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {/* Step 4: TL sales detail */}
      <AnimatePresence>
        {detail && (
          <motion.div
            key={detail.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="glass-card p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Ticket className="h-4 w-4 text-primary" /> Ventas de {detail.name}
              </h3>
              <button id="ventas-detail-close" onClick={() => setSelectedTL(null)} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl ring-1 ring-border">
              <table className="w-full text-sm">
                <thead className="bg-primary/20 text-xs uppercase tracking-wider text-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Nro de venta</th>
                    <th className="text-left px-4 py-3">Ciudad</th>
                    <th className="text-left px-4 py-3">Nombre del RRPP</th>
                    <th className="text-left px-4 py-3">Team leader</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.sales.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Aún no hay ventas registradas.</td></tr>
                  ) : (
                    detail.sales.map((s, i) => (
                      <tr key={i} className="border-t border-border hover:bg-secondary/40 transition-colors">
                        <td className="px-4 py-3 font-bold text-success">{s.amount.toLocaleString('es-BO')}bs ({s.qty})</td>
                        <td className="px-4 py-3 text-foreground">{s.city}</td>
                        <td className="px-4 py-3 text-foreground">{s.rrpp}</td>
                        <td className="px-4 py-3 text-foreground">{s.tl}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
