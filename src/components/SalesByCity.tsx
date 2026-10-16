import { useMemo, useState, useEffect } from 'react';
import { MapPin, Calendar, Ticket, DollarSign, Crown, X, ChevronRight, Edit, Check, Trash2, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ seller_name: string; items: Record<string, string> }>({ seller_name: '', items: {} });
  const [saving, setSaving] = useState(false);
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [newRowForm, setNewRowForm] = useState<{
    seller_name: string;
    items: Record<string, string>;
    delivered: boolean;
  }>({ seller_name: '', items: {}, delivered: false });
  const [savingNewRow, setSavingNewRow] = useState(false);
  const [tlQuotaMap, setTlQuotaMap] = useState<Record<string, number>>({});

  const queryClient = useQueryClient();
  const { user, hasRole } = useAuth();
  const isAdmin = !!(user && (hasRole('admin') || hasRole('super_admin')));

  // Paid ticket types of the selected event -> one column each
  const ticketTypes = useMemo(() => {
    const ev = events.find((e) => e.id === eventId);
    return ((ev?.ticket_types || []) as any[]).filter((t) => t.type !== 'rrpp_free');
  }, [events, eventId]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-rrpp-sales'] });

  const toggleDelivered = async (id: string, value: boolean) => {
    if (!isAdmin) return;
    const { error } = await supabase.from('rrpp_sales' as any).update({ delivered: value }).eq('id', id);
    if (error) return toast.error('No se pudo actualizar');
    refresh();
  };

  const startEdit = (s: any) => {
    setIsAddingRow(false);
    setEditingId(s.id);
    setEditForm({
      seller_name: s.rrpp === '—' ? '' : s.rrpp,
      items: Object.fromEntries(ticketTypes.map((t) => [t.id, String(s.items?.[t.id] ?? 0)])),
    });
  };

  const resetNewRowForm = () => {
    setNewRowForm({
      seller_name: '',
      items: Object.fromEntries(ticketTypes.map((t) => [t.id, '0'])),
      delivered: false,
    });
  };

  const startAddRow = () => {
    setEditingId(null);
    resetNewRowForm();
    setIsAddingRow(true);
  };

  const getRowTotal = (s: any) => {
    const computed = ticketTypes.reduce((acc, t) => {
      const q = Number(s.items?.[t.id] ?? 0);
      return acc + q * Number(t.price || 0);
    }, 0);
    return computed > 0 ? computed : Number(s.amount || 0);
  };

  const getEditingRowTotal = () => {
    return ticketTypes.reduce((acc, t) => {
      const q = Math.max(0, parseInt(editForm.items[t.id] || '0') || 0);
      return acc + q * Number(t.price || 0);
    }, 0);
  };

  const getNewRowTotal = () => {
    return ticketTypes.reduce((acc, t) => {
      const q = Math.max(0, parseInt(newRowForm.items[t.id] || '0') || 0);
      return acc + q * Number(t.price || 0);
    }, 0);
  };

  const getNewRowQty = () => {
    return ticketTypes.reduce((acc, t) => {
      const q = Math.max(0, parseInt(newRowForm.items[t.id] || '0') || 0);
      return acc + q;
    }, 0);
  };

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
            id: s.id as string,
            items: (s.items || {}) as Record<string, number>,
            delivered: !!s.delivered,
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

  useEffect(() => {
    if (!detail) return;
    const currentSalesTotal = detail.sales.reduce((acc, s) => acc + s.qty, 0);
    const candidateQuota = Math.max(detail.qty || 0, currentSalesTotal);
    if (candidateQuota > (tlQuotaMap[detail.id] || 0)) {
      setTlQuotaMap((prev) => ({ ...prev, [detail.id]: candidateQuota }));
    }
  }, [detail, tlQuotaMap]);

  // Quota total de entradas del Team Leader que se pueden reestructurar
  const detailQuota = useMemo(() => {
    if (!detail) return 0;
    if (detail.qty > 0) return detail.qty;
    return tlQuotaMap[detail.id] || detail.sales.reduce((acc, s) => acc + s.qty, 0);
  }, [detail, tlQuotaMap]);

  // Total de entradas actualmente asignadas en las filas
  const currentAssignedQty = useMemo(() => {
    if (!detail) return 0;
    return detail.sales.reduce((acc, s) => acc + s.qty, 0);
  }, [detail]);

  // Entradas que aún quedan disponibles para repartir
  const availableToAssign = Math.max(0, detailQuota - currentAssignedQty);

  const saveEdit = async () => {
    if (!editingId || !detail) return;
    const targetName = editForm.seller_name.trim();
    if (!targetName) {
      return toast.error('Ingresa el nombre del RRPP');
    }

    const items: Record<string, number> = {};
    let quantity = 0;
    let total_amount = 0;
    ticketTypes.forEach((t) => {
      const q = Math.max(0, parseInt(editForm.items[t.id] || '0') || 0);
      if (q > 0) items[t.id] = q;
      quantity += q;
      total_amount += q * Number(t.price || 0);
    });

    if (quantity <= 0) {
      return toast.error('La fila debe tener al menos 1 entrada');
    }

    // Regla: no pasarse de las entradas que tiene el Team Leader
    const otherRowsAssigned = detail.sales
      .filter((s) => s.id !== editingId)
      .reduce((acc, s) => acc + s.qty, 0);
    const maxAllowedForThisRow = detailQuota - otherRowsAssigned;

    if (quantity > maxAllowedForThisRow) {
      return toast.error(
        `No puedes exceder el total de ${detailQuota} entradas del Team Leader. El máximo permitido para esta fila es ${maxAllowedForThisRow} entradas.`
      );
    }

    setSaving(true);
    try {
      // Regla: si se renombra al nombre de otra fila existente (ej. Pepe), fusionar en lugar de duplicar fila
      const otherExisting = detail.sales.find(
        (s) => s.id !== editingId && s.rrpp.trim().toLowerCase() === targetName.toLowerCase()
      );

      if (otherExisting) {
        const mergedItems: Record<string, number> = { ...(otherExisting.items || {}) };
        ticketTypes.forEach((t) => {
          const q = items[t.id] || 0;
          if (q > 0) {
            mergedItems[t.id] = (mergedItems[t.id] || 0) + q;
          }
        });
        const mergedQuantity = Object.values(mergedItems).reduce((a, b) => a + b, 0);
        const mergedAmount = ticketTypes.reduce(
          (acc, t) => acc + (mergedItems[t.id] || 0) * Number(t.price || 0),
          0
        );

        const { error: updErr } = await supabase
          .from('rrpp_sales' as any)
          .update({
            items: mergedItems,
            quantity: mergedQuantity,
            total_amount: mergedAmount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', otherExisting.id);

        if (updErr) throw updErr;

        await supabase.from('rrpp_sales' as any).delete().eq('id', editingId);
        toast.success(`Se fusionó con la fila existente de ${otherExisting.rrpp} (Total: ${mergedQuantity} entradas)`);
      } else {
        const { error } = await supabase
          .from('rrpp_sales' as any)
          .update({
            seller_name: targetName,
            items,
            quantity,
            total_amount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);

        if (error) throw error;
        toast.success('Venta actualizada');
      }

      setEditingId(null);
      refresh();
    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveNewRow = async (targetTlId: string) => {
    if (!targetTlId || !detail) return;

    // Regla 1: Solo se puede si ya tiene ventas realizadas
    if (detailQuota <= 0 || detail.sales.length === 0) {
      return toast.error('Este Team Leader aún no tiene ventas realizadas para reestructurar.');
    }

    const sellerNameTrimmed = newRowForm.seller_name.trim();
    if (!sellerNameTrimmed) {
      return toast.error('Ingresa el nombre del RRPP');
    }

    const items: Record<string, number> = {};
    let quantityToAdd = 0;
    let amountToAdd = 0;
    ticketTypes.forEach((t) => {
      const q = Math.max(0, parseInt(newRowForm.items[t.id] || '0') || 0);
      if (q > 0) items[t.id] = q;
      quantityToAdd += q;
      amountToAdd += q * Number(t.price || 0);
    });

    if (quantityToAdd <= 0) {
      return toast.error('Debes asignar al menos 1 entrada en algún tipo');
    }

    // Regla 2: No pasarse del total disponible
    if (quantityToAdd > availableToAssign) {
      return toast.error(
        `No puedes exceder el total de ${detailQuota} entradas del Team Leader. Solo quedan ${availableToAssign} entradas disponibles por asignar.`
      );
    }

    setSavingNewRow(true);
    try {
      // Regla 3: Si ya existe una fila de este RRPP (ej. Pepe), se suman las entradas a esa fila
      const normalizedName = sellerNameTrimmed.toLowerCase();
      const existingSale = detail.sales.find(
        (s) => s.rrpp.trim().toLowerCase() === normalizedName
      );

      if (existingSale) {
        const mergedItems: Record<string, number> = { ...(existingSale.items || {}) };
        ticketTypes.forEach((t) => {
          const q = items[t.id] || 0;
          if (q > 0) {
            mergedItems[t.id] = (mergedItems[t.id] || 0) + q;
          }
        });
        const mergedQuantity = Object.values(mergedItems).reduce((a, b) => a + b, 0);
        const mergedAmount = ticketTypes.reduce(
          (acc, t) => acc + (mergedItems[t.id] || 0) * Number(t.price || 0),
          0
        );

        const { error: updateErr } = await supabase
          .from('rrpp_sales' as any)
          .update({
            items: mergedItems,
            quantity: mergedQuantity,
            total_amount: mergedAmount,
            delivered: newRowForm.delivered || existingSale.delivered,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingSale.id);

        if (updateErr) throw updateErr;

        toast.success(
          `Se sumaron ${quantityToAdd} entradas a la venta existente de ${existingSale.rrpp} (Total: ${mergedQuantity} entradas)`
        );
      } else {
        const payload = {
          event_id: eventId,
          rrpp_id: targetTlId,
          seller_name: sellerNameTrimmed,
          quantity: quantityToAdd,
          total_amount: amountToAdd,
          items,
          delivered: newRowForm.delivered,
        };

        let { error } = await supabase.from('rrpp_sales' as any).insert(payload);

        if (error) {
          const rpcRes = await (supabase.rpc as any)('admin_add_rrpp_sale', {
            _event_id: eventId,
            _rrpp_id: targetTlId,
            _seller_name: sellerNameTrimmed,
            _items: items,
            _quantity: quantityToAdd,
            _amount: amountToAdd,
            _delivered: newRowForm.delivered,
          });
          if (rpcRes.error) {
            throw new Error(error.message || rpcRes.error.message);
          }
        }

        toast.success(`Fila de venta agregada para ${sellerNameTrimmed} (${quantityToAdd} entradas)`);
      }

      setIsAddingRow(false);
      resetNewRowForm();
      refresh();
    } catch (err: any) {
      console.error('Error al agregar/actualizar fila:', err);
      toast.error('Error: ' + (err.message || 'Error desconocido'));
    } finally {
      setSavingNewRow(false);
    }
  };

  const deleteSale = async (id: string) => {
    if (!confirm('¿Eliminar esta fila de venta?')) return;
    const { error } = await supabase.from('rrpp_sales' as any).delete().eq('id', id);
    if (error) return toast.error('Error al eliminar');
    toast.success('Venta eliminada');
    refresh();
  };

  const detailTotals = useMemo(() => {
    if (!detail) return { items: {} as Record<string, number>, totalQty: 0, totalAmount: 0 };
    const items: Record<string, number> = {};
    ticketTypes.forEach((t) => { items[t.id] = 0; });
    let totalQty = 0;
    let totalAmount = 0;
    detail.sales.forEach((s) => {
      ticketTypes.forEach((t) => {
        const q = Number(s.items?.[t.id] || 0);
        items[t.id] = (items[t.id] || 0) + q;
      });
      totalQty += Number(s.qty || 0);
      totalAmount += getRowTotal(s);
    });
    return { items, totalQty, totalAmount };
  }, [detail, ticketTypes]);

  // Quick event summary: one row per ticket type (all cities)
  const summary = useMemo(() => {
    if (!eventId) return [];
    const map = new Map<string, { name: string; price: number; qty: number; amount: number }>();
    reservations
      .filter((r) => r.event_id === eventId && (r.status === 'active' || r.status === 'used') && r.type !== 'rrpp_free')
      .forEach((r) => {
        const key = r.ticket_type_id || r.ticket_types?.name || 'sin-tipo';
        const price = Number(r.ticket_types?.price || 0);
        const q = r.quantity || 1;
        const cur = map.get(key) || { name: r.ticket_types?.name || 'Sin tipo', price, qty: 0, amount: 0 };
        cur.qty += q;
        cur.amount += q * price;
        map.set(key, cur);
      });
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [eventId, reservations]);
  const summaryTotals = summary.reduce((acc, s) => ({ qty: acc.qty + s.qty, amount: acc.amount + s.amount }), { qty: 0, amount: 0 });

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

      {/* Event quick summary by ticket type */}
      {eventId && (
        <motion.div key={`sum-${eventId}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Ticket className="h-4 w-4 text-primary" /> Resumen rápido del evento
          </h3>
          {summary.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aún no hay entradas vendidas para este evento.</p>
          ) : (
            <div className="overflow-hidden rounded-xl ring-1 ring-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/80 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Tipo de entrada</th>
                    <th className="text-center px-4 py-3">Vendidas</th>
                    <th className="text-right px-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((s) => (
                    <tr key={s.name} className="border-t border-border hover:bg-secondary/40 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {s.name}
                        <p className="text-[10px] text-muted-foreground">Bs. {s.price.toLocaleString('es-BO')} c/u</p>
                      </td>
                      <td className="px-4 py-3 text-center text-lg font-bold text-primary">{s.qty}</td>
                      <td className="px-4 py-3 text-right font-bold text-success">Bs. {s.amount.toLocaleString('es-BO')}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-secondary/60 border-t border-border">
                  <tr>
                    <td className="px-4 py-3 font-bold text-foreground">Total</td>
                    <td className="px-4 py-3 text-center font-bold text-foreground">{summaryTotals.qty}</td>
                    <td className="px-4 py-3 text-right font-bold text-foreground">Bs. {summaryTotals.amount.toLocaleString('es-BO')}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </motion.div>
      )}

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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-primary" /> Ventas de {detail.name}
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-xs mt-1">
                  <span className="text-muted-foreground">
                    Total Team Leader: <strong className="text-foreground">{detailQuota}</strong> entradas
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span className={currentAssignedQty === detailQuota ? 'text-success font-bold' : 'text-primary font-bold'}>
                    Asignadas: {currentAssignedQty} / {detailQuota}
                  </span>
                  {detailQuota > 0 && availableToAssign > 0 && (
                    <span className="rounded-md bg-warning/10 px-2 py-0.5 text-warning font-semibold">
                      {availableToAssign} por asignar
                    </span>
                  )}
                  {detailQuota > 0 && availableToAssign === 0 && (
                    <span className="rounded-md bg-success/10 px-2 py-0.5 text-success font-semibold">
                      Totalmente asignadas
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isAdmin && detailQuota > 0 && detail.sales.length > 0 && (
                  <button
                    id="ventas-add-row-btn"
                    disabled={availableToAssign <= 0 && !isAddingRow}
                    onClick={() => {
                      if (isAddingRow) {
                        setIsAddingRow(false);
                      } else {
                        if (availableToAssign <= 0) {
                          return toast.error(
                            `Ya se asignaron todas las ${detailQuota} entradas de este Team Leader. Para reasignar, primero reduce la cantidad en una de las filas existentes.`
                          );
                        }
                        startAddRow();
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all shadow-glow ${
                      isAddingRow
                        ? 'bg-secondary text-foreground hover:bg-secondary/80'
                        : availableToAssign <= 0
                        ? 'bg-secondary text-muted-foreground cursor-not-allowed opacity-60'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`}
                    title={availableToAssign <= 0 ? 'Todas las entradas ya han sido asignadas' : 'Agregar fila para reestructurar'}
                  >
                    <Plus className={`h-3.5 w-3.5 transition-transform ${isAddingRow ? 'rotate-45' : ''}`} />
                    {isAddingRow ? 'Cancelar' : availableToAssign <= 0 ? 'Todas asignadas' : 'Agregar fila'}
                  </button>
                )}
                <button
                  id="ventas-detail-close"
                  onClick={() => {
                    setSelectedTL(null);
                    setIsAddingRow(false);
                  }}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl ring-1 ring-border">
              <table className="w-full text-sm">
                <thead className="bg-primary/20 text-xs uppercase tracking-wider text-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Nro de venta</th>
                    <th className="text-left px-4 py-3">Ciudad</th>
                    <th className="text-left px-4 py-3">Nombre del RRPP</th>
                    <th className="text-left px-4 py-3">Team leader</th>
                    {ticketTypes.map((t) => (
                      <th key={t.id} className="text-center px-4 py-3 whitespace-nowrap">{t.name}</th>
                    ))}
                    <th className="text-right px-4 py-3 whitespace-nowrap">Total Bs</th>
                    <th className="text-center px-4 py-3">Entregado</th>
                    {isAdmin && <th className="text-center px-3 py-3 whitespace-nowrap">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {isAddingRow && (
                    <tr className="border-t-2 border-primary/50 bg-primary/10">
                      <td className="px-4 py-3 font-bold text-primary">
                        <span className="inline-flex items-center gap-1 text-xs"><Plus className="h-3 w-3" /> Nueva</span>
                      </td>
                      <td className="px-4 py-3 text-foreground font-medium">
                        {detail.sales[0]?.city || city}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          id="new-sale-rrpp-name"
                          placeholder="Nombre del RRPP *"
                          value={newRowForm.seller_name}
                          onChange={(e) => setNewRowForm({ ...newRowForm, seller_name: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveNewRow(detail.id); }}
                          className="w-full rounded-lg bg-secondary px-2 py-1 text-sm text-foreground ring-1 ring-border outline-none focus:ring-primary min-w-[140px]"
                          autoFocus
                        />
                      </td>
                      <td className="px-4 py-3 text-foreground font-medium">
                        {detail.name}
                      </td>
                      {ticketTypes.map((t) => (
                        <td key={t.id} className="px-4 py-3 text-center">
                          <input
                            type="number"
                            min={0}
                            value={newRowForm.items[t.id] ?? '0'}
                            onChange={(e) =>
                              setNewRowForm({
                                ...newRowForm,
                                items: { ...newRowForm.items, [t.id]: e.target.value },
                              })
                            }
                            onKeyDown={(e) => { if (e.key === 'Enter') saveNewRow(detail.id); }}
                            className="w-full rounded-lg bg-secondary px-2 py-1 text-sm text-foreground ring-1 ring-border outline-none focus:ring-primary w-16 text-center"
                          />
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right font-bold whitespace-nowrap">
                        <span className={getNewRowQty() > availableToAssign ? 'text-destructive font-bold' : 'text-success'}>
                          Bs. {getNewRowTotal().toLocaleString('es-BO')}
                        </span>
                        {getNewRowQty() > 0 && (
                          <p className={`text-[10px] ${getNewRowQty() > availableToAssign ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                            {getNewRowQty()} / {availableToAssign} disp.
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          id="new-sale-delivered-toggle"
                          type="button"
                          role="switch"
                          aria-checked={newRowForm.delivered}
                          onClick={() => setNewRowForm({ ...newRowForm, delivered: !newRowForm.delivered })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            newRowForm.delivered ? 'bg-success' : 'bg-muted'
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                              newRowForm.delivered ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            id="new-sale-save-btn"
                            disabled={savingNewRow}
                            onClick={() => saveNewRow(detail.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-white hover:bg-success/90 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                            {savingNewRow ? 'Guardando...' : 'Guardar'}
                          </button>
                          <button
                            id="new-sale-cancel-btn"
                            onClick={() => {
                              setIsAddingRow(false);
                              resetNewRowForm();
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-all active:scale-95"
                          >
                            <X className="h-3.5 w-3.5" />
                            Cancelar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {detail.sales.length === 0 && !isAddingRow ? (
                    <tr>
                      <td colSpan={7 + ticketTypes.length} className="px-4 py-6 text-center text-muted-foreground">
                        {detailQuota <= 0
                          ? 'Este Team Leader aún no tiene ventas realizadas para reestructurar.'
                          : 'Aún no hay ventas registradas.'}
                      </td>
                    </tr>
                  ) : (
                    detail.sales.map((s, i) => {
                      const editing = editingId === s.id;
                      const inputCls = 'w-full rounded-lg bg-secondary px-2 py-1 text-sm text-foreground ring-1 ring-border outline-none focus:ring-primary';
                      return (
                        <tr key={s.id} className={`border-t border-border transition-colors ${s.delivered ? 'bg-success/10' : 'hover:bg-secondary/40'}`}>
                          <td className="px-4 py-3 font-bold text-success">{i + 1}</td>
                          <td className="px-4 py-3 text-foreground">{s.city}</td>
                          <td className="px-4 py-3 text-foreground">
                            {editing ? (
                              <input
                                value={editForm.seller_name}
                                onChange={(e) => setEditForm({ ...editForm, seller_name: e.target.value })}
                                onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); }}
                                className={`${inputCls} min-w-[140px]`}
                              />
                            ) : s.rrpp}
                          </td>
                          <td className="px-4 py-3 text-foreground">{s.tl}</td>
                          {ticketTypes.map((t) => (
                            <td key={t.id} className="px-4 py-3 text-center font-bold text-primary">
                              {editing ? (
                                <input
                                  type="number"
                                  min={0}
                                  value={editForm.items[t.id] ?? '0'}
                                  onChange={(e) => setEditForm({ ...editForm, items: { ...editForm.items, [t.id]: e.target.value } })}
                                  onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); }}
                                  className={`${inputCls} w-16 text-center`}
                                />
                              ) : (s.items[t.id] || 0)}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-right font-bold text-success whitespace-nowrap">
                            Bs. {(editing ? getEditingRowTotal() : getRowTotal(s)).toLocaleString('es-BO')}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              id={`ventas-delivered-${s.id}`}
                              role="switch"
                              aria-checked={s.delivered}
                              disabled={!isAdmin}
                              onClick={() => toggleDelivered(s.id, !s.delivered)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:cursor-not-allowed ${s.delivered ? 'bg-success' : 'bg-muted'}`}
                            >
                              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${s.delivered ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </button>
                          </td>
                          {isAdmin && (
                            <td className="px-3 py-3 whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                {editing ? (
                                  <>
                                    <button
                                      id={`ventas-save-${s.id}`}
                                      disabled={saving}
                                      onClick={saveEdit}
                                      className="inline-flex items-center gap-1 rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-white hover:bg-success/90 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                      {saving ? 'Guardando...' : 'Guardar'}
                                    </button>
                                    <button
                                      id={`ventas-cancel-${s.id}`}
                                      onClick={() => setEditingId(null)}
                                      className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-all active:scale-95"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                      Cancelar
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      id={`ventas-edit-${s.id}`}
                                      onClick={() => startEdit(s)}
                                      title="Editar fila"
                                      className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary/80 hover:text-primary transition-all active:scale-95"
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                      Editar
                                    </button>
                                    <button
                                      id={`ventas-delete-${s.id}`}
                                      onClick={() => deleteSale(s.id)}
                                      title="Eliminar fila"
                                      className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10 transition-colors"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {detail.sales.length > 0 && (
                  <tfoot className="bg-secondary/60 border-t border-border text-xs">
                    <tr>
                      <td className="px-4 py-3 font-bold text-foreground" colSpan={4}>Total</td>
                      {ticketTypes.map((t) => (
                        <td key={t.id} className="px-4 py-3 text-center font-bold text-primary">
                          {detailTotals.items[t.id] || 0}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right font-bold text-success whitespace-nowrap">
                        Bs. {detailTotals.totalAmount.toLocaleString('es-BO')}
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">
                        {detail.sales.filter(s => s.delivered).length}/{detail.sales.length}
                      </td>
                      {isAdmin && <td />}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
