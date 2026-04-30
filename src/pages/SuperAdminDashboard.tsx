import { useState } from 'react';
import { Building2, Plus, Users, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ZoneTable } from '@/hooks/useSupabaseData';

type Tab = 'organizations' | 'approvals';

export default function SuperAdminDashboard() {
  const { userRole } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('organizations');
  
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '' });
  const [saving, setSaving] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [addingOwner, setAddingOwner] = useState(false);

  const { data: orgs, isLoading: orgsLoading } = useQuery({
    queryKey: ['all-organizations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('organizations').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: purchaseRequests, isLoading: requestsLoading } = useQuery({
    queryKey: ['super-admin-purchase-requests'],
    queryFn: async () => {
      // Get all pending requests
      const { data, error } = await supabase
        .from('purchase_requests' as any)
        .select('*, events!inner(title, organization_id)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Get profile info
      const uids = [...new Set((data || []).flatMap((r: any) => [r.user_id, r.rrpp_id]).filter(Boolean))];
      let pMap: any = {};
      if (uids.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, name, email').in('user_id', uids);
        pMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]));
      }

      const { data: allOrgs } = await supabase.from('organizations').select('id, name');
      const orgMap = Object.fromEntries((allOrgs || []).map((o: any) => [o.id, o.name]));

      return (data || []).map((r: any) => ({
        ...r,
        buyerProfile: r.user_id ? pMap[r.user_id] : null,
        rrppProfile: r.rrpp_id ? pMap[r.rrpp_id] : null,
        orgName: r.events.organization_id ? orgMap[r.events.organization_id] : 'Desconocida',
      }));
    },
    enabled: userRole === 'super_admin',
  });

  if (userRole !== 'super_admin') {
    return (
      <div className="text-center py-20 space-y-3">
        <Building2 className="h-12 w-12 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">Acceso restringido a Super Administradores</p>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!form.name || !form.slug) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('organizations').insert({
        name: form.name,
        slug: form.slug.toLowerCase().replace(/\s/g, '-'),
      });
      if (error) throw error;
      toast.success('Organización creada');
      setForm({ name: '', slug: '' });
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['all-organizations'] });
    } catch (err: any) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  const handleToggleAutomatedFreePass = async (id: string, current: boolean) => {
    try {
      const { error } = await supabase.from('organizations').update({ automated_free_pass: !current }).eq('id', id);
      if (error) throw error;
      toast.success('Configuración actualizada');
      queryClient.invalidateQueries({ queryKey: ['all-organizations'] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAddOwner = async () => {
    if (!ownerEmail || !selectedOrgId) return;
    setAddingOwner(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', ownerEmail.trim())
        .maybeSingle();
      if (!profile) { toast.error('Usuario no encontrado'); setAddingOwner(false); return; }

      const { data: existing } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', profile.user_id)
        .eq('role', 'admin')
        .maybeSingle();
      if (!existing) {
        await supabase.from('user_roles').upsert({ user_id: profile.user_id, role: 'admin' as any });
      }

      const { error } = await supabase.from('org_members').insert({
        organization_id: selectedOrgId,
        user_id: profile.user_id,
        role: 'owner' as any,
      });
      if (error) throw error;
      toast.success('Owner asignado a la organización');
      setOwnerEmail('');
      setSelectedOrgId(null);
    } catch (err: any) {
      toast.error(err.message);
    }
    setAddingOwner(false);
  };

  const handleApproveRequest = async (req: any) => {
    if (!confirm('¿Confirmas que recibiste el pago para aprobar esta compra?')) return;
    try {
      // 1. Update status
      const { error: updErr } = await supabase
        .from('purchase_requests' as any)
        .update({ status: 'approved' })
        .eq('id', req.id);

      if (updErr) throw updErr;

      // 2. Create or activate reservations
      const tts = req.ticket_types as any[];
      for (const tt of tts) {
        // Handle mesa quantity logic
        let finalQtyForMesa = tt.quantity;
        const isMesa = tt.type === 'mesa_vip' && tt.zone_table_id;

        if (isMesa) {
           const { data: zones } = await supabase.from('organization_zones').select('tables_data');
           const allTables = zones?.flatMap(z => z.tables_data as ZoneTable[]) || [];
           const table = allTables.find(t => t.id === tt.zone_table_id);
           if (table?.tickets_included) finalQtyForMesa = table.tickets_included;

           // ACTIVATE PENDING MESA
           const { data: existingPending } = await supabase
             .from('reservations')
             .select('id')
             .eq('event_id', req.event_id)
             .eq('table_id', tt.zone_table_id)
             .eq('status', 'pending')
             .maybeSingle();

           const { data: codeData } = await supabase.rpc('generate_ticket_code', { 
             prefix: req.events.title.substring(0, 3).toUpperCase() 
           });
           const code = codeData || `TKT-${Date.now()}`;

           if (existingPending) {
             await supabase.from('reservations').update({
               status: 'active',
               code: code,
               quantity: finalQtyForMesa,
               user_id: req.user_id,
               rrpp_id: req.rrpp_id
             }).eq('id', existingPending.id);
           } else {
             await supabase.from('reservations').insert({
               code,
               event_id: req.event_id,
               ticket_type_id: tt.ticket_type_id,
               user_id: req.user_id,
               rrpp_id: req.rrpp_id,
               guest_name: `Mesa - ${req.buyerProfile?.name || 'Cliente'}`,
               type: 'mesa_vip',
               quantity: finalQtyForMesa,
               table_id: tt.zone_table_id,
               status: 'active'
             });
           }
        } else {
          // NORMAL TICKETS: Generate one individual reservation per quantity
          for (let i = 0; i < tt.quantity; i++) {
            const { data: codeData } = await supabase.rpc('generate_ticket_code', { 
              prefix: req.events.title.substring(0, 3).toUpperCase() 
            });
            const code = codeData || `TKT-${Date.now()}-${i}`;

            await supabase.from('reservations').insert({
              code,
              event_id: req.event_id,
              ticket_type_id: tt.ticket_type_id,
              user_id: req.user_id,
              rrpp_id: req.rrpp_id,
              guest_name: req.buyerProfile?.name || 'Cliente',
              type: tt.type,
              quantity: 1, // Individual ticket
              status: 'active'
            });
          }
        }
      }

      // 3. Delete the request
      await supabase.from('purchase_requests' as any).delete().eq('id', req.id);

      toast.success('Pago aprobado y entradas generadas');
      queryClient.invalidateQueries({ queryKey: ['super-admin-purchase-requests'] });
    } catch (err: any) {
      toast.error(err.message || 'Error al aprobar');
    }
  };

  const handleRejectRequest = async (id: string) => {
    if (!confirm('¿Estás seguro de RECHAZAR y eliminar esta solicitud de compra?')) return;
    try {
      const { data, error } = await supabase
        .from('purchase_requests' as any)
        .delete()
        .eq('id', id)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error('No se pudo rechazar la solicitud. Verifica tus permisos de administrador.');
      }

      toast.success('Solicitud rechazada');
      queryClient.invalidateQueries({ queryKey: ['super-admin-purchase-requests'] });
    } catch (err: any) {
      toast.error(err.message || 'Error al rechazar');
    }
  };

  if (orgsLoading || requestsLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-4xl mx-auto">
      <div>
        <div className="flex items-center gap-2 text-sm text-primary font-semibold mb-1"><Building2 className="h-4 w-4" />Super Admin</div>
        <h1 className="text-2xl font-black text-foreground">Control Central</h1>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setTab('organizations')} className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all touch-target ${tab === 'organizations' ? 'bg-primary text-primary-foreground shadow-glow' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
          <Building2 className="h-4 w-4" /> Organizaciones
        </button>
        <button onClick={() => setTab('approvals')} className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all touch-target ${tab === 'approvals' ? 'bg-primary text-primary-foreground shadow-glow' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
          <CheckCircle className="h-4 w-4" /> Aprobaciones
          {purchaseRequests?.length ? (
             <span className="ml-1 rounded-full bg-destructive w-5 h-5 flex items-center justify-center text-[10px] text-destructive-foreground">
               {purchaseRequests.length}
             </span>
          ) : null}
        </button>
      </div>

      {tab === 'organizations' && (
        <div className="space-y-6">
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:shadow-glow active:scale-[0.98]">
            <Plus className="h-4 w-4" /> Nueva Discoteca
          </button>

          {showForm && (
            <div className="glass-card p-4 space-y-3">
              <input placeholder="Nombre de la discoteca" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary" />
              <input placeholder="Slug (ej: forum-club)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary" />
              <button onClick={handleCreate} disabled={saving || !form.name || !form.slug} className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40">
                {saving ? 'Creando...' : 'Crear Organización'}
              </button>
            </div>
          )}

          {/* Assign owner to org */}
          <div className="glass-card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Asignar Owner a Discoteca</h3>
            <input type="email" placeholder="Email del owner" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary" />
            <select value={selectedOrgId || ''} onChange={(e) => setSelectedOrgId(e.target.value || null)} className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground ring-1 ring-border">
              <option value="">Seleccionar discoteca</option>
              {orgs?.map((org: any) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
            <button onClick={handleAddOwner} disabled={addingOwner || !ownerEmail || !selectedOrgId} className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40">
              {addingOwner ? 'Asignando...' : 'Asignar Owner'}
            </button>
          </div>

          {/* Org list */}
          <div className="space-y-3">
            {orgs?.map((org: any) => (
              <div key={org.id} className="glass-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{org.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{org.slug}</p>
                    <div className="mt-2 flex items-center gap-4">
                       <label className="flex items-center gap-2 cursor-pointer group">
                         <div 
                           onClick={() => handleToggleAutomatedFreePass(org.id, org.automated_free_pass)}
                           className={`w-10 h-5 rounded-full p-1 transition-colors duration-200 ease-in-out ${org.automated_free_pass ? 'bg-primary' : 'bg-muted'}`}
                         >
                           <div className={`w-3 h-3 bg-white rounded-full transition-transform duration-200 ease-in-out ${org.automated_free_pass ? 'translate-x-5' : 'translate-x-0'}`} />
                         </div>
                         <span className="text-[10px] font-bold text-muted-foreground uppercase group-hover:text-primary transition-colors">Free Pass Automático</span>
                       </label>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground block">{new Date(org.created_at).toLocaleDateString('es-BO')}</span>
                  </div>
                </div>
              </div>
            ))}
            {(!orgs || orgs.length === 0) && (
              <div className="glass-card p-6 text-center text-muted-foreground text-sm">
                No hay organizaciones creadas
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'approvals' && (
        <div className="space-y-4">
          <div className="glass-card p-4 space-y-3">
             <h3 className="text-sm font-semibold text-foreground">Aprobaciones Globales</h3>
             {purchaseRequests?.length === 0 ? (
               <p className="text-sm text-muted-foreground text-center py-4">No hay pagos pendientes por verificar en la plataforma.</p>
             ) : (
               <div className="space-y-3">
                 {purchaseRequests?.map((r: any) => {
                    const isRRPP = !!r.rrpp_id;
                    const profileName = isRRPP ? (r.rrppProfile?.name || 'RRPP') : (r.buyerProfile?.name || 'Cliente');
                    const profileEmail = isRRPP ? (r.rrppProfile?.email || '') : (r.buyerProfile?.email || '');
                    return (
                      <div key={r.id} className="rounded-xl bg-secondary p-4 space-y-3 relative overflow-hidden">
                        <div className="flex justify-between items-start">
                           <div>
                             <p className="font-semibold text-foreground text-base">Bs. {r.total_amount}</p>
                             <p className="text-xs text-muted-foreground">Solicitado por: <span className="font-medium text-foreground">{profileName}</span></p>
                             <p className="text-xs text-muted-foreground">Email: {profileEmail}</p>
                             <p className="text-xs text-muted-foreground border-t border-border mt-1 pt-1">
                               Discoteca: <span className="font-bold text-primary">{r.orgName}</span>
                             </p>
                             <p className="text-xs text-muted-foreground">Evento: <span className="font-medium">{r.events.title}</span></p>
                           </div>
                           <span className="bg-warning/20 text-warning px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                             Pendiente
                           </span>
                        </div>
                        <div className="bg-background/50 rounded-lg p-2 space-y-1 ring-1 ring-border">
                           <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Detalle del Pedido:</p>
                           {r.ticket_types.map((tt: any, i: number) => (
                             <p key={i} className="text-sm text-foreground">• {tt.quantity}x {tt.name} (Bs. {tt.price} c/u)</p>
                           ))}
                        </div>
                        <div className="flex items-center gap-2 pt-1 border-t border-border mt-2">
                          <button onClick={() => handleApproveRequest(r)} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:shadow-glow transition-all active:scale-[0.98]">
                            Aprobar
                          </button>
                          <button onClick={() => handleRejectRequest(r.id)} className="flex-1 rounded-xl bg-destructive/10 text-destructive py-2.5 text-sm font-semibold hover:bg-destructive/20 transition-all active:scale-[0.98]">
                            Rechazar
                          </button>
                        </div>
                      </div>
                    );
                 })}
               </div>
             )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
